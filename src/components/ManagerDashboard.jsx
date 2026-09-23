import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from '../firebase';
import { BRANCHES } from './Navbar';
import { UserAvatar } from './UserAvatar';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
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
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  // Quick Multi-Date Scheduler State
  const [formUserId, setFormUserId] = useState('');
  const [formBranch, setFormBranch] = useState(selectedBranch !== 'ALL' ? selectedBranch : 'Panorama');
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

  const getEmpWorkingStats = (userId, displayName) => {
    const userShifts = shifts.filter(s => s.userId === userId || (displayName && s.userDisplayName === displayName));
    const daysWorked = new Set(userShifts.map(s => s.date)).size;
    const totalHours = userShifts.reduce((acc, s) => acc + getShiftWorkedHours(s), 0);
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

  const handleOpenAddModal = (targetDateStr = null, defaultBranch = 'Panorama') => {
    setEditingShift(null);
    setFormUserId(schedulableEmployees[0]?.uid || schedulableEmployees[0]?.id || '');
    setFormBranch(selectedBranch !== 'ALL' ? selectedBranch : defaultBranch);
    setFormStartTime('09:00');
    setFormEndTime('22:00');
    setFormBreakMinutes('60');
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
    setFormBranch(shift.branch);
    setFormStartTime(shift.startTime || '09:00');
    setFormEndTime(shift.endTime || '22:00');
    setFormBreakMinutes(String(shift.breakMinutes ?? 60));
    setFormActualHours(shift.actualHours !== undefined && shift.actualHours !== null ? String(shift.actualHours) : '');
    setFormNote(shift.note || '');
    setSelectedDates([shift.date]);
    setCalendarMonth(startOfMonth(parseISO(shift.date)));
    setIsModalOpen(true);
  };

  // Helper: Check if selected employee already has a shift on date at another branch
  const getEmployeeLocationConflict = (userId, dateStr, currentTargetBranch) => {
    if (!userId || !dateStr) return null;
    const existingShift = shifts.find(s => {
      if (editingShift && s.id === editingShift.id) return false;
      return s.userId === userId && s.date === dateStr && s.branch !== currentTargetBranch;
    });
    return existingShift ? existingShift.branch : null;
  };

  const toggleDateSelection = (dateStr) => {
    if (editingShift) return; // Edit mode operates on single date

    if (isBefore(startOfDay(parseISO(dateStr)), startOfDay(new Date()))) {
      showAlert("Past dates cannot be scheduled. Please select today or a future date.", "Past Date Restricted", "warning");
      return;
    }

    const conflictBranch = getEmployeeLocationConflict(formUserId, dateStr, formBranch);
    if (conflictBranch) {
      const emp = employees.find(e => (e.uid || e.id) === formUserId);
      const empName = emp ? emp.displayName : 'This employee';
      showAlert(`${empName} is already scheduled at "${conflictBranch}" on ${dateStr}.\nAn employee cannot be scheduled in different locations on the same day.`, "Location Conflict", "warning");
      return;
    }

    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr]);
    }
  };

  const selectAllMonthDays = () => {
    if (editingShift || !formUserId) return;
    const validDates = [];
    const conflicts = [];
    const today = startOfDay(new Date());

    monthDays.forEach(d => {
      // Skip past dates
      if (isBefore(startOfDay(d), today)) return;

      const dStr = format(d, 'yyyy-MM-dd');
      const conflictBranch = getEmployeeLocationConflict(formUserId, dStr, formBranch);
      if (conflictBranch) {
        conflicts.push(`${dStr} (${conflictBranch})`);
      } else {
        validDates.push(dStr);
      }
    });

    if (validDates.length > 0) {
      setSelectedDates(validDates);
    }
    if (conflicts.length > 0) {
      showAlert(`Skipped ${conflicts.length} conflicting date(s) where employee is already scheduled at another location:\n\n` + conflicts.slice(0, 5).join('\n') + (conflicts.length > 5 ? '\n...' : ''), "Conflicts Skipped", "info");
    }
  };

  const clearDateSelection = () => {
    if (!editingShift) {
      setSelectedDates([]);
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formUserId) {
      showAlert("Please select an employee.", "Selection Required", "warning");
      return;
    }
    if (selectedDates.length === 0) {
      showAlert("Please select at least one working date.", "Selection Required", "warning");
      return;
    }

    // Double check conflict & past date validation for all selected dates
    const today = startOfDay(new Date());
    for (const dStr of selectedDates) {
      if (isBefore(startOfDay(parseISO(dStr)), today)) {
        showAlert(`Cannot save schedule for ${dStr}:\nPast dates cannot be scheduled.`, "Past Date Restricted", "error");
        return;
      }
      const conflictBranch = getEmployeeLocationConflict(formUserId, dStr, formBranch);
      if (conflictBranch) {
        const emp = employees.find(e => (e.uid || e.id) === formUserId);
        showAlert(`${emp?.displayName || 'Employee'} is already scheduled at "${conflictBranch}" on ${dStr}.\nAn employee cannot be scheduled in different locations on the same day.`, "Location Conflict Warning", "error");
        return;
      }
    }

    const selectedEmp = employees.find(emp => (emp.uid || emp.id) === formUserId);
    const empName = selectedEmp ? selectedEmp.displayName : 'Employee';

    const calculatedHours = calculateShiftHours(formStartTime, formEndTime, Number(formBreakMinutes));
    const finalActualHours = formActualHours !== '' ? parseFloat(formActualHours) : parseFloat(calculatedHours);

    if (editingShift) {
      // Single shift update
      const shiftData = {
        userId: formUserId,
        userDisplayName: empName,
        branch: formBranch,
        date: selectedDates[0],
        startTime: formStartTime,
        endTime: formEndTime,
        breakMinutes: Number(formBreakMinutes),
        actualHours: finalActualHours,
        note: formNote,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'shifts', editingShift.id), shiftData);
    } else {
      // Create shifts across all selected calendar dates
      for (const dStr of selectedDates) {
        const newDocRef = doc(collection(db, 'shifts'));
        await setDoc(newDocRef, {
          userId: formUserId,
          userDisplayName: empName,
          branch: formBranch,
          date: dStr,
          startTime: formStartTime,
          endTime: formEndTime,
          breakMinutes: Number(formBreakMinutes),
          actualHours: finalActualHours,
          note: formNote,
          createdAt: new Date().toISOString()
        });
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteShift = async (shiftId) => {
    const confirmed = await showConfirm('Are you sure you want to delete this scheduled shift?', 'Delete Scheduled Shift', 'danger');
    if (!confirmed) return;
    await deleteDoc(doc(db, 'shifts', shiftId));
  };

  const calculateShiftHours = (start, end, breakMins = 0) => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let totalMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    totalMinutes -= breakMins;
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
            Schedule employees across all 5 branches.
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
          Active Location: <span className="badge badge-amber">{selectedBranch === 'ALL' ? 'All 5 Branches' : selectedBranch}</span>
        </div>
      </div>

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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {dayShifts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-subtle)', fontSize: '0.75rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    No shifts scheduled
                  </div>
                ) : (
                  dayShifts.map((shift) => {
                    const hrs = shift.actualHours !== undefined && shift.actualHours !== null
                      ? parseFloat(shift.actualHours).toFixed(1)
                      : calculateShiftHours(shift.startTime, shift.endTime, shift.breakMinutes);

                    return (
                      <div
                        key={shift.id}
                        className="shift-card"
                      >
                        {/* Row 1: Avatar + Name & Branch */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <UserAvatar
                            photoURL={employeeMap[shift.userId]?.photoURL || shift.photoURL}
                            displayName={shift.userDisplayName}
                            size={28}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                              {shift.userDisplayName}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '1px' }}>
                              📍 {shift.branch}
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Shift Time & Duration */}
                        <div style={{ fontSize: '0.76rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, background: 'rgba(255,255,255,0.05)', padding: '4px 7px', borderRadius: '6px', flexWrap: 'wrap' }}>
                          <Clock size={12} style={{ flexShrink: 0 }} /> 
                          <span style={{ whiteSpace: 'nowrap' }}>{shift.startTime || '09:00'} - {shift.endTime || '22:00'}</span>
                          <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.74rem' }}>({hrs}h)</span>
                        </div>

                        {/* Optional Note / Sick Info */}
                        {shift.note && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2px 4px' }}>
                            📝 {shift.note}
                          </div>
                        )}

                        {/* Row 3: Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', paddingTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <button 
                            type="button"
                            className="btn btn-sm btn-secondary" 
                            style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                            onClick={() => handleOpenEditModal(shift)}
                            title="Edit shift"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button 
                            type="button"
                            className="btn btn-sm btn-danger" 
                            style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                            onClick={() => handleDeleteShift(shift.id)}
                            title="Delete shift"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                      </div>
                    );
                  })
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
              
              {/* 1. Employee Name */}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                  <User size={16} /> Employee Name
                </label>

                {/* Selected Employee Preview with Avatar */}
                {formUserId && employeeMap[formUserId] && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '0.65rem'
                  }}>
                    <UserAvatar
                      photoURL={employeeMap[formUserId].photoURL}
                      displayName={employeeMap[formUserId].displayName}
                      size={38}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        {employeeMap[formUserId].displayName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {employeeMap[formUserId].email || 'Staff Employee'} • {employeeMap[formUserId].assignedBranch || 'Suppa Kebs'}
                      </div>
                    </div>
                  </div>
                )}

                <select 
                  className="form-select" 
                  value={formUserId} 
                  onChange={(e) => setFormUserId(e.target.value)}
                  required
                  style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
                >
                  {schedulableEmployees.length === 0 ? (
                    <option value="">No authorized employees found</option>
                  ) : (
                    schedulableEmployees.map(emp => (
                      <option key={emp.uid || emp.id} value={emp.uid || emp.id}>
                        {emp.displayName} ({emp.assignedBranch || 'Employee'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* 2. Location (Branch) */}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                  <Store size={16} /> Location (Branch)
                </label>
                <select 
                  className="form-select"
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  required
                  style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
                >
                  {BRANCHES.map(b => (
                    <option key={b} value={b}>📍 {b}</option>
                  ))}
                </select>
              </div>

              {/* 3. Shift Times & Worked Hours (ONLY shown when editing an existing shift) */}
              {editingShift && (
                <div className="form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--accent-gold)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={16} /> Shift Timing & Worked Hours Adjustment
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Start Time</label>
                      <input 
                        type="time" 
                        className="form-control" 
                        value={formStartTime} 
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setFormStartTime(newStart);
                          const [sH, sM] = newStart.split(':').map(Number);
                          const [eH, eM] = formEndTime.split(':').map(Number);
                          let grossMinutes = (eH * 60 + eM) - (sH * 60 + sM);
                          if (grossMinutes < 0) grossMinutes += 24 * 60;
                          setFormBreakMinutes(String((grossMinutes / 60) >= 8 ? 60 : 30));
                        }}
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>End Time</label>
                      <input 
                        type="time" 
                        className="form-control" 
                        value={formEndTime} 
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          setFormEndTime(newEnd);
                          const [sH, sM] = formStartTime.split(':').map(Number);
                          const [eH, eM] = newEnd.split(':').map(Number);
                          let grossMinutes = (eH * 60 + eM) - (sH * 60 + sM);
                          if (grossMinutes < 0) grossMinutes += 24 * 60;
                          setFormBreakMinutes(String((grossMinutes / 60) >= 8 ? 60 : 30));
                        }}
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Break (Mins) <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>(&ge;8h=60m, &lt;8h=30m)</span>
                      </label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={formBreakMinutes} 
                        onChange={(e) => setFormBreakMinutes(e.target.value)}
                        placeholder="60"
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success)' }}>
                        Worked Hours (Sick / Early)
                      </label>
                      <input 
                        type="number" 
                        step="0.5"
                        min="0"
                        max="24"
                        className="form-control" 
                        value={formActualHours} 
                        onChange={(e) => setFormActualHours(e.target.value)}
                        placeholder={`Auto: ${calculateShiftHours(formStartTime, formEndTime, Number(formBreakMinutes))}h`}
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem', borderColor: formActualHours ? 'var(--success)' : undefined }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Shift Notes / Sick Reason</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formNote} 
                      onChange={(e) => setFormNote(e.target.value)}
                      placeholder="e.g. Left early sick at 14:00"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}

              {/* 3. Full Month Interactive Calendar Date Picker */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                
                {/* Month Navigation & Batch Selectors */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                    <CalendarIcon size={16} /> Select Working Dates ({selectedDates.length} selected)
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
                    {/* Padding cells before 1st of month */}
                    {paddingDays.map(p => (
                      <div key={`pad-${p}`} style={{ height: '36px' }} />
                    ))}

                    {/* Days of the month */}
                    {monthDays.map(d => {
                      const dStr = format(d, 'yyyy-MM-dd');
                      const isSelected = selectedDates.includes(dStr);
                      const isToday = isSameDay(d, new Date());
                      const isPast = isBefore(startOfDay(d), startOfDay(new Date()));
                      const conflictLocation = getEmployeeLocationConflict(formUserId, dStr, formBranch);

                      return (
                        <button
                          key={dStr}
                          type="button"
                          disabled={isPast}
                          onClick={() => !isPast && toggleDateSelection(dStr)}
                          title={isPast ? "Past date - cannot be scheduled" : conflictLocation ? `Conflict: Already scheduled at ${conflictLocation}` : `${format(d, 'MMM d, yyyy')}`}
                          className={`cal-day-btn${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' is-today' : ''}${conflictLocation ? ' conflict' : ''}`}
                          style={isPast ? { opacity: 0.3, cursor: 'not-allowed', background: 'rgba(255,255,255,0.02)', pointerEvents: 'none' } : {}}
                        >
                          <span>{format(d, 'd')}</span>
                          {conflictLocation && !isPast && (
                            <AlertTriangle size={10} style={{ position: 'absolute', top: '2px', right: '2px' }} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                </div>

              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.95rem' }}>
                  <Check size={17} /> {editingShift ? 'Update Shift' : `Save ${selectedDates.length} Shift${selectedDates.length > 1 ? 's' : ''}`}
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

    </div>
  );
};
