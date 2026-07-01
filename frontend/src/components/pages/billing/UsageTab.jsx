import React, { useEffect } from 'react';
import {
  Loader2, TrendingUp, Clock, Calendar, Zap,
  AlertCircle, AlertTriangle, CreditCard, CheckCircle,
} from 'lucide-react';
import { useSubscriptionStore } from '../../../store/subscription';

function formatHours(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: '#16a34a', bg: 'rgba(22,163,74,0.1)',   icon: CheckCircle },
  past_due:  { label: 'Past Due',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)',   icon: AlertCircle },
  canceled:  { label: 'Canceled',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: AlertCircle },
  trial:     { label: 'Trial',     color: '#5B6AF0', bg: 'rgba(91,106,240,0.1)',  icon: CreditCard },
  inactive:  { label: 'Inactive',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: AlertCircle },
  incomplete:{ label: 'Incomplete',color: '#d97706', bg: 'rgba(217,119,6,0.1)',   icon: AlertTriangle },
};

function progressColor(pct) {
  if (pct >= 90) return 'linear-gradient(90deg,#ef4444,#dc2626)';
  if (pct >= 70) return 'linear-gradient(90deg,#f59e0b,#f97316)';
  return 'linear-gradient(90deg,#5B6AF0,#8B5CF6)';
}

export default function UsageTab() {
  const { usage, loading, fetchUsage } = useSubscriptionStore();

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  if (loading.usage && !usage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 64, color: 'var(--text3)' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent2)' }} />
        <span style={{ fontSize: 13 }}>Loading usage data…</span>
      </div>
    );
  }

  if (!usage || !usage.has_subscription) {
    return (
      <div style={{ maxWidth: 520 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          padding: 40, textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: 'rgba(91,106,240,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <CreditCard size={24} style={{ color: 'var(--accent2)' }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            No Active Subscription
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Choose a plan to start uploading meetings and tracking your usage.
          </p>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[usage.status] || STATUS_CONFIG.inactive;
  const StatusIcon = statusCfg.icon;
  const pct = usage.usage_pct || 0;
  const days = daysUntil(usage.period_end);

  return (
    <div style={{ maxWidth: 660, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Warning banners */}
      {pct >= 100 && (
        <Banner type="error" icon={AlertCircle}>
          You've used <strong>100%</strong> of your quota. Uploads are paused until your plan renews or you upgrade.
        </Banner>
      )}
      {pct >= 90 && pct < 100 && (
        <Banner type="warning" icon={AlertTriangle}>
          You're at <strong>{pct}%</strong> of your quota. Consider upgrading before it runs out.
        </Banner>
      )}
      {usage.cancel_at_period_end && (
        <Banner type="error" icon={AlertCircle}>
          Subscription canceled — access continues until <strong>{formatDate(usage.period_end)}</strong>.
        </Banner>
      )}
      {usage.status === 'past_due' && (
        <Banner type="error" icon={AlertCircle}>
          Your last payment failed. Please update your payment method to restore access.
        </Banner>
      )}

      {/* Hero card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Current Plan
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              {usage.plan?.name || '—'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
              ${((usage.plan?.price_cents || 0) / 100).toFixed(0)}/{usage.plan?.interval === 'year' ? 'year' : 'month'}
              {usage.plan?.hours_limit ? ` · ${usage.plan.hours_limit}h included` : ''}
            </p>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            color: statusCfg.color, background: statusCfg.bg,
          }}>
            <StatusIcon size={12} />
            {statusCfg.label}
          </span>
        </div>

        {/* Progress section */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>Usage this period</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 90 ? '#ef4444' : 'var(--text)' }}>
              {pct}% used
            </span>
          </div>
          <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.min(pct, 100)}%`,
              background: progressColor(pct),
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {formatHours(usage.used_seconds)} used
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {formatHours(usage.quota_seconds)} total
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard
          icon={Zap}
          label="Total Remaining"
          value={formatHours(usage.remaining_seconds)}
          sub={`of ${formatHours(usage.quota_seconds)}`}
          accent={usage.remaining_seconds > 0 && pct < 70}
          warn={pct >= 90}
        />
        <StatCard
          icon={TrendingUp}
          label="Used"
          value={formatHours(usage.used_seconds)}
          sub={`${pct}% of total quota`}
        />
        <StatCard
          icon={Calendar}
          label="Renews In"
          value={days !== null ? `${days}d` : '—'}
          sub={formatDate(usage.period_end)}
        />
      </div>

      {/* Billing period card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
        padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Billing Period
          </p>
          <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
            {formatDate(usage.period_start)} — {formatDate(usage.period_end)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Next Renewal
          </p>
          <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
            {formatDate(usage.period_end)}
            {days !== null && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>({days} days)</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent, warn }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      padding: 16,
    }}>
      <div style={{ display: 'flex', align: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: warn ? 'rgba(239,68,68,0.1)' : accent ? 'rgba(22,163,74,0.1)' : 'var(--surface2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} style={{ color: warn ? '#ef4444' : accent ? '#16a34a' : 'var(--text3)' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: '28px' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: warn ? '#ef4444' : 'var(--text)', marginBottom: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub}</div>}
    </div>
  );
}

function Banner({ type, icon: Icon, children }) {
  const cfg = {
    error:   { bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.2)',  color: '#dc2626' },
    warning: { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)', color: '#d97706' },
  }[type];
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12,
      padding: '12px 16px', fontSize: 13, color: cfg.color,
    }}>
      <Icon size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}
