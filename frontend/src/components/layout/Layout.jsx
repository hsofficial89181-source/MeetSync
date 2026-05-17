import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Video, CheckSquare, Plug, Users,
  Zap, BarChart2, Settings, Search, Bell, LogOut,
  ChevronDown, Sun, Moon, Menu, X,
} from 'lucide-react';
import { useAuthStore }  from '../../store/auth';
import { useThemeStore } from '../../store/theme';
import api from '../../services/api';

const NAV_MAIN = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/meetings',   icon: Video,           label: 'Meetings' },
  { to: '/tasks',      icon: CheckSquare,     label: 'Task Board' },
  { to: '/analytics',  icon: BarChart2,       label: 'Analytics' },
];
const NAV_MANAGE = [
  { to: '/integrations', icon: Plug,     label: 'Integrations' },
  { to: '/team',         icon: Users,    label: 'Team' },
  { to: '/settings',     icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const navigate  = useNavigate();
  const { user, workspace, logout } = useAuthStore();
  const { theme, toggleTheme }      = useThemeStore();
  const [notifCount, setNotifCount] = useState(0);
  const [notifs,     setNotifs]     = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUser,   setShowUser]   = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const notifRef = useRef(null);
  const userRef  = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function h(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (userRef.current  && !userRef.current.contains(e.target))  setShowUser(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Poll unread count
  useEffect(() => {
    fetchCount();
    const iv = setInterval(fetchCount, 30000);
    return () => clearInterval(iv);
  }, []);

  async function fetchCount() {
    try { const { data } = await api.get('/notifications/unread-count'); setNotifCount(data.count); } catch {}
  }

  async function handleBell() {
    const next = !showNotifs;
    setShowNotifs(next); setShowUser(false);
    if (next) { const { data } = await api.get('/notifications'); setNotifs(data); }
  }

  async function markAllRead() {
    await api.post('/notifications/read-all');
    setNotifCount(0); setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  }

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={16} color="white" fill="white" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{workspace?.name || 'MeetSync AI'}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Space Mono', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Action Engine</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '14px 12px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>Workspace</div>
        {NAV_MAIN.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={() => setMobileSidebarOpen(false)} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon size={14} /><span>{label}</span>
          </NavLink>
        ))}
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0 8px', margin: '14px 0 6px' }}>Manage</div>
        {NAV_MANAGE.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={() => setMobileSidebarOpen(false)} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon size={14} /><span>{label}</span>
          </NavLink>
        ))}

        {/* Footer links */}
        <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px 8px 8px' }}>
          <NavLink to="/privacy-policy" onClick={() => setMobileSidebarOpen(false)} style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'none', transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text2)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>Privacy Policy</NavLink>
          <NavLink to="/terms-conditions" onClick={() => setMobileSidebarOpen(false)} style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'none', transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text2)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>Terms & Conditions</NavLink>
        </div>
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
            onClick={() => { setShowUser(s => !s); setShowNotifs(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'rgba(91,106,240,0.2)', color: 'var(--accent2)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{user?.role}</div>
            </div>
            <ChevronDown size={12} color="var(--text3)" />
          </div>

          {showUser && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', zIndex: 200 }}>
              {[
                { label: 'Settings', icon: Settings, action: () => { navigate('/settings'); setShowUser(false); }, color: 'var(--text2)' },
                { label: 'Sign out',  icon: LogOut,   action: async () => { await logout(); navigate('/login'); }, color: 'var(--red)' },
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
    </>
  );

  return (
    <div className="app-layout" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' }}>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 299, display: 'none' }}
          className="sidebar-overlay visible"
        />
      )}

      {/* Sidebar */}
      <aside style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        {sidebarContent}
      </aside>

      {/* Main */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileSidebarOpen(s => !s)}
            style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4 }}
            className="mobile-only"
          >
            <Menu size={20} />
          </button>

          {/* Search trigger */}
          <div
            onClick={() => navigate('/search')}
            style={{ flex: 1, maxWidth: 440, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <Search size={14} color="var(--text3)" />
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>Search meetings, tasks, decisions…</span>
            <kbd style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)', background: 'var(--surface)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)', fontFamily: 'Space Mono' }}>⌘K</kbd>
          </div>

          {/* Notification bell */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              onClick={handleBell}
              style={{ position: 'relative', background: showNotifs ? 'var(--surface2)' : 'none', border: '1px solid var(--border)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)', transition: 'background 0.15s' }}
            >
              <Bell size={16} />
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--accent)', color: 'white', fontSize: 9, fontWeight: 700, width: 17, height: 17, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, zIndex: 200, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Notifications</span>
                  {notifCount > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all read</button>}
                </div>
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {notifs.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>You're all caught up ✓</div>
                  ) : notifs.map(n => (
                    <div key={n.id} onClick={() => { if (n.link) { navigate(n.link); setShowNotifs(false); } }}
                      style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: n.link ? 'pointer' : 'default', background: n.read ? 'transparent' : 'rgba(91,106,240,0.04)', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (n.link) e.currentTarget.style.background = 'var(--surface2)'; }}
                      onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(91,106,240,0.04)'}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 500, color: 'var(--text)', lineHeight: 1.4 }}>{n.title}</div>
                          {n.body && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{n.body}</div>}
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
