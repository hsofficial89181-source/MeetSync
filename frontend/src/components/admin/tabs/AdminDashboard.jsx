import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, CreditCard, DollarSign, ArrowRight, RefreshCw, Activity, Settings } from 'lucide-react';
import adminApi from '../../../services/adminApi';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await adminApi.get('/stats');
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatRevenue = (cents) => {
    if (!cents) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
  };

  const statCards = [
    { label: 'Total Workspaces', value: stats?.total_workspaces ?? '—', icon: Building2, color: '#5B6AF0', bg: 'rgba(91,106,240,0.1)' },
    { label: 'Total Users', value: stats?.total_users ?? '—', icon: Users, color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    { label: 'Active Subscriptions', value: stats?.active_subscriptions ?? '—', icon: CreditCard, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Total Revenue', value: stats ? formatRevenue(stats.total_revenue_cents) : '—', icon: DollarSign, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  ];

  const quickNav = [
    { label: 'Manage Workspaces', desc: 'View and edit all active workspaces', icon: Users, path: '/admin/users' },
    { label: 'Manage Subscriptions', desc: 'View all subscription plans and statuses', icon: CreditCard, path: '/admin/subscriptions' },
    { label: 'View Analytics', desc: 'System-wide usage statistics and charts', icon: Activity, path: '/admin/analytics' },
    { label: 'Platform Settings', desc: 'Update admin profile and password', icon: Settings, path: '/admin/settings' },
  ];

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Admin Dashboard
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Overview of system-wide administration</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
          <RefreshCw size={28} style={{ animation: 'spin 2s linear infinite', color: 'var(--text3)' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Admin Dashboard
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Overview of system-wide administration</p>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: 'var(--text3)', fontSize: '14px', marginBottom: '16px' }}>Failed to load stats: {error}</p>
          <button onClick={fetchStats} className="btn btn-ghost btn-sm">
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }

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

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        {statCards.map((card) => (
          <div key={card.label} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: card.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <card.icon size={20} color={card.color} />
            </div>
            <div>
              <div style={{
                fontSize: '28px',
                fontWeight: '700',
                color: 'var(--text)',
                lineHeight: 1.1,
                marginBottom: '6px',
              }}>
                {card.value}
              </div>
              <div style={{
                fontSize: '13px',
                color: 'var(--text2)',
              }}>
                {card.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Navigation */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '28px',
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px',
        }}>
          {quickNav.map((item) => (
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
                background: 'var(--surface3)',
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
  );
}

