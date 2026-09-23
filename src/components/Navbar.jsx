import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { ProfileModal } from './ProfileModal';
import {
  Calendar,
  Users,
  FileSpreadsheet,
  LogOut,
  ShieldCheck,
  UserCheck,
  Clock,
  Store,
  Camera
} from 'lucide-react';

import { GlassSelect } from './GlassSelect';

export const BRANCHES = [
  'Panorama',
  'Vilnius Outlet',
  'Antakalnio',
  'Paupio Turgus',
  'Verkių'
];

export const Navbar = ({ selectedBranch, setSelectedBranch }) => {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const isManager    = userProfile?.role === 'manager';
  const isAuthorized = userProfile?.status === 'authorized';
  const path         = location.pathname;

  const navActive = (p) => path === p ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';

  return (
    <>
      {/* ── Navbar logo ring keyframe (injected once) ── */}
      <style>{`
        @keyframes nav-ring-spin {
          to { stroke-dashoffset: -220; }
        }
        @keyframes nav-logo-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0), 0 0 14px rgba(245,158,11,0.35); }
          50%      { box-shadow: 0 0 0 5px rgba(245,158,11,0.1), 0 0 18px rgba(245,158,11,0.5); }
        }
      `}</style>

      {/* ─── Sticky Header ─────────────────────────────── */}
      <header className="app-header">
        <div
          className="app-container"
          style={{
            padding: '0.55rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'nowrap'
          }}
        >
          {/* Brand */}
          <button
            onClick={() => navigate(isManager ? '/schedule' : '/my-shifts')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.55rem',
              padding: 0, flexShrink: 0
            }}
          >
            {/* Logo with spinning arc ring */}
            <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
              {/* Spinning arc SVG — sits slightly outside the box */}
              <svg
                style={{ position: 'absolute', inset: '-7px', width: 50, height: 50, pointerEvents: 'none' }}
                viewBox="0 0 50 50"
              >
                <circle cx="25" cy="25" r="22"
                  fill="none"
                  stroke="rgba(245,158,11,0.15)"
                  strokeWidth="1.2"
                />
                <circle cx="25" cy="25" r="22"
                  fill="none"
                  stroke="rgba(245,158,11,0.8)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeDasharray="18 120"
                  style={{ animation: 'nav-ring-spin 3s linear infinite', transformOrigin: '25px 25px' }}
                />
              </svg>
              {/* Logo box */}
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 5,
                animation: 'nav-logo-pulse 3s ease-in-out infinite',
              }}>
                <img src="/logo.svg" alt="WrapTime" style={{ width: '100%', height: '100%' }} />
              </div>
            </div>

            <div>
              <h1 style={{
                fontSize: '1.1rem', fontWeight: 800, margin: 0, lineHeight: 1,
                background: 'linear-gradient(90deg,#FFFFFF,#FCD34D)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}>
                WrapTime
              </h1>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                Wraperia Suppa Kebs
              </p>
            </div>
          </button>


          {/* Branch Selector — hidden on profile pages */}
          {!path.startsWith('/profile') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '0 1 auto' }}>
              <Store size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
              <select
                className="form-select nav-branch-select"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={{
                  padding: '0.3rem 0.55rem', fontSize: '0.78rem',
                  width: 'auto', minWidth: '130px', maxWidth: '180px',
                  background: 'rgba(30,41,59,0.95)'
                }}
              >
                <option value="ALL">🏢 All Branches</option>
                {BRANCHES.map(b => (
                  <option key={b} value={b}>📍 {b}</option>
                ))}
              </select>
            </div>
          )}

          {/* Desktop Nav Tabs */}
          {isAuthorized && (
            <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              {isManager ? (
                <>
                  <button className={navActive('/schedule')} onClick={() => navigate('/schedule')}>
                    <Calendar size={14} /><span>Schedule</span>
                  </button>
                  <button className={navActive('/employees')} onClick={() => navigate('/employees')}>
                    <Users size={14} /><span>Employees</span>
                  </button>
                </>
              ) : (
                <>
                  <button className={navActive('/my-shifts')} onClick={() => navigate('/my-shifts')}>
                    <Clock size={14} /><span>My Shifts</span>
                  </button>
                  <button className={navActive('/roster')} onClick={() => navigate('/roster')}>
                    <Users size={14} /><span>Roster</span>
                  </button>
                </>
              )}
              <button 
                className={path === '/reports' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-success'} 
                onClick={() => navigate('/reports')} 
                title="Monthly Work Reports"
              >
                <FileSpreadsheet size={14} /><span>Reports</span>
              </button>
            </nav>
          )}

          {/* User Avatar + Role + Logout — desktop only; mobile uses bottom nav Profile tab */}
          {userProfile && (
            <div
              className="desktop-only"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                flexShrink: 0
              }}
            >
              {/* Clickable avatar & name → opens /profile route */}
              <button
                onClick={() => navigate('/profile')}
                title="View & Edit My Profile"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, position: 'relative', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <UserAvatar
                  photoURL={userProfile.photoURL}
                  displayName={userProfile.displayName}
                  size={30}
                />
              </button>

              <div 
                style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                onClick={() => navigate('/profile')}
                title="View & Edit My Profile"
              >
                <span style={{
                  fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)',
                  maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {userProfile.displayName}
                </span>
                {isManager ? (
                  <span className="badge badge-amber" style={{ fontSize: '0.5rem', padding: '1px 4px' }}>
                    <ShieldCheck size={9} /> Manager
                  </span>
                ) : (
                  <span className="badge badge-blue" style={{ fontSize: '0.5rem', padding: '1px 4px' }}>
                    <UserCheck size={9} /> Staff
                  </span>
                )}
              </div>

              <button
                className="btn btn-sm btn-secondary"
                onClick={logout}
                title="Log Out"
                style={{ padding: '0.3rem 0.5rem', marginLeft: 2 }}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ─── Mobile Bottom Nav ──────────────────────────── */}
      {isAuthorized && (
        <nav className="mobile-bottom-nav">
          {isManager ? (
            <>
              <button
                className={`mobile-nav-btn ${path === '/schedule' ? 'active' : ''}`}
                onClick={() => navigate('/schedule')}
              >
                <Calendar size={22} /><span>Schedule</span>
              </button>
              <button
                className={`mobile-nav-btn ${path === '/employees' || path === '/approvals' ? 'active' : ''}`}
                onClick={() => navigate('/employees')}
              >
                <Users size={22} /><span>Employees</span>
              </button>
            </>
          ) : (
            <>
              <button
                className={`mobile-nav-btn ${path === '/my-shifts' ? 'active' : ''}`}
                onClick={() => navigate('/my-shifts')}
              >
                <Clock size={22} /><span>My Shifts</span>
              </button>
              <button
                className={`mobile-nav-btn ${path === '/roster' ? 'active' : ''}`}
                onClick={() => navigate('/roster')}
              >
                <Users size={22} /><span>Roster</span>
              </button>
            </>
          )}
          {/* Reports */}
          <button
            className={`mobile-nav-btn ${path === '/reports' ? 'active' : ''}`}
            onClick={() => navigate('/reports')}
          >
            <FileSpreadsheet size={22} /><span>Reports</span>
          </button>

          {/* Profile — rightmost, conventional position */}
          <button
            className={`mobile-nav-btn ${path.startsWith('/profile') ? 'active' : ''}`}
            onClick={() => navigate('/profile')}
            style={{ position: 'relative' }}
          >
            {/* Render the user's avatar as the icon */}
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <UserAvatar
                photoURL={userProfile?.photoURL}
                displayName={userProfile?.displayName}
                size={26}
                borderColor={path.startsWith('/profile') ? 'var(--primary)' : 'var(--text-muted)'}
              />
            </div>
            <span>Profile</span>
          </button>
        </nav>
      )}

      {/* ─── Profile Modal ───────────────────────────────── */}
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
};
