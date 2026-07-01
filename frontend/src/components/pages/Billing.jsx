import React, { useState, useEffect } from 'react';
import { BarChart2, CreditCard, FileText } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useSubscriptionStore } from '../../store/subscription';
import UsageTab from './billing/UsageTab';
import ManageSubscriptionTab from './billing/ManageSubscriptionTab';
import InvoicesTab from './billing/InvoicesTab';
import Checkout from './Checkout';

const TABS = [
  { key: 'manage',   label: 'Manage Subscription', icon: CreditCard },
  { key: 'usage',    label: 'Usage',              icon: BarChart2 },
  { key: 'invoices', label: 'Invoices',            icon: FileText },
];

export default function Billing() {
  const [tab, setTab] = useState('manage');
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const { fetchAll, fetchSubscription, fetchUsage, fetchHistory, fetchInvoices } = useSubscriptionStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader title="Billing & Subscription" subtitle="Manage your plan, usage, and invoices" />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '200px 1fr', overflow: 'hidden' }} className="settings-layout">
        {/* Sidebar tabs */}
        <div style={{ borderRight: '1px solid var(--border)', padding: '16px 12px', background: 'var(--surface)' }} className="settings-tabs">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setCheckoutPlan(null); setTab(t.key); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'rgba(91,106,240,0.1)' : 'transparent',
              color: tab === t.key ? 'var(--accent2)' : 'var(--text2)',
              fontSize: 13, fontFamily: 'DM Sans, sans-serif', marginBottom: 2, textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (tab !== t.key) e.currentTarget.style.background = 'var(--surface2)'; }}
            onMouseLeave={e => { if (tab !== t.key) e.currentTarget.style.background = 'transparent'; }}
            >
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', padding: 28, background: 'var(--bg)' }}>
          {checkoutPlan ? (
            <Checkout
              plan={checkoutPlan}
              onClose={() => setCheckoutPlan(null)}
              onSuccess={async () => {
                await fetchSubscription();
                await fetchUsage();
                await fetchHistory();
                await fetchInvoices();
              }}
            />
          ) : (
            <>
              {tab === 'usage'    && <UsageTab />}
              {tab === 'manage'   && <ManageSubscriptionTab onSelectPlan={setCheckoutPlan} />}
              {tab === 'invoices' && <InvoicesTab />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
