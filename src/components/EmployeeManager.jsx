import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { db, collection, onSnapshot, doc, updateDoc } from '../firebase';
import { BRANCHES } from './Navbar';
import {
  Users, CheckCircle2, XCircle, ShieldCheck, UserCheck,
  Store, Search, Mail, Lock, Clock, Phone, ExternalLink,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

/* ── Brand icons ─────────────────────────────────────────── */
const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.651 4.797 1.785 6.8L2 30l7.4-1.757A13.93 13.93 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2Z" fill="currentColor" fillOpacity="0.15"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M16 4C9.373 4 4 9.373 4 16c0 2.25.612 4.36 1.68 6.17L4.5 27.5l5.48-1.165A11.94 11.94 0 0 0 16 28c6.627 0 12-5.373 12-12S22.627 4 16 4Zm-3.01 6.5c-.28-.63-.57-.645-.835-.655-.215-.009-.46-.008-.706-.008-.245 0-.643.092-.98.46-.337.368-1.286 1.257-1.286 3.065 0 1.808 1.317 3.556 1.5 3.802.184.245 2.552 4.07 6.29 5.54 3.113 1.224 3.737.981 4.41.92.674-.061 2.174-.888 2.48-1.747.306-.858.306-1.594.214-1.748-.092-.153-.337-.245-.705-.43-.368-.184-2.175-1.072-2.512-1.194-.337-.122-.582-.184-.827.184-.245.367-.949 1.193-1.163 1.439-.214.245-.429.276-.797.092-.368-.184-1.553-.572-2.958-1.826-1.093-.976-1.83-2.18-2.046-2.548-.214-.367-.022-.566.162-.749.165-.164.368-.429.552-.643.184-.214.245-.368.368-.612.122-.245.061-.46-.031-.643-.092-.184-.804-1.997-1.12-2.74Z" fill="currentColor"/>
  </svg>
);

const MessengerIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path d="M16 2C8.268 2 2 7.925 2 15.231c0 4.077 1.922 7.715 4.942 10.18V30l4.534-2.49A14.56 14.56 0 0 0 16 28.462c7.732 0 14-6.21 14-13.231C30 7.925 23.732 2 16 2Z" fill="currentColor" fillOpacity="0.15"/>
    <path d="M16 4C9.373 4 4 9.16 4 15.231c0 3.572 1.754 6.755 4.5 8.867V28l4.2-2.31c1.06.294 2.175.772 3.3.772 6.627 0 12-5.16 12-11.231C28 9.16 22.627 4 16 4Zm1.193 15.103-3.057-3.256-5.966 3.256 6.563-6.974 3.131 3.256 5.892-3.256-6.563 6.974Z" fill="currentColor"/>
  </svg>
);

/* ── Status colour config ─────────────────────────────────── */
const STATUS_MAP = {
  authorized: { label: 'Active',   color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.28)'  },
  pending:    { label: 'Pending',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)'  },
  rejected:   { label: 'Rejected', color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.28)' },
};

/* ── Compact employee card ───────────────────────────────── */
const EmployeeCard = ({ user, isSelf, currentUid, shifts, onStatus, onBranch, navigate }) => {
  const uid          = user.uid || user.id;
  const isPending    = user.status === 'pending';
  const isManager    = user.role   === 'manager';
  const isAuthorized = user.status === 'authorized';
  const st           = STATUS_MAP[user.status] || STATUS_MAP.rejected;

  /* Working stats */
  const getHours = s => {
    if (s.actualHours !== undefined && s.actualHours !== null && s.actualHours !== '')
      return parseFloat(s.actualHours) || 0;
    const [sH, sM] = (s.startTime || '09:00').split(':').map(Number);
    const [eH, eM] = (s.endTime   || '22:00').split(':').map(Number);
    let gross = (eH * 60 + eM) - (sH * 60 + sM);
    if (gross < 0) gross += 1440;
    const gh = gross / 60;
    let brk = gh >= 8 ? 60 : 30;
    if (s.breakMinutes !== undefined && s.breakMinutes !== null && s.breakMinutes !== '') {
      const b = Number(s.breakMinutes);
      if (!isNaN(b) && b >= 0) brk = b;
    }
    return Math.max(0, (gross - brk) / 60);
  };

  const userShifts  = shifts.filter(s => s.userId === uid || (user.displayName && s.userDisplayName === user.displayName));
  const daysWorked  = new Set(userShifts.map(s => s.date)).size;
  const totalHours  = userShifts.reduce((acc, s) => acc + getHours(s), 0);

  /* Card accent colour: gold for self, muted for others */
  const accentBorder = isSelf
    ? '1.5px solid rgba(245,158,11,0.6)'
    : isPending
      ? '1px solid rgba(245,158,11,0.35)'
      : '1px solid rgba(255,255,255,0.07)';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.045)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderRadius: '18px',
      border: accentBorder,
      boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'; }}
    >

      {/* ── Top strip: avatar + name + status ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem 1rem 0.8rem' }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <UserAvatar photoURL={user.photoURL} displayName={user.displayName} size={46} />
          {/* Online-dot style status indicator */}
          <span style={{
            position: 'absolute', bottom: 0, right: 0,
            width: '11px', height: '11px', borderRadius: '50%',
            background: st.color,
            border: '2px solid #080E1E',
            boxShadow: `0 0 6px ${st.color}88`,
          }} />
        </div>

        {/* Name + email + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              onClick={() => navigate(isSelf ? '/profile' : `/profile/${uid}`)}
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: '1rem',
                color: 'var(--text-main)',
                cursor: 'pointer',
                letterSpacing: '-0.2px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '160px',
              }}
              title={user.displayName}
            >
              {user.displayName || 'Unnamed'}
            </span>
            {isSelf && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '99px', background: 'rgba(245,158,11,0.18)', color: 'var(--primary)', border: '1px solid rgba(245,158,11,0.35)', letterSpacing: '0.04em' }}>YOU</span>
            )}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '1px', fontFamily: 'var(--font-body)' }}>
            <Mail size={10} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{user.email}</span>
          </div>
          {/* Role pill */}
          <div style={{ marginTop: '4px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: '99px',
              background: isManager ? 'rgba(245,158,11,0.12)' : 'rgba(56,189,248,0.1)',
              color: isManager ? 'var(--primary)' : '#7DD3FC',
              border: isManager ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(56,189,248,0.25)',
            }}>
              {isManager ? <ShieldCheck size={9} /> : <UserCheck size={9} />}
              {isManager ? 'Manager' : 'Staff'}
            </span>
          </div>
        </div>

        {/* Status badge top-right */}
        <span style={{
          alignSelf: 'flex-start',
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
          padding: '3px 9px', borderRadius: '99px',
          background: st.bg, color: st.color, border: `1px solid ${st.border}`,
          whiteSpace: 'nowrap',
        }}>
          {st.label}
        </span>
      </div>

      {/* ── Stats row ── */}
      {!isManager && (
        <div style={{
          display: 'flex', gap: '0', margin: '0 1rem 0.8rem',
          background: 'rgba(0,0,0,0.2)', borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
        }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '0.5rem 0.25rem', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)', lineHeight: 1.1 }}>{daysWorked}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px' }}>Days</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '0.5rem 0.25rem' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)', lineHeight: 1.1 }}>{totalHours.toFixed(0)}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px' }}>Hours</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '0.5rem 0.25rem', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, color: '#7DD3FC', lineHeight: 1.1 }}>{userShifts.length}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px' }}>Shifts</div>
          </div>
        </div>
      )}

      {/* ── Branch + contacts row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem 0.75rem', gap: '0.5rem' }}>
        {/* Branch dropdown — employees only */}
        {!isManager && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}>
            <Store size={12} color="var(--primary)" style={{ flexShrink: 0 }} />
            <select
              className="form-select"
              style={{ fontSize: '0.76rem', padding: '4px 8px', borderRadius: '8px', fontFamily: 'var(--font-body)', fontWeight: 600, flex: 1, minWidth: 0 }}
              value={user.defaultBranch || 'Panorama'}
              onChange={e => onBranch(uid, e.target.value)}
            >
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        {/* Contact icon links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0, marginLeft: isManager ? 'auto' : undefined }}>
          {user.phone && (
            <a href={`tel:${user.phone}`} title={user.phone}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:8, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.22)', color:'var(--primary)', textDecoration:'none' }}>
              <Phone size={13} />
            </a>
          )}
          {user.whatsapp && (
            <a href={`https://wa.me/${user.whatsapp.replace(/[^0-9]/g,'')}`} target="_blank" rel="noopener noreferrer" title={`WhatsApp: ${user.whatsapp}`}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:8, background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.28)', color:'#25D366', textDecoration:'none' }}>
              <WhatsAppIcon size={14} />
            </a>
          )}
          {user.messenger && (
            <a href={user.messenger.startsWith('http') ? user.messenger : `https://m.me/${user.messenger}`} target="_blank" rel="noopener noreferrer" title={`Messenger`}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:8, background:'rgba(0,132,255,0.1)', border:'1px solid rgba(0,132,255,0.28)', color:'#0084FF', textDecoration:'none' }}>
              <MessengerIcon size={14} />
            </a>
          )}
        </div>

      </div>

      {/* ── Footer action strip ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', display:'flex', gap:'0' }}>
        {/* Profile link */}
        <button
          onClick={() => navigate(isSelf ? '/profile' : `/profile/${uid}`)}
          style={{
            flex: 1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.3rem',
            padding: '0.6rem 0.75rem',
            background: 'none', border: 'none', cursor:'pointer',
            fontSize:'0.74rem', fontWeight:700, fontFamily:'var(--font-body)',
            color: 'var(--text-muted)', letterSpacing:'0.01em',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='var(--text-main)'; e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='none'; }}
        >
          <ExternalLink size={12} /> Profile
        </button>

        {/* Action */}
        {isSelf ? (
          <div style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.3rem', padding:'0.6rem', fontSize:'0.72rem', color:'var(--text-subtle)', fontFamily:'var(--font-body)' }}>
            <Lock size={11} color="var(--primary)" /> Protected
          </div>
        ) : isPending ? (
          <>
            <button
              onClick={() => onStatus(uid, 'authorized')}
              style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem', padding:'0.6rem', background:'none', border:'none', cursor:'pointer', fontSize:'0.74rem', fontWeight:700, fontFamily:'var(--font-body)', color:'var(--success)', borderRight:'1px solid rgba(255,255,255,0.06)', transition:'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(52,211,153,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}
            >
              <CheckCircle2 size={13} /> Authorize
            </button>
            <button
              onClick={() => onStatus(uid, 'rejected')}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.3rem', padding:'0.6rem', background:'none', border:'none', cursor:'pointer', fontSize:'0.74rem', fontWeight:700, fontFamily:'var(--font-body)', color:'var(--danger)', transition:'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(248,113,113,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}
            >
              <XCircle size={13} /> Reject
            </button>
          </>
        ) : (
          <button
            onClick={() => onStatus(uid, isAuthorized ? 'pending' : 'authorized')}
            style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem', padding:'0.6rem', background:'none', border:'none', cursor:'pointer', fontSize:'0.74rem', fontWeight:700, fontFamily:'var(--font-body)', color: isAuthorized ? 'var(--danger)' : 'var(--success)', transition:'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = isAuthorized ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background='none'}
          >
            {isAuthorized ? <><XCircle size={13} /> Revoke</> : <><CheckCircle2 size={13} /> Authorize</>}
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Page component ──────────────────────────────────────── */
export const EmployeeManager = () => {
  const navigate = useNavigate();
  const { userProfile: currentUserProfile } = useAuth();
  const { showAlert } = useToast();
  const [users, setUsers]         = useState([]);
  const [shifts, setShifts]       = useState([]);
  const [filterTab, setFilterTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const unsubUsers  = onSnapshot(collection(db, 'users'),  snap => { setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
    const unsubShifts = onSnapshot(collection(db, 'shifts'), snap => setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubUsers(); unsubShifts(); };
  }, []);

  const updateUserStatus = async (uid, status) => {
    if (uid === currentUserProfile?.uid && status !== 'authorized') {
      showAlert("Managers cannot revoke their own access.", "Security Protection", "warning");
      return;
    }
    await updateDoc(doc(db, 'users', uid), { status, updatedAt: new Date().toISOString() });
  };

  const updateUserBranch = async (uid, defaultBranch) => {
    await updateDoc(doc(db, 'users', uid), { defaultBranch, updatedAt: new Date().toISOString() });
  };

  const pendingCount = users.filter(u => u.status === 'pending').length;

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    if (q && !(u.displayName || '').toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false;
    if (filterTab === 'PENDING')    return u.status === 'pending';
    if (filterTab === 'MANAGERS')   return u.role   === 'manager';
    if (filterTab === 'AUTHORIZED') return u.status === 'authorized';
    return true;
  });

  /* ── Tab config ── */
  const TABS = [
    { id: 'ALL',        label: `All  (${users.length})` },
    { id: 'PENDING',    label: `Pending`,   badge: pendingCount },
    { id: 'MANAGERS',   label: `Managers`,  count: users.filter(u=>u.role==='manager').length },
    { id: 'AUTHORIZED', label: `Active`,    count: users.filter(u=>u.status==='authorized').length },
  ];

  return (
    <div className="animate-fade-in">

      {/* ── Page header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', display:'flex', alignItems:'center', gap:'0.5rem', letterSpacing:'-0.3px', marginBottom:'0.25rem' }}>
          <Users size={22} color="var(--primary)" /> Staff Directory
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
          Manage access roles, branch assignments, and view working statistics.
        </p>
      </div>

      {/* ── Search + tabs row ── */}
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {/* Search */}
        <div style={{ position:'relative', minWidth:'200px', flex:'1 1 200px', maxWidth:'280px' }}>
          <Search size={14} style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search name or email…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft:'32px', fontFamily:'var(--font-body)', fontSize:'0.83rem' }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTab(t.id)}
              style={{
                display:'inline-flex', alignItems:'center', gap:'0.3rem',
                padding:'0.38rem 0.85rem',
                fontFamily: 'var(--font-body)', fontSize:'0.78rem', fontWeight: filterTab===t.id ? 700 : 600,
                borderRadius:'99px', cursor:'pointer', border:'none',
                background: filterTab===t.id ? 'linear-gradient(135deg,#F59E0B,#D97706)' : 'rgba(255,255,255,0.06)',
                color: filterTab===t.id ? '#0A0F1E' : 'var(--text-muted)',
                boxShadow: filterTab===t.id ? '0 2px 10px rgba(245,158,11,0.35)' : 'none',
                transition:'all 0.18s ease',
              }}
            >
              {t.label}
              {t.badge > 0 && (
                <span style={{ background:'var(--danger)', color:'#fff', fontSize:'0.6rem', fontWeight:800, borderRadius:'99px', padding:'1px 5px', minWidth:'16px', textAlign:'center' }}>
                  {t.badge}
                </span>
              )}
              {t.count !== undefined && (
                <span style={{ fontSize:'0.68rem', opacity:0.7 }}>({t.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'var(--text-muted)', fontFamily:'var(--font-body)' }}>
          Loading staff records…
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass-panel" style={{ textAlign:'center', padding:'3rem' }}>
          <p style={{ color:'var(--text-muted)', fontFamily:'var(--font-body)', margin:0 }}>No employees match the selected filter.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'1rem' }}>
          {filteredUsers.map(user => {
            const uid   = user.uid || user.id;
            const isSelf = uid === currentUserProfile?.uid;
            return (
              <EmployeeCard
                key={uid}
                user={user}
                isSelf={isSelf}
                currentUid={currentUserProfile?.uid}
                shifts={shifts}
                onStatus={updateUserStatus}
                onBranch={updateUserBranch}
                navigate={navigate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
