import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Menu, Search, Bell } from 'lucide-react';
import { useAdminAuthStore } from '../../store/adminAuth';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout() {
  const { isAuthenticated, isLoading, init } = useAdminAuthStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/admin/login', { replace: true, state: { from: location } });
    }
  }, [isLoading, isAuthenticated, navigate, location]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text2)'
      }}>
        Loading Admin...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="admin-layout" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' }}>
      
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 299 }}
          className="sidebar-overlay visible"
        />
      )}

      {/* Sidebar */}
      <aside style={{ background: 'var(--surface2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <AdminSidebar />
      </aside>

      {/* Main */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileSidebarOpen(s => !s)}
            style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4 }}
            className="mobile-only"
          >
            <Menu size={20} />
          </button>

          {/* Search trigger (Admin search) */}
          <div
            style={{ flex: 1, maxWidth: 440, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <Search size={14} color="var(--text3)" />
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>Admin search: users, workspaces…</span>
          </div>

          {/* Placeholder for future admin notifications */}
          <div style={{ position: 'relative' }}>
            <button
              style={{ position: 'relative', background: 'none', border: '1px solid var(--border)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)', transition: 'background 0.15s' }}
            >
              <Bell size={16} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
