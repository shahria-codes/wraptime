import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import html2pdf from 'html2pdf.js';
import { db, collection, onSnapshot } from '../firebase';
import { BRANCHES } from './Navbar';
import { UserAvatar } from './UserAvatar';
import { GlassSelect } from './GlassSelect';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Store, 
  FileText,
  Download,
  Loader2
} from 'lucide-react';
import { 
  format, 
  parseISO, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  subMonths 
} from 'date-fns';

export const ExcelExporter = ({ isOpen, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);
  
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real-time Firestore fetch for shifts & employees
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribeShifts = onSnapshot(collection(db, 'shifts'), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setShifts(list);
    }, (err) => console.error("Firestore shifts error:", err));

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status === 'authorized' && data.role !== 'manager') {
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
  }, [isOpen]);

  if (!isOpen) return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthNameStr = format(currentMonth, 'MMMM yyyy');

  // Filter shifts within the selected month
  const monthShifts = shifts.filter(s => {
    if (!s.date) return false;
    const d = parseISO(s.date);
    return d >= monthStart && d <= monthEnd;
  });

  // Helper to compute worked hours for a single shift
  const getShiftWorkedHours = (s) => {
    if (s.actualHours !== undefined && s.actualHours !== null && s.actualHours !== '') {
      return parseFloat(s.actualHours);
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

  // Options for Branch filter
  const branchOptions = [
    { value: 'ALL', label: 'All 5 Branches (Separated)', icon: <Store size={15} color="var(--primary)" /> },
    ...BRANCHES.map(b => ({ value: b, label: b, icon: <span style={{ fontSize: '0.9rem' }}>📍</span> }))
  ];

  // List of branches to render separately
  const branchesToRender = filterBranch === 'ALL' ? BRANCHES : [filterBranch];

  // Direct PDF File Download Handler (No System Print Dialog!)
  const handleExportPDF = () => {
    const element = document.getElementById('report-pdf-content');
    if (!element) return;

    setIsExporting(true);
    element.classList.add('pdf-export-mode');

    const opt = {
      margin:       [4, 4, 4, 4],
      filename:     `WrapTime_UAB_SuperMaistas_${filterBranch}_${format(currentMonth, 'yyyy_MM')}.pdf`,
      image:        { type: 'jpeg', quality: 0.75 },
      html2canvas:  { scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 1200 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true },
      pagebreak:    { mode: ['css'], avoid: 'tr' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      element.classList.remove('pdf-export-mode');
      setIsExporting(false);
    }).catch((err) => {
      console.error("PDF Export error:", err);
      element.classList.remove('pdf-export-mode');
      setIsExporting(false);
    });
  };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 999999 }} onClick={onClose}>
      <div 
        className="modal-content animate-fade-in print-report-container report-modal-content" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Controls (Hidden on Print) */}
        <div className="no-print report-header-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="report-header-title-box">
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <FileText color="var(--primary)" /> Monthly Branch Work Report
            </h3>
            <p className="report-header-subtitle" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              WrapTime • UAB SuperMaistas Official Presence & Hours Log
            </p>
          </div>

          <div className="report-action-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Month Navigator */}
            <div className="report-month-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.06)', padding: '4px 8px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <button 
                className="btn btn-sm btn-secondary" 
                style={{ padding: '2px 6px' }}
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent-gold)', minWidth: '115px', textAlign: 'center' }}>
                {monthNameStr}
              </span>

              <button 
                className="btn btn-sm btn-secondary" 
                style={{ padding: '2px 6px' }}
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Branch Selector */}
            <div className="report-branch-select-box" style={{ width: '210px' }}>
              <GlassSelect
                options={branchOptions}
                value={filterBranch}
                onChange={setFilterBranch}
                size="sm"
              />
            </div>

            {/* Export PDF Button (Direct 1-click file download, NO system print popup!) */}
            <button 
              className="btn btn-primary report-export-btn" 
              onClick={handleExportPDF} 
              disabled={isExporting}
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {isExporting ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
              <span>{isExporting ? 'Downloading PDF...' : 'Export PDF'}</span>
            </button>

            {/* Close Button */}
            <button className="btn btn-sm btn-secondary" onClick={onClose} style={{ padding: '6px 10px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PDF Exportable Document Container (Crisp grid borders, transparent background) */}
        <div id="report-pdf-content" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.2rem', background: 'transparent' }}>
          
          {/* Printable Report Header */}
          <div className="report-company-header" style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '0.02em' }}>
                  WrapTime
                </h1>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', margin: '0.15rem 0 0 0' }}>
                  UAB SuperMaistas
                </h2>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                  {monthNameStr}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Viewing Mode: <strong style={{ color: '#FFF' }}>{filterBranch === 'ALL' ? 'Separated Tables for All 5 Branches' : filterBranch}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Container for Branch Tables */}
          {branchesToRender.map((branchName) => {
            const branchShiftsInMonth = monthShifts.filter(s => s.branch === branchName);

            return (
              <div key={branchName} className="branch-matrix-block" style={{ marginBottom: '2.25rem' }}>
                
                {/* Branch Section Banner (Clean border, no background color) */}
                <div className="branch-banner" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 1rem',
                  background: 'transparent',
                  borderRadius: '10px 10px 0 0',
                  border: '1px solid var(--border-color)',
                  borderBottom: 'none'
                }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    📍 Branch: {branchName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Total Month Shifts at {branchName}: <span style={{ color: 'var(--accent-gold)', fontWeight: 800 }}>{branchShiftsInMonth.length}</span>
                  </div>
                </div>

                {/* Table for this Branch (No background color, crisp borders) */}
                <div className="report-matrix-wrapper">
                  <table className="report-matrix-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }}>
                    
                    {/* Header Row 1: Branch Title & Summary ColSpans */}
                    <thead>
                      <tr style={{ background: 'transparent', borderBottom: '1px solid var(--border-color)', color: 'var(--primary)', fontWeight: 800 }}>
                        <th 
                          className="emp-name-cell"
                          style={{ 
                            padding: '0.65rem 0.85rem', 
                            textAlign: 'left', 
                            minWidth: '170px', 
                            position: 'sticky', 
                            left: 0, 
                            background: 'rgba(12, 18, 38, 0.98)', 
                            zIndex: 10,
                            borderRight: '1px solid var(--border-color)',
                            borderBottom: '1px solid var(--border-color)'
                          }}
                        >
                          Employee Name
                        </th>
                        <th 
                          colSpan={monthDays.length} 
                          style={{ 
                            padding: '0.65rem', 
                            fontSize: '0.88rem', 
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            borderRight: '1px solid var(--border-color)',
                            borderBottom: '1px solid var(--border-color)',
                            background: 'transparent',
                            color: 'var(--primary)'
                          }}
                        >
                          {branchName} Monthly Work Report ({monthNameStr})
                        </th>
                        <th 
                          colSpan={2}
                          style={{ padding: '0.65rem', minWidth: '120px', background: 'transparent', color: 'var(--success)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}
                        >
                          {branchName} Summary
                        </th>
                        <th 
                          colSpan={2}
                          style={{ padding: '0.65rem', minWidth: '130px', background: 'transparent', color: '#38BDF8', borderBottom: '1px solid var(--border-color)' }}
                        >
                          All Branches Summary
                        </th>
                      </tr>

                      {/* Header Row 2: Dates 01..31 & Detailed Summary Titles (Days & Hours) */}
                      <tr style={{ background: 'transparent', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                        <th 
                          className="emp-name-cell"
                          style={{ 
                            padding: '0.5rem 0.85rem', 
                            textAlign: 'left', 
                            position: 'sticky', 
                            left: 0, 
                            background: 'rgba(12, 18, 38, 0.98)', 
                            zIndex: 10,
                            borderRight: '1px solid var(--border-color)',
                            borderBottom: '1px solid var(--border-color)'
                          }}
                        >
                          Staff Member
                        </th>

                        {monthDays.map(d => {
                          const dayNum = format(d, 'dd');
                          const dayOfWeek = format(d, 'EEE');
                          const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun';

                          return (
                            <th 
                              key={dayNum} 
                              className="day-col-header"
                              style={{ 
                                padding: '0.4rem 0.25rem', 
                                minWidth: '30px',
                                background: 'transparent',
                                color: isWeekend ? 'var(--accent-gold)' : 'var(--text-main)',
                                borderRight: '1px solid var(--border-color)',
                                borderBottom: '1px solid var(--border-color)'
                              }}
                              title={format(d, 'EEEE, MMM dd, yyyy')}
                            >
                              <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{dayNum}</div>
                              <div style={{ fontSize: '0.62rem', opacity: 0.7, textTransform: 'uppercase' }}>{dayOfWeek.charAt(0)}</div>
                            </th>
                          );
                        })}

                        {/* Branch Summary Header (Days & Hours) */}
                        <th className="summary-col-header" style={{ padding: '0.4rem', color: 'var(--success)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', minWidth: '55px' }}>
                          Days
                        </th>
                        <th className="summary-col-header" style={{ padding: '0.4rem', color: 'var(--success)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', minWidth: '65px' }}>
                          Hours
                        </th>

                        {/* All Branches Summary Header (Days & Hours) */}
                        <th className="summary-col-header" style={{ padding: '0.4rem', color: '#38BDF8', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', minWidth: '55px' }}>
                          Days
                        </th>
                        <th className="summary-col-header" style={{ padding: '0.4rem', color: '#38BDF8', borderBottom: '1px solid var(--border-color)', minWidth: '65px' }}>
                          Hours
                        </th>
                      </tr>
                    </thead>

                    {/* Third Row Onwards: 1 Row per Employee */}
                    <tbody>
                      {employees.length === 0 ? (
                        <tr>
                          <td colSpan={monthDays.length + 5} style={{ padding: '2rem', color: 'var(--text-muted)' }}>
                            No authorized staff employees found
                          </td>
                        </tr>
                      ) : (
                        employees.map((emp) => {
                          const empUid = emp.uid || emp.id;

                          // Shifts for this employee across all branches in current month
                          const empAllMonthShifts = monthShifts.filter(s => s.userId === empUid || s.userDisplayName === emp.displayName);
                          
                          // Shifts for this employee at THIS specific branch
                          const empThisBranchShifts = empAllMonthShifts.filter(s => s.branch === branchName);

                          const countWorkThisBranch = new Set(empThisBranchShifts.map(s => s.date)).size;
                          const countWorkAllBranches = new Set(empAllMonthShifts.map(s => s.date)).size;

                          const hoursThisBranch = empThisBranchShifts.reduce((acc, s) => acc + getShiftWorkedHours(s), 0);
                          const hoursAllBranches = empAllMonthShifts.reduce((acc, s) => acc + getShiftWorkedHours(s), 0);

                          return (
                            <tr 
                              key={empUid}
                              style={{ borderBottom: '1px solid var(--border-color)' }}
                              className="matrix-data-row"
                            >
                              {/* Employee Name */}
                              <td 
                                className="emp-name-cell"
                                style={{ 
                                  padding: '0.55rem 0.85rem', 
                                  textAlign: 'left', 
                                  fontWeight: 700, 
                                  color: '#FFFFFF',
                                  position: 'sticky', 
                                  left: 0, 
                                  background: 'rgba(12, 18, 38, 0.98)', 
                                  zIndex: 5,
                                  borderRight: '1px solid var(--border-color)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div className="pdf-hide-avatar">
                                    <UserAvatar photoURL={emp.photoURL} displayName={emp.displayName} size={24} />
                                  </div>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {emp.displayName}
                                  </span>
                                </div>
                              </td>

                              {/* Daily Columns 01..31 (Clean crisp borders, Work/Rest indicators) */}
                              {monthDays.map(d => {
                                const dateStr = format(d, 'yyyy-MM-dd');
                                
                                // Check if employee worked on this date at THIS branch
                                const dayShifts = empThisBranchShifts.filter(s => s.date === dateStr);
                                const hasWorked = dayShifts.length > 0;
                                
                                const dayWorkedHours = dayShifts.reduce((acc, s) => acc + getShiftWorkedHours(s), 0);
                                const shiftInfo = dayShifts.map(s => `${s.startTime} - ${s.endTime} (${getShiftWorkedHours(s).toFixed(1)}h)${s.note ? ' [' + s.note + ']' : ''}`).join(', ');

                                return (
                                  <td 
                                    key={dateStr}
                                    style={{ 
                                      padding: '0.45rem 0.2rem',
                                      borderRight: '1px solid var(--border-color)',
                                      background: 'transparent'
                                    }}
                                    title={hasWorked ? `${branchName}: ${shiftInfo}` : `Rest`}
                                  >
                                    {hasWorked ? (
                                      <span 
                                        style={{ 
                                          fontWeight: 800,
                                          fontSize: '0.85rem',
                                          color: 'var(--success)'
                                        }}
                                      >
                                        W
                                      </span>
                                    ) : (
                                      <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontWeight: 600 }}>R</span>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Total Work THIS Branch: Days */}
                              <td 
                                style={{ 
                                  padding: '0.55rem', 
                                  fontWeight: 800, 
                                  color: countWorkThisBranch > 0 ? 'var(--success)' : 'var(--text-muted)',
                                  background: 'transparent',
                                  borderRight: '1px solid var(--border-color)'
                                }}
                              >
                                {countWorkThisBranch}d
                              </td>

                              {/* Total Work THIS Branch: Hours */}
                              <td 
                                style={{ 
                                  padding: '0.55rem', 
                                  fontWeight: 800, 
                                  color: hoursThisBranch > 0 ? 'var(--success)' : 'var(--text-muted)',
                                  background: 'transparent',
                                  borderRight: '1px solid var(--border-color)'
                                }}
                              >
                                {hoursThisBranch.toFixed(1)}h
                              </td>

                              {/* Total Work ALL Branches: Days */}
                              <td 
                                style={{ 
                                  padding: '0.55rem', 
                                  fontWeight: 800, 
                                  color: countWorkAllBranches > 0 ? '#38BDF8' : 'var(--text-muted)',
                                  background: 'transparent',
                                  borderRight: '1px solid var(--border-color)'
                                }}
                              >
                                {countWorkAllBranches}d
                              </td>

                              {/* Total Work ALL Branches: Hours */}
                              <td 
                                style={{ 
                                  padding: '0.55rem', 
                                  fontWeight: 800, 
                                  color: hoursAllBranches > 0 ? '#38BDF8' : 'var(--text-muted)',
                                  background: 'transparent'
                                }}
                              >
                                {hoursAllBranches.toFixed(1)}h
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>

                  </table>
                </div>

              </div>
            );
          })}

          {/* Footer Summary */}
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              Note: <span style={{ color: 'var(--success)', fontWeight: 800 }}>W</span> = Work Date • <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>R</span> = Rest Date
            </div>
            <div>
              Total Active Employees: <strong style={{ color: '#FFF' }}>{employees.length}</strong> • Month Shifts Total: <strong style={{ color: 'var(--primary)' }}>{monthShifts.length}</strong>
            </div>
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
};
