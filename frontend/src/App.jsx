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
import Login         from './components/pages/Login';
import Register      from './components/pages/Register';
import ShareView     from './components/pages/ShareView';
import NotFound      from './components/pages/NotFound';
import ErrorBoundary from './components/ui/ErrorBoundary';
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
        <Route path="/login"        element={<Login />} />
        <Route path="/register"     element={<Register />} />
        <Route path="/share/:token" element={<ShareView />} />

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

        {/* 404 — catches all unmatched routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}
