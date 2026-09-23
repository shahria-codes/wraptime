import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogOut, RefreshCw, KeyRound, CheckCircle2 } from 'lucide-react';

export const PendingApproval = () => {
  const { userProfile, logout, promoteToManager } = useAuth();

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-card animate-fade-in" style={{ maxWidth: '500px', width: '100%', padding: '2.5rem 2rem', textAlign: 'center' }}>
        
        <div style={{ 
          width: '72px', 
          height: '72px', 
          borderRadius: '50%', 
          background: 'rgba(245, 158, 11, 0.15)', 
          color: 'var(--primary)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 1.5rem auto',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }}>
          <ShieldAlert size={36} />
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
          Authorization Required
        </h2>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Welcome, <strong style={{ color: 'var(--primary)' }}>{userProfile?.displayName || userProfile?.email}</strong>! You are signed in with your Google account.
        </p>

        <div className="glass-panel" style={{ textAlign: 'left', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)', minWidth: '80px' }}>Email:</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{userProfile?.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)', minWidth: '80px' }}>Status:</span>
            <span className="badge badge-amber">⏳ Pending Manager Approval</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)', minWidth: '80px' }}>Workplace:</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Wraperia Suppa Kebs</span>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginBottom: '2rem', lineHeight: 1.5 }}>
          For security, only authorized employees can view shift rosters and schedules. Please ask a Manager at <strong>Wraperia Suppa Kebs</strong> to grant you access in their Manager Dashboard.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />
            <span>Check Status</span>
          </button>

          <button className="btn btn-danger" onClick={logout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

      </div>
    </div>
  );
};
