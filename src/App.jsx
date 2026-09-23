import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Login } from './components/Login';
import { PendingApproval } from './components/PendingApproval';
import { ManagerDashboard } from './components/ManagerDashboard';
import { EmployeeManager } from './components/EmployeeManager';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { ExcelExporter } from './components/ExcelExporter';
import { UserProfilePage } from './components/UserProfilePage';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { Loader2 } from 'lucide-react';

const ProtectedLayout = ({ children, selectedBranch, setSelectedBranch }) => {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: '1rem' }}>
      <Navbar
        selectedBranch={selectedBranch}
        setSelectedBranch={setSelectedBranch}
      />
      <main className="app-container" style={{ paddingTop: '1rem' }}>
        {children}
      </main>
    </div>
  );
};

const AppRoutes = () => {
  const { user, userProfile, loading } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState('ALL');

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        flexDirection: 'column',
        gap: '2rem',
      }}>
        {/* Animated ring + logo */}
        <div style={{ position: 'relative', width: 88, height: 88 }}>
          {/* Outer spinning ring */}
          <svg
            width="88" height="88"
            viewBox="0 0 88 88"
            style={{ position: 'absolute', top: 0, left: 0, animation: 'wt-spin 1.4s linear infinite' }}
          >
            <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth="5" />
            <circle
              cx="44" cy="44" r="38"
              fill="none"
              stroke="url(#wt-grad)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="60 180"
            />
            <defs>
              <linearGradient id="wt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>

          {/* Inner counter-spin ring */}
          <svg
            width="66" height="66"
            viewBox="0 0 66 66"
            style={{ position: 'absolute', top: 11, left: 11, animation: 'wt-spin-rev 2s linear infinite' }}
          >
            <circle cx="33" cy="33" r="27" fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="3" />
            <circle
              cx="33" cy="33" r="27"
              fill="none"
              stroke="rgba(168,85,247,0.6)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="30 140"
            />
          </svg>

          {/* Center W letter */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '1.6rem', fontWeight: 900,
            background: 'linear-gradient(135deg, #f59e0b, #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.04em',
            animation: 'wt-pulse 1.4s ease-in-out infinite',
          }}>W</div>
        </div>

        {/* Animated dots */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b, #a855f7)',
              animation: `wt-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>

        <style>{`
          @keyframes wt-spin    { to { transform: rotate(360deg); } }
          @keyframes wt-spin-rev{ to { transform: rotate(-360deg); } }
          @keyframes wt-pulse   { 0%,100%{opacity:1;transform:translate(-50%,-50%) scale(1)} 50%{opacity:.7;transform:translate(-50%,-50%) scale(0.88)} }
          @keyframes wt-bounce  { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-8px);opacity:1} }
        `}</style>
      </div>
    );
  }

  // 1. Unauthenticated users -> Redirect to Login
  if (!user || !userProfile) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 2. Pending or Rejected status -> Redirect to Pending Approval Screen
  if (userProfile.status === 'pending' || userProfile.status === 'rejected') {
    return (
      <Routes>
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="*" element={<Navigate to="/pending" replace />} />
      </Routes>
    );
  }

  const isManager = userProfile.role === 'manager';

  return (
    <>
      <ProtectedLayout 
        selectedBranch={selectedBranch}
        setSelectedBranch={setSelectedBranch}
      >
        <Routes>
          {isManager ? (
            <>
              {/* Manager Routes */}
              <Route path="/schedule" element={<ManagerDashboard selectedBranch={selectedBranch} />} />
              <Route path="/reports" element={<ExcelExporter selectedBranch={selectedBranch} />} />
              <Route path="/employees" element={<EmployeeManager />} />
              <Route path="/approvals" element={<EmployeeManager />} />
              <Route path="/profile" element={<UserProfilePage />} />
              <Route path="/profile/:userId" element={<UserProfilePage />} />
              <Route path="/" element={<Navigate to="/schedule" replace />} />
              <Route path="*" element={<Navigate to="/schedule" replace />} />
            </>
          ) : (
            <>
              {/* Employee Routes */}
              <Route path="/my-shifts" element={<EmployeeDashboard selectedBranch={selectedBranch} activeSubTab="my-schedule" />} />
              <Route path="/roster" element={<EmployeeDashboard selectedBranch={selectedBranch} activeSubTab="roster" />} />
              <Route path="/reports" element={<ExcelExporter selectedBranch={selectedBranch} />} />
              <Route path="/profile" element={<UserProfilePage />} />
              <Route path="/profile/:userId" element={<UserProfilePage />} />
              <Route path="/" element={<Navigate to="/my-shifts" replace />} />
              <Route path="*" element={<Navigate to="/my-shifts" replace />} />
            </>
          )}
        </Routes>
      </ProtectedLayout>

      <PwaInstallPrompt />
    </>
  );
};

import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
