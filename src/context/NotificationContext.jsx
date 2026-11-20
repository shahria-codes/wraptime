import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db, collection, doc, updateDoc, setDoc, deleteDoc, onSnapshot, query, orderBy } from '../firebase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const { showAlert } = useToast();
  const isManager = userProfile?.role === 'manager';

  const [notifications, setNotifications] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Listen to 'notifications' collection in real time
  useEffect(() => {
    if (!isManager) {
      setNotifications([]);
      setPendingUsers([]);
      setLoading(false);
      return;
    }

    const notifQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(list);
      setLoading(false);
    }, (err) => {
      console.warn("Notifications collection query error:", err);
      setLoading(false);
    });

    // 2. Also listen to 'users' collection to catch any pending user registrations
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const pending = [];
      snapshot.forEach(d => {
        const u = { id: d.id, uid: d.id, ...d.data() };
        if (u.status === 'pending' && u.role !== 'manager') {
          pending.push(u);
        }
      });
      setPendingUsers(pending);
    }, (err) => console.warn("Users query for notifications error:", err));

    return () => {
      unsubNotifs();
      unsubUsers();
    };
  }, [isManager]);

  // Combine notifications & pending users seamlessly
  const allNotifications = useMemo(() => {
    const map = new Map();

    // First add recorded notifications
    notifications.forEach(n => {
      map.set(n.targetUserId || n.id, n);
    });

    // Ensure every pending user has a visible notification item
    pendingUsers.forEach(u => {
      const existing = map.get(u.uid);
      if (!existing) {
        map.set(u.uid, {
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
      } else {
        // Keep status synchronized with user document
        map.set(u.uid, {
          ...existing,
          userName: u.displayName || existing.userName,
          userEmail: u.email || existing.userEmail,
          userPhotoURL: u.photoURL || existing.userPhotoURL,
          status: u.status
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Pending first, then newest first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [notifications, pendingUsers]);

  // Count unread or pending items
  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !n.read || n.status === 'pending').length;
  }, [allNotifications]);

  // Approve a user from notification
  const handleApproveUser = async (targetUserId, notifId) => {
    try {
      const now = new Date().toISOString();
      // 1. Update user document
      await updateDoc(doc(db, 'users', targetUserId), {
        status: 'authorized',
        updatedAt: now
      });

      // 2. Update notification if persistent doc exists
      if (notifId && !notifId.startsWith('pending-user-')) {
        await updateDoc(doc(db, 'notifications', notifId), {
          status: 'authorized',
          read: true,
          resolvedAt: now,
          updatedAt: now
        });
      } else {
        // Create/save resolved notification
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

  // Reject a user from notification
  const handleRejectUser = async (targetUserId, notifId) => {
    try {
      const now = new Date().toISOString();
      // 1. Update user document
      await updateDoc(doc(db, 'users', targetUserId), {
        status: 'rejected',
        updatedAt: now
      });

      // 2. Update notification if persistent doc exists
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
      const unread = notifications.filter(n => !n.read);
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
    handleApproveUser: () => {},
    handleRejectUser: () => {},
    markAllAsRead: () => {},
    dismissNotification: () => {}
  };
};
