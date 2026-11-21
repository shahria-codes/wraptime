import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db, collection, doc, setDoc, updateDoc, onSnapshot } from '../firebase';
import { useBranches } from '../context/BranchContext';
import { UserAvatar } from './UserAvatar';
import { 
  Clock, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  MapPin,
  Sparkles,
  CalendarDays,
  LogIn,
  LogOut,
  Timer,
  Check,
  X
} from 'lucide-react';
import { 
  format, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  parseISO, 
  isSameDay,
  isBefore,
  startOfDay,
  differenceInCalendarDays
} from 'date-fns';

export const EmployeeDashboard = ({ selectedBranch, activeSubTab = 'my-schedule' }) => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { showAlert } = useToast();
  const { branchNames, getBranchHoursForDate } = useBranches();

  // Accordion state for roster branch cards (mutually exclusive: expanding one closes any other)
  const [expandedRosterBranches, setExpandedRosterBranches] = useState({});
  const toggleRosterBranch = (key) => {
    setExpandedRosterBranches(prev => (prev[key] ? {} : { [key]: true }));
  };

  const [shifts, setShifts] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [scheduleFilter, setScheduleFilter] = useState('upcoming'); // 'upcoming' | 'all' | 'past'

  // Live real-time clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check-In Modal state
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInBranch, setCheckInBranch] = useState(branchNames[0] || '');
  const [targetShiftForCheckIn, setTargetShiftForCheckIn] = useState(null);

  // Check-Out Modal state
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [targetShiftForCheckOut, setTargetShiftForCheckOut] = useState(null);
  const [checkOutTimeInput, setCheckOutTimeInput] = useState('');
  const [checkOutBreakMins, setCheckOutBreakMins] = useState(30);
  const [checkOutNote, setCheckOutNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribeShifts = onSnapshot(collection(db, 'shifts'), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setShifts(list);
    }, (err) => console.error("Firestore shifts error:", err));

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        if (docSnap.data().status === 'authorized') {
          list.push({ uid: docSnap.id, ...docSnap.data() });
        }
      });
      setAllEmployees(list);
      setLoading(false);
    }, (err) => console.error("Firestore users error:", err));

    return () => {
      unsubscribeShifts();
      unsubscribeUsers();
    };
  }, []);

  const employeeMap = useMemo(() => {
    const map = {};
    allEmployees.forEach(emp => {
      map[emp.uid || emp.id] = emp;
    });
    return map;
  }, [allEmployees]);

  const calculateHours = (start, end, breakMins = 0) => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let totalMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    totalMinutes -= breakMins;
    return Math.max(0, totalMinutes / 60);
  };

  const calculateNetWorkedHours = (startTimeStr, endTimeStr, breakMinutes = 0) => {
    if (!startTimeStr || !endTimeStr) return 0;
    const [sH, sM] = startTimeStr.split(':').map(Number);
    const [eH, eM] = endTimeStr.split(':').map(Number);
    let grossMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (grossMinutes < 0) grossMinutes += 24 * 60;
    const effectiveBreak = grossMinutes < 240 ? 0 : breakMinutes;
    const netMinutes = Math.max(0, grossMinutes - effectiveBreak);
    return parseFloat((netMinutes / 60).toFixed(2));
  };

  const formatTeammateName = (displayName) => {
    if (!displayName) return 'Staff';
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 0) return 'Staff';
    const first = parts[0];
    const lettersOnly = first.replace(/[^a-zA-Z]/g, '');
    if (lettersOnly.length > 2) {
      return first;
    }
    return parts[1] || first;
  };

  // Employee's own shifts
  const myUid = userProfile?.uid;
  const myShifts = useMemo(() => {
    return shifts.filter(s => s.userId === myUid || (userProfile?.displayName && s.userDisplayName === userProfile?.displayName));
  }, [shifts, myUid, userProfile?.displayName]);

  // Today reference
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  // Helper: check if a shift's scheduled time window has already ended without check-in
  const isShiftTimeExpired = (shift, now = currentTime) => {
    if (!shift || !shift.date) return false;
    const todayStrNow = format(now, 'yyyy-MM-dd');
    if (shift.date < todayStrNow) return true;
    if (shift.date === todayStrNow) {
      if (shift.status === 'checked-in') return false; // currently working
      if (shift.status === 'completed' || (shift.checkInTime && shift.checkOutTime)) return false;
      const nowTimeStr = format(now, 'HH:mm');
      const endTime = shift.endTime || '22:00';
      return nowTimeStr >= endTime;
    }
    return false;
  };

  // Active shift currently clocked in
  const activeShift = useMemo(() => {
    return myShifts.find(s => s.status === 'checked-in' || (s.checkInTimestamp && !s.checkOutTimestamp && s.date === todayStr));
  }, [myShifts, todayStr]);

  // Today's scheduled shift (if any, pending, not completed, and not expired)
  const todaysShift = useMemo(() => {
    return myShifts.find(s => s.date === todayStr && s.status !== 'completed' && s.status !== 'checked-in' && !isShiftTimeExpired(s, currentTime));
  }, [myShifts, todayStr, currentTime]);

  // Today's shift that ended without attendance
  const todaysExpiredShift = useMemo(() => {
    return myShifts.find(s => s.date === todayStr && s.status !== 'completed' && s.status !== 'checked-in' && isShiftTimeExpired(s, currentTime));
  }, [myShifts, todayStr, currentTime]);

  // Today's completed shifts (if any)
  const todaysCompletedShifts = useMemo(() => {
    return myShifts.filter(s => s.date === todayStr && (s.status === 'completed' || (s.checkInTime && s.checkOutTime)));
  }, [myShifts, todayStr]);

  // Live timer for active shift (seconds elapsed)
  const elapsedSeconds = useMemo(() => {
    if (!activeShift?.checkInTimestamp) return 0;
    const start = new Date(activeShift.checkInTimestamp).getTime();
    const diff = Math.max(0, Math.floor((currentTime.getTime() - start) / 1000));
    return diff;
  }, [activeShift, currentTime]);

  const formatElapsedTimer = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Total statistics calculation (counted ONLY after checked in)
  const attendedShifts = useMemo(() => {
    return myShifts.filter(s => s.status === 'completed' || s.status === 'checked-in' || !!s.checkInTime);
  }, [myShifts]);

  const totalDaysWorked = useMemo(() => new Set(attendedShifts.map(s => s.date)).size, [attendedShifts]);
  const totalHoursWorked = useMemo(() => {
    return attendedShifts.reduce((acc, s) => {
      if (s.actualHours !== undefined && s.actualHours !== null && s.actualHours !== '') {
        return acc + (parseFloat(s.actualHours) || 0);
      }
      if (s.checkInTime) {
        if (s.checkOutTime) {
          return acc + calculateNetWorkedHours(s.checkInTime, s.checkOutTime, Number(s.breakMinutes) || 0);
        }
        const nowStr = format(currentTime, 'HH:mm');
        return acc + calculateNetWorkedHours(s.checkInTime, nowStr, 0);
      }
      return acc;
    }, 0);
  }, [attendedShifts, currentTime]);

  // Sorted and filtered shift categories
  const sortedMyShifts = useMemo(() => {
    return [...myShifts].sort((a, b) => a.date.localeCompare(b.date));
  }, [myShifts]);

  const upcomingShifts = useMemo(() => {
    return sortedMyShifts.filter(s => {
      if (s.status === 'completed' || (s.checkInTime && s.checkOutTime)) return false;
      if (s.date > todayStr) return true;
      if (s.date === todayStr) {
        if (s.status === 'checked-in') return true;
        return !isShiftTimeExpired(s, currentTime);
      }
      return false;
    });
  }, [sortedMyShifts, todayStr, currentTime]);

  const pastShifts = useMemo(() => {
    return sortedMyShifts.filter(s => {
      if (s.status === 'completed' || (s.checkInTime && s.checkOutTime) || s.date < todayStr) return true;
      if (s.date === todayStr) {
        if (s.status === 'checked-in') return false;
        return isShiftTimeExpired(s, currentTime);
      }
      return false;
    }).reverse();
  }, [sortedMyShifts, todayStr, currentTime]);

  const displayedShifts = useMemo(() => {
    let list = sortedMyShifts;
    if (scheduleFilter === 'upcoming') {
      list = upcomingShifts;
    } else if (scheduleFilter === 'past') {
      list = pastShifts;
    }

    if (selectedBranch && selectedBranch !== 'ALL') {
      list = list.filter(s => s.branch === selectedBranch);
    }

    return list;
  }, [scheduleFilter, sortedMyShifts, upcomingShifts, pastShifts, selectedBranch]);

  // Immediate next shift
  const nextShift = upcomingShifts.length > 0 ? upcomingShifts[0] : null;

  // Filtered Branch Roster shifts
  const branchShifts = useMemo(() => {
    return shifts.filter(s => {
      if (selectedBranch !== 'ALL' && s.branch !== selectedBranch) return false;
      return true;
    });
  }, [shifts, selectedBranch]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const currentWeekEnd = useMemo(() => endOfWeek(currentWeekStart, { weekStartsOn: 1 }), [currentWeekStart]);

  // ── Open Check-In Modal ──
  const openCheckInModal = (shift = null) => {
    const shiftToUse = shift || todaysShift || null;
    if (shiftToUse && isShiftTimeExpired(shiftToUse, new Date())) {
      showAlert(`This shift ended at ${shiftToUse.endTime || '22:00'}. Check-in is closed.`, 'Check-In Closed', 'warning');
      return;
    }
    setTargetShiftForCheckIn(shiftToUse);
    const initialBranch = shiftToUse?.branch || (selectedBranch !== 'ALL' ? selectedBranch : userProfile?.branch || branchNames[0] || '');
    setCheckInBranch(initialBranch);
    setIsCheckInModalOpen(true);
  };

  // ── Execute Check-In ──
  const handleConfirmCheckIn = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const now = new Date();
      const timeStr = format(now, 'HH:mm');

      if (targetShiftForCheckIn?.id) {
        // Check in to existing scheduled shift
        await updateDoc(doc(db, 'shifts', targetShiftForCheckIn.id), {
          status: 'checked-in',
          checkInTime: timeStr,
          checkInTimestamp: now.toISOString(),
          branch: checkInBranch || targetShiftForCheckIn.branch,
          updatedAt: now.toISOString()
        });
      } else {
        // Create a new on-demand checked-in shift
        const newDocRef = doc(collection(db, 'shifts'));
        await setDoc(newDocRef, {
          userId: userProfile.uid,
          userDisplayName: userProfile.displayName || 'Staff',
          branch: checkInBranch || branchNames[0] || '',
          date: format(now, 'yyyy-MM-dd'),
          startTime: timeStr,
          endTime: '22:00',
          checkInTime: timeStr,
          checkInTimestamp: now.toISOString(),
          breakMinutes: 30,
          status: 'checked-in',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        });
      }

      setIsCheckInModalOpen(false);
      showAlert(`Checked in at ${timeStr} (${checkInBranch})! Have a wonderful shift.`, 'Checked In Successfully', 'success');
    } catch (err) {
      console.error("Check in error:", err);
      showAlert("Failed to check in. Please try again.", "Check In Error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Open Check-Out Modal ──
  const openCheckOutModal = (shift = null) => {
    const target = shift || activeShift;
    if (!target) return;
    setTargetShiftForCheckOut(target);
    setCheckOutTimeInput(format(new Date(), 'HH:mm'));
    setCheckOutBreakMins(target?.breakMinutes ?? 30);
    setCheckOutNote('');
    setIsCheckOutModalOpen(true);
  };

  // ── Execute Check-Out ──
  const handleConfirmCheckOut = async () => {
    if (!targetShiftForCheckOut || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const now = new Date();
      const outTime = checkOutTimeInput || format(now, 'HH:mm');
      const inTime = targetShiftForCheckOut.checkInTime || targetShiftForCheckOut.startTime || '09:00';
      const breakM = Number(checkOutBreakMins) || 0;

      const workedHours = calculateNetWorkedHours(inTime, outTime, breakM);

      const updatedData = {
        status: 'completed',
        checkInTime: inTime,
        checkOutTime: outTime,
        checkOutTimestamp: now.toISOString(),
        breakMinutes: breakM,
        actualHours: workedHours,
        updatedAt: now.toISOString()
      };

      if (checkOutNote.trim()) {
        updatedData.note = targetShiftForCheckOut.note 
          ? `${targetShiftForCheckOut.note} | ${checkOutNote.trim()}`
          : checkOutNote.trim();
      }

      await updateDoc(doc(db, 'shifts', targetShiftForCheckOut.id), updatedData);

      setIsCheckOutModalOpen(false);
      showAlert(
        `Shift ended! You worked ${workedHours} net hours at ${targetShiftForCheckOut.branch} today. Thank you for your work!`,
        'Checked Out Successfully',
        'success'
      );
    } catch (err) {
      console.error("Check out error:", err);
      showAlert("Failed to check out. Please try again.", "Check Out Error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate live preview of worked hours in Check-Out modal
  const modalPreviewHours = useMemo(() => {
    if (!targetShiftForCheckOut) return 0;
    const inTime = targetShiftForCheckOut.checkInTime || targetShiftForCheckOut.startTime || '09:00';
    const outTime = checkOutTimeInput || format(new Date(), 'HH:mm');
    return calculateNetWorkedHours(inTime, outTime, Number(checkOutBreakMins) || 0);
  }, [targetShiftForCheckOut, checkOutTimeInput, checkOutBreakMins]);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2.5rem' }}>
      
      {/* ── Welcome Banner & Personal Summary ── */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '1.5rem', 
          marginBottom: '1.25rem', 
          borderLeft: '5px solid var(--primary)',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.75) 100%)',
          borderRadius: '20px',
          boxShadow: 'var(--shadow-md), var(--inset-shine)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <UserAvatar 
              photoURL={userProfile?.photoURL} 
              displayName={userProfile?.displayName} 
              size={52} 
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                  Welcome back, {userProfile?.displayName || 'Staff'}!
                </h2>
                <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  Wraperia Staff
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                Your personal schedule & live time clock
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ 
              background: 'rgba(11, 19, 38, 0.8)', 
              padding: '0.65rem 1.1rem', 
              borderRadius: '14px', 
              border: '1px solid var(--border-glass)', 
              textAlign: 'center', 
              minWidth: '95px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Days Worked</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--primary)', fontFamily: 'var(--font-heading)', marginTop: '2px' }}>{totalDaysWorked}</div>
            </div>

            <div style={{ 
              background: 'rgba(11, 19, 38, 0.8)', 
              padding: '0.65rem 1.1rem', 
              borderRadius: '14px', 
              border: '1px solid var(--border-glass)', 
              textAlign: 'center', 
              minWidth: '95px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Total Hours</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)', marginTop: '2px' }}>{totalHoursWorked.toFixed(1)}h</div>
            </div>

            <div style={{ 
              background: 'rgba(11, 19, 38, 0.8)', 
              padding: '0.65rem 1.1rem', 
              borderRadius: '14px', 
              border: '1px solid var(--border-glass)', 
              textAlign: 'center', 
              minWidth: '95px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Upcoming</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#38BDF8', fontFamily: 'var(--font-heading)', marginTop: '2px' }}>{upcomingShifts.length}</div>
            </div>
          </div>
        </div>

        {/* Quick Next Shift Ribbon */}
        {nextShift && (
          <div style={{
            marginTop: '1.15rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.6rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: isSameDay(parseISO(nextShift.date), today) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: isSameDay(parseISO(nextShift.date), today) ? '#FCA5A5' : 'var(--accent-gold)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.72rem'
              }}>
                <Sparkles size={12} />
                {isSameDay(parseISO(nextShift.date), today) ? 'NEXT SHIFT TODAY' : 'NEXT UPCOMING SHIFT'}
              </span>
              <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>
                {format(parseISO(nextShift.date), 'EEEE, MMM dd')}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <MapPin size={12} style={{ color: 'var(--primary)' }} /> {nextShift.branch}
              </span>
            </div>

            <div style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--accent-gold)',
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '3px 10px',
              borderRadius: '8px'
            }}>
              {nextShift.startTime} - {nextShift.endTime}
            </div>
          </div>
        )}
      </div>

      {/* ── INTERACTIVE TIME CLOCK (CHECK IN / CHECK OUT WIDGET) ── */}
      <div 
        className="glass-card" 
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          borderRadius: '20px',
          background: activeShift 
            ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%)' 
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(15, 23, 42, 0.75) 100%)',
          border: activeShift ? '1px solid rgba(52, 211, 153, 0.45)' : '1px solid var(--border-glass)',
          boxShadow: activeShift 
            ? '0 10px 30px -8px rgba(52, 211, 153, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)' 
            : 'var(--shadow-sm)'
        }}
      >
        {activeShift ? (
          /* ── Clocked In State: Live Timer Running ── */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              
              {/* Pulsing Clock Icon */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.25), rgba(52, 211, 153, 0.08))',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34D399',
                boxShadow: '0 0 20px rgba(52, 211, 153, 0.25)',
                flexShrink: 0
              }}>
                <Timer size={28} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'rgba(52, 211, 153, 0.2)',
                    border: '1px solid rgba(52, 211, 153, 0.5)',
                    color: '#34D399',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em'
                  }}>
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#34D399',
                      boxShadow: '0 0 8px #34D399'
                    }} />
                    ON DUTY • CLOCKED IN
                  </span>

                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: 'var(--accent-gold)',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    <MapPin size={12} /> {activeShift.branch}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Clocked in at <strong style={{ color: '#FFF' }}>{activeShift.checkInTime || activeShift.startTime}</strong> ({format(today, 'MMM dd, yyyy')})
                </div>
              </div>
            </div>

            {/* Live Timer & Check Out Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{
                background: 'rgba(11, 19, 38, 0.85)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                padding: '0.5rem 1.25rem',
                borderRadius: '14px',
                textAlign: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
              }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
                  Live Shift Duration
                </div>
                <div style={{
                  fontSize: '1.65rem',
                  fontWeight: 900,
                  color: '#34D399',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                  marginTop: '1px'
                }}>
                  {formatElapsedTimer(elapsedSeconds)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openCheckOutModal(activeShift)}
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFF',
                  padding: '0.75rem 1.4rem',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 6px 20px rgba(239, 68, 68, 0.35)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <LogOut size={18} />
                Check Out / End Shift
              </button>
            </div>
          </div>
        ) : (
          /* ── Clocked Out State: Ready to Check In ── */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
            
            {/* Live Clock & Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '14px',
                background: todaysCompletedShifts.length > 0 && !todaysShift
                  ? 'rgba(52, 211, 153, 0.12)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: todaysCompletedShifts.length > 0 && !todaysShift
                  ? '1px solid rgba(52, 211, 153, 0.3)'
                  : '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: todaysCompletedShifts.length > 0 && !todaysShift ? '#34D399' : 'var(--text-muted)',
                flexShrink: 0
              }}>
                {todaysCompletedShifts.length > 0 && !todaysShift ? <CheckCircle2 size={24} /> : <Clock size={24} />}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                    {format(currentTime, 'HH:mm:ss')}
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {format(currentTime, 'EEEE, MMM dd')}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {todaysShift ? (
                    <span>
                      Scheduled today at <strong style={{ color: 'var(--accent-gold)' }}>{todaysShift.branch}</strong> ({todaysShift.startTime} - {todaysShift.endTime})
                    </span>
                  ) : todaysCompletedShifts.length > 0 ? (
                    <span style={{ color: '#34D399', fontWeight: 700 }}>
                      ✓ Shift completed for today ({todaysCompletedShifts[0].checkInTime || todaysCompletedShifts[0].startTime} - {todaysCompletedShifts[0].checkOutTime || todaysCompletedShifts[0].endTime})
                    </span>
                  ) : todaysExpiredShift ? (
                    <span style={{ color: '#F87171', fontWeight: 600 }}>
                      Shift ended at <strong style={{ color: 'var(--accent-gold)' }}>{todaysExpiredShift.branch}</strong> ({todaysExpiredShift.startTime} - {todaysExpiredShift.endTime}) • Not checked in
                    </span>
                  ) : (
                    <span>No scheduled shift for today.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Check-In Controls */}
            {todaysCompletedShifts.length > 0 && !todaysShift ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                color: '#34D399',
                padding: '0.55rem 1rem',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}>
                <CheckCircle2 size={16} />
                <span>All Done For Today</span>
              </div>
            ) : todaysShift ? (
              <button
                type="button"
                onClick={() => openCheckInModal(todaysShift)}
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFF',
                  padding: '0.7rem 1.4rem',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <LogIn size={17} />
                Check In ({todaysShift.branch})
              </button>
            ) : todaysExpiredShift ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                color: '#F87171',
                padding: '0.55rem 1rem',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.82rem'
              }}>
                <Clock size={15} />
                <span>Shift Ended • Check-In Closed</span>
              </div>
            ) : (
              <button
                type="button"
                disabled
                title="No work scheduled for today"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-subtle)',
                  padding: '0.7rem 1.4rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: 0.5
                }}
              >
                <LogIn size={17} />
                Check In
              </button>
            )}

          </div>
        )}
      </div>

      {/* ── Main View Content ── */}
      <div>
        {activeSubTab === 'my-schedule' ? (
          <div>
            {/* Header & Filter Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem'
            }}>
              <div>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 800, 
                  color: 'var(--text-main)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.6rem',
                  margin: 0
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)'
                  }}>
                    <Clock size={18} />
                  </div>
                  My Scheduled Shifts
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  {selectedBranch !== 'ALL' ? `Filtered by branch: ${selectedBranch}` : 'Showing shifts across all branches'}
                </p>
              </div>

              {/* Filter Tabs */}
              <div style={{
                display: 'inline-flex',
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '4px',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)',
                gap: '4px'
              }}>
                <button
                  type="button"
                  onClick={() => setScheduleFilter('upcoming')}
                  style={{
                    border: 'none',
                    background: scheduleFilter === 'upcoming' ? 'var(--primary)' : 'transparent',
                    color: scheduleFilter === 'upcoming' ? '#0F172A' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Upcoming ({upcomingShifts.length})
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleFilter('all')}
                  style={{
                    border: 'none',
                    background: scheduleFilter === 'all' ? 'var(--primary)' : 'transparent',
                    color: scheduleFilter === 'all' ? '#0F172A' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  All ({myShifts.length})
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleFilter('past')}
                  style={{
                    border: 'none',
                    background: scheduleFilter === 'past' ? 'var(--primary)' : 'transparent',
                    color: scheduleFilter === 'past' ? '#0F172A' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Past ({pastShifts.length})
                </button>
              </div>
            </div>

            {/* Empty States */}
            {displayedShifts.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', borderRadius: '20px' }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '16px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <CalendarDays size={28} />
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                  {scheduleFilter === 'upcoming' 
                    ? 'No upcoming shifts scheduled'
                    : scheduleFilter === 'past' 
                      ? 'No past shifts recorded'
                      : 'No scheduled shifts found'}
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                  {scheduleFilter === 'upcoming'
                    ? 'You have no future shifts assigned yet. Check back once your manager publishes the weekly rota or explore past shifts.'
                    : 'Check back after your manager adds shifts or adjust your branch filter.'}
                </p>
                {scheduleFilter === 'upcoming' && pastShifts.length > 0 && (
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setScheduleFilter('past')}
                  >
                    View Past Shifts ({pastShifts.length})
                  </button>
                )}
              </div>
            ) : (
              /* Scheduled Cards Grid */
              <div className="grid-auto-fill-320">
                {displayedShifts.map(shift => {
                  const hrs = calculateHours(shift.startTime, shift.endTime, shift.breakMinutes);
                  const shiftDate = parseISO(shift.date);
                  const isToday = isSameDay(shiftDate, today);
                  const isPast = isBefore(shiftDate, today);
                  const daysDiff = differenceInCalendarDays(shiftDate, today);

                  const isShiftActive = shift.status === 'checked-in' || (shift.checkInTimestamp && !shift.checkOutTimestamp && isToday);
                  const isShiftCompleted = shift.status === 'completed' || (shift.checkInTime && shift.checkOutTime);
                  const isExpired = isShiftTimeExpired(shift, currentTime);

                  // Find coworkers scheduled on this same date and branch
                  const coworkers = shifts.filter(s => 
                    s.date === shift.date && 
                    s.branch === shift.branch && 
                    s.userId !== myUid &&
                    s.userDisplayName !== userProfile?.displayName
                  );

                  return (
                    <div 
                      key={shift.id}
                      className="glass-card"
                      style={{ 
                        padding: '1.25rem',
                        position: 'relative',
                        borderRadius: '20px',
                        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                        cursor: 'default',
                        background: isShiftActive
                          ? 'linear-gradient(145deg, rgba(52, 211, 153, 0.12) 0%, rgba(15, 23, 42, 0.88) 100%)'
                          : isExpired
                            ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(15, 23, 42, 0.65) 100%)'
                            : isToday 
                              ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.88) 100%)' 
                              : isPast 
                                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(15, 23, 42, 0.65) 100%)'
                                : 'linear-gradient(145deg, rgba(255, 255, 255, 0.06) 0%, rgba(15, 23, 42, 0.75) 100%)',
                        border: isShiftActive
                          ? '1px solid rgba(52, 211, 153, 0.55)'
                          : isExpired
                            ? '1px solid rgba(239, 68, 68, 0.25)'
                            : isToday 
                              ? '1px solid rgba(245, 158, 11, 0.55)' 
                              : isPast 
                                ? '1px solid rgba(255, 255, 255, 0.07)'
                                : '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: isShiftActive
                          ? '0 12px 35px -8px rgba(52, 211, 153, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                          : isToday && !isExpired
                            ? '0 12px 35px -8px rgba(245, 158, 11, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)' 
                            : '0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                        opacity: (isPast || isExpired) ? 0.78 : 1
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        if (!isToday && !isPast && !isShiftActive) {
                          e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                          e.currentTarget.style.boxShadow = '0 14px 32px rgba(0,0,0,0.38), 0 0 20px rgba(245, 158, 11, 0.12)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        if (!isToday && !isPast && !isShiftActive) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)';
                        }
                      }}
                    >
                      {/* Top Header: Date Block & Status Badges */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.9rem' }}>
                        
                        {/* Calendar Date Block */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '52px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: isShiftActive
                              ? '1px solid rgba(52, 211, 153, 0.6)'
                              : isToday 
                                ? '1px solid rgba(245, 158, 11, 0.6)' 
                                : isPast 
                                  ? '1px solid rgba(255, 255, 255, 0.08)' 
                                  : '1px solid rgba(245, 158, 11, 0.3)',
                            boxShadow: isShiftActive
                              ? '0 4px 16px rgba(52, 211, 153, 0.25)'
                              : isToday 
                                ? '0 4px 16px rgba(245, 158, 11, 0.25)' 
                                : '0 2px 8px rgba(0,0,0,0.3)',
                            flexShrink: 0
                          }}>
                            <div style={{
                              background: isShiftActive
                                ? '#34D399'
                                : isToday 
                                  ? 'var(--primary)' 
                                  : isPast 
                                    ? 'rgba(255, 255, 255, 0.08)' 
                                    : 'rgba(245, 158, 11, 0.2)',
                              color: isShiftActive || isToday ? '#0F172A' : isPast ? 'var(--text-muted)' : 'var(--accent-gold)',
                              fontSize: '0.62rem',
                              fontWeight: 900,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              textAlign: 'center',
                              padding: '2.5px 0',
                              lineHeight: 1
                            }}>
                              {format(shiftDate, 'MMM')}
                            </div>
                            <div style={{
                              background: 'rgba(11, 19, 38, 0.92)',
                              color: isPast ? 'var(--text-muted)' : '#FFFFFF',
                              fontSize: '1.3rem',
                              fontWeight: 900,
                              textAlign: 'center',
                              padding: '4px 0 3px',
                              lineHeight: 1.1,
                              fontFamily: 'var(--font-heading)'
                            }}>
                              {format(shiftDate, 'dd')}
                            </div>
                          </div>

                          {/* Day Name Only */}
                          <div style={{
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            color: isPast ? 'var(--text-muted)' : 'var(--text-main)',
                            lineHeight: 1.2,
                            letterSpacing: '-0.02em',
                            whiteSpace: 'nowrap'
                          }}>
                            {format(shiftDate, 'EEEE')}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                          {isShiftActive ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: 'rgba(52, 211, 153, 0.18)',
                              border: '1px solid rgba(52, 211, 153, 0.5)',
                              color: '#34D399',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              boxShadow: '0 0 14px rgba(52, 211, 153, 0.25)'
                            }}>
                              <span style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: '#34D399',
                                boxShadow: '0 0 6px #34D399'
                              }} />
                              Clocked In
                            </span>
                          ) : isShiftCompleted ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: 'rgba(52, 211, 153, 0.12)',
                              border: '1px solid rgba(52, 211, 153, 0.3)',
                              color: '#34D399',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700
                            }}>
                              <CheckCircle2 size={11} /> Completed
                            </span>
                          ) : isExpired ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#F87171',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700
                            }}>
                              <Clock size={11} /> Shift Ended
                            </span>
                          ) : isToday ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: 'rgba(245, 158, 11, 0.2)',
                              border: '1px solid rgba(245, 158, 11, 0.5)',
                              color: 'var(--accent-gold)',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              boxShadow: '0 0 12px rgba(245, 158, 11, 0.2)'
                            }}>
                              🔥 Today
                            </span>
                          ) : daysDiff === 1 ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: 'rgba(99, 102, 241, 0.16)',
                              border: '1px solid rgba(99, 102, 241, 0.35)',
                              color: '#A5B4FC',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700
                            }}>
                              ⚡ Tomorrow
                            </span>
                          ) : isPast ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-muted)',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 600
                            }}>
                              <CheckCircle2 size={11} style={{ color: 'var(--success)' }} /> Done
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border-glass)',
                              color: 'var(--text-muted)',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 600
                            }}>
                              {daysDiff <= 7 ? `In ${daysDiff} days` : 'Upcoming'}
                            </span>
                          )}

                          {/* Branch badge with operating/shift hours */}
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            color: 'var(--accent-gold)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '7px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap'
                          }}>
                            <MapPin size={11} style={{ color: 'var(--primary)' }} />
                            <span>{shift.branch}</span>
                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>•</span>
                            <span>{shift.startTime || '09:00'} - {shift.endTime || '22:00'}</span>
                          </span>
                        </div>

                      </div>

                      {/* Teammates on Shift */}
                      {coworkers.length > 0 ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '0.75rem',
                          paddingTop: '0.65rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          gap: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <Users size={13} style={{ color: 'var(--primary)' }} />
                            <span>Teammates:</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {coworkers.slice(0, 3).map((cw, idx) => (
                                <div
                                  key={cw.id || idx}
                                  title={`${cw.userDisplayName} (${cw.startTime} - ${cw.endTime})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (cw.userId) navigate(`/profile/${cw.userId}`);
                                  }}
                                  style={{
                                    marginLeft: idx === 0 ? 0 : -8,
                                    border: '2px solid #090E1F',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s ease',
                                    zIndex: 3 - idx
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15) translateY(-2px)'}
                                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1) translateY(0)'}
                                >
                                  <UserAvatar
                                    photoURL={employeeMap[cw.userId]?.photoURL || cw.photoURL}
                                    displayName={cw.userDisplayName}
                                    size={24}
                                  />
                                </div>
                              ))}
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              {coworkers.length === 1
                                ? formatTeammateName(coworkers[0].userDisplayName)
                                : `${formatTeammateName(coworkers[0].userDisplayName)} +${coworkers.length - 1}`}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '0.75rem',
                          paddingTop: '0.65rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          fontSize: '0.73rem',
                          color: 'var(--text-subtle)'
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Users size={12} /> Solo shift
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>Single staff on duty</span>
                        </div>
                      )}

                      {/* Note Callout (if any) */}
                      {shift.note && (
                        <div style={{
                          marginTop: '0.75rem',
                          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)',
                          border: '1px dashed rgba(245, 158, 11, 0.3)',
                          borderRadius: '10px',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem'
                        }}>
                          <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>📌</span>
                          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35, color: '#E2E8F0' }}>
                            <strong style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>Note: </strong>
                            {shift.note}
                          </div>
                        </div>
                      )}

                      {/* ── Check-In / Check-Out Actions on Today's Card ── */}
                      {isToday && (
                        <div style={{
                          marginTop: '0.85rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.6rem'
                        }}>
                          {isShiftActive ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#34D399', fontWeight: 700 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 8px #34D399' }} />
                                <span>Checked in at {shift.checkInTime}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => openCheckOutModal(shift)}
                                style={{
                                  border: 'none',
                                  background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                  color: '#FFF',
                                  padding: '0.45rem 0.95rem',
                                  borderRadius: '9px',
                                  fontWeight: 700,
                                  fontSize: '0.78rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)'
                                }}
                              >
                                <LogOut size={14} /> Check Out Now
                              </button>
                            </>
                          ) : isShiftCompleted ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success)', fontWeight: 700 }}>
                                <CheckCircle2 size={13} /> Completed Shift
                              </span>
                              <span>
                                In: <strong style={{ color: '#FFF' }}>{shift.checkInTime || shift.startTime}</strong> • Out: <strong style={{ color: '#FFF' }}>{shift.checkOutTime || shift.endTime}</strong> ({shift.actualHours || hrs}h)
                              </span>
                            </div>
                          ) : isExpired ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#F87171', fontWeight: 600 }}>
                                <XCircle size={13} /> Shift ended ({shift.startTime} - {shift.endTime}) • Not checked in
                              </span>
                              <span style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: '8px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-muted)',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                              }}>
                                Ended
                              </span>
                            </div>
                          ) : (
                            <>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Scheduled for today • Ready to work?
                              </span>
                              <button
                                type="button"
                                onClick={() => openCheckInModal(shift)}
                                style={{
                                  border: 'none',
                                  background: 'linear-gradient(135deg, #10B981, #059669)',
                                  color: '#FFF',
                                  padding: '0.45rem 0.95rem',
                                  borderRadius: '9px',
                                  fontWeight: 700,
                                  fontSize: '0.78rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
                                }}
                              >
                                <LogIn size={14} /> Check In Now
                              </button>
                            </>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── Branch Co-Workers Roster Tab ── */
          <div>
            <div className="page-header" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 800, 
                  color: 'var(--text-main)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.6rem',
                  margin: 0
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)'
                  }}>
                    <Users size={18} />
                  </div>
                  Branch Co-Workers Roster
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Viewing: <span className="badge badge-amber" style={{ marginLeft: '4px' }}>{selectedBranch === 'ALL' ? 'All 5 Branches' : selectedBranch}</span>
                </div>
              </div>

              {/* Week Navigation Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentWeekStart(d => addDays(d, -7))}
                  title="Previous week"
                >
                  <ChevronLeft size={16} />
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                  style={{ fontWeight: 700, fontSize: '0.78rem' }}
                >
                  This Week ({format(currentWeekStart, 'MMM dd')} - {format(currentWeekEnd, 'MMM dd')})
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentWeekStart(d => addDays(d, 7))}
                  title="Next week"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Weekly Grid for Roster */}
            <div className="grid-week">
              {weekDays.map(dayDate => {
                const dateStr = format(dayDate, 'yyyy-MM-dd');
                const isToday = isSameDay(dayDate, today);
                const dayShifts = branchShifts.filter(s => s.date === dateStr);

                return (
                  <div 
                    key={dateStr}
                    className="glass-card"
                    style={{ 
                      padding: '0.9rem', 
                      minHeight: '320px',
                      borderRadius: '16px',
                      border: isToday ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                      background: isToday 
                        ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)' 
                        : 'rgba(15, 23, 42, 0.65)',
                      boxShadow: isToday ? '0 8px 24px rgba(245, 158, 11, 0.15)' : 'var(--shadow-sm)'
                    }}
                  >
                    {/* Day Column Header */}
                    <div style={{ 
                      borderBottom: '1px solid var(--border-glass)', 
                      paddingBottom: '0.65rem', 
                      marginBottom: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ 
                          fontSize: '0.72rem', 
                          textTransform: 'uppercase', 
                          fontWeight: 800, 
                          color: isToday ? 'var(--primary)' : 'var(--text-muted)',
                          letterSpacing: '0.05em'
                        }}>
                          {format(dayDate, 'EEEE')}
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '1px' }}>
                          {format(dayDate, 'MMM dd')}
                        </div>
                      </div>

                      {isToday && (
                        <span style={{
                          background: 'var(--primary)',
                          color: '#0F172A',
                          fontWeight: 800,
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase'
                        }}>
                          Today
                        </span>
                      )}
                    </div>

                    {/* Shifts Stack */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {dayShifts.length === 0 ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', textAlign: 'center', padding: '1.5rem 0' }}>
                          No team scheduled
                        </div>
                      ) : (
                        (() => {
                          const shiftsByBranch = dayShifts.reduce((acc, shift) => {
                            const b = shift.branch || 'Unassigned';
                            if (!acc[b]) acc[b] = [];
                            acc[b].push(shift);
                            return acc;
                          }, {});

                          return Object.entries(shiftsByBranch).map(([branchName, branchShiftsList]) => {
                            const accordionKey = `${dateStr}-${branchName}`;
                            const isExpanded = !!expandedRosterBranches[accordionKey];
                            const firstShift = branchShiftsList[0];
                            const allSameTime = branchShiftsList.every(
                              s => (s.startTime || '09:00') === (firstShift.startTime || '09:00') &&
                                   (s.endTime || '22:00') === (firstShift.endTime || '22:00')
                            );
                            const sharedTimeStr = `${firstShift.startTime || '09:00'} - ${firstShift.endTime || '22:00'}`;
                            const branchHours = getBranchHoursForDate ? getBranchHoursForDate(branchName, dateStr) : null;
                            const branchHoursStr = branchHours?.closed
                              ? 'Closed'
                              : branchHours?.open && branchHours?.close
                                ? `${branchHours.open} - ${branchHours.close}`
                                : (allSameTime ? sharedTimeStr : `${firstShift.startTime || '09:00'} - ${firstShift.endTime || '22:00'}`);
                            const checkedInCount = branchShiftsList.filter(s => s.status === 'checked-in').length;

                            return (
                              <div
                                key={branchName}
                                style={{
                                  background: 'rgba(15, 23, 42, 0.78)',
                                  border: '1px solid var(--border-color)',
                                  borderLeft: `3px solid ${checkedInCount > 0 ? '#34D399' : 'var(--primary)'}`,
                                  borderRadius: '8px',
                                  marginBottom: '0.35rem',
                                  boxSizing: 'border-box',
                                  width: '100%',
                                  overflow: 'hidden',
                                  transition: 'all 0.15s ease',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                                }}
                              >
                                {/* Accordion Header — click to expand/collapse */}
                                <button
                                  type="button"
                                  onClick={() => toggleRosterBranch(accordionKey)}
                                  style={{
                                    width: '100%',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0.4rem 0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    textAlign: 'left'
                                  }}
                                >
                                  {/* Branch name */}
                                  <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    color: 'var(--accent-gold)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    flex: 1,
                                    minWidth: 0,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}>
                                    📍 {branchName}
                                  </span>

                                  {/* Avatar stack (up to 3) */}
                                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    {branchShiftsList.slice(0, 3).map((shift, idx) => (
                                      <div
                                        key={shift.id}
                                        title={shift.userDisplayName}
                                        style={{
                                          marginLeft: idx === 0 ? 0 : '-6px',
                                          zIndex: 3 - idx,
                                          position: 'relative',
                                          border: '1.5px solid rgba(15,23,42,0.9)',
                                          borderRadius: '50%'
                                        }}
                                      >
                                        <UserAvatar
                                          photoURL={employeeMap[shift.userId]?.photoURL || shift.photoURL}
                                          displayName={shift.userDisplayName}
                                          size={18}
                                        />
                                      </div>
                                    ))}
                                  </div>

                                  {/* Chevron */}
                                  <ChevronDown
                                    size={12}
                                    style={{
                                      color: 'var(--text-muted)',
                                      flexShrink: 0,
                                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.2s ease'
                                    }}
                                  />
                                </button>

                                {/* Expandable staff list */}
                                {isExpanded && (
                                  <div style={{
                                    borderTop: '1px solid rgba(255,255,255,0.07)',
                                    padding: '0.3rem 0.5rem 0.4rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.25rem'
                                  }}>
                                    {/* Branch Opening & Closing Hours (shown when expanded) */}
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.15rem 0.2rem 0.3rem',
                                      borderBottom: '1px dashed rgba(255,255,255,0.08)',
                                      fontSize: '0.67rem',
                                      color: 'var(--text-muted)',
                                      marginBottom: '0.15rem'
                                    }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                                        <Clock size={11} /> {branchHoursStr}
                                      </span>
                                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                        {branchShiftsList.length} staff
                                      </span>
                                    </div>

                                    {branchShiftsList.map((shift) => {
                                      const isMe = shift.userId === myUid || (userProfile?.displayName && shift.userDisplayName === userProfile?.displayName);
                                      return (
                                        <div
                                          key={shift.id}
                                          onClick={() => shift.userId && navigate(isMe ? '/profile' : `/profile/${shift.userId}`)}
                                          title={`Click to view ${shift.userDisplayName}'s profile`}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.3rem',
                                            padding: '2px 4px',
                                            borderRadius: '6px',
                                            background: isMe ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s ease'
                                          }}
                                        >
                                          {/* Left: Avatar + Name + Check-in/out time */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, flex: 1 }}>
                                            <UserAvatar
                                              photoURL={employeeMap[shift.userId]?.photoURL || shift.photoURL}
                                              displayName={shift.userDisplayName || employeeMap[shift.userId]?.displayName}
                                              size={22}
                                            />
                                            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                              <div style={{
                                                fontWeight: 700,
                                                fontSize: '0.78rem',
                                                color: isMe ? 'var(--accent-gold)' : '#FFFFFF',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                lineHeight: 1.2
                                              }}>
                                                {formatTeammateName(shift.userDisplayName || employeeMap[shift.userId]?.displayName)} {isMe && '(You)'}
                                              </div>
                                              {/* Check-in / Check-out time bottom of employee name */}
                                              <div style={{
                                                fontSize: '0.63rem',
                                                lineHeight: 1.2,
                                                marginTop: '1px'
                                              }}>
                                                {shift.checkInTime ? (
                                                  shift.checkOutTime ? (
                                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                                      In: {shift.checkInTime} • Out: {shift.checkOutTime}
                                                    </span>
                                                  ) : (
                                                    <span style={{
                                                      color: '#34D399',
                                                      fontWeight: 700,
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '3px'
                                                    }}>
                                                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 4px #34D399' }} />
                                                      In: {shift.checkInTime}
                                                    </span>
                                                  )
                                                ) : (
                                                  <span style={{ color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>
                                                    Not checked in
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

      {/* ── MODAL: CHECK-IN CONFIRMATION ── */}
      {isCheckInModalOpen && createPortal(
        <div 
          className="modal-overlay" 
          onClick={() => !isSubmitting && setIsCheckInModalOpen(false)}
          style={{ zIndex: 99999 }}
        >
          <div 
            className="modal-content animate-fade-in" 
            style={{ maxWidth: '440px', padding: '1.75rem', borderRadius: '24px' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981'
                }}>
                  <LogIn size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Clock In / Start Shift
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Confirm your start time & working location
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCheckInModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Check-In Details Box */}
            <div style={{
              background: 'rgba(11, 19, 38, 0.75)',
              border: '1px solid var(--border-glass)',
              borderRadius: '16px',
              padding: '1.1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Branch Location
                </label>
                <select
                  value={checkInBranch}
                  onChange={(e) => setCheckInBranch(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid var(--border-bright)',
                    color: '#FFF',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                >
                  {branchNames.map(b => (
                    <option key={b} value={b} style={{ background: '#0F172A', color: '#FFF' }}>
                      📍 {b}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.65rem 0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Clock-In Time
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#34D399', fontFamily: 'monospace', marginTop: '2px' }}>
                    {format(currentTime, 'HH:mm')}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.65rem 0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Date
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFF', marginTop: '4px' }}>
                    {format(today, 'MMM dd, yyyy')}
                  </div>
                </div>
              </div>

              {targetShiftForCheckIn && (
                <div style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.65rem' }}>
                  Matches scheduled rota: <strong style={{ color: 'var(--accent-gold)' }}>{targetShiftForCheckIn.startTime} - {targetShiftForCheckIn.endTime}</strong>
                </div>
              )}
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, padding: '0.75rem' }}
                onClick={() => setIsCheckInModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  flex: 2,
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
                }}
                onClick={handleConfirmCheckIn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>Recording...</span>
                ) : (
                  <>
                    <Check size={18} /> Confirm Clock In
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: CHECK-OUT (END SHIFT & VERIFY HOURS) ── */}
      {isCheckOutModalOpen && targetShiftForCheckOut && createPortal(
        <div 
          className="modal-overlay" 
          onClick={() => !isSubmitting && setIsCheckOutModalOpen(false)}
          style={{ zIndex: 99999 }}
        >
          <div 
            className="modal-content animate-fade-in" 
            style={{ maxWidth: '480px', padding: '1.75rem', borderRadius: '24px' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EF4444'
                }}>
                  <LogOut size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Clock Out / End Shift
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Review your worked hours and confirm departure
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCheckOutModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Check-Out Details Box */}
            <div style={{
              background: 'rgba(11, 19, 38, 0.75)',
              border: '1px solid var(--border-glass)',
              borderRadius: '16px',
              padding: '1.1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Branch
                  </span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                    <MapPin size={13} /> {targetShiftForCheckOut.branch}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Shift Date
                  </span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFF', marginTop: '2px' }}>
                    {format(parseISO(targetShiftForCheckOut.date), 'EEE, MMM dd')}
                  </div>
                </div>
              </div>

              {/* In / Out Time Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.75rem', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Started (In)
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#34D399', fontFamily: 'monospace', marginTop: '2px' }}>
                    {targetShiftForCheckOut.checkInTime || targetShiftForCheckOut.startTime || '09:00'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.75rem', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Departure (Out)
                  </div>
                  <input
                    type="time"
                    value={checkOutTimeInput}
                    onChange={(e) => setCheckOutTimeInput(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#FFF',
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      width: '100%',
                      outline: 'none',
                      padding: 0,
                      marginTop: '2px'
                    }}
                  />
                </div>
              </div>

              {/* Break Duration Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  <span>Break Deducted</span>
                  <span style={{ color: 'var(--accent-gold)' }}>{checkOutBreakMins} min</span>
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[0, 15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setCheckOutBreakMins(mins)}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.2rem',
                        borderRadius: '8px',
                        border: checkOutBreakMins === mins ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                        background: checkOutBreakMins === mins ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        color: checkOutBreakMins === mins ? 'var(--accent-gold)' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {mins === 0 ? 'No Break' : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Net Worked Hours Highlight */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.05))',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '0.85rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Total Verified Net Hours
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#FFF', marginTop: '2px' }}>
                    Calculated for payroll & manager report
                  </div>
                </div>

                <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)' }}>
                  {modalPreviewHours.toFixed(1)} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>hrs</span>
                </div>
              </div>

              {/* Handover / Shift Note */}
              <div style={{ marginTop: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Optional Handover / Shift Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Completed prep, fridge restocked"
                  value={checkOutNote}
                  onChange={(e) => setCheckOutNote(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid var(--border-glass)',
                    color: '#FFF',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, padding: '0.75rem' }}
                onClick={() => setIsCheckOutModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  flex: 2,
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)'
                }}
                onClick={handleConfirmCheckOut}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>Recording...</span>
                ) : (
                  <>
                    <Check size={18} /> Confirm Check Out ({modalPreviewHours.toFixed(1)}h)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
