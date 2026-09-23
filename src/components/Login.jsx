import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Calendar, FileSpreadsheet, Store } from 'lucide-react';

export const Login = () => {
  const { loginWithGoogle, error } = useAuth();

  return (
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
      <div className="glass-card animate-fade-in" style={{ maxWidth: '520px', width: '100%', padding: '2.5rem 2rem', textAlign: 'center', position: 'relative' }}>
        
        {/* App Logo */}
        <div style={{ 
          width: '84px', 
          height: '84px', 
          borderRadius: '24px', 
          background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 1.25rem auto',
          boxShadow: '0 0 30px rgba(245, 158, 11, 0.4)',
          padding: '12px'
        }}>
          <img src="/logo.svg" alt="WrapTime Logo" style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Title & Workplace */}
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem', background: 'linear-gradient(90deg, #FFFFFF, #FCD34D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          WrapTime
        </h1>
        <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '1.5rem' }}>
          Wraperia Suppa Kebs
        </p>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
          Employee Shift Scheduling & Management PWA for our 5 restaurant branches: 
          <br/>
          <strong style={{ color: 'var(--text-main)' }}>Panorama, Vilnius Outlet, Antakalnio, Paupio Turgus, and Verkių</strong>.
        </p>

        {/* Feature Highlights Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2rem', textAlign: 'left' }}>
          <div className="glass-panel" style={{ padding: '0.75rem' }}>
            <Calendar size={18} color="var(--primary)" style={{ marginBottom: '0.35rem' }} />
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Shift Builder</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Weekly branch shift matrices (09:00 - 22:00)</div>
          </div>

          <div className="glass-panel" style={{ padding: '0.75rem' }}>
            <ShieldCheck size={18} color="var(--success)" style={{ marginBottom: '0.35rem' }} />
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Manager Approvals</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Secure Google login & staff authorization</div>
          </div>

          <div className="glass-panel" style={{ padding: '0.75rem' }}>
            <FileSpreadsheet size={18} color="var(--warning)" style={{ marginBottom: '0.35rem' }} />
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Excel Export</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Download work days & total hours reports</div>
          </div>

          <div className="glass-panel" style={{ padding: '0.75rem' }}>
            <Store size={18} color="#38BDF8" style={{ marginBottom: '0.35rem' }} />
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>5 Locations</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Filter schedules by branch location</div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Google Login Button */}
        <button 
          className="btn btn-primary" 
          onClick={loginWithGoogle}
          style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Sign In with Google Account</span>
        </button>

        <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
          WrapTime PWA v1.0 • Wraperia Suppa Kebs Lithuania
        </div>

      </div>
    </div>
  );
};
