import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Plug, Settings, ArrowRight, Zap } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '22px',
          fontWeight: '700',
          color: 'var(--text)',
          letterSpacing: '-0.5px',
          marginBottom: '4px',
        }}>
          Admin Dashboard
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Overview of system-wide administration</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '24px',
      }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <Zap size={20} color="white" fill="white" />
          </div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '12px',
          }}>
            Welcome to MeetSync Admin
          </h3>
          <p style={{
            fontSize: '14px',
            color: 'var(--text2)',
            lineHeight: '1.6',
            marginBottom: '20px',
          }}>
            This is the Super Admin panel where you can manage all aspects of the MeetSync AI platform.
          </p>
          <div style={{
            display: 'grid',
            gap: '12px',
          }}>
            {[
              { label: 'User Management', icon: Users, path: '/admin/users' },
              { label: 'System Analytics', icon: Activity, path: '/admin/analytics' },
              { label: 'Platform Settings', icon: Settings, path: '/admin/settings' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text2)' }}>
                <item.icon size={14} color="var(--accent)" />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '20px',
          }}>
            Quick Navigation
          </h3>
          <div style={{
            display: 'grid',
            gap: '12px',
          }}>
            {[
              { label: 'Manage Workspaces', desc: 'View and edit all active workspaces', icon: Users, path: '/admin/users' },
              { label: 'View Analytics', desc: 'System-wide usage statistics', icon: Activity, path: '/admin/analytics' },
              { label: 'Integrations', desc: 'Manage global platform integrations', icon: Plug, path: '/admin/integrations' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  width: '100%',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <item.icon size={18} color="var(--text2)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{item.desc}</div>
                </div>
                <ArrowRight size={14} color="var(--text3)" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

