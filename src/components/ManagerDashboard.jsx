import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from '../firebase';
import { useBranches } from '../context/BranchContext';
import { UserAvatar } from './UserAvatar';
import { BranchManagerModal } from './BranchManagerModal';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Clock, 
  Store, 
  User, 
  Zap,
  Check,
  AlertTriangle,
  X
} from 'lucide-react';
import { 
  format, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  isSameDay, 
  parseISO, 
  addWeeks, 
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  startOfDay,
  isBefore
} from 'date-fns';

import { useToast } from '../context/ToastContext';

export const ManagerDashboard = ({ selectedBranch }) => {
  const { showAlert, showConfirm } = useToast();
  const { branches, branchNames, getBranchHoursForDate } = useBranches();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  // Accordion state for branch cards { [branchKey]: boolean }
  const [expandedBranches, setExpandedBranches] = useState({});

  const toggleBranch = (key) => {
    setExpandedBranches(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Quick Multi-Date Scheduler State
  const [formUserId, setFormUserId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [formBranch, setFormBranch] = useState(selectedBranch !== 'ALL' ? selectedBranch : (branchNames[0] || ''));
  const [locationMode, setLocationMode] = useState('same'); // 'same', 'per_date', or 'per_employee'
  const [userBranches, setUserBranches] = useState({}); // { [uid]: branch }
  const [dateBranches, setDateBranches] = useState({}); // { [dateStr]: branch }
  const [activeDatePrompt, setActiveDatePrompt] = useState(null);
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('22:00');
  const [formBreakMinutes, setFormBreakMinutes] = useState('60');
  const [formActualHours, setFormActualHours] = useState('');
  const [formNote, setFormNote] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));

  // Fetch authorized employees & shifts from Firestore
  useEffect(() => {
    const unsubscribeShifts = onSnapshot(collection(db, 'shifts'), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setShifts(list);
    }, (err) => console.error("Firestore shifts error:", err));

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status === 'authorized') {
          list.push({ uid: docSnap.id, ...data });
        }
      });
      setEmployees(list);
      setLoading(false);
    }, (err) => console.error("Firestore users error:", err));

    return () => {
      unsubscribeShifts();
      unsubscribeUsers();
    };
  }, []);

  // Only employees (not managers) are schedulable
  const schedulableEmployees = employees.filter(emp => emp.role !== 'manager');

  // Employee lookup map for quick access to photoURL & metadata
  const employeeMap = React.useMemo(() => {
    const map = {};
    employees.forEach(emp => {
      map[emp.uid || emp.id] = emp;
    });
    return map;
  }, [employees]);

  // When branch or date changes in the modal, auto-fill shift times from branch settings for that day
  const applyBranchHours = (branchName, dateStr) => {
    if (!branchName) return;
    const targetDate = dateStr || (selectedDates[0] ? selectedDates[0] : format(new Date(), 'yyyy-MM-dd'));
    const hours = getBranchHoursForDate(branchName, targetDate);
    if (hours) {
      if (hours.closed) {
        showAlert(`${branchName} is marked as Closed on this day.`, 'warning');
      } else {
        setFormStartTime(hours.open || '09:00');
        setFormEndTime(hours.close || '22:00');
        setFormBreakMinutes(String(getAutoBreakMinutes(hours.open || '09:00', hours.close || '22:00')));
      }
    }
  };

  const getShiftWorkedHours = (s) => {
    if (!s) return 0;
    if (s.actualHours !== undefined && s.actualHours !== null && s.actualHours !== '') {
      return parseFloat(s.actualHours) || 0;
    }
    const [sH, sM] = (s.startTime || '09:00').split(':').map(Number);
    const [eH, eM] = (s.endTime || '22:00').split(':').map(Number);
    let grossMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (grossMinutes < 0) grossMinutes += 24 * 60;
    const grossHours = grossMinutes / 60;

    let breakMins = grossHours >= 8 ? 60 : 30;
    if (s.breakMinutes !== undefined && s.breakMinutes !== null && s.breakMinutes !== '') {
      const b = Number(s.breakMinutes);
      if (!isNaN(b) && b >= 0) breakMins = b;
    }

    let netMinutes = grossMinutes - breakMins;
    return Math.max(0, netMinutes / 60);
  };

  const formatSingleName = (displayName) => {
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

  const getEmpWorkingStats = (userId, displayName) => {
    const userShifts = shifts.filter(s => s.userId === userId || (displayName && s.userDisplayName === displayName));
    const attendedShifts = userShifts.filter(s => s.status === 'completed' || s.status === 'checked-in' || !!s.checkInTime);
    const daysWorked = new Set(attendedShifts.map(s => s.date)).size;
    const totalHours = attendedShifts.reduce((acc, s) => acc + getShiftWorkedHours(s), 0);
    return { daysWorked, totalHours };
  };

  // Generate 7 days for current week view (Mon - Sun)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Generate all days in current calendar month for the interactive picker
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate padding days for Monday start (1 = Mon, 0 = Sun)
  const startDayOfWeek = getDay(monthStart);
  const paddingOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const paddingDays = Array.from({ length: paddingOffset }, (_, i) => i);

  const toggleUserSelection = (uId) => {
    if (editingShift) {
      setFormUserId(uId);
      setSelectedUserIds([uId]);
    } else {
      if (selectedUserIds.includes(uId)) {
        if (selectedUserIds.length > 1) {
          setSelectedUserIds(selectedUserIds.filter(id => id !== uId));
        }
      } else {
        setSelectedUserIds([...selectedUserIds, uId]);
      }
    }
  };

  const selectAllEmployees = () => {
    if (editingShift) return;
    const allIds = schedulableEmployees.map(e => e.uid || e.id);
    setSelectedUserIds(allIds);
  };

  const clearEmployeeSelection = () => {
    if (editingShift) return;
    const firstUid = schedulableEmployees[0]?.uid || schedulableEmployees[0]?.id;
    setSelectedUserIds(firstUid ? [firstUid] : []);
  };

  const handleOpenAddModal = (targetDateStr = null, defaultBranch = null) => {
    if (branchNames.length === 0) {
      showAlert('Please create at least one branch before scheduling shifts.', 'warning');
      setIsBranchModalOpen(true);
      return;
    }
    setEditingShift(null);
    const firstUid = schedulableEmployees[0]?.uid || schedulableEmployees[0]?.id || '';
    setFormUserId(firstUid);
    setSelectedUserIds(firstUid ? [firstUid] : []);
    const initialBranch = selectedBranch !== 'ALL' ? selectedBranch : (defaultBranch || branchNames[0] || '');
    setFormBranch(initialBranch);
    setLocationMode('same');

    const initialEmpMap = {};
    schedulableEmployees.forEach(e => {
      const uid = e.uid || e.id;
      initialEmpMap[uid] = e.assignedBranch || initialBranch;
    });
    setUserBranches(initialEmpMap);

    const initialDateMap = {};
    if (targetDateStr) {
      initialDateMap[targetDateStr] = initialBranch;
    }
    setDateBranches(initialDateMap);

    const targetDate = targetDateStr || format(new Date(), 'yyyy-MM-dd');
    const branchHours = getBranchHoursForDate(initialBranch, targetDate);
    if (branchHours && !branchHours.closed) {
      setFormStartTime(branchHours.open || '09:00');
      setFormEndTime(branchHours.close || '22:00');
      setFormBreakMinutes(String(getAutoBreakMinutes(branchHours.open || '09:00', branchHours.close || '22:00')));
    } else {
      setFormStartTime('09:00');
      setFormEndTime('22:00');
      setFormBreakMinutes('60');
    }
    setFormActualHours('');
    setFormNote('');

    if (targetDateStr) {
      const parsedDefault = parseISO(targetDateStr);
      if (!isBefore(startOfDay(parsedDefault), startOfDay(new Date()))) {
        setSelectedDates([targetDateStr]);
        setCalendarMonth(startOfMonth(parsedDefault));
      } else {
        setSelectedDates([]);
        setCalendarMonth(startOfMonth(new Date()));
      }
    } else {
      setSelectedDates([]);
      setCalendarMonth(startOfMonth(new Date()));
    }

    setIsModalOpen(true);
  };

  const handleOpenEditModal = (shift) => {
    setEditingShift(shift);
    setFormUserId(shift.userId);
    setSelectedUserIds([shift.userId]);
    setFormBranch(shift.branch);
    setLocationMode('same');
    setUserBranches({ [shift.userId]: shift.branch });
    setDateBranches({ [shift.date]: shift.branch });
    setFormStartTime(shift.startTime || '09:00');
    setFormEndTime(shift.endTime || '22:00');
    setFormBreakMinutes(String(shift.breakMinutes ?? 60));
    setFormActualHours(shift.actualHours !== undefined && shift.actualHours !== null ? String(shift.actualHours) : '');
    setFormNote(shift.note || '');
    setSelectedDates([shift.date]);
    setCalendarMonth(startOfMonth(parseISO(shift.date)));
    setIsModalOpen(true);
  };

  const toggleDateSelection = (dateStr) => {
    if (editingShift) return; // Date is locked for specific shift editing
    if (isBefore(startOfDay(parseISO(dateStr)), startOfDay(new Date()))) {
      showAlert("Past dates cannot be scheduled. Please select today or a future date.", "Past Date Restricted", "warning");
      return;
    }

    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
      if (activeDatePrompt === dateStr) {
        setActiveDatePrompt(null);
      }
    } else {
      setSelectedDates([...selectedDates, dateStr]);
      if (!dateBranches[dateStr]) {
        setDateBranches(prev => ({ ...prev, [dateStr]: formBranch }));
      }
      setActiveDatePrompt(dateStr);
    }
  };

  const selectAllMonthDays = () => {
    if (editingShift || selectedUserIds.length === 0) return;
    const validDates = [];
    const today = startOfDay(new Date());
    const newDateBranches = { ...dateBranches };

    monthDays.forEach(d => {
      // Skip past dates
      if (isBefore(startOfDay(d), today)) return;
      const dStr = format(d, 'yyyy-MM-dd');
      validDates.push(dStr);
      if (!newDateBranches[dStr]) {
        newDateBranches[dStr] = formBranch;
      }
    });

    if (validDates.length > 0) {
      setSelectedDates(validDates);
      setDateBranches(newDateBranches);
    }
  };

  const clearDateSelection = () => {
    if (!editingShift) {
      setSelectedDates([]);
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      showAlert("Please select at least one employee.", "Selection Required", "warning");
      return;
    }
    if (selectedDates.length === 0) {
      showAlert("Please select at least one working date.", "Selection Required", "warning");
      return;
    }

    // Past date validation
    const today = startOfDay(new Date());
    for (const dStr of selectedDates) {
      if (isBefore(startOfDay(parseISO(dStr)), today)) {
        showAlert(`Cannot save schedule for ${dStr}:\nPast dates cannot be scheduled.`, "Past Date Restricted", "error");
        return;
      }
    }

    const autoBreak = getAutoBreakMinutes(formStartTime, formEndTime);
    const calculatedHours = calculateShiftHours(formStartTime, formEndTime, autoBreak);
    const finalActualHours = formActualHours !== '' ? parseFloat(formActualHours) : parseFloat(calculatedHours);

    if (editingShift) {
      // Single shift update
      const targetUid = selectedUserIds[0] || formUserId;
      const selectedEmp = employees.find(emp => (emp.uid || emp.id) === targetUid);
      const empName = selectedEmp ? selectedEmp.displayName : 'Employee';

      let empBranch = formBranch;
      if (locationMode === 'per_date' && dateBranches[selectedDates[0]]) {
        empBranch = dateBranches[selectedDates[0]];
      } else if (locationMode === 'per_employee' && userBranches[targetUid]) {
        empBranch = userBranches[targetUid];
      }

      const shiftData = {
        userId: targetUid,
        userDisplayName: empName,
        branch: empBranch,
        date: selectedDates[0],
        startTime: formStartTime,
        endTime: formEndTime,
        breakMinutes: autoBreak,
        actualHours: finalActualHours,
        note: formNote,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'shifts', editingShift.id), shiftData);
    } else {
      // Create/replace shifts for ALL selected employees across ALL selected dates
      for (const uId of selectedUserIds) {
        const selectedEmp = employees.find(emp => (emp.uid || emp.id) === uId);
        const empName = selectedEmp ? selectedEmp.displayName : 'Employee';

        for (const dStr of selectedDates) {
          let empBranch = formBranch;
          if (locationMode === 'per_date' && dateBranches[dStr]) {
            empBranch = dateBranches[dStr];
          } else if (locationMode === 'per_employee' && userBranches[uId]) {
            empBranch = userBranches[uId];
          }

          const existingShift = shifts.find(s => s.userId === uId && s.date === dStr);
          if (existingShift) {
            await updateDoc(doc(db, 'shifts', existingShift.id), {
              userDisplayName: empName,
              branch: empBranch,
              startTime: formStartTime,
              endTime: formEndTime,
              breakMinutes: autoBreak,
              actualHours: finalActualHours,
              note: formNote,
              updatedAt: new Date().toISOString()
            });
          } else {
            const newDocRef = doc(collection(db, 'shifts'));
            await setDoc(newDocRef, {
              userId: uId,
              userDisplayName: empName,
              branch: empBranch,
              date: dStr,
              startTime: formStartTime,
              endTime: formEndTime,
              breakMinutes: autoBreak,
              actualHours: finalActualHours,
              note: formNote,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteShift = async (shiftId) => {
    const confirmed = await showConfirm('Are you sure you want to delete this scheduled shift?', 'Delete Scheduled Shift', 'danger');
    if (!confirmed) return;
    await deleteDoc(doc(db, 'shifts', shiftId));
  };

  const getAutoBreakMinutes = (start, end) => {
    if (!start || !end) return 30;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let grossMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (grossMinutes < 0) grossMinutes += 24 * 60;
    return (grossMinutes / 60) >= 8 ? 60 : 30;
  };

  const calculateShiftHours = (start, end, breakMins = null) => {
    if (!start || !end) return 0;
    const b = (breakMins !== null && breakMins !== undefined && breakMins !== '')
      ? Number(breakMins)
      : getAutoBreakMinutes(start, end);
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let totalMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    totalMinutes -= b;
    return Math.max(0, (totalMinutes / 60)).toFixed(1);
  };

  const filteredShifts = shifts.filter(s => {
    if (selectedBranch !== 'ALL' && s.branch !== selectedBranch) return false;
    return true;
  });

  return (
    <div className="animate-fade-in">
      
      {/* Header controls: Week Navigator & Quick Actions */}
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon color="var(--primary)" /> Schedule Builder
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Schedule employees across workplace branches.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Week Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
            <button className="btn btn-sm btn-secondary" style={{ padding: '0.35rem 0.6rem' }} onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
              <ChevronLeft size={15} />
            </button>
            <button className="btn btn-sm btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }} onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              This Week
            </button>
            <button className="btn btn-sm btn-secondary" style={{ padding: '0.35rem 0.6rem' }} onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
              <ChevronRight size={15} />
            </button>
          </div>

          <button className="btn btn-primary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.88rem' }} onClick={() => handleOpenAddModal()}>
            <Zap size={16} /> Schedule
          </button>
        </div>
      </div>

      {/* Week Date Subtitle Banner */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent-gold)' }}>
          🗓️ {format(currentWeekStart, 'MMM dd')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM dd, yyyy')}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Active Location: <span className="badge badge-amber">{selectedBranch === 'ALL' ? 'All Branches' : selectedBranch}</span>
        </div>
      </div>

      {/* Empty Branches Onboarding Hero Banner */}
      {branches.length === 0 && (
        <div className="glass-panel animate-fade-in" style={{
          textAlign: 'center',
          padding: '2.5rem 1.5rem',
          marginBottom: '1.5rem',
          border: '1.5px dashed var(--accent-gold)',
          background: 'rgba(245, 158, 11, 0.05)',
          borderRadius: '12px'
        }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <Store size={28} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.4rem', color: 'var(--text-main)' }}>
            No Branches Created Yet
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 1.25rem' }}>
            Welcome Manager! Please set up your first workplace branch to begin creating schedules and tracking attendance.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsBranchModalOpen(true)}
            style={{ padding: '0.6rem 1.3rem', fontSize: '0.9rem' }}
          >
            <Plus size={16} /> Create Your First Branch
          </button>
        </div>
      )}

      {/* Weekly Schedule Grid (7 Days) */}
      <div className="grid-week">
        {weekDays.map((dayDate) => {
          const dateStr = format(dayDate, 'yyyy-MM-dd');
          const isToday = isSameDay(dayDate, new Date());
          const dayShifts = filteredShifts.filter(s => s.date === dateStr);

          const isDayInPast = isBefore(startOfDay(dayDate), startOfDay(new Date()));

          return (
            <div
              key={dateStr}
              className={`day-column${isToday ? ' is-today' : ''}`}
              style={isDayInPast ? { opacity: 0.78 } : {}}
            >
              {/* Day Header */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700, color: isToday ? 'var(--primary)' : isDayInPast ? 'var(--text-subtle)' : 'var(--text-muted)' }}>
                    {format(dayDate, 'EEE')}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isDayInPast ? 'var(--text-muted)' : 'var(--text-main)' }}>
                    {format(dayDate, 'MMM dd')}
                  </div>
                </div>

                <button 
                  className="btn btn-sm btn-primary" 
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.75rem',
                    opacity: isDayInPast ? 0.35 : 1,
                    cursor: isDayInPast ? 'not-allowed' : 'pointer'
                  }}
                  disabled={isDayInPast}
                  onClick={() => !isDayInPast && handleOpenAddModal(dateStr)}
                  title={isDayInPast ? "Past dates cannot be scheduled" : "Schedule employee on this date"}
                >
                  <Plus size={14} /> Schedule
                </button>
              </div>

              {/* Day Shifts */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {dayShifts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-subtle)', fontSize: '0.75rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    No shifts scheduled
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
                      const isExpanded = !!expandedBranches[accordionKey];
                      const firstShift = branchShiftsList[0];
                      const allSameTime = branchShiftsList.every(
                        s => (s.startTime || '09:00') === (firstShift.startTime || '09:00') &&
                             (s.endTime || '22:00') === (firstShift.endTime || '22:00')
                      );
                      const sharedTimeStr = `${firstShift.startTime || '09:00'} - ${firstShift.endTime || '22:00'}`;
                      const branchHours = getBranchHoursForDate(branchName, dateStr);
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
                          {/* Accordion Header — always visible, click to expand */}
                          <button
                            type="button"
                            onClick={() => toggleBranch(accordionKey)}
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

                              {branchShiftsList.map((shift) => (
                                <div
                                  key={shift.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.3rem',
                                    padding: '2px 0',
                                    minHeight: '24px'
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
                                        color: '#FFFFFF',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        lineHeight: 1.2
                                      }}>
                                        {formatSingleName(shift.userDisplayName || employeeMap[shift.userId]?.displayName || employeeMap[shift.userId]?.email?.split('@')[0])}
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

                                    {shift.note && (
                                      <span title={shift.note} style={{ cursor: 'help', fontSize: '0.65rem', flexShrink: 0 }}>📝</span>
                                    )}
                                  </div>

                                  {/* Right: Actions */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      style={{
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: 'var(--text-muted)',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: 1
                                      }}
                                      onClick={() => handleOpenEditModal(shift)}
                                      title="Edit shift"
                                    >
                                      <Edit3 size={10} />
                                    </button>
                                    <button
                                      type="button"
                                      style={{
                                        background: 'rgba(239,68,68,0.1)',
                                        border: '1px solid rgba(239,68,68,0.25)',
                                        color: '#F87171',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: 1
                                      }}
                                      onClick={() => handleDeleteShift(shift.id)}
                                      title="Delete shift"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                </div>
                              ))}
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

      {/* Simplified Add Schedule Modal with Full Month Interactive Calendar */}
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap color="var(--primary)" /> {editingShift ? 'Edit Shift Entry' : 'Schedule Employee'}
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setIsModalOpen(false)} style={{ padding: '4px 8px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveShift}>
              
              {/* 1. Employee Selection */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                    <User size={16} /> {editingShift ? 'Employee Name' : `Select Employee(s) (${selectedUserIds.length} selected)`}
                  </label>
                  {!editingShift && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button type="button" className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={selectAllEmployees}>
                        Select All Staff
                      </button>
                      <button type="button" className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={clearEmployeeSelection}>
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                {editingShift ? (
                  <select 
                    className="form-select" 
                    value={formUserId} 
                    onChange={(e) => {
                      setFormUserId(e.target.value);
                      setSelectedUserIds([e.target.value]);
                    }}
                    required
                    style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
                  >
                    {schedulableEmployees.map(emp => (
                      <option key={emp.uid || emp.id} value={emp.uid || emp.id}>
                        {formatSingleName(emp.displayName)} ({emp.assignedBranch || 'Employee'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.45rem',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    padding: '6px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {schedulableEmployees.map(emp => {
                      const uid = emp.uid || emp.id;
                      const isSelected = selectedUserIds.includes(uid);

                      return (
                        <div
                          key={uid}
                          onClick={() => toggleUserSelection(uid)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.45rem 0.6rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            width: 'fit-content',
                            background: isSelected ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <UserAvatar photoURL={emp.photoURL} displayName={emp.displayName} size={22} />
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                            whiteSpace: 'nowrap',
                          }}>
                            {formatSingleName(emp.displayName)}
                          </span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ pointerEvents: 'none', width: '14px', height: '14px', accentColor: 'var(--primary)' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Workplace Location Assignment Mode */}
              {!editingShift && (
                <div className="form-group" style={{ marginBottom: '1.25rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '0.6rem' }}>
                    <Store size={15} /> Workplace Location Assignment:
                  </label>
                  <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: locationMode === 'same' ? 700 : 500, color: locationMode === 'same' ? 'var(--primary)' : 'var(--text-main)', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="locationModeRadio" 
                        checked={locationMode === 'same'} 
                        onChange={() => setLocationMode('same')}
                        style={{ accentColor: 'var(--primary)', width: '15px', height: '15px' }}
                      />
                      <span>Same Place for All Dates</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: locationMode === 'per_date' ? 700 : 500, color: locationMode === 'per_date' ? 'var(--primary)' : 'var(--text-main)', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="locationModeRadio" 
                        checked={locationMode === 'per_date'} 
                        onChange={() => setLocationMode('per_date')}
                        style={{ accentColor: 'var(--primary)', width: '15px', height: '15px' }}
                      />
                      <span>Different Place per Date</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 3. Location / Branch Selection (Shown when locationMode === 'same' or when editing) */}
              {(locationMode === 'same' || editingShift) && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.4rem' }}>
                    <Store size={16} /> Location / Branch (Workplace)
                  </label>
                  <select 
                    className="form-select"
                    value={formBranch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormBranch(val);
                      const newD = {};
                      selectedDates.forEach(d => { newD[d] = val; });
                      setDateBranches(newD);
                      const newU = {};
                      selectedUserIds.forEach(u => { newU[u] = val; });
                      setUserBranches(newU);
                      // Auto-fill shift times from branch settings for selected date
                      applyBranchHours(val, selectedDates[0]);
                    }}
                    required
                    style={{ fontSize: '0.95rem', padding: '0.65rem 0.9rem' }}
                  >
                    {branchNames.map(b => (
                      <option key={b} value={b}>📍 {b}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 4. Working Date Selection & Per-Date Workplace Dropdowns */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                    <CalendarIcon size={16} /> {editingShift ? 'Scheduled Date (Fixed)' : `Select Working Date(s) (${selectedDates.length} selected)`}
                  </label>

                  {!editingShift && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button type="button" className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={selectAllMonthDays}>
                        Select All Month
                      </button>
                      <button type="button" className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={clearDateSelection}>
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {editingShift ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    borderRadius: '10px',
                    border: '1px solid var(--accent-gold)',
                    color: 'var(--accent-gold)',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}>
                    <CalendarIcon size={18} />
                    <span>{selectedDates[0] ? format(parseISO(selectedDates[0]), 'EEEE, MMMM d, yyyy') : ''}</span>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '6px', marginLeft: 'auto', color: 'var(--text-muted)' }}>
                      🔒 Locked for Edit
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Calendar Month Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.7)', padding: '6px 12px', borderRadius: '8px', marginBottom: '8px', border: '1px solid var(--border-color)' }}>
                      <button type="button" className="btn btn-sm btn-secondary" style={{ padding: '2px 6px' }} onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                        <ChevronLeft size={16} />
                      </button>

                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-gold)' }}>
                        {format(calendarMonth, 'MMMM yyyy')}
                      </span>

                      <button type="button" className="btn btn-sm btn-secondary" style={{ padding: '2px 6px' }} onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Month Days Grid (7 columns: Mon to Sun) */}
                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      
                      {/* Day Names Row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                      </div>

                      {/* Calendar Grid Cells */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {paddingDays.map(p => (
                          <div key={`pad-${p}`} style={{ height: '36px' }} />
                        ))}

                        {monthDays.map(d => {
                          const dStr = format(d, 'yyyy-MM-dd');
                          const isSelected = selectedDates.includes(dStr);
                          const isToday = isSameDay(d, new Date());
                          const isPast = isBefore(startOfDay(d), startOfDay(new Date()));
                          
                          // Find existing scheduled shift for selected employee(s) on this date
                          const targetUids = selectedUserIds.length > 0 ? selectedUserIds : (formUserId ? [formUserId] : []);
                          const existingShiftOnDate = shifts.find(s => targetUids.includes(s.userId) && s.date === dStr && (!editingShift || s.id !== editingShift.id));
                          const conflictLocation = existingShiftOnDate ? existingShiftOnDate.branch : null;
                          const assignedBranch = dateBranches[dStr] || formBranch;

                          return (
                            <button
                              key={dStr}
                              type="button"
                              disabled={isPast}
                              onClick={() => !isPast && toggleDateSelection(dStr)}
                              title={
                                isPast 
                                  ? "Past date - cannot be scheduled" 
                                  : conflictLocation 
                                    ? `Currently scheduled at ${conflictLocation}` 
                                    : `${format(d, 'MMM d, yyyy')}: ${assignedBranch}`
                              }
                              className={`cal-day-btn${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' is-today' : ''}`}
                              style={
                                isPast 
                                  ? { opacity: 0.3, cursor: 'not-allowed', background: 'rgba(255,255,255,0.02)', pointerEvents: 'none' } 
                                  : { flexDirection: 'column', padding: '2px 0', height: '42px', position: 'relative' }
                              }
                            >
                              <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? 800 : 600 }}>{format(d, 'd')}</span>
                              
                              {isSelected ? (
                                <span style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--accent-gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95%' }}>
                                  📍 {locationMode === 'per_date' ? assignedBranch : formBranch}
                                </span>
                              ) : conflictLocation && !isPast ? (
                                <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--primary)', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95%' }}>
                                  📍 {conflictLocation}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                    </div>

                    {/* Per-Date Workplace Prompt (Only the active/last-clicked date) */}
                    {locationMode === 'per_date' && selectedDates.length > 0 && (
                      <div style={{ marginTop: '0.85rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Store size={15} /> Assign Workplace for Selected Date:
                          </span>
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {Object.keys(dateBranches).filter(d => selectedDates.includes(d)).length}/{selectedDates.length} assigned
                          </span>
                        </div>

                        {activeDatePrompt && selectedDates.includes(activeDatePrompt) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(245, 158, 11, 0.12)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--accent-gold)' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-gold)', whiteSpace: 'nowrap' }}>
                              📅 {format(parseISO(activeDatePrompt), 'EEE, MMM d')}
                            </span>
                            <select
                              className="form-select"
                              value={dateBranches[activeDatePrompt] || formBranch}
                              onChange={(e) => {
                                setDateBranches(prev => ({ ...prev, [activeDatePrompt]: e.target.value }));
                              }}
                              style={{ fontSize: '0.9rem', padding: '6px 12px', fontWeight: 700, flex: 1 }}
                              autoFocus
                            >
                              {branchNames.map(b => (
                                <option key={b} value={b}>📍 {b}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
                            👆 Click a date on the calendar to assign its workplace
                          </div>
                        )}

                        {/* Mini summary of already-assigned dates */}
                        {selectedDates.length > 1 && (
                          <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {selectedDates.map(dStr => {
                              const branch = dateBranches[dStr];
                              const isActive = activeDatePrompt === dStr;
                              return (
                                <button
                                  key={dStr}
                                  type="button"
                                  onClick={() => setActiveDatePrompt(dStr)}
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '20px',
                                    border: isActive ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                                    background: isActive ? 'rgba(245,158,11,0.18)' : branch ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                                    color: isActive ? 'var(--accent-gold)' : branch ? '#4ade80' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  {format(parseISO(dStr), 'MMM d')} {branch ? `· ${branch}` : '· unset'}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* 4. Shift Timing & Worked Hours (ONLY shown when editing an existing shift) */}
              {editingShift && (
                <div className="form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.9rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--accent-gold)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={16} /> Shift Timing &amp; Worked Hours
                    </span>
                    <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      Auto Break: {getAutoBreakMinutes(formStartTime, formEndTime)}m
                    </span>
                  </div>

                  {/* Start Time & End Time */}
                  <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Start Time</label>
                      <input 
                        type="time" 
                        className="form-control" 
                        value={formStartTime} 
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setFormStartTime(newStart);
                          setFormBreakMinutes(String(getAutoBreakMinutes(newStart, formEndTime)));
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', fontSize: '0.9rem', borderRadius: '8px' }}
                      />
                    </div>
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>End Time</label>
                      <input 
                        type="time" 
                        className="form-control" 
                        value={formEndTime} 
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          setFormEndTime(newEnd);
                          setFormBreakMinutes(String(getAutoBreakMinutes(formStartTime, newEnd)));
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', fontSize: '0.9rem', borderRadius: '8px' }}
                      />
                    </div>
                  </div>

                  {/* Worked Hours (Sick/Early override) & Notes */}
                  <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success)', display: 'block', marginBottom: '0.3rem' }}>
                        Worked Hours <span style={{ fontWeight: 400, opacity: 0.85, fontSize: '0.72rem' }}>(Sick/Early)</span>
                      </label>
                      <input 
                        type="number" 
                        step="0.5"
                        min="0"
                        max="24"
                        className="form-control" 
                        value={formActualHours} 
                        onChange={(e) => setFormActualHours(e.target.value)}
                        placeholder={`Auto: ${calculateShiftHours(formStartTime, formEndTime, getAutoBreakMinutes(formStartTime, formEndTime))}h`}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', fontSize: '0.85rem', borderRadius: '8px', borderColor: formActualHours ? 'var(--success)' : undefined }}
                      />
                    </div>
                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Shift Notes / Sick Reason</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formNote} 
                        onChange={(e) => setFormNote(e.target.value)}
                        placeholder="e.g. Left early sick at 14:00"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', fontSize: '0.85rem', borderRadius: '8px' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.95rem' }}>
                  <Check size={17} /> {
                    editingShift 
                      ? 'Update Shift' 
                      : `Save ${(selectedUserIds.length * selectedDates.length) || selectedDates.length} Shift${(selectedUserIds.length * selectedDates.length) > 1 ? 's' : ''}`
                  }
                </button>
                <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Branch & Operating Hours Manager Modal */}
      <BranchManagerModal isOpen={isBranchModalOpen} onClose={() => setIsBranchModalOpen(false)} />

    </div>
  );
};
