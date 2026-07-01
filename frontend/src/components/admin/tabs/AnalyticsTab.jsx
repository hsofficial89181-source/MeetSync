import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { RefreshCw, TrendingUp, DollarSign, CreditCard, Users } from 'lucide-react';
import adminApi from '../../../services/adminApi';

const C = {
  accent:  '#5B6AF0',
  accent2: '#7B8BFF',
  green:   '#22C55E',
  amber:   '#F59E0B',
  red:     '#EF4444',
  purple:  '#8B5CF6',
  gray:    '#8B92B3',
  grid:    'rgba(128,128,160,0.12)',
  tooltip: { backgroundColor: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 },
};

const PIE_COLORS = [C.accent, C.green, C.amber, C.purple, C.red, C.gray];

function formatCents(cents) {
  if (!cents) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(cents / 100);
}

export default function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await adminApi.get('/analytics');
      setData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <RefreshCw size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--text3)', marginBottom: '16px' }} />
        <div style={{ color: 'var(--text2)', fontSize: '13px' }}>Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '12px',
        padding: '32px',
        textAlign: 'center',
        maxWidth: '500px',
        margin: '40px auto',
      }}>
        <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>Error Loading Analytics</div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>{error}</div>
        <button onClick={fetchAnalytics} className="btn btn-ghost">
          <RefreshCw size={14} /> Try Again
        </button>
      </div>
    );
  }

  const totalRevenue = (data?.revenue || []).reduce((sum, r) => sum + (r.revenue_cents || 0), 0);
  const avgRevenue = data?.revenue?.length ? totalRevenue / data.revenue.length : 0;
  const totalActiveSubs = (data?.plans || []).reduce((sum, p) => sum + (p.count || 0), 0);
  const topPlan = data?.plans?.[0]?.plan_name || '—';

  const statCards = [
    { label: 'Total Revenue (6mo)', value: formatCents(totalRevenue), icon: DollarSign, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
    { label: 'Avg Monthly Revenue', value: formatCents(avgRevenue), icon: TrendingUp, color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    { label: 'Active Subscriptions', value: totalActiveSubs, icon: CreditCard, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Most Popular Plan', value: topPlan, icon: Users, color: '#5B6AF0', bg: 'rgba(91,106,240,0.1)' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
          System Analytics
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Platform-wide growth, revenue, and subscription metrics</p>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {statCards.map((card) => (
          <div key={card.label} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: card.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <card.icon size={18} color={card.color} />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)', lineHeight: 1.2, marginBottom: '4px' }}>
                {card.value}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px',
      }}>
        {/* Growth Chart */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
            Growth Over Time
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '20px' }}>
            New workspaces and users (last 6 months)
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.growth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8B92B3' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8B92B3' }} allowDecimals={false} />
              <Tooltip contentStyle={C.tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="workspaces" stroke={C.accent} strokeWidth={2} dot={{ r: 3 }} name="Workspaces" />
              <Line type="monotone" dataKey="users" stroke={C.green} strokeWidth={2} dot={{ r: 3 }} name="Users" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Chart */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
            Revenue by Month
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '20px' }}>
            Paid invoice revenue (last 6 months)
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.revenue || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8B92B3' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8B92B3' }} tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
              <Tooltip contentStyle={C.tooltip} formatter={(v) => formatCents(v)} />
              <Bar dataKey="revenue_cents" fill={C.purple} radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Plan Distribution */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
            Subscription Plan Distribution
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '20px' }}>
            Active subscriptions by plan
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data?.plans || []}
                dataKey="count"
                nameKey="plan_name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {(data?.plans || []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={C.tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
