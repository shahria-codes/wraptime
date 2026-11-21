import React, { useState, useRef, useEffect } from 'react';
import { useNotifications, formatSingleName } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import {
  Bell,
  CheckCircle2,
  XCircle,
  X,
  CheckCheck,
  ArrowLeftRight,
  Clock,
  Trash2,
  Palmtree,
  CalendarDays
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';

export const NotificationCenter = () => {
  const { userProfile } = useAuth();
  const {
    notifications,
    unreadCount,
    handleApproveUser,
    handleRejectUser,
    handleApproveSwap,
    handleRejectSwap,
    handleCancelSwap,
    handleApproveVacation,
    handleRejectVacation,
    handleCancelVacation,
    markAllAsRead,
    dismissNotification
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const panelRef = useRef(null);

  const myUid = userProfile?.uid;

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const onApproveUser = async (userId, notifId, e) => {
    e.stopPropagation();
    setProcessingId(userId);
    try {
      await handleApproveUser(userId, notifId);
    } finally {
      setProcessingId(null);
    }
  };

  const onRejectUser = async (userId, notifId, e) => {
    e.stopPropagation();
    setProcessingId(userId);
    try {
      await handleRejectUser(userId, notifId);
    } finally {
      setProcessingId(null);
    }
  };

  const onApproveSwap = async (item, e) => {
    e.stopPropagation();
    setProcessingId(item.id);
    try {
      await handleApproveSwap(item);
    } finally {
      setProcessingId(null);
    }
  };

  const onRejectSwap = async (item, e) => {
    e.stopPropagation();
    setProcessingId(item.id);
    try {
      await handleRejectSwap(item);
    } finally {
      setProcessingId(null);
    }
  };

  const onCancelSwap = async (item, e) => {
    e.stopPropagation();
    setProcessingId(item.id);
    try {
      await handleCancelSwap(item.id);
    } finally {
      setProcessingId(null);
    }
  };

  const onApproveVacation = async (item, e) => {
    e.stopPropagation();
    setProcessingId(item.id);
    try {
      await handleApproveVacation(item);
    } finally {
      setProcessingId(null);
    }
  };

  const onRejectVacation = async (item, e) => {
    e.stopPropagation();
    setProcessingId(item.id);
    try {
      await handleRejectVacation(item);
    } finally {
      setProcessingId(null);
    }
  };

  const onCancelVacation = async (item, e) => {
    e.stopPropagation();
    setProcessingId(item.id);
    try {
      await handleCancelVacation(item.vacationId, item.id);
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return 'Recently';
    try {
      return formatDistanceToNow(parseISO(isoString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const formatFriendlyDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'EEE, MMM d');
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* ── Bell Icon Button ── */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            markAllAsRead();
          }
        }}
        title="Notifications"
        style={{
          background: isOpen ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.05)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '0.45rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          color: isOpen ? 'var(--primary)' : unreadCount > 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
          transition: 'all 0.2s ease'
        }}
      >
        <Bell size={18} />

        {/* Unread badge with glowing pulse */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: '#EF4444',
              color: '#FFFFFF',
              borderRadius: '999px',
              minWidth: '17px',
              height: '17px',
              padding: '0 4px',
              fontSize: '0.62rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.7)',
              border: '2px solid #080E1E'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ── */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '370px',
            maxWidth: '92vw',
            background: 'rgba(11, 19, 38, 0.97)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.75), 0 0 20px rgba(245, 158, 11, 0.12)',
            zIndex: 10000,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.02)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#FFFFFF' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: 'var(--accent-gold)',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '99px'
                  }}
                >
                  {unreadCount} New
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  <CheckCheck size={13} />
                  <span>Mark read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div
            style={{
              maxHeight: '420px',
              overflowY: 'auto',
              padding: '0.5rem'
            }}
          >
            {notifications.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2.5rem 1rem',
                  color: 'var(--text-muted)'
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                    color: 'var(--text-subtle)'
                  }}
                >
                  <Bell size={20} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  No Notifications
                </div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.25rem' }}>
                  You are all caught up!
                </div>
              </div>
            ) : (
              notifications.map((item) => {
                const isProcessing = processingId === item.id || processingId === item.targetUserId;

                // ── Case A: Shift Swap Request ──
                if (item.type === 'SHIFT_SWAP_REQUEST') {
                  const isRecipient = item.recipientUid === myUid;
                  const isRequester = item.requesterUid === myUid;
                  const isPending = item.status === 'pending';
                  const isApproved = item.status === 'approved';
                  const isRejected = item.status === 'rejected';

                  const requesterSingle = item.requesterSingleName || formatSingleName(item.requesterName);
                  const recipientSingle = item.recipientSingleName || formatSingleName(item.recipientName);

                  const preferDateText = formatFriendlyDate(item.targetShiftDate);
                  const scheduleDateText = formatFriendlyDate(item.requesterShiftDate);

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: isPending && isRecipient
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                          : 'rgba(255, 255, 255, 0.02)',
                        border: isPending && isRecipient
                          ? '1px solid rgba(245, 158, 11, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '12px',
                        padding: '0.75rem 0.85rem',
                        marginBottom: '0.5rem',
                        transition: 'all 0.15s ease',
                        boxShadow: isPending && isRecipient ? '0 4px 16px rgba(245, 158, 11, 0.15)' : 'none'
                      }}
                    >
                      {/* Top Row: Requester Avatar + Header + Relative Time */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <UserAvatar
                            photoURL={isRecipient ? item.requesterPhotoURL : item.recipientPhotoURL}
                            displayName={isRecipient ? item.requesterName : item.recipientName}
                            size={36}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              background: '#F59E0B',
                              color: '#0F172A',
                              borderRadius: '50%',
                              width: 15,
                              height: 15,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1.5px solid #080E1E'
                            }}
                          >
                            <ArrowLeftRight size={9} strokeWidth={2.5} />
                          </div>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: '0.84rem',
                                color: '#FFFFFF',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {isRecipient ? requesterSingle : recipientSingle}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {formatTime(item.createdAt)}
                            </span>
                          </div>

                          {/* Correct and Compact Notification Text */}
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: '#E2E8F0',
                              marginTop: '3px',
                              lineHeight: 1.35
                            }}
                          >
                            {isRecipient ? (
                              <>
                                <strong style={{ color: 'var(--accent-gold)' }}>{requesterSingle}</strong> wants to work on{' '}
                                <strong style={{ color: '#38BDF8' }}>{preferDateText}</strong>, and let you work on{' '}
                                <strong style={{ color: '#34D399' }}>{scheduleDateText}</strong>.
                              </>
                            ) : (
                              <>
                                You asked <strong style={{ color: 'var(--accent-gold)' }}>{recipientSingle}</strong> to work on{' '}
                                <strong style={{ color: '#38BDF8' }}>{preferDateText}</strong>, and take your shift on{' '}
                                <strong style={{ color: '#34D399' }}>{scheduleDateText}</strong>.
                              </>
                            )}
                          </div>

                          {/* Shift Comparison Badges */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              marginTop: '6px',
                              fontSize: '0.67rem',
                              flexWrap: 'wrap'
                            }}
                          >
                            <span
                              style={{
                                background: 'rgba(52, 211, 153, 0.12)',
                                border: '1px solid rgba(52, 211, 153, 0.3)',
                                color: '#34D399',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                fontWeight: 700
                              }}
                            >
                              📍 {item.requesterShiftBranch} • {scheduleDateText}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>⇄</span>
                            <span
                              style={{
                                background: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: '#38BDF8',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                fontWeight: 700
                              }}
                            >
                              📍 {item.targetShiftBranch} • {preferDateText}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.45rem' }}>
                        {isRecipient && isPending ? (
                          <>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={(e) => onRejectSwap(item, e)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#F87171',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '8px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <XCircle size={13} />
                              <span>Reject</span>
                            </button>

                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={(e) => onApproveSwap(item, e)}
                              style={{
                                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                border: 'none',
                                color: '#FFFFFF',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '8px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <CheckCircle2 size={13} />
                              <span>{isProcessing ? 'Processing…' : 'Approve'}</span>
                            </button>
                          </>
                        ) : isRequester && isPending ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: 'var(--accent-gold)'
                              }}
                            >
                              <Clock size={12} /> Waiting for {recipientSingle}
                            </span>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={(e) => onCancelSwap(item, e)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#F87171',
                                cursor: 'pointer',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <Trash2 size={11} /> Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: isApproved ? 'var(--success)' : '#F87171'
                              }}
                            >
                              {isApproved ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {isApproved ? 'Schedule Exchanged' : 'Exchange Rejected'}
                            </span>

                            <button
                              type="button"
                              onClick={() => dismissNotification(item.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-subtle)',
                                cursor: 'pointer',
                                fontSize: '0.65rem'
                              }}
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── Case B: Shift Swap Resolved ──
                if (item.type === 'SHIFT_SWAP_RESOLVED') {
                  const isApproved = item.status === 'approved';
                  const actorSingle = item.actorSingleName || formatSingleName(item.actorName);
                  const preferDateText = formatFriendlyDate(item.targetShiftDate);

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: isApproved ? 'rgba(52, 211, 153, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        border: isApproved ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '0.75rem 0.85rem',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                        <UserAvatar
                          photoURL={item.actorPhotoURL}
                          displayName={item.actorName}
                          size={34}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#FFFFFF' }}>
                              {item.title || 'Schedule Exchange Update'}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {formatTime(item.createdAt)}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.76rem', color: '#E2E8F0', marginTop: '3px', lineHeight: 1.35 }}>
                            {isApproved ? (
                              <>
                                <strong style={{ color: 'var(--accent-gold)' }}>{actorSingle}</strong> approved your exchange:{' '}
                                you are now scheduled on <strong style={{ color: '#34D399' }}>{preferDateText}</strong>.
                              </>
                            ) : (
                              <>
                                <strong style={{ color: 'var(--accent-gold)' }}>{actorSingle}</strong> declined your schedule exchange request for{' '}
                                <strong style={{ color: '#F87171' }}>{preferDateText}</strong>.
                              </>
                            )}
                          </div>

                          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => dismissNotification(item.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-subtle)',
                                cursor: 'pointer',
                                fontSize: '0.65rem'
                              }}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── Case C: Vacation Request (Only Designated Branch Manager or Requester) ──
                if (item.type === 'VACATION_REQUEST') {
                  const isRequester = item.requesterUid === myUid;
                  const isPending = item.status === 'pending';
                  const isApproved = item.status === 'approved';
                  const isRejected = item.status === 'rejected';

                  const requesterSingle = item.requesterSingleName || formatSingleName(item.requesterName);
                  const startFriendly = formatFriendlyDate(item.startDate);
                  const endFriendly = formatFriendlyDate(item.endDate);

                  let daysCount = 1;
                  try {
                    const s = parseISO(item.startDate);
                    const e = parseISO(item.endDate);
                    daysCount = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                  } catch (_) {}

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: isPending && !isRequester
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                          : 'rgba(255, 255, 255, 0.02)',
                        border: isPending && !isRequester
                          ? '1px solid rgba(245, 158, 11, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '12px',
                        padding: '0.75rem 0.85rem',
                        marginBottom: '0.5rem',
                        transition: 'all 0.15s ease',
                        boxShadow: isPending && !isRequester ? '0 4px 16px rgba(245, 158, 11, 0.15)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <UserAvatar
                            photoURL={item.requesterPhotoURL}
                            displayName={item.requesterName}
                            size={36}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              background: '#F59E0B',
                              color: '#0F172A',
                              borderRadius: '50%',
                              width: 15,
                              height: 15,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1.5px solid #080E1E'
                            }}
                          >
                            <Palmtree size={9} strokeWidth={2.5} />
                          </div>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#FFFFFF' }}>
                              {isRequester ? 'Your Vacation Request' : requesterSingle}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {formatTime(item.createdAt)}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: '#E2E8F0', marginTop: '3px', lineHeight: 1.35 }}>
                            {isRequester ? (
                              <>
                                You requested <strong style={{ color: 'var(--accent-gold)' }}>{daysCount} {daysCount === 1 ? 'day' : 'days'}</strong> off from{' '}
                                <strong style={{ color: '#38BDF8' }}>{startFriendly}</strong> to <strong style={{ color: '#38BDF8' }}>{endFriendly}</strong>.
                              </>
                            ) : (
                              <>
                                <strong style={{ color: 'var(--accent-gold)' }}>{requesterSingle}</strong> requested{' '}
                                <strong style={{ color: 'var(--accent-gold)' }}>{daysCount} {daysCount === 1 ? 'day' : 'days'}</strong> off from{' '}
                                <strong style={{ color: '#38BDF8' }}>{startFriendly}</strong> to <strong style={{ color: '#38BDF8' }}>{endFriendly}</strong>.
                              </>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '5px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                color: 'var(--accent-gold)',
                                fontSize: '0.67rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '6px'
                              }}
                            >
                              📍 {item.branch}
                            </span>
                            <span
                              style={{
                                background: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: '#38BDF8',
                                fontSize: '0.67rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '6px'
                              }}
                            >
                              🏖️ {daysCount} Days
                            </span>
                          </div>

                          {item.reason && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                              "{item.reason}"
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Row */}
                      <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.45rem' }}>
                        {!isRequester && isPending ? (
                          <>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={(e) => onRejectVacation(item, e)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#F87171',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '8px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <XCircle size={13} />
                              <span>Reject</span>
                            </button>

                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={(e) => onApproveVacation(item, e)}
                              style={{
                                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                border: 'none',
                                color: '#FFFFFF',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '8px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <CheckCircle2 size={13} />
                              <span>{isProcessing ? 'Processing…' : 'Approve Vacation'}</span>
                            </button>
                          </>
                        ) : isRequester && isPending ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: 'var(--accent-gold)'
                              }}
                            >
                              <Clock size={12} /> Pending branch manager review
                            </span>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={(e) => onCancelVacation(item, e)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#F87171',
                                cursor: 'pointer',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <Trash2 size={11} /> Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: isApproved ? 'var(--success)' : '#F87171'
                              }}
                            >
                              {isApproved ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {isApproved ? 'Vacation Approved' : 'Vacation Declined'}
                            </span>

                            <button
                              type="button"
                              onClick={() => dismissNotification(item.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-subtle)',
                                cursor: 'pointer',
                                fontSize: '0.65rem'
                              }}
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── Case D: Vacation Request Resolved ──
                if (item.type === 'VACATION_RESOLVED') {
                  const isApproved = item.status === 'approved';
                  const actorSingle = item.actorSingleName || formatSingleName(item.actorName);
                  const startFriendly = formatFriendlyDate(item.startDate);
                  const endFriendly = formatFriendlyDate(item.endDate);

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: isApproved ? 'rgba(52, 211, 153, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        border: isApproved ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '0.75rem 0.85rem',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                        <UserAvatar
                          photoURL={item.actorPhotoURL}
                          displayName={item.actorName}
                          size={34}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#FFFFFF' }}>
                              {item.title || 'Vacation Request Update'}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {formatTime(item.createdAt)}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.76rem', color: '#E2E8F0', marginTop: '3px', lineHeight: 1.35 }}>
                            {isApproved ? (
                              <>
                                <strong style={{ color: 'var(--accent-gold)' }}>{actorSingle}</strong> approved your vacation from{' '}
                                <strong style={{ color: '#34D399' }}>{startFriendly}</strong> to <strong style={{ color: '#34D399' }}>{endFriendly}</strong> at 📍 {item.branch}!
                              </>
                            ) : (
                              <>
                                <strong style={{ color: 'var(--accent-gold)' }}>{actorSingle}</strong> declined your vacation request from{' '}
                                <strong style={{ color: '#F87171' }}>{startFriendly}</strong> to <strong style={{ color: '#F87171' }}>{endFriendly}</strong>.
                              </>
                            )}
                          </div>

                          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => dismissNotification(item.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-subtle)',
                                cursor: 'pointer',
                                fontSize: '0.65rem'
                              }}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── Case E: New User Pending Approval (Manager) ──
                const isPending = item.status === 'pending';
                const isAuthorized = item.status === 'authorized';

                return (
                  <div
                    key={item.id}
                    style={{
                      background: isPending ? 'rgba(245, 158, 11, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                      border: isPending ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '0.7rem 0.8rem',
                      marginBottom: '0.45rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Top Row: User Avatar + Name + Time */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <UserAvatar
                        photoURL={item.userPhotoURL}
                        displayName={item.userName}
                        size={34}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.84rem',
                              color: '#FFFFFF',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {item.userName}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatTime(item.createdAt)}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginTop: '1px'
                          }}
                        >
                          {item.userEmail}
                        </div>

                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: isPending ? 'var(--accent-gold)' : 'var(--text-muted)',
                            marginTop: '4px',
                            fontWeight: isPending ? 600 : 400
                          }}
                        >
                          {isPending
                            ? 'Requested staff authorization'
                            : isAuthorized
                              ? 'Staff member approved'
                              : 'Registration rejected'}
                        </div>
                      </div>
                    </div>

                    {/* Action Row */}
                    <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={(e) => onRejectUser(item.targetUserId, item.id, e)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#F87171',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <XCircle size={13} />
                            <span>Reject</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={(e) => onApproveUser(item.targetUserId, item.id, e)}
                            style={{
                              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                              border: 'none',
                              color: '#FFFFFF',
                              padding: '0.35rem 0.85rem',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>{isProcessing ? 'Processing…' : 'Approve'}</span>
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: isAuthorized ? 'var(--success)' : '#F87171'
                            }}
                          >
                            {isAuthorized ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {isAuthorized ? 'Approved' : 'Rejected'}
                          </span>

                          <button
                            type="button"
                            onClick={() => dismissNotification(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-subtle)',
                              cursor: 'pointer',
                              fontSize: '0.65rem'
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};