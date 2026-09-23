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

const ProtectedLayout = ({ children, selectedBranch, setSelectedBranch, onOpenExcelExport }) => {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: '1rem' }}>
      <Navbar
        selectedBranch={selectedBranch}
        setSelectedBranch={setSelectedBranch}
        onOpenExcelExport={onOpenExcelExport}
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
  const [isExcelOpen, setIsExcelOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--primary)' }}>
        <Loader2 className="animate-spin" size={42} />
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Loading WrapTime PWA...
        </div>
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
        onOpenExcelExport={() => setIsExcelOpen(true)}
      >
        <Routes>
          {isManager ? (
            <>
              {/* Manager Routes */}
              <Route path="/schedule" element={<ManagerDashboard selectedBranch={selectedBranch} />} />
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
              <Route path="/profile" element={<UserProfilePage />} />
              <Route path="/profile/:userId" element={<UserProfilePage />} />
              <Route path="/" element={<Navigate to="/my-shifts" replace />} />
              <Route path="*" element={<Navigate to="/my-shifts" replace />} />
            </>
          )}
        </Routes>
      </ProtectedLayout>

      <ExcelExporter 
        isOpen={isExcelOpen}
        onClose={() => setIsExcelOpen(false)}
      />

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
