import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { UserAvatar } from './UserAvatar';
import {
  Bell,
  CheckCircle2,
  XCircle,
  X,
  CheckCheck
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

export const NotificationCenter = () => {
  const {
    notifications,
    unreadCount,
    handleApproveUser,
    handleRejectUser,
    markAllAsRead,
    dismissNotification
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const panelRef = useRef(null);

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

  const onApprove = async (userId, notifId, e) => {
    e.stopPropagation();
    setProcessingId(userId);
    try {
      await handleApproveUser(userId, notifId);
    } finally {
      setProcessingId(null);
    }
  };

  const onReject = async (userId, notifId, e) => {
    e.stopPropagation();
    setProcessingId(userId);
    try {
      await handleRejectUser(userId, notifId);
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
            width: '340px',
            maxWidth: '90vw',
            background: 'rgba(11, 19, 38, 0.96)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(245, 158, 11, 0.1)',
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
              maxHeight: '380px',
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
                const isPending = item.status === 'pending';
                const isAuthorized = item.status === 'authorized';
                const isProcessing = processingId === item.targetUserId;

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
                            onClick={(e) => onReject(item.targetUserId, item.id, e)}
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
                            onClick={(e) => onApprove(item.targetUserId, item.id, e)}
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
