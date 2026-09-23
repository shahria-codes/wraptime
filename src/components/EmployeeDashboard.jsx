import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, collection, onSnapshot } from '../firebase';
import { BRANCHES } from './Navbar';
import { UserAvatar } from './UserAvatar';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Store, 
  Users, 
  Award, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, parseISO, isSameDay } from 'date-fns';

export const EmployeeDashboard = ({ selectedBranch, activeSubTab = 'my-schedule' }) => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

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

  const employeeMap = React.useMemo(() => {
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

  // Employee's own shifts
  const myUid = userProfile?.uid;
  const myShifts = shifts.filter(s => s.userId === myUid || s.userDisplayName === userProfile?.displayName);

  // Total statistics calculation
  const totalDaysWorked = new Set(myShifts.map(s => s.date)).size;
  const totalHoursWorked = myShifts.reduce((acc, s) => acc + calculateHours(s.startTime, s.endTime, s.breakMinutes), 0);

  // Filtered Branch Roster shifts
  const branchShifts = shifts.filter(s => {
    if (selectedBranch !== 'ALL' && s.branch !== selectedBranch) return false;
    return true;
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  return (
    <div className="animate-fade-in">
      
      {/* Welcome Banner & Personal Summary */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '6px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: '1 1 200px' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              👋 Welcome back, {userProfile?.displayName}!
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Wraperia Suppa Kebs Employee Dashboard
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '0.55rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', minWidth: '90px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Days</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{totalDaysWorked}</div>
            </div>
            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '0.55rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', minWidth: '90px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Hours</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{totalHoursWorked.toFixed(1)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* View Switcher: My Shifts vs Branch Roster */}
      <div style={{ marginBottom: '1.5rem' }}>
        {activeSubTab === 'my-schedule' ? (
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock color="var(--primary)" /> My Scheduled Shifts
            </h3>

            {myShifts.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>You have no scheduled shifts yet. Check back soon after your manager publishes the weekly schedule!</p>
              </div>
            ) : (
              <div className="grid-auto-fill-280">
                {myShifts.sort((a,b) => a.date.localeCompare(b.date)).map(shift => {
                  const hrs = calculateHours(shift.startTime, shift.endTime, shift.breakMinutes);
                  const shiftDate = parseISO(shift.date);
                  const isToday = isSameDay(shiftDate, new Date());

                  return (
                    <div 
                      key={shift.id}
                      className="glass-card"
                      style={{ 
                        padding: '1.25rem',
                        borderLeft: isToday ? '6px solid var(--primary)' : '1px solid var(--border-color)',
                        background: isToday ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-card)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span className="badge badge-amber">📍 {shift.branch}</span>
                        {isToday && <span className="badge badge-green">🔥 Today</span>}
                      </div>

                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                        {format(shiftDate, 'EEEE, MMM dd, yyyy')}
                      </div>

                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        <Clock size={16} /> {shift.startTime} - {shift.endTime} ({hrs.toFixed(1)} hrs)
                      </div>

                      {shift.note && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
                          🏷️ {shift.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="page-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users color="var(--primary)" /> Branch Co-Workers Roster
              </h3>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Viewing: <span className="badge badge-amber">{selectedBranch === 'ALL' ? 'All 5 Branches' : selectedBranch}</span>
              </div>
            </div>

            {/* Weekly Grid for Roster */}
            <div className="grid-week">
              {weekDays.map(dayDate => {
                const dateStr = format(dayDate, 'yyyy-MM-dd');
                const isToday = isSameDay(dayDate, new Date());
                const dayShifts = branchShifts.filter(s => s.date === dateStr);

                return (
                  <div 
                    key={dateStr}
                    className="glass-card"
                    style={{ 
                      padding: '0.85rem', 
                      minHeight: '300px',
                      border: isToday ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: isToday ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-card)'
                    }}
                  >
                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: isToday ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {format(dayDate, 'EEE')}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {format(dayDate, 'MMM dd')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {dayShifts.length === 0 ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', textAlign: 'center', padding: '1rem 0' }}>
                          No team scheduled
                        </div>
                      ) : (
                        dayShifts.map(s => (
                          <div 
                            key={s.id}
                            onClick={() => navigate(`/profile/${s.userId}`)}
                            title={`Click to view ${s.userDisplayName}'s staff profile`}
                            style={{ 
                              background: 'rgba(15, 23, 42, 0.75)',
                              padding: '0.5rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              borderLeft: s.userId === myUid ? '3px solid var(--success)' : '3px solid var(--primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '4px' }}>
                              <UserAvatar
                                photoURL={employeeMap[s.userId]?.photoURL || s.photoURL}
                                displayName={s.userDisplayName}
                                size={20}
                              />
                              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: s.userId === myUid ? 'var(--success)' : '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {s.userDisplayName} {s.userId === myUid && '(You)'}
                              </div>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)' }}>
                              {s.startTime} - {s.endTime}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              📍 {s.branch}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

    </div>
  );
};
