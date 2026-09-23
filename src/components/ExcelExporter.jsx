import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { db, collection, onSnapshot, query, where } from '../firebase';
import { BRANCHES } from './Navbar';
import { UserAvatar } from './UserAvatar';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft,
  Store, 
  FileText,
  Download,
  Loader2,
  Table,
  LayoutGrid
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

// In-memory cache map for monthly shifts to minimize DB hits and enable instant 0ms month transitions
const shiftMonthCache = new Map();

export const ExcelExporter = ({ selectedBranch }) => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const filterBranch = selectedBranch || 'ALL';
  const [displayMode, setDisplayMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards';
    }
    return 'table';
  }); // 'table' or 'cards'
  const [isExporting, setIsExporting] = useState(false);
  
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch authorized staff members
  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status === 'authorized' && data.role !== 'manager') {
          list.push({ uid: docSnap.id, ...data });
        }
      });
      setEmployees(list);
    }, (err) => console.error("Firestore users error:", err));

    return () => unsubscribeUsers();
  }, []);

  // Lazy & Cached Monthly Firestore Fetching: Only fetch data for the selected month
  useEffect(() => {
    const monthKey = format(currentMonth, 'yyyy-MM');
    const monthStartStr = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEndStr = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    // 1. Instant Cache Hit: Display cached month data immediately if available
    if (shiftMonthCache.has(monthKey)) {
      setShifts(shiftMonthCache.get(monthKey));
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Query Firestore ONLY for the selected month's date range [monthStartStr .. monthEndStr]
    const q = query(
      collection(db, 'shifts'),
      where('date', '>=', monthStartStr),
      where('date', '<=', monthEndStr)
    );

    // 3. Realtime Listener: Automatically keeps cache & UI in sync with 0 delay on DB updates
    const unsubscribeShifts = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      
      // Update in-memory cache and state
      shiftMonthCache.set(monthKey, list);
      setShifts(list);
      setLoading(false);
    }, (err) => {
      console.error(`Firestore monthly shifts query error [${monthKey}]:`, err);
      setLoading(false);
    });

    return () => unsubscribeShifts();
  }, [currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthNameStr = format(currentMonth, 'MMMM yyyy');

  // Filter shifts within the selected month (guaranteed by monthly query)
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

  // List of branches to render separately based on global Navbar selection
  const branchesToRender = filterBranch === 'ALL' ? BRANCHES : [filterBranch];

  // Direct PDF File Download Handler — ALWAYS exports as a clean Table Matrix PDF document
  const handleExportPDF = () => {
    const activeMode = displayMode;
    
    // Temporarily switch display mode to 'table' so PDF generator renders the full matrix table
    if (activeMode !== 'table') {
      setDisplayMode('table');
    }

    setIsExporting(true);

    setTimeout(() => {
      const element = document.getElementById('report-pdf-content');
      if (!element) {
        setIsExporting(false);
        if (activeMode !== 'table') setDisplayMode(activeMode);
        return;
      }

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
        if (activeMode !== 'table') setDisplayMode(activeMode);
      }).catch((err) => {
        console.error("PDF Export error:", err);
        element.classList.remove('pdf-export-mode');
        setIsExporting(false);
        if (activeMode !== 'table') setDisplayMode(activeMode);
      });
    }, 150);
  };

  return (
    <div className="reports-page animate-fade-in" style={{ paddingBottom: '3rem' }}>
      
      {/* Page Header & Control Bar */}
      <div className="no-print report-header-controls" style={{ marginBottom: '1.25rem' }}>
        
        {/* Top Bar: Back & Export Buttons */}
        <div className="report-header-top-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
          <button 
            className="btn btn-sm btn-secondary" 
            onClick={() => navigate(-1)} 
            style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
            title="Back"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <button 
            className="btn btn-primary report-export-btn" 
            onClick={handleExportPDF} 
            disabled={isExporting}
            style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {isExporting ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
            <span>{isExporting ? 'Downloading...' : 'Export PDF'}</span>
          </button>
        </div>

        {/* Title Box */}
        <div className="report-header-title-box" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText color="var(--primary)" size={22} /> Monthly Branch Work Report
          </h2>
          <p className="report-header-subtitle" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            WrapTime • UAB SuperMaistas Official Presence Log
          </p>
        </div>

        {/* Action Controls Card */}
        <div className="report-action-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          <div className="report-action-bar-row1" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* View Mode Switcher (Table vs Cards) */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-color)', gap: '2px' }}>
              <button 
                className={`btn btn-xs ${displayMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDisplayMode('table')}
                style={{ padding: '4px 9px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Full Matrix Table View"
              >
                <Table size={13} /> <span>Table</span>
              </button>
              <button 
                className={`btn btn-xs ${displayMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDisplayMode('cards')}
                style={{ padding: '4px 9px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Mobile Summary Cards View"
              >
                <LayoutGrid size={13} /> <span>Cards</span>
              </button>
            </div>

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

              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--accent-gold)', minWidth: '105px', textAlign: 'center' }}>
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
          </div>

        </div>
      </div>

        {/* PDF Exportable Document Container (Crisp grid borders, transparent background) */}
        <div id="report-pdf-content" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.2rem', background: 'transparent' }}>
          
          {/* Printable Report Header — Hidden on web screen mode on mobile to avoid duplication */}
          <div className="report-company-header screen-hide-header" style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border-color)' }}>
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

                {/* Cards View vs Table View */}
                {displayMode === 'cards' ? (
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '0 0 10px 10px', border: '1px solid var(--border-color)' }}>
                    {employees.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No staff members found</div>
                    ) : (
                      employees.map((emp) => {
                        const empUid = emp.uid || emp.id;
                        const empAllMonthShifts = monthShifts.filter(s => s.userId === empUid || s.userDisplayName === emp.displayName);
                        const empThisBranchShifts = empAllMonthShifts.filter(s => s.branch === branchName);

                        const countWorkThisBranch = new Set(empThisBranchShifts.map(s => s.date)).size;
                        const countWorkAllBranches = new Set(empAllMonthShifts.map(s => s.date)).size;

                        const hoursThisBranch = empThisBranchShifts.reduce((acc, s) => acc + getShiftWorkedHours(s), 0);
                        const hoursAllBranches = empAllMonthShifts.reduce((acc, s) => acc + getShiftWorkedHours(s), 0);

                        return (
                          <div key={empUid} className="glass-card" style={{ padding: '0.9rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(30,41,59,0.7)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <UserAvatar photoURL={emp.photoURL} displayName={emp.displayName} size={34} />
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFF' }}>{emp.displayName}</div>
                                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                                    All Branches Total: <strong style={{ color: '#38BDF8' }}>{countWorkAllBranches}d ({hoursAllBranches.toFixed(1)}h)</strong>
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: countWorkThisBranch > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                                  {countWorkThisBranch} Days • {hoursThisBranch.toFixed(1)} Hours
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>at {branchName}</div>
                              </div>
                            </div>

                            {/* Worked Days List */}
                            {empThisBranchShifts.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                                {empThisBranchShifts.map(s => (
                                  <span key={s.id || `${s.date}-${s.startTime}`} className="badge" style={{ fontSize: '0.72rem', padding: '3px 8px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    🗓️ {s.date.split('-').slice(1).join('/')}: {s.startTime}-{s.endTime} ({getShiftWorkedHours(s).toFixed(1)}h)
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.3rem' }}>
                                No shifts scheduled at {branchName} this month
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  /* Table for this Branch */
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
              )}
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
  );
};
