import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, AlertTriangle, CreditCard,
  Calendar, Download, Printer, Eye, X
} from 'lucide-react';
import adminApi from '../../../services/adminApi';

const STATUS_BADGE = {
  paid:          { label: 'Paid',         color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  open:          { label: 'Open',         color: '#7B8BFF', bg: 'rgba(91,106,240,0.1)' },
  void:          { label: 'Void',         color: '#8B92B3', bg: 'rgba(139,146,179,0.1)' },
  uncollectible: { label: 'Uncollectible',color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

const SUB_STATUS_BADGE = {
  active:   { label: 'Active',   color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  trial:    { label: 'Trial',    color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  past_due: { label: 'Past Due', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  canceled: { label: 'Canceled', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  inactive: { label: 'Inactive', color: '#8B92B3', bg: 'rgba(139,146,179,0.1)' },
};

function formatCents(cents) {
  if (!cents && cents !== 0) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(cents / 100);
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SubscriptionDetail() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    fetchDetail();
  }, [workspaceId]);

  const fetchDetail = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data } = await adminApi.get(`/subscriptions/${workspaceId}`);
      setData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (invoice) => {
    setDownloading(invoice.id);
    try {
      const token = localStorage.getItem('adminAccessToken');
      const res = await fetch(`/api/admin/subscriptions/${workspaceId}/invoices/${invoice.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err.message);
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <RefreshCw size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--text3)', marginBottom: '16px' }} />
        <div style={{ color: 'var(--text2)', fontSize: '13px' }}>Loading subscription details...</div>
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
        <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '16px' }} />
        <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>Error Loading Subscription</div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>{error}</div>
        <button onClick={() => navigate('/admin/subscriptions')} className="btn btn-ghost">
          <ArrowLeft size={14} /> Back to Subscriptions
        </button>
      </div>
    );
  }

  const sub = data?.subscription;
  const subBadge = sub ? (SUB_STATUS_BADGE[sub.status] || SUB_STATUS_BADGE.inactive) : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
        <button onClick={() => navigate('/admin/subscriptions')} className="btn btn-ghost">
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.5px' }}>
            {data?.workspace?.name}
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'Space Mono' }}>{data?.workspace?.slug}</div>
        </div>
      </div>

      {/* Subscription Info Card */}
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '16px' }}>
        Subscription Details
      </h3>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px',
      }}>
        {sub ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                Plan
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={16} color="var(--accent2)" />
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>
                  {sub.plan_name || '--'}
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                Status
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600',
                background: subBadge.bg,
                color: subBadge.color,
              }}>
                {subBadge.label}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                Price
              </div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>
                {sub.price_cents ? formatCents(sub.price_cents) : '--'}
                {sub.hours_limit ? ` / ${sub.hours_limit} hrs` : ''}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                Billing Period
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text)' }}>
                <Calendar size={14} color="var(--text3)" />
                {formatDate(sub.current_period_start)} - {formatDate(sub.current_period_end)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                Created
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                {formatDate(sub.created_at)}
              </div>
            </div>
            {sub.cancel_at_period_end && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                  Cancellation
                </div>
                <div style={{ fontSize: '13px', color: '#F59E0B', fontWeight: 500 }}>
                  Cancels at period end
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '6px' }}>
              No Active Subscription
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
              This workspace does not have a subscription.
            </div>
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '16px' }}>
        Invoices
      </h3>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Invoice #', 'Date', 'Amount', 'Status', 'Actions'].map((h, i) => (
                  <th key={h} style={{
                    padding: '16px',
                    textAlign: i >= 2 ? 'center' : 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--text2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.invoices?.map((inv) => {
                const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.open;
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text2)' }}>
                        {formatDate(inv.created_at)}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                        {formatCents(inv.total_cents)}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: badge.bg,
                        color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="btn btn-ghost btn-sm"
                          title="View Invoice"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setTimeout(() => window.print(), 300);
                          }}
                          className="btn btn-ghost btn-sm"
                          title="Print Invoice"
                        >
                          <Printer size={13} />
                        </button>
                        <button
                          onClick={() => handleDownload(inv)}
                          disabled={downloading === inv.id}
                          className="btn btn-ghost btn-sm"
                          title="Download PDF"
                          style={{ opacity: downloading === inv.id ? 0.5 : 1 }}
                        >
                          {downloading === inv.id
                            ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Download size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(!data?.invoices || data.invoices.length === 0) && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧾</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
              No invoices found
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text2)' }}>
              This workspace has no invoices yet.
            </div>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }} onClick={() => setSelectedInvoice(null)}>
          <div className="print-area" style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '28px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>Invoice Details</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} className="btn btn-ghost btn-sm">
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setSelectedInvoice(null)} className="btn btn-ghost btn-sm">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Invoice Content */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent2)' }}>MeetSync AI</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>Action Engine for Meetings</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>support@meetsync.ai</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>INVOICE</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>#{selectedInvoice.invoice_number}</div>
                  <span style={{
                    display: 'inline-block', marginTop: '6px', padding: '2px 10px', borderRadius: '12px',
                    fontSize: '11px', fontWeight: '600',
                    color: STATUS_BADGE[selectedInvoice.status]?.color,
                    background: STATUS_BADGE[selectedInvoice.status]?.bg,
                  }}>
                    {STATUS_BADGE[selectedInvoice.status]?.label || selectedInvoice.status}
                  </span>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)', marginBottom: '20px' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                    Billed To
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                    {data?.workspace?.name || '--'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                    Invoice Details
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Date: {formatDate(selectedInvoice.created_at)}</div>
                  {selectedInvoice.paid_at && (
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Paid: {formatDate(selectedInvoice.paid_at)}</div>
                  )}
                  {selectedInvoice.period_start && selectedInvoice.period_end && (
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      Period: {formatDate(selectedInvoice.period_start)} - {formatDate(selectedInvoice.period_end)}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text)', marginBottom: '8px' }}>
                  <span>{sub?.plan_name || 'Subscription'}</span>
                  <span>{formatCents(selectedInvoice.amount_cents)}</span>
                </div>
                {selectedInvoice.tax_cents > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>
                    <span>Tax</span>
                    <span>{formatCents(selectedInvoice.tax_cents)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '12px', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
                    <span>Total</span>
                    <span>{formatCents(selectedInvoice.total_cents)} {selectedInvoice.currency?.toUpperCase() || 'USD'}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text3)', textAlign: 'center' }}>
                This is a computer-generated invoice and does not require a signature.<br />
                Thank you for your business!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
