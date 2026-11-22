import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications, formatSingleName } from '../context/NotificationContext';
import { UserAvatar } from './UserAvatar';
import {
  X,
  ArrowLeftRight,
  Calendar,
  Clock,
  MapPin,
  Check,
  Send,
  AlertCircle
} from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';

export const ShiftSwapModal = ({
  isOpen,
  onClose,
  initialShift = null,
  myUpcomingShifts = [],
  allShifts = [],
  employees = []
}) => {
  const { userProfile } = useAuth();
  const { handleSendSwapRequest, notifications = [], handleCancelSwap } = useNotifications();

  const myUid = userProfile?.uid;
  const myName = userProfile?.displayName || 'You';
  const mySingleName = formatSingleName(myName);

  // Selected shift of mine to give away
  const [selectedMyShiftId, setSelectedMyShiftId] = useState(null);
  // Selected colleague's shift to take
  const [selectedTargetShiftId, setSelectedTargetShiftId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterBranch, setFilterBranch] = useState('ALL');

  // Preselect initial shift when opened
  React.useEffect(() => {
    if (initialShift?.id) {
      setSelectedMyShiftId(initialShift.id);
    } else if (myUpcomingShifts.length > 0 && !selectedMyShiftId) {
      setSelectedMyShiftId(myUpcomingShifts[0].id);
    }
  }, [initialShift, myUpcomingShifts, isOpen]);

  // Clean selections on close
  const handleModalClose = () => {
    setSelectedTargetShiftId(null);
    setIsSubmitting(false);
    onClose();
  };

  // Map employees by UID
  const employeeMap = useMemo(() => {
    const map = {};
    employees.forEach(emp => {
      const id = emp.uid || emp.id;
      if (id) map[id] = emp;
    });
    return map;
  }, [employees]);

  // Active "My Shift"
  const currentMyShift = useMemo(() => {
    return myUpcomingShifts.find(s => s.id === selectedMyShiftId) || initialShift || myUpcomingShifts[0] || null;
  }, [myUpcomingShifts, selectedMyShiftId, initialShift]);

  // Check if current user already sent an active pending swap request for this shift
  const pendingSwapForCurrentShift = useMemo(() => {
    if (!currentMyShift?.id) return null;
    return notifications.find(n =>
      n.type === 'SHIFT_SWAP_REQUEST' &&
      n.status === 'pending' &&
      n.requesterUid === myUid &&
      n.requesterShiftId === currentMyShift.id
    );
  }, [notifications, myUid, currentMyShift]);

  // Eligible colleague shifts available for exchange
  const eligibleColleagueShifts = useMemo(() => {
    const today = startOfDay(new Date());

    return allShifts.filter(s => {
      // Must not be my own shift
      if (s.userId === myUid) return false;
      if (s.userDisplayName && userProfile?.displayName && s.userDisplayName.trim().toLowerCase() === userProfile.displayName.trim().toLowerCase()) {
        return false;
      }
      // Must not be completed
      if (s.status === 'completed') return false;
      // Must be today or future
      if (s.date) {
        try {
          const shiftDate = parseISO(s.date);
          if (isBefore(shiftDate, today)) return false;
        } catch {
          return false;
        }
      }
      // If branch filter applied
      if (filterBranch !== 'ALL' && s.branch !== filterBranch) return false;

      // ── PREVENT DOUBLE SHIFT CONFLICTS ON THE SAME DATE ──
      if (currentMyShift?.date) {
        // Case 1: Same day swap (changing branches on the same day)
        if (s.date === currentMyShift.date) {
          // Cannot swap with someone who is already at the same branch as me on that day
          if (s.branch === currentMyShift.branch) return false;
        } else {
          // Case 2: Different dates swap
          // 2a. Do I already have a shift on colleague's date (s.date)?
          const iAlreadyWorkOnColleagueDate = allShifts.some(myOther =>
            (myOther.userId === myUid || (myOther.userDisplayName && userProfile?.displayName && myOther.userDisplayName.trim().toLowerCase() === userProfile.displayName.trim().toLowerCase())) &&
            myOther.date === s.date &&
            myOther.id !== currentMyShift.id
          );
          if (iAlreadyWorkOnColleagueDate) return false;

          // 2b. Does colleague already have a shift on my shift's date (currentMyShift.date)?
          const colleagueAlreadyWorksOnMyDate = allShifts.some(colleagueOther =>
            (colleagueOther.userId === s.userId || (colleagueOther.userDisplayName && s.userDisplayName && colleagueOther.userDisplayName.trim().toLowerCase() === s.userDisplayName.trim().toLowerCase())) &&
            colleagueOther.date === currentMyShift.date &&
            colleagueOther.id !== s.id
          );
          if (colleagueAlreadyWorksOnMyDate) return false;
        }
      }

      return true;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [allShifts, myUid, userProfile, filterBranch, currentMyShift]);

  const selectedTargetShift = useMemo(() => {
    return eligibleColleagueShifts.find(s => s.id === selectedTargetShiftId) || null;
  }, [eligibleColleagueShifts, selectedTargetShiftId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentMyShift || !selectedTargetShift) return;

    setIsSubmitting(true);
    try {
      const targetUser = employeeMap[selectedTargetShift.userId] || {
        displayName: selectedTargetShift.userDisplayName,
        photoURL: selectedTargetShift.photoURL
      };

      await handleSendSwapRequest({
        myShift: currentMyShift,
        targetShift: selectedTargetShift,
        targetUser
      });

      handleModalClose();
    } catch (err) {
      console.error('Failed to submit exchange:', err);
    } finally {
      setIsSubmitting(false);
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

  const targetColleagueName = selectedTargetShift?.userDisplayName || 'Colleague';
  const targetColleagueSingle = formatSingleName(targetColleagueName);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 9, 20, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={handleModalClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '24px',
          padding: '1.75rem',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(245, 158, 11, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}
            >
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                Exchange Work Schedule
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Request to swap shifts with a colleague
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '0.4rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
          
          {/* Active Pending Swap Request Notice */}
          {pendingSwapForCurrentShift && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
                <Clock size={16} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.78rem', color: '#FFFFFF', lineHeight: 1.35 }}>
                  Exchange request sent to <strong style={{ color: 'var(--accent-gold)' }}>{pendingSwapForCurrentShift.recipientSingleName || formatSingleName(pendingSwapForCurrentShift.recipientName)}</strong> for {formatFriendlyDate(pendingSwapForCurrentShift.targetShiftDate)}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCancelSwap(pendingSwapForCurrentShift.id)}
                title="Cancel this exchange request"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#F87171',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                Cancel Request
              </button>
            </div>
          )}

          {/* Step 1: Your Scheduled Shift */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-gold)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Your Shift to Exchange (Your Schedule Date)
            </label>

            {myUpcomingShifts.length > 1 ? (
              <select
                className="form-select"
                value={currentMyShift?.id || ''}
                onChange={(e) => setSelectedMyShiftId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.85rem',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#FFFFFF',
                  marginBottom: '0.5rem'
                }}
              >
                {myUpcomingShifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {formatFriendlyDate(s.date)} • {s.startTime || '09:00'}-{s.endTime || '22:00'} at {s.branch}
                  </option>
                ))}
              </select>
            ) : null}

            {currentMyShift ? (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '14px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: 'var(--accent-gold)',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      textAlign: 'center'
                    }}
                  >
                    {formatFriendlyDate(currentMyShift.date)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={13} color="var(--primary)" /> {currentMyShift.branch}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={12} /> {currentMyShift.startTime || '09:00'} - {currentMyShift.endTime || '22:00'}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    background: 'rgba(52, 211, 153, 0.15)',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    color: '#34D399',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '8px'
                  }}
                >
                  Giving this away
                </span>
              </div>
            ) : (
              <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                You have no scheduled shifts to exchange.
              </div>
            )}
          </div>

          {/* Step 2: Select Colleague's Shift */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                2. Colleague's Shift to Take (Your Preferred Date)
              </label>

              {/* Branch quick filter */}
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'var(--text-muted)',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '6px'
                }}
              >
                <option value="ALL">All Branches</option>
                {Array.from(new Set(eligibleColleagueShifts.map(s => s.branch).filter(Boolean))).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {eligibleColleagueShifts.length === 0 ? (
              <div
                style={{
                  padding: '1.75rem 1rem',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  borderRadius: '14px',
                  color: 'var(--text-muted)'
                }}
              >
                <AlertCircle size={22} style={{ margin: '0 auto 0.4rem', opacity: 0.6 }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  No Available Shifts Found
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                  No colleagues currently have upcoming shifts available to swap with.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '220px', overflowY: 'auto' }}>
                {eligibleColleagueShifts.map(s => {
                  const isSelected = s.id === selectedTargetShiftId;
                  const emp = employeeMap[s.userId] || {};
                  const colleagueName = s.userDisplayName || emp.displayName || 'Colleague';
                  const colleaguePhoto = emp.photoURL || s.photoURL || '';

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedTargetShiftId(s.id)}
                      style={{
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(15, 23, 42, 0.85) 100%)'
                          : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected
                          ? '1.5px solid #38BDF8'
                          : '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '12px',
                        padding: '0.65rem 0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.65rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Left: Colleague info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <UserAvatar photoURL={colleaguePhoto} displayName={colleagueName} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formatSingleName(colleagueName)}
                            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({colleagueName})
                            </span>
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '1px' }}>
                            <span>📍 {s.branch}</span>
                            <span>•</span>
                            <span>{s.startTime || '09:00'} - {s.endTime || '22:00'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Date pill & select checkmark */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span
                          style={{
                            background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                            color: isSelected ? '#38BDF8' : 'var(--text-main)',
                            fontWeight: 800,
                            fontSize: '0.76rem',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {formatFriendlyDate(s.date)}
                        </span>

                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            border: isSelected ? '2px solid #38BDF8' : '1.5px solid rgba(255, 255, 255, 0.2)',
                            background: isSelected ? '#38BDF8' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0F172A'
                          }}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Notification Preview */}
          {selectedTargetShift && currentMyShift && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(56, 189, 248, 0.08) 100%)',
                border: '1px dashed rgba(245, 158, 11, 0.4)',
                borderRadius: '14px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem'
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                Notification preview for {targetColleagueSingle}:
              </div>
              <div style={{ fontSize: '0.82rem', color: '#FFFFFF', lineHeight: 1.4 }}>
                <strong style={{ color: 'var(--accent-gold)' }}>{mySingleName}</strong> wants to work on{' '}
                <strong style={{ color: '#38BDF8' }}>{formatFriendlyDate(selectedTargetShift.date)}</strong>, and let you work on{' '}
                <strong style={{ color: '#34D399' }}>{formatFriendlyDate(currentMyShift.date)}</strong>.
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}
        >
          <button
            type="button"
            onClick={handleModalClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--text-muted)',
              padding: '0.55rem 1.1rem',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!currentMyShift || !selectedTargetShift || isSubmitting || !!pendingSwapForCurrentShift}
            style={{
              background: !currentMyShift || !selectedTargetShift || !!pendingSwapForCurrentShift
                ? 'rgba(245, 158, 11, 0.3)'
                : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              border: 'none',
              color: '#0F172A',
              padding: '0.55rem 1.35rem',
              borderRadius: '10px',
              fontSize: '0.84rem',
              fontWeight: 900,
              cursor: !currentMyShift || !selectedTargetShift || isSubmitting || !!pendingSwapForCurrentShift ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: !currentMyShift || !selectedTargetShift || !!pendingSwapForCurrentShift ? 'none' : '0 4px 16px rgba(245, 158, 11, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <Send size={14} />
            <span>
              {isSubmitting
                ? 'Sending Request…'
                : pendingSwapForCurrentShift
                  ? 'Request Already Pending'
                  : 'Send Exchange Request'}
            </span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};