import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuthStore } from '../../store/adminAuth';

export default function AdminHeader() {
  const { logout, user } = useAdminAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <header style={{
      height: '64px',
      background: 'var(--panel)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
    }}>
      <div style={{
        fontSize: '18px',
        fontWeight: '600',
        color: 'var(--text)',
      }}>
        Super Admin Dashboard
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--surface2)',
          borderRadius: '20px',
          fontSize: '13px',
          color: 'var(--text2)',
        }}>
          <span style={{ fontSize: '14px' }}>🛡️</span>
          <span>Super Admin</span>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text2)',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface2)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text2)';
          }}
        >
          <span>🚪</span>
          Logout
        </button>
      </div>
    </header>
  );
}
