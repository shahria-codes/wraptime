import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { db, collection, doc, updateDoc, setDoc, deleteDoc, onSnapshot, query, orderBy } from '../firebase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

export const formatSingleName = (displayName) => {
  if (!displayName) return 'Staff';
  const clean = String(displayName).trim();
  if (!clean) return 'Staff';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Staff';
  const first = parts[0];
  const lettersOnly = first.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length > 2) {
    return first;
  }
  return parts[1] || first || 'Staff';
};

// ── Device push helper ──────────────────────────────────────────
// Shows a native OS/browser notification via the Service Worker
// (PWA-compatible) with a plain Notification API fallback.
const pushDeviceNotif = async (title, body, icon = '/pwa-192x192.png') => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon,
        badge: '/pwa-192x192.png',
        tag: title,          // collapses duplicate notifications
        renotify: false,
        silent: false
      });
    } else {
      new Notification(title, { body, icon });
    }
  } catch (err) {
    // SW may not support showNotification in some browsers — fall back
    try { new Notification(title, { body, icon }); } catch (_) {}
  }
};

// ── Permission request helper ──────────────────────────────────
// Called once after sign-in. Resolves silently if already decided.
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
};

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const { showAlert } = useToast();
  const isManager = userProfile?.role === 'manager';
  const myUid = userProfile?.uid;

  const [rawNotifications, setRawNotifications] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Track IDs we've already shown a device notification for.
  // Using a ref so it survives re-renders without causing them.
  const seenIdsRef = useRef(null); // null = initial load (don't fire burst)

  // ── Request device notification permission once after sign-in ──
  useEffect(() => {
    if (!myUid) return;
    requestNotificationPermission().catch(() => {});
  }, [myUid]);

  // 1. Listen to 'notifications' collection in real time
  useEffect(() => {
    if (!myUid) {
      setRawNotifications([]);
      setPendingUsers([]);
      setLoading(false);
      return;
    }

    const notifQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago in ms
      const stale = [];
      const list = [];

      snapshot.docs.forEach(d => {
        const data = d.data();
        const createdMs = data.createdAt ? new Date(data.createdAt).getTime() : 0;
        if (createdMs > 0 && createdMs < cutoff) {
          stale.push(d.id);
        } else {
          list.push({ id: d.id, ...data });
        }
      });

      // Silently purge stale notifications (fire-and-forget, no UI impact)
      if (stale.length > 0) {
        stale.forEach(id => {
          deleteDoc(doc(db, 'notifications', id)).catch(() => {});
        });
      }

      // ── Device notification for newly arrived items ──
      // On first snapshot we just seed the seen-set without pushing anything
      // (avoids a burst of old notifications on page load).
      if (seenIdsRef.current === null) {
        seenIdsRef.current = new Set(list.map(n => n.id));
      } else {
        list.forEach(n => {
          if (seenIdsRef.current.has(n.id)) return; // already seen
          seenIdsRef.current.add(n.id);

          // Only push device notification for items addressed to ME
          const isForMe =
            n.recipientUid === myUid ||
            n.targetUserId === myUid ||
            (isManager && n.type === 'NEW_USER_PENDING' && n.status === 'pending');

          if (!isForMe) return;

          // Build human-readable title + body per type
          let title = 'WrapTime';
          let body  = 'You have a new notification.';

          if (n.type === 'SHIFT_SWAP_REQUEST') {
            const who = n.requesterSingleName || formatSingleName(n.requesterName) || 'A colleague';
            title = '⇄ Schedule Exchange Request';
            body  = `${who} wants to swap shifts with you.`;
          } else if (n.type === 'SHIFT_SWAP_RESOLVED') {
            const who = n.actorSingleName || formatSingleName(n.actorName) || 'Your colleague';
            title = n.status === 'approved'
              ? '✅ Exchange Approved'
              : '❌ Exchange Declined';
            body = n.status === 'approved'
              ? `${who} approved your schedule exchange.`
              : `${who} declined your schedule exchange request.`;
          } else if (n.type === 'NEW_USER_PENDING') {
            const who = n.userName || 'A new employee';
            title = '👤 New Staff Registration';
            body  = `${who} is waiting for your approval.`;
          }

          pushDeviceNotif(title, body);
        });
      }

      setRawNotifications(list);
      setLoading(false);
    }, (err) => {
      console.warn("Notifications collection query error:", err);
      setLoading(false);
    });

    // 2. If manager, also listen to 'users' collection to catch any pending user registrations
    let unsubUsers = () => {};
    if (isManager) {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const pending = [];
        snapshot.forEach(d => {
          const u = { id: d.id, uid: d.id, ...d.data() };
          if (u.status === 'pending' && u.role !== 'manager') {
            pending.push(u);
          }
        });
        setPendingUsers(pending);
      }, (err) => console.warn("Users query for notifications error:", err));
    } else {
      setPendingUsers([]);
    }

    return () => {
      unsubNotifs();
      unsubUsers();
      // Reset seen-IDs on unmount (user logout / uid change)
      seenIdsRef.current = null;
    };
  }, [myUid, isManager]);

  // Combine notifications & pending users seamlessly according to user role
  const allNotifications = useMemo(() => {
    if (!myUid) return [];

    const map = new Map();

    // Filter notifications relevant to current user:
    // - Managers see:
    //    1. Swap requests where they are recipient or requester, or any shift swap notification
    //    2. Standard system notifications
    // - Employees see:
    //    1. Swap requests where recipientUid === myUid or requesterUid === myUid
    //    2. Resolved swap notifications addressed to them (recipientUid === myUid)
    const userNotifs = rawNotifications.filter(n => {
      if (n.type === 'SHIFT_SWAP_REQUEST' || n.type === 'SHIFT_SWAP_RESOLVED') {
        return n.recipientUid === myUid || n.requesterUid === myUid || isManager;
      }
      if (isManager) return true;
      return n.recipientUid === myUid || n.targetUserId === myUid;
    });

    userNotifs.forEach(n => {
      map.set(n.id, n);
    });

    // Managers only: include pending user registrations
    if (isManager) {
      pendingUsers.forEach(u => {
        const existing = map.get(u.uid) || map.get(`pending-user-${u.uid}`);
        if (!existing) {
          map.set(`pending-user-${u.uid}`, {
            id: `pending-user-${u.uid}`,
            targetUserId: u.uid,
            type: 'NEW_USER_PENDING',
            title: 'New Staff Member Joined',
            message: `${u.displayName || 'A new user'} registered and is waiting for approval.`,
            userName: u.displayName || u.email?.split('@')[0] || 'New Employee',
            userEmail: u.email || '',
            userPhotoURL: u.photoURL || '',
            status: 'pending',
            read: false,
            createdAt: u.createdAt || new Date().toISOString()
          });
        }
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      // Pending actions first
      const aIsPendingAction = (a.status === 'pending' && (a.recipientUid === myUid || (isManager && a.type === 'NEW_USER_PENDING')));
      const bIsPendingAction = (b.status === 'pending' && (b.recipientUid === myUid || (isManager && b.type === 'NEW_USER_PENDING')));

      if (aIsPendingAction && !bIsPendingAction) return -1;
      if (!aIsPendingAction && bIsPendingAction) return 1;

      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [rawNotifications, pendingUsers, myUid, isManager]);

  // Count unread or pending items that require action from the current user
  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => {
      // If it's a swap request waiting for my approval
      if (n.type === 'SHIFT_SWAP_REQUEST') {
        if (n.recipientUid === myUid && n.status === 'pending') return true;
        return !n.read && n.recipientUid === myUid;
      }
      // If manager and pending user registration
      if (isManager && n.type === 'NEW_USER_PENDING' && n.status === 'pending') {
        return true;
      }
      // Resolved swap notification for requester that is unread
      if (n.type === 'SHIFT_SWAP_RESOLVED' && n.recipientUid === myUid && !n.read) {
        return true;
      }
      return !n.read;
    }).length;
  }, [allNotifications, myUid, isManager]);

  // ── 1. Shift Swap Request Creation ──
  const handleSendSwapRequest = async ({ myShift, targetShift, targetUser }) => {
    if (!myShift || !targetShift || !userProfile) {
      throw new Error('Missing shift information for swap request.');
    }

    try {
      const now = new Date().toISOString();
      const notifRef = doc(collection(db, 'notifications'));
      
      const payload = {
        id: notifRef.id,
        type: 'SHIFT_SWAP_REQUEST',
        status: 'pending',
        // Requester (who wants to swap)
        requesterUid: userProfile.uid,
        requesterName: userProfile.displayName || 'Colleague',
        requesterSingleName: formatSingleName(userProfile.displayName),
        requesterPhotoURL: userProfile.photoURL || '',
        requesterShiftId: myShift.id,
        requesterShiftDate: myShift.date, // HisScheduleDate
        requesterShiftHours: `${myShift.startTime || '09:00'} - ${myShift.endTime || '22:00'}`,
        requesterShiftBranch: myShift.branch || '',
        // Target / Recipient (the colleague who gets the request)
        recipientUid: targetShift.userId,
        recipientName: targetShift.userDisplayName || targetUser?.displayName || 'Colleague',
        recipientSingleName: formatSingleName(targetShift.userDisplayName || targetUser?.displayName),
        recipientPhotoURL: targetUser?.photoURL || targetShift.photoURL || '',
        targetShiftId: targetShift.id,
        targetShiftDate: targetShift.date, // HisPreferDate
        targetShiftHours: `${targetShift.startTime || '09:00'} - ${targetShift.endTime || '22:00'}`,
        targetShiftBranch: targetShift.branch || '',
        read: false,
        createdAt: now
      };

      await setDoc(notifRef, payload);
      showAlert(`Exchange request sent to ${formatSingleName(targetShift.userDisplayName || targetUser?.displayName)}!`, 'Request Sent', 'success');
      return notifRef.id;
    } catch (err) {
      console.error('Error sending swap request:', err);
      showAlert('Failed to send swap request. Please try again.', 'Error', 'error');
      throw err;
    }
  };

  // ── 2. Approve Shift Swap ──
  const handleApproveSwap = async (notif) => {
    try {
      const now = new Date().toISOString();

      // 1. Swap ownership of the two shifts in Firestore
      if (notif.requesterShiftId && notif.targetShiftId) {
        // Shift 1 (requester's original shift) is assigned to recipient
        await updateDoc(doc(db, 'shifts', notif.requesterShiftId), {
          userId: notif.recipientUid,
          userDisplayName: notif.recipientName,
          updatedAt: now
        });

        // Shift 2 (target's original shift) is assigned to requester
        await updateDoc(doc(db, 'shifts', notif.targetShiftId), {
          userId: notif.requesterUid,
          userDisplayName: notif.requesterName,
          updatedAt: now
        });
      }

      // 2. Mark swap request notification as approved
      await updateDoc(doc(db, 'notifications', notif.id), {
        status: 'approved',
        read: true,
        resolvedAt: now,
        updatedAt: now
      });

      // 3. Send resolution notification to the requester
      const resRef = doc(collection(db, 'notifications'));
      await setDoc(resRef, {
        id: resRef.id,
        type: 'SHIFT_SWAP_RESOLVED',
        status: 'approved',
        recipientUid: notif.requesterUid, // Delivered to original requester
        recipientName: notif.requesterName,
        actorUid: notif.recipientUid,
        actorName: notif.recipientName,
        actorSingleName: formatSingleName(notif.recipientName),
        actorPhotoURL: notif.recipientPhotoURL || userProfile?.photoURL || '',
        targetShiftDate: notif.targetShiftDate,
        requesterShiftDate: notif.requesterShiftDate,
        targetShiftBranch: notif.targetShiftBranch,
        requesterShiftBranch: notif.requesterShiftBranch,
        title: 'Schedule Exchange Approved',
        read: false,
        createdAt: now
      });

      showAlert('Shift exchange approved! Your schedules have been updated.', 'Exchange Approved', 'success');
    } catch (err) {
      console.error('Error approving shift swap:', err);
      showAlert('Failed to approve exchange. Please try again.', 'Error', 'error');
    }
  };

  // ── 3. Reject Shift Swap ──
  const handleRejectSwap = async (notif) => {
    try {
      const now = new Date().toISOString();

      // 1. Mark notification as rejected
      await updateDoc(doc(db, 'notifications', notif.id), {
        status: 'rejected',
        read: true,
        resolvedAt: now,
        updatedAt: now
      });

      // 2. Send resolution notification to the requester
      const resRef = doc(collection(db, 'notifications'));
      await setDoc(resRef, {
        id: resRef.id,
        type: 'SHIFT_SWAP_RESOLVED',
        status: 'rejected',
        recipientUid: notif.requesterUid,
        recipientName: notif.requesterName,
        actorUid: notif.recipientUid,
        actorName: notif.recipientName,
        actorSingleName: formatSingleName(notif.recipientName),
        actorPhotoURL: notif.recipientPhotoURL || userProfile?.photoURL || '',
        targetShiftDate: notif.targetShiftDate,
        requesterShiftDate: notif.requesterShiftDate,
        targetShiftBranch: notif.targetShiftBranch,
        requesterShiftBranch: notif.requesterShiftBranch,
        title: 'Schedule Exchange Declined',
        read: false,
        createdAt: now
      });

      showAlert('Shift exchange request declined.', 'Exchange Declined', 'info');
    } catch (err) {
      console.error('Error rejecting shift swap:', err);
      showAlert('Failed to decline exchange. Please try again.', 'Error', 'error');
    }
  };

  // ── 4. Cancel Pending Swap (Requester can cancel) ──
  const handleCancelSwap = async (notifId) => {
    try {
      await deleteDoc(doc(db, 'notifications', notifId));
      showAlert('Exchange request cancelled.', 'Request Cancelled', 'info');
    } catch (err) {
      console.error('Error cancelling swap:', err);
      showAlert('Failed to cancel request.', 'Error', 'error');
    }
  };

  // ── 5. User Registration Approval (Manager) ──
  const handleApproveUser = async (targetUserId, notifId) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', targetUserId), {
        status: 'authorized',
        updatedAt: now
      });

      if (notifId && !notifId.startsWith('pending-user-')) {
        await updateDoc(doc(db, 'notifications', notifId), {
          status: 'authorized',
          read: true,
          resolvedAt: now,
          updatedAt: now
        });
      } else {
        const ref = doc(db, 'notifications', `user-notif-${targetUserId}`);
        await setDoc(ref, {
          id: ref.id,
          targetUserId,
          type: 'NEW_USER_PENDING',
          title: 'Staff Member Authorized',
          status: 'authorized',
          read: true,
          resolvedAt: now,
          updatedAt: now,
          createdAt: now
        }, { merge: true });
      }

      showAlert('User has been authorized successfully and can now access the system.', 'User Approved', 'success');
    } catch (err) {
      console.error('Error approving user:', err);
      showAlert('Failed to approve user. Please try again.', 'Error', 'error');
    }
  };

  // ── 6. User Registration Rejection (Manager) ──
  const handleRejectUser = async (targetUserId, notifId) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', targetUserId), {
        status: 'rejected',
        updatedAt: now
      });

      if (notifId && !notifId.startsWith('pending-user-')) {
        await updateDoc(doc(db, 'notifications', notifId), {
          status: 'rejected',
          read: true,
          resolvedAt: now,
          updatedAt: now
        });
      } else {
        const ref = doc(db, 'notifications', `user-notif-${targetUserId}`);
        await setDoc(ref, {
          id: ref.id,
          targetUserId,
          type: 'NEW_USER_PENDING',
          title: 'Staff Member Rejected',
          status: 'rejected',
          read: true,
          resolvedAt: now,
          updatedAt: now,
          createdAt: now
        }, { merge: true });
      }

      showAlert('User registration has been rejected.', 'User Rejected', 'info');
    } catch (err) {
      console.error('Error rejecting user:', err);
      showAlert('Failed to reject user. Please try again.', 'Error', 'error');
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const unread = allNotifications.filter(n => !n.read && !n.id.startsWith('pending-user-'));
      await Promise.all(
        unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }))
      );
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  // Clear or dismiss a single notification
  const dismissNotification = async (notifId) => {
    if (!notifId || notifId.startsWith('pending-user-')) return;
    try {
      await deleteDoc(doc(db, 'notifications', notifId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications: allNotifications,
        unreadCount,
        loading,
        handleSendSwapRequest,
        handleApproveSwap,
        handleRejectSwap,
        handleCancelSwap,
        handleApproveUser,
        handleRejectUser,
        markAllAsRead,
        dismissNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  return context || {
    notifications: [],
    unreadCount: 0,
    loading: false,
    handleSendSwapRequest: async () => {},
    handleApproveSwap: async () => {},
    handleRejectSwap: async () => {},
    handleCancelSwap: async () => {},
    handleApproveUser: async () => {},
    handleRejectUser: async () => {},
    markAllAsRead: async () => {},
    dismissNotification: async () => {}
  };
};