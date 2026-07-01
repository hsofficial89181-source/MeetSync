import React, { useState, useEffect } from 'react';
import {
  Loader2, Check, AlertCircle, CreditCard, X, ArrowUp, ArrowDown,
  XCircle, RotateCcw, Clock, Star, Zap, Users, Building2, RefreshCw,
} from 'lucide-react';
import { useSubscriptionStore } from '../../../store/subscription';
import { useAuthStore } from '../../../store/auth';

function formatCents(cents) {
  return `$${((cents || 0) / 100).toFixed(0)}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  past_due:  { label: 'Past Due',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  canceled:  { label: 'Canceled',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  trial:     { label: 'Trial',     color: '#5B6AF0', bg: 'rgba(91,106,240,0.1)' },
  inactive:  { label: 'Inactive',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

const PLAN_ICONS = {
  starter:      Zap,
  professional: Star,
  business:     Users,
  enterprise:   Building2,
};

const PLAN_FEATURES = {
  starter:      ['10 meeting hours/month', 'AI transcription'],
  professional: ['30 meeting hours/month', 'AI transcription'],
  business:     ['80 meeting hours/month', 'AI transcription'],
  enterprise:   ['350 meeting hours/month', 'AI transcription'],
};

const PLAN_FEATURES_YEARLY = {
  starter:      ['120 meeting hours/year', 'AI transcription'],
  professional: ['360 meeting hours/year', 'AI transcription'],
  business:     ['960 meeting hours/year', 'AI transcription'],
  enterprise:   ['4200 meeting hours/year', 'AI transcription'],
};

export default function ManageSubscriptionTab({ onSelectPlan }) {
  const {
    plans, subscription, history, usage, loading,
    fetchPlans, fetchSubscription, fetchHistory, fetchUsage,
    upgradePlan, downgradePlan, cancelSubscription, reactivateSubscription,
    previewUpgrade,
  } = useSubscriptionStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [billingInterval, setBillingInterval] = useState('month');
  const [confirmModal, setConfirmModal] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    fetchPlans();
    fetchSubscription();
    fetchHistory();
    fetchUsage();
  }, [fetchPlans, fetchSubscription, fetchHistory, fetchUsage]);

  const currentPlanCode = subscription?.plan?.code;
  const subStatus = subscription?.subscription?.status || 'inactive';
  const statusCfg = STATUS_CONFIG[subStatus] || STATUS_CONFIG.inactive;
  const cancelAtEnd = subscription?.subscription?.cancel_at_period_end;
  const hasSubscription = !!subscription?.subscription && subStatus !== 'inactive' && subStatus !== 'canceled';

  async function handleAction(action, planCode) {
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      if (action === 'upgrade') {
        const res = await upgradePlan(planCode);
        setActionSuccess(res.message || 'Plan upgraded successfully');
      } else if (action === 'downgrade') {
        const res = await downgradePlan(planCode);
        setActionSuccess(res.message || 'Downgrade scheduled for next billing period');
      } else if (action === 'cancel') {
        const res = await cancelSubscription();
        setActionSuccess(res.message || 'Subscription will be canceled at period end');
      } else if (action === 'reactivate') {
        const res = await reactivateSubscription();
        setActionSuccess(res.message || 'Subscription reactivated');
      }
      setConfirmModal(null);
      setUpgradeModal(null);
      await fetchHistory();
    } catch (err) {
      setActionError(err?.response?.data?.error || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading.subscription && !subscription) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 64, color: 'var(--text3)' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent2)' }} />
        <span style={{ fontSize: 13 }}>Loading subscription…</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 740, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {actionError && <StatusBanner type="error" icon={AlertCircle}>{actionError}</StatusBanner>}
      {actionSuccess && <StatusBanner type="success" icon={Check}>{actionSuccess}</StatusBanner>}

      {/* ── Current Subscription Card ── */}
      {hasSubscription ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          padding: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Current Plan
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {subscription.plan?.name || '—'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
                {formatCents(subscription.plan?.price_cents)}/{subscription.plan?.interval === 'year' ? 'year' : 'month'} · {subscription.plan?.hours_limit || '—'} hours included
              </p>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              color: statusCfg.color, background: statusCfg.bg, flexShrink: 0,
            }}>
              {statusCfg.label}
            </span>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            {/* Payment method */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {subscription.payment_method ? (
                <>
                  <div style={{
                    width: 32, height: 22, borderRadius: 4, background: 'var(--surface2)',
                    border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CreditCard size={13} style={{ color: 'var(--text3)' }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>
                    <span style={{ textTransform: 'capitalize' }}>{subscription.payment_method.brand}</span>
                    {' '}·· {subscription.payment_method.last4}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {subscription.payment_method.exp_month}/{String(subscription.payment_method.exp_year).slice(-2)}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>No payment method on file</span>
              )}
            </div>

            {/* Actions */}
            {isAdmin && (
              <div style={{ display: 'flex', gap: 8 }}>
                {cancelAtEnd ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setConfirmModal({ action: 'reactivate' })}
                    disabled={actionLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RotateCcw size={13} /> Reactivate
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmModal({ action: 'cancel' })}
                    disabled={actionLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}
                  >
                    <XCircle size={13} /> Cancel Plan
                  </button>
                )}
              </div>
            )}
          </div>

          {cancelAtEnd && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)',
              borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginTop: 16,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              Subscription cancels at end of billing period — access until <strong style={{ marginLeft: 4 }}>{formatDate(subscription.subscription?.current_period_end)}</strong>
            </div>
          )}

          {subscription?.subscription?.pending_plan_code && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(91,106,240,0.06)', border: '1px solid rgba(91,106,240,0.15)',
              borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--accent2)', marginTop: 16,
            }}>
              <ArrowDown size={14} style={{ flexShrink: 0 }} />
              Plan switches to <strong style={{ marginLeft: 4 }}>{subscription.subscription.pending_plan_name}</strong> at the next billing period — <strong style={{ marginLeft: 4 }}>{formatDate(subscription.subscription?.current_period_end)}</strong>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16,
          padding: 32, textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'var(--surface2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <CreditCard size={20} style={{ color: 'var(--text3)' }} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No Active Subscription</h3>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Choose a plan below to start uploading meetings.</p>
        </div>
      )}

      {/* ── Usage Summary (with carry-over) ── */}
      {hasSubscription && usage?.has_subscription && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          padding: 20,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Usage Summary
          </h3>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                {Math.floor(usage.used_seconds / 3600)}h {Math.floor((usage.used_seconds % 3600) / 60)}m used
              </span>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                {Math.floor(usage.remaining_seconds / 3600)}h {Math.floor((usage.remaining_seconds % 3600) / 60)}m remaining
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(usage.usage_pct, 100)}%`,
                background: usage.usage_pct > 90 ? '#EF4444' : usage.usage_pct > 70 ? '#F59E0B' : '#22C55E',
                borderRadius: 4, transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Plan Cards ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Available Plans
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {loading.plans && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text3)' }} />}
            {/* Monthly / Yearly toggle */}
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 3, gap: 2,
            }}>
              <button
                onClick={() => setBillingInterval('month')}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
                  background: billingInterval === 'month' ? 'var(--surface)' : 'transparent',
                  color: billingInterval === 'month' ? 'var(--text)' : 'var(--text3)',
                  boxShadow: billingInterval === 'month' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('year')}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
                  background: billingInterval === 'year' ? 'var(--surface)' : 'transparent',
                  color: billingInterval === 'year' ? 'var(--text)' : 'var(--text3)',
                  boxShadow: billingInterval === 'year' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                Yearly
                {billingInterval === 'year' && (
                  <span style={{
                    background: 'rgba(22,163,74,0.12)', color: '#16a34a',
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                  }}>SAVE MORE</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {plans.filter(p => p.interval === billingInterval).map(plan => {
            const baseCode = plan.code.replace('_yearly', '');
            const isCurrent = plan.code === currentPlanCode;
            const visiblePlans = plans.filter(p => p.interval === billingInterval);
            const planIdx = visiblePlans.findIndex(p => p.code === plan.code);
            const currIdx = visiblePlans.findIndex(p => p.code === currentPlanCode);
            const isUpgrade = hasSubscription && planIdx > currIdx;
            const isDowngrade = hasSubscription && planIdx < currIdx;
            const currentInterval = subscription?.plan?.interval;
            const isYearlyBlocked = hasSubscription && currentInterval === 'year' && plan.interval === 'month';
            const PlanIcon = PLAN_ICONS[baseCode] || Zap;
            const features = plan.interval === 'year'
              ? (PLAN_FEATURES_YEARLY[baseCode] || [`${plan.hours_limit} hours/year`])
              : (PLAN_FEATURES[baseCode] || [`${plan.hours_limit} hours/month`]);
            const displayCents = plan.price_cents;
            const priceSuffix = plan.interval === 'year' ? '/yr' : '/mo';

            return (
              <div key={plan.code} style={{
                background: isCurrent ? 'rgba(91,106,240,0.04)' : 'var(--surface)',
                border: isCurrent ? '2px solid var(--accent2)' : '1px solid var(--border)',
                borderRadius: 14, padding: 18, position: 'relative',
                display: 'flex', flexDirection: 'column',
              }}>
                {isCurrent && (
                  <span style={{
                    position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--accent2)', color: '#fff', fontSize: 10, fontWeight: 700,
                    padding: '2px 10px', borderRadius: 99, letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  }}>
                    CURRENT
                  </span>
                )}

                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: isCurrent ? 'rgba(91,106,240,0.12)' : 'var(--surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                }}>
                  <PlanIcon size={16} style={{ color: isCurrent ? 'var(--accent2)' : 'var(--text3)' }} />
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{plan.name.replace(' (Yearly)', '')}</div>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: isCurrent ? 'var(--accent2)' : 'var(--text)' }}>
                    {formatCents(displayCents)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{priceSuffix}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                  {features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                      <Check size={11} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div style={{
                    textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--accent2)',
                    padding: '7px 0', borderRadius: 8, background: 'rgba(91,106,240,0.08)',
                  }}>
                    Your Plan
                  </div>
                ) : isYearlyBlocked ? (
                  <div style={{
                    textAlign: 'center', fontSize: 11, fontWeight: 500, color: 'var(--text3)',
                    padding: '7px 0', borderRadius: 8, background: 'var(--surface2)',
                    cursor: 'not-allowed',
                  }}>
                    Yearly plan active
                  </div>
                ) : isAdmin ? (
                  <button
                    className="btn btn-sm"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      background: isUpgrade ? 'var(--accent2)' : 'var(--surface2)',
                      color: isUpgrade ? '#fff' : 'var(--text2)',
                      border: isUpgrade ? 'none' : '1px solid var(--border)',
                      borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                    disabled={actionLoading}
                    onClick={() => {
                      if (!hasSubscription) {
                        onSelectPlan(plan);
                      } else if (isUpgrade) {
                        setUpgradeModal({ planCode: plan.code, planName: plan.name.replace(' (Yearly)', '') });
                      } else if (isDowngrade) {
                        setConfirmModal({ action: 'downgrade', planCode: plan.code, isUpgrade, isDowngrade });
                      }
                    }}
                  >
                    {!hasSubscription ? 'Subscribe' :
                     isUpgrade   ? <><ArrowUp size={12} /> Upgrade</>   :
                                   <><ArrowDown size={12} /> Downgrade</>}
                  </button>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '4px 0' }}>
                    Contact admin to change plan
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Subscription History ── */}
      {history.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            History
          </h3>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {history.slice(0, 8).map((h, i) => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < Math.min(history.length, 8) - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <HistoryDot action={h.action} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                    {formatHistoryAction(h.action)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                    {h.from_plan && h.to_plan && h.from_plan !== h.to_plan
                      ? `${h.from_plan} → ${h.to_plan}`
                      : h.to_plan || h.from_plan || ''}
                    {h.performed_by_name && <span> · {h.performed_by_name}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                  {new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      {confirmModal && (
        <ConfirmModal
          modal={confirmModal}
          plans={plans}
          currentPlanName={subscription?.plan?.name}
          planEndDate={subscription?.subscription?.current_period_end}
          loading={actionLoading}
          error={actionError}
          onCancel={() => { setConfirmModal(null); setActionError(''); }}
          onConfirm={() => handleAction(confirmModal.action, confirmModal.planCode)}
        />
      )}

      {/* ── Upgrade Modal ── */}
      {upgradeModal && (
        <UpgradeModal
          planCode={upgradeModal.planCode}
          planName={upgradeModal.planName}
          currentPlanName={subscription?.plan?.name}
          previewUpgrade={previewUpgrade}
          loading={actionLoading}
          error={actionError}
          onCancel={() => { setUpgradeModal(null); setActionError(''); }}
          onConfirm={() => handleAction('upgrade', upgradeModal.planCode)}
        />
      )}
    </div>
  );
}

function HistoryDot({ action }) {
  const cfg = {
    created:        { color: '#16a34a', bg: 'rgba(22,163,74,0.12)',   Icon: Check },
    upgraded:       { color: '#5B6AF0', bg: 'rgba(91,106,240,0.12)',  Icon: ArrowUp },
    downgraded:     { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', Icon: ArrowDown },
    canceled:       { color: '#dc2626', bg: 'rgba(220,38,38,0.1)',   Icon: XCircle },
    reactivated:    { color: '#16a34a', bg: 'rgba(22,163,74,0.12)',   Icon: RotateCcw },
    payment_failed: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)',   Icon: AlertCircle },
  };
  const { color, bg, Icon } = cfg[action] || { color: '#6b7280', bg: 'var(--surface2)', Icon: Clock };
  return (
    <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={13} style={{ color }} />
    </div>
  );
}

function formatHistoryAction(action) {
  return {
    created: 'Subscription Created', upgraded: 'Plan Upgraded',
    downgraded: 'Plan Downgraded', canceled: 'Subscription Canceled',
    reactivated: 'Subscription Reactivated', payment_failed: 'Payment Failed',
  }[action] || action;
}

function ConfirmModal({ modal, plans, currentPlanName, planEndDate, loading, error, onCancel, onConfirm }) {
  const plan = plans.find(p => p.code === modal.planCode);

  const titles = {
    upgrade: 'Upgrade Plan',
    downgrade: 'Schedule Downgrade',
    cancel: 'Cancel Subscription',
    reactivate: 'Reactivate Subscription',
  };
  const messages = {
    upgrade: `You're upgrading from ${currentPlanName} to ${plan?.name}. The new plan becomes active immediately. Stripe will prorate the difference and charge your existing payment method. Your remaining usage hours carry over to the new plan.`,
    downgrade: `You're downgrading from ${currentPlanName} to ${plan?.name}. Your current plan remains active until the end of this billing period (${formatDate(planEndDate)}). The new plan takes effect at renewal, and usage hours will reset according to the new plan.`,
    cancel: 'Your subscription will be canceled at the end of the current billing period. You keep full access until then.',
    reactivate: 'Your subscription will continue billing normally. No changes to your billing date.',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: 28, maxWidth: 420, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {titles[modal.action] || 'Confirm Action'}
          </h3>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 6 }}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>
          {messages[modal.action] || 'Are you sure?'}
        </p>

        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 16,
            display: 'flex', gap: 6, alignItems: 'center',
          }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel} disabled={loading}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={loading}
            style={{
              background: modal.action === 'cancel' ? '#dc2626' : 'var(--accent2)',
              color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpgradeModal({ planCode, planName, currentPlanName, previewUpgrade, loading, error, onCancel, onConfirm }) {
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError('');
    previewUpgrade(planCode)
      .then(data => { if (!cancelled) setPreview(data); })
      .catch(() => { if (!cancelled) setPreviewError('Unable to load upgrade preview. Please try again.'); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [planCode]);

  const amount = preview?.amount_cents || 0;
  const hasCharge = amount > 0;
  const pm = preview?.payment_method;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'rgba(91,106,240,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowUp size={16} style={{ color: 'var(--accent2)' }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Upgrade Plan
            </h3>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 6 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Plan transition */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
          background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{currentPlanName}</span>
          <ArrowUp size={14} style={{ color: 'var(--accent2)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent2)' }}>{planName}</span>
        </div>

        {previewLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 0' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent2)' }} />
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>Calculating prorated charge…</span>
          </div>
        ) : previewError ? (
          <div style={{
            background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <AlertCircle size={14} /> {previewError}
          </div>
        ) : (
          <>
            {/* Charge amount */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, marginBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                  Prorated Charge
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Billed immediately via your saved payment method
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: hasCharge ? 'var(--text)' : '#16a34a' }}>
                {hasCharge ? `$${(amount / 100).toFixed(2)}` : 'No Charge'}
              </div>
            </div>

            {/* Payment method */}
            {pm && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16,
              }}>
                <div style={{
                  width: 32, height: 22, borderRadius: 4, background: 'var(--surface2)',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CreditCard size={13} style={{ color: 'var(--text3)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    <span style={{ textTransform: 'capitalize' }}>{pm.brand}</span>
                    {' '}·· {pm.last4}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    Expires {pm.exp_month}/{String(pm.exp_year).slice(-2)}
                  </div>
                </div>
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 16 }}>
              The new plan becomes active immediately upon confirmation.
            </p>
          </>
        )}

        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 16,
            display: 'flex', gap: 6, alignItems: 'center',
          }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel} disabled={loading || previewLoading}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={loading || previewLoading}
            style={{
              background: 'var(--accent2)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              opacity: loading || previewLoading ? 0.7 : 1,
            }}
          >
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</> : 'Confirm & Pay'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBanner({ type, icon: Icon, children }) {
  const cfg = {
    error:   { bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.2)',  color: '#dc2626' },
    success: { bg: 'rgba(22,163,74,0.07)', border: 'rgba(22,163,74,0.2)', color: '#16a34a' },
  }[type];
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12,
      padding: '11px 16px', fontSize: 13, color: cfg.color,
    }}>
      <Icon size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}
