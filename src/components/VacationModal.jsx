import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotifications, formatSingleName } from '../context/NotificationContext';
import { useBranches, isJakariaBranch } from '../context/BranchContext';
import { db, collection, query, where, onSnapshot } from '../firebase';
import {
  X,
  Palmtree,
  Calendar,
  Send,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { format, parseISO, addDays, addMonths, startOfMonth, isBefore, startOfDay } from 'date-fns';

export const VacationModal = ({ isOpen, onClose }) => {
  const { userProfile } = useAuth();
  const { showAlert } = useToast();
  const { branchNames } = useBranches();
  const { handleSendVacationRequest, handleCancelVacation } = useNotifications();

  const myUid = userProfile?.uid;
  const defaultUserBranch = userProfile?.defaultBranch || userProfile?.assignedBranch || branchNames[0] || '';

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  // Month date computations
  const now = useMemo(() => new Date(), []);
  const nextMonthDate = useMemo(() => addMonths(now, 1), [now]);
  const monthAfterNextDate = useMemo(() => addMonths(now, 2), [now]);

  const nextMonthStr = useMemo(() => format(nextMonthDate, 'yyyy-MM'), [nextMonthDate]);
  const nextMonthName = useMemo(() => format(nextMonthDate, 'MMMM yyyy'), [nextMonthDate]);

  const monthAfterNextStr = useMemo(() => format(monthAfterNextDate, 'yyyy-MM'), [monthAfterNextDate]);
  const monthAfterNextName = useMemo(() => format(monthAfterNextDate, 'MMMM yyyy'), [monthAfterNextDate]);

  const firstDayNextMonth = useMemo(() => format(startOfMonth(nextMonthDate), 'yyyy-MM-dd'), [nextMonthDate]);
  const firstDayAfterNextMonth = useMemo(() => format(startOfMonth(monthAfterNextDate), 'yyyy-MM-dd'), [monthAfterNextDate]);

  const [shifts, setShifts] = useState([]);
  const [branch, setBranch] = useState(defaultUserBranch);
  const [startDate, setStartDate] = useState(firstDayNextMonth);
  const [endDate, setEndDate] = useState(firstDayNextMonth);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myVacations, setMyVacations] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (defaultUserBranch && !branch) {
      setBranch(defaultUserBranch);
    }
  }, [defaultUserBranch, branch]);

  // Listen to all shifts in real time to check whether the manager has started scheduling
  useEffect(() => {
    if (!isOpen) return;

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setShifts(list);
    }, (err) => console.warn('Shifts query error in VacationModal:', err));

    return () => unsubShifts();
  }, [isOpen]);

  // Check whether the manager already started ANY schedule for next month for this branch
  const isNextMonthScheduled = useMemo(() => {
    return shifts.some(s => {
      if (!s.date || !s.date.startsWith(nextMonthStr)) return false;
      if (branch && s.branch && s.branch.trim().toLowerCase() !== branch.trim().toLowerCase()) return false;
      return true;
    });
  }, [shifts, nextMonthStr, branch]);

  // Minimum allowed date:
  // Vacation requests cannot be made for the current month (current schedule is active).
  // - If manager already started scheduling next month -> earliest allowed is month after next (firstDayAfterNextMonth).
  // - If manager has not started next month schedule yet -> earliest allowed is first day of next month (firstDayNextMonth).
  const minAllowedStartDate = useMemo(() => {
    if (isNextMonthScheduled) {
      return firstDayAfterNextMonth;
    }
    return firstDayNextMonth;
  }, [isNextMonthScheduled, firstDayAfterNextMonth, firstDayNextMonth]);

  // Auto-align dates when branch or scheduling status changes
  useEffect(() => {
    if (isNextMonthScheduled) {
      if (!startDate || startDate < firstDayAfterNextMonth) {
        setStartDate(firstDayAfterNextMonth);
        setEndDate(firstDayAfterNextMonth);
      }
    } else {
      if (!startDate || startDate < firstDayNextMonth) {
        setStartDate(firstDayNextMonth);
        setEndDate(firstDayNextMonth);
      }
    }
  }, [isNextMonthScheduled, firstDayAfterNextMonth, firstDayNextMonth]);

  // Listen to my own vacation requests in real time
  useEffect(() => {
    if (!myUid || !isOpen) return;

    const q = query(collection(db, 'vacations'), where('userId', '==', myUid));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setMyVacations(list);
    }, (err) => console.warn('Vacations query error:', err));

    return () => unsub();
  }, [myUid, isOpen]);

  // Designated Manager based on selected branch
  const designatedManagerName = useMemo(() => {
    if (!branch) return 'Branch Manager';
    return isJakariaBranch(branch) ? 'Md Jakaria Mashud Shahria' : 'Nur Ullah Mehmud';
  }, [branch]);

  const daysCount = useMemo(() => {
    if (!startDate || !endDate) return 1;
    try {
      const s = parseISO(startDate);
      const e = parseISO(endDate);
      const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  }, [startDate, endDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate || !branch) return;

    if (endDate < startDate) {
      showAlert('End date cannot be earlier than start date.', 'Invalid Dates', 'warning');
      return;
    }

    // Current month restriction:
    if (startDate < firstDayNextMonth) {
      showAlert(
        `Vacation requests cannot be submitted for the current month (${format(new Date(), 'MMMM yyyy')}). You can only request vacation starting from ${nextMonthName} (${firstDayNextMonth}) onwards.`,
        'Current Month Restricted',
        'warning'
      );
      return;
    }

    // Strict validation: if manager already started next month's schedule, block selection in next month
    if (isNextMonthScheduled && startDate < firstDayAfterNextMonth) {
      showAlert(
        `The branch manager has already started scheduling for ${nextMonthName}. Next month is locked for vacation requests. Please select dates from ${monthAfterNextName} (${firstDayAfterNextMonth}) onwards.`,
        'Schedule Already Started',
        'warning'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await handleSendVacationRequest({
        startDate,
        endDate,
        branch,
        reason: reason.trim()
      });
      setReason('');
    } catch (err) {
      console.error('Failed to request vacation:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onCancel = async (vacation) => {
    setCancellingId(vacation.id);
    try {
      await handleCancelVacation(vacation.id, null);
    } finally {
      setCancellingId(null);
    }
  };

  const formatFriendlyDate = (dStr) => {
    if (!dStr) return '';
    try {
      return format(parseISO(dStr), 'EEE, MMM d, yyyy');
    } catch {
      return dStr;
    }
  };

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
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          background: 'rgba(15, 23, 42, 0.96)',
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
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}
            >
              <Palmtree size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#FFFFFF' }}>
                Request Vacation / Leave
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Notify your branch manager for approval
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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
          
          <form onSubmit={handleSubmit}>
            {/* Branch Selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-gold)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Workplace Branch
              </label>
              <select
                className="form-select"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.85rem',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#FFFFFF'
                }}
              >
                {branchNames.map(b => (
                  <option key={b} value={b}>📍 {b}</option>
                ))}
              </select>

              {/* Designated Manager Notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '0.45rem',
                  fontSize: '0.73rem',
                  color: 'var(--text-muted)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}
              >
                <ShieldCheck size={14} color="var(--primary)" />
                <span>
                  Designated Branch Manager: <strong style={{ color: '#FFFFFF' }}>{designatedManagerName}</strong>
                </span>
              </div>
            </div>

            {/* Next Month Scheduling Status Banner */}
            {isNextMonthScheduled ? (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '12px',
                  padding: '0.75rem 0.9rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem'
                }}
              >
                <AlertCircle size={18} color="#F87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.78rem', color: '#FCA5A5', lineHeight: 1.45 }}>
                  <strong style={{ color: '#FFFFFF' }}>{nextMonthName} Schedule Already Started:</strong>
                  <div>
                    The manager has already scheduled shifts for {branch || 'this branch'} in {nextMonthName}.
                    Vacation requests for {nextMonthName} are now closed. You can request vacation for{' '}
                    <strong style={{ color: 'var(--accent-gold)' }}>{monthAfterNextName} ({firstDayAfterNextMonth})</strong> onwards.
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(52, 211, 153, 0.1)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  borderRadius: '12px',
                  padding: '0.65rem 0.9rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem'
                }}
              >
                <CheckCircle2 size={16} color="#34D399" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.76rem', color: '#6EE7B7', lineHeight: 1.4 }}>
                  <strong style={{ color: '#FFFFFF' }}>{nextMonthName} Schedule Not Started:</strong> The manager has not made the schedule for {nextMonthName} yet. Vacation requests for next month can be sent now!
                </div>
              </div>
            )}

            {/* Date Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#38BDF8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  min={minAllowedStartDate}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) {
                      setEndDate(e.target.value);
                    }
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.82rem',
                    borderRadius: '12px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#FFFFFF'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#38BDF8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  End Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  min={startDate || minAllowedStartDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.82rem',
                    borderRadius: '12px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#FFFFFF'
                  }}
                />
              </div>
            </div>

            {/* Duration Display */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(56, 189, 248, 0.08) 100%)',
                border: '1px dashed rgba(245, 158, 11, 0.35)',
                borderRadius: '12px',
                padding: '0.65rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#E2E8F0' }}>
                Total requested time off:
              </span>
              <span
                style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: 'var(--accent-gold)',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  padding: '3px 10px',
                  borderRadius: '99px',
                  border: '1px solid rgba(245, 158, 11, 0.4)'
                }}
              >
                🏖️ {daysCount} {daysCount === 1 ? 'Day' : 'Days'}
              </span>
            </div>

            {/* Optional Reason / Note */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Reason / Note for Manager (Optional)
              </label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="e.g. Annual leave, family trip, travel abroad..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  fontSize: '0.82rem',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid var(--border-color)',
                  color: '#FFFFFF',
                  resize: 'none'
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !startDate || !endDate}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                border: 'none',
                color: '#0F172A',
                padding: '0.65rem 1.25rem',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: 900,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              <Send size={15} />
              <span>{isSubmitting ? 'Submitting to Manager…' : 'Submit Vacation Request'}</span>
            </button>
          </form>

          {/* History of Vacation Requests */}
          <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={14} color="var(--primary)" /> Your Vacation Requests ({myVacations.length})
            </h4>

            {myVacations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-subtle)', fontSize: '0.78rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px' }}>
                No vacation requests submitted yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {myVacations.map(vac => {
                  const isApproved = vac.status === 'approved';
                  const isPending = vac.status === 'pending';
                  const isRejected = vac.status === 'rejected';

                  let count = 1;
                  try {
                    const s = parseISO(vac.startDate);
                    const e = parseISO(vac.endDate);
                    count = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                  } catch (_) {}

                  return (
                    <div
                      key={vac.id}
                      style={{
                        background: isApproved
                          ? 'rgba(52, 211, 153, 0.08)'
                          : isPending
                            ? 'rgba(245, 158, 11, 0.06)'
                            : 'rgba(239, 68, 68, 0.06)',
                        border: isApproved
                          ? '1px solid rgba(52, 211, 153, 0.3)'
                          : isPending
                            ? '1px solid rgba(245, 158, 11, 0.25)'
                            : '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '12px',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.65rem'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#FFFFFF' }}>
                            {format(parseISO(vac.startDate), 'MMM d')} – {format(parseISO(vac.endDate), 'MMM d, yyyy')}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            ({count} {count === 1 ? 'day' : 'days'})
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <span>📍 {vac.branch}</span>
                          {vac.reason && <span>• "{vac.reason}"</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '8px',
                            background: isApproved
                              ? 'rgba(52, 211, 153, 0.18)'
                              : isPending
                                ? 'rgba(245, 158, 11, 0.18)'
                                : 'rgba(239, 68, 68, 0.18)',
                            color: isApproved ? '#34D399' : isPending ? 'var(--accent-gold)' : '#F87171'
                          }}
                        >
                          {isApproved ? <CheckCircle2 size={12} /> : isPending ? <Clock size={12} /> : <XCircle size={12} />}
                          {isApproved ? 'Approved' : isPending ? 'Pending' : 'Declined'}
                        </span>

                        {isPending && (
                          <button
                            type="button"
                            disabled={cancellingId === vac.id}
                            onClick={() => onCancel(vac)}
                            title="Cancel Request"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-subtle)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
};