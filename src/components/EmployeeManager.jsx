import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { db, collection, onSnapshot, doc, updateDoc } from '../firebase';
import { BRANCHES } from './Navbar';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  UserCheck, 
  Store, 
  Search,
  Mail,
  Lock,
  Clock,
  Phone,
  Calendar,
  Quote,
  Award,
  ChevronDown,
  ChevronUp,
  User,
  ExternalLink,
  GraduationCap
} from 'lucide-react';

import { useToast } from '../context/ToastContext';

/* ── Brand SVG Icons ─────────────────────────────────────── */
const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.651 4.797 1.785 6.8L2 30l7.4-1.757A13.93 13.93 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2Z" fill="currentColor" fillOpacity="0.15"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M16 4C9.373 4 4 9.373 4 16c0 2.25.612 4.36 1.68 6.17L4.5 27.5l5.48-1.165A11.94 11.94 0 0 0 16 28c6.627 0 12-5.373 12-12S22.627 4 16 4Zm-3.01 6.5c-.28-.63-.57-.645-.835-.655-.215-.009-.46-.008-.706-.008-.245 0-.643.092-.98.46-.337.368-1.286 1.257-1.286 3.065 0 1.808 1.317 3.556 1.5 3.802.184.245 2.552 4.07 6.29 5.54 3.113 1.224 3.737.981 4.41.92.674-.061 2.174-.888 2.48-1.747.306-.858.306-1.594.214-1.748-.092-.153-.337-.245-.705-.43-.368-.184-2.175-1.072-2.512-1.194-.337-.122-.582-.184-.827.184-.245.367-.949 1.193-1.163 1.439-.214.245-.429.276-.797.092-.368-.184-1.553-.572-2.958-1.826-1.093-.976-1.83-2.18-2.046-2.548-.214-.367-.022-.566.162-.749.165-.164.368-.429.552-.643.184-.214.245-.368.368-.612.122-.245.061-.46-.031-.643-.092-.184-.804-1.997-1.12-2.74Z" fill="currentColor"/>
  </svg>
);

const MessengerIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2C8.268 2 2 7.925 2 15.231c0 4.077 1.922 7.715 4.942 10.18V30l4.534-2.49A14.56 14.56 0 0 0 16 28.462c7.732 0 14-6.21 14-13.231C30 7.925 23.732 2 16 2Z" fill="currentColor" fillOpacity="0.15"/>
    <path d="M16 4C9.373 4 4 9.16 4 15.231c0 3.572 1.754 6.755 4.5 8.867V28l4.2-2.31c1.06.294 2.175.772 3.3.772 6.627 0 12-5.16 12-11.231C28 9.16 22.627 4 16 4Zm1.193 15.103-3.057-3.256-5.966 3.256 6.563-6.974 3.131 3.256 5.892-3.256-6.563 6.974Z" fill="currentColor"/>
  </svg>
);

export const EmployeeManager = () => {
  const navigate = useNavigate();
  const { userProfile: currentUserProfile } = useAuth();
  const { showAlert } = useToast();
  const [users, setUsers] = useState([]);
  const [filterTab, setFilterTab] = useState('ALL'); // ALL, PENDING, MANAGERS, AUTHORIZED
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [shifts, setShifts] = useState([]);
  const [expandedUserIds, setExpandedUserIds] = useState([]);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      const userList = [];
      snapshot.forEach((docSnap) => {
        userList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setUsers(userList);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching users from Firestore:', err);
      setLoading(false);
    });

    const shiftsRef = collection(db, 'shifts');
    const unsubscribeShifts = onSnapshot(shiftsRef, (snapshot) => {
      const shiftList = [];
      snapshot.forEach((docSnap) => {
        shiftList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setShifts(shiftList);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeShifts();
    };
  }, []);

  const toggleExpandUser = (uid) => {
    setExpandedUserIds(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const getShiftWorkedHours = (s) => {
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

  const getUserWorkingStats = (userId, displayName) => {
    const userShifts = shifts.filter(s => s.userId === userId || (displayName && s.userDisplayName === displayName));
    const daysWorked = new Set(userShifts.map(s => s.date)).size;
    const totalHours = userShifts.reduce((acc, s) => acc + getShiftWorkedHours(s), 0);
    return { daysWorked, totalHours };
  };

  const updateUserStatus = async (uid, status, role = null) => {
    if (uid === currentUserProfile?.uid && (status !== 'authorized' || role === 'employee')) {
      showAlert("Managers cannot revoke their own access or demote their own account.", "Security Protection", "warning");
      return;
    }

    const userRef = doc(db, 'users', uid);
    const updates = { status, updatedAt: new Date().toISOString() };
    if (role) updates.role = role;
    await updateDoc(userRef, updates);
  };

  const updateUserBranch = async (uid, defaultBranch) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { defaultBranch, updatedAt: new Date().toISOString() });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (user.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterTab === 'PENDING') return user.status === 'pending';
    if (filterTab === 'MANAGERS') return user.role === 'manager';
    if (filterTab === 'AUTHORIZED') return user.status === 'authorized';
    return true;
  });

  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Users color="var(--primary)" /> Employee Management & Staff Directory
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            View total working hours, employee profiles, qualifications, and manage access roles.
          </p>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button 
          className={`btn btn-sm ${filterTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterTab('ALL')}
        >
          All Users ({users.length})
        </button>

        <button 
          className={`btn btn-sm ${filterTab === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterTab('PENDING')}
          style={{ position: 'relative' }}
        >
          ⏳ Pending Approvals
          {pendingCount > 0 && (
            <span style={{ 
              background: 'var(--danger)', 
              color: '#fff', 
              fontSize: '0.65rem', 
              borderRadius: '99px', 
              padding: '1px 6px', 
              marginLeft: '4px',
              fontWeight: 700 
            }}>
              {pendingCount}
            </span>
          )}
        </button>

        <button 
          className={`btn btn-sm ${filterTab === 'MANAGERS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterTab('MANAGERS')}
        >
          🛡️ Managers ({users.filter(u => u.role === 'manager').length})
        </button>

        <button 
          className={`btn btn-sm ${filterTab === 'AUTHORIZED' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterTab('AUTHORIZED')}
        >
          ✅ Authorized Staff ({users.filter(u => u.status === 'authorized').length})
        </button>
      </div>

      {/* User Grid Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading employee records...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No employees match the selected filter criteria.</p>
        </div>
      ) : (
        <div className="grid-auto-fill-320">
          {filteredUsers.map(user => {
            const uid = user.uid || user.id;
            const isPending = user.status === 'pending';
            const isManager = user.role === 'manager';
            const isAuthorized = user.status === 'authorized';
            const isSelf = (uid === currentUserProfile?.uid);
            const isExpanded = expandedUserIds.includes(uid);

            const stats = getUserWorkingStats(uid, user.displayName);

            return (
              <div 
                key={uid} 
                className="glass-card" 
                style={{ 
                  padding: '1.25rem', 
                  border: isSelf ? '1.5px solid var(--primary)' : isPending ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border-color)',
                  background: isSelf ? 'rgba(245, 158, 11, 0.08)' : isPending ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <UserAvatar photoURL={user.photoURL} displayName={user.displayName} size={48} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <h3 
                        style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                        onClick={() => navigate(`/profile/${uid}`)}
                        title="Click to visit staff profile"
                      >
                        {user.displayName || 'Unnamed User'}
                      </h3>
                      {isSelf && (
                        <span className="badge badge-amber" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>You</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}>
                      <Mail size={12} /> {user.email}
                    </div>

                    {/* Contact icons — brand icon row */}
                    {(user.phone || user.whatsapp || user.messenger) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.45rem' }}>
                        {user.phone && (
                          <a
                            href={`tel:${user.phone}`}
                            title={user.phone}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--primary)', textDecoration: 'none' }}
                          >
                            <Phone size={14} />
                          </a>
                        )}
                        {user.whatsapp && (
                          <a
                            href={`https://wa.me/${user.whatsapp.replace(/[^0-9]/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            title={`WhatsApp: ${user.whatsapp}`}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', textDecoration: 'none' }}
                          >
                            <WhatsAppIcon size={15} />
                          </a>
                        )}
                        {user.messenger && (
                          <a
                            href={user.messenger.startsWith('http') ? user.messenger : `https://m.me/${user.messenger}`}
                            target="_blank" rel="noopener noreferrer"
                            title={`Messenger: ${user.messenger}`}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(0,132,255,0.12)', border: '1px solid rgba(0,132,255,0.3)', color: '#0084FF', textDecoration: 'none' }}
                          >
                            <MessengerIcon size={15} />
                          </a>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                {/* Total Working Stats Badge — ONLY for Staff Employees, NOT Managers */}
                {!isManager && (
                  <div style={{ 
                    background: 'rgba(245, 158, 11, 0.1)', 
                    border: '1px solid rgba(245, 158, 11, 0.25)', 
                    borderRadius: '8px', 
                    padding: '0.45rem 0.65rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    fontSize: '0.82rem',
                    marginBottom: '0.85rem'
                  }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                      <Clock size={14} color="var(--accent-gold)" /> Total Working:
                    </span>
                    <span style={{ fontWeight: 800, color: 'var(--accent-gold)' }}>
                      {stats.daysWorked} Days ({stats.totalHours.toFixed(1)} hrs)
                    </span>
                  </div>
                )}

                {/* Profile Page Button — shows "My Profile" for self */}
                <button
                  type="button"
                  className={`btn btn-sm ${isSelf ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', marginBottom: '0.75rem', gap: '0.35rem' }}
                  onClick={() => navigate(isSelf ? '/profile' : `/profile/${uid}`)}
                >
                  <User size={13} /> {isSelf ? 'My Profile' : 'Visit Staff Profile'} <ExternalLink size={12} />
                </button>

                {/* Status Badges & Branch Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                    {isPending ? (
                      <span className="badge badge-amber">⏳ Pending</span>
                    ) : isAuthorized ? (
                      <span className="badge badge-green">✅ Authorized</span>
                    ) : (
                      <span className="badge badge-red">❌ Rejected</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Role:</span>
                    <span className={`badge ${isManager ? 'badge-amber' : 'badge-blue'}`}>
                      {isManager ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
                      {isManager ? 'Manager' : 'Employee Staff'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Store size={14} color="var(--primary)" /> Default Branch:
                    </span>
                    <select 
                      className="form-select"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                      value={user.defaultBranch || 'Panorama'}
                      onChange={(e) => updateUserBranch(uid, e.target.value)}
                    >
                      {BRANCHES.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  {isSelf ? (
                    <div style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-subtle)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '4px' }}>
                      <Lock size={12} color="var(--primary)" /> Logged-in Manager Account (Protected)
                    </div>
                  ) : isPending ? (
                    <>
                      <button 
                        className="btn btn-sm btn-success" 
                        style={{ flex: 1 }}
                        onClick={() => updateUserStatus(uid, 'authorized')}
                      >
                        <CheckCircle2 size={14} /> Authorize Access
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => updateUserStatus(uid, 'rejected')}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className={`btn btn-sm ${isAuthorized ? 'btn-secondary' : 'btn-success'}`}
                        style={{ flex: 1 }}
                        onClick={() => updateUserStatus(uid, isAuthorized ? 'pending' : 'authorized')}
                      >
                        {isAuthorized ? 'Revoke Access' : 'Authorize'}
                      </button>
                    </>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

