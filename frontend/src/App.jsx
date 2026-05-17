import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout        from './components/layout/Layout';
import Dashboard     from './components/pages/Dashboard';
import Meetings      from './components/pages/Meetings';
import MeetingDetail from './components/pages/MeetingDetail';
import TaskBoard     from './components/pages/TaskBoard';
import Integrations  from './components/pages/Integrations';
import Team          from './components/pages/Team';
import Analytics     from './components/pages/Analytics';
import Search        from './components/pages/Search';
import Settings      from './components/pages/Settings';
import Login          from './components/pages/Login';
import Register       from './components/pages/Register';
import ForgotPassword from './components/pages/ForgotPassword';
import OtpVerify      from './components/pages/OtpVerify';
import ResetPassword  from './components/pages/ResetPassword';
import ShareView     from './components/pages/ShareView';
import OAuthCallback from './components/pages/OAuthCallback';
import NotFound      from './components/pages/NotFound';
import ErrorBoundary from './components/ui/ErrorBoundary';
import PrivacyPolicy from './components/pages/PrivacyPolicy';
import TermsConditions from './components/pages/TermsConditions';

// Admin Panel imports
import AdminLogin       from './components/admin/AdminLogin';
import AdminLayout      from './components/admin/AdminLayout';
import AdminDashboard   from './components/admin/tabs/AdminDashboard';
import UserManagementTab from './components/admin/tabs/UserManagementTab';
import AnalyticsTab     from './components/admin/tabs/AnalyticsTab';
import IntegrationsTab  from './components/admin/tabs/IntegrationsTab';
import SettingsTab      from './components/admin/tabs/SettingsTab';
import WorkspaceDetail  from './components/admin/pages/WorkspaceDetail';
import WorkspaceEdit    from './components/admin/pages/WorkspaceEdit';

import { useStore }      from './store';
import { useAuthStore }  from './store/auth';
import { useThemeStore } from './store/theme';

function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading MeetSync…</div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function App() {
  const { init, isAuthenticated }                                      = useAuthStore();
  const { fetchMeetings, fetchTasks, fetchStats, fetchIntegrations }   = useStore();
  const { initTheme }                                                  = useThemeStore();

  useEffect(() => {
    initTheme();
    init();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMeetings();
      fetchTasks();
      fetchStats();
      fetchIntegrations();
    }
  }, [isAuthenticated]);

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route path="/login"                   element={<Login />} />
        <Route path="/register"                element={<Register />} />
        <Route path="/forgot-password"         element={<ForgotPassword />} />
        <Route path="/forgot-password/verify"  element={<OtpVerify />} />
        <Route path="/forgot-password/reset"   element={<ResetPassword />} />
        <Route path="/share/:token"            element={<ShareView />} />
        <Route path="/oauth/callback"           element={<OAuthCallback />} />
        <Route path="/privacy-policy"           element={<PrivacyPolicy />} />
        <Route path="/terms-conditions"         element={<TermsConditions />} />

        {/* Protected app shell */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Each page wrapped in its own ErrorBoundary so one crash doesn't kill the nav */}
          <Route path="dashboard"    element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="meetings"     element={<ErrorBoundary><Meetings /></ErrorBoundary>} />
          <Route path="meetings/:id" element={<ErrorBoundary><MeetingDetail /></ErrorBoundary>} />
          <Route path="tasks"        element={<ErrorBoundary><TaskBoard /></ErrorBoundary>} />
          <Route path="analytics"    element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
          <Route path="integrations" element={<ErrorBoundary><Integrations /></ErrorBoundary>} />
          <Route path="team"         element={<ErrorBoundary><Team /></ErrorBoundary>} />
          <Route path="search"       element={<ErrorBoundary><Search /></ErrorBoundary>} />
          <Route path="settings"     element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        </Route>

        {/* Admin Panel Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagementTab />} />
          <Route path="workspaces/:id" element={<WorkspaceDetail />} />
          <Route path="workspaces/:id/edit" element={<WorkspaceEdit />} />
          <Route path="analytics" element={<AnalyticsTab />} />
          <Route path="integrations" element={<IntegrationsTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Route>

        {/* 404 — catches all unmatched routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}
