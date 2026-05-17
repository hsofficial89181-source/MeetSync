import React, { useRef, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, BarChart2, Plug, Settings, 
  Zap, Sun, Moon, LogOut, ChevronDown 
} from 'lucide-react';
import { useAdminAuthStore } from '../../store/adminAuth';
import { useThemeStore } from '../../store/theme';

const menuItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/users', label: 'User Management', icon: Users },
  { path: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/admin/integrations', label: 'Integrations', icon: Plug },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminSidebar() {
  const { user, logout } = useAdminAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const [showUser, setShowUser] = useState(false);
  const userRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function h(e) {
      if (userRef.current && !userRef.current.contains(e.target)) setShowUser(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SA';

  return (
    <div className="admin-sidebar-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={16} color="white" fill="white" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>MeetSync AI</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Space Mono', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '14px 12px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>Administration</div>
        {menuItems.map(({ path, icon: Icon, label, end }) => (
          <NavLink 
            key={path} 
            to={path} 
            end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={14} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + theme toggle */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 13, marginBottom: 4, transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {/* User menu */}
        <div style={{ position: 'relative' }} ref={userRef}>
          <div
            onClick={() => setShowUser(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'rgba(91,106,240,0.2)', color: 'var(--accent2)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{user?.name || 'Super Admin'}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{user?.role || 'superadmin'}</div>
            </div>
            <ChevronDown size={12} color="var(--text3)" />
          </div>

          {showUser && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', zIndex: 200 }}>
              {[
                { label: 'Admin Settings', icon: Settings, action: () => { navigate('/admin/settings'); setShowUser(false); }, color: 'var(--text2)' },
                { label: 'Sign out',  icon: LogOut,   action: async () => { await logout(); navigate('/admin/login'); }, color: 'var(--red)' },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'none', border: 'none', color: item.color, cursor: 'pointer', fontSize: 13, textAlign: 'left', transition: 'background 0.1s', fontFamily: 'DM Sans, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <item.icon size={13} />{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
