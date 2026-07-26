import React, { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, Download, Printer } from 'lucide-react';
import { useSubscriptionStore } from '../../../store/subscription';

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_BADGE = {
  paid:          { label: 'Paid',        color: 'var(--green)',  bg: 'rgba(34,197,94,0.1)' },
  open:          { label: 'Open',        color: 'var(--accent2)',bg: 'rgba(91,106,240,0.1)' },
  void:          { label: 'Void',        color: 'var(--text3)',  bg: 'rgba(107,114,128,0.1)' },
  uncollectible: { label: 'Uncollectible',color: 'var(--red)',   bg: 'rgba(239,68,68,0.1)' },
};

export default function InvoiceDetail({ invoiceId, onBack }) {
  const { fetchInvoiceDetail, downloadInvoice, invoiceDetail, loading } = useSubscriptionStore();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchInvoiceDetail(invoiceId);
  }, [fetchInvoiceDetail, invoiceId]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadInvoice(invoiceId);
    } catch (err) {
      console.error('Download failed:', err.message);
    } finally {
      setDownloading(false);
    }
  }

  if (loading.invoiceDetail && !invoiceDetail) {
    return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
    </div>;
  }

  if (!invoiceDetail) {
    return <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 32 }}>Invoice not found</div>;
  }

  const badge = STATUS_BADGE[invoiceDetail.status] || STATUS_BADGE.open;

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Back + Actions */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Invoices
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            <Printer size={14} /> Print
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={downloading}>
            {downloading
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <Download size={14} />}
            Download PDF
          </button>
        </div>
      </div>

      {/* Invoice Card */}
      <div className="print-area" style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent2)' }}>MeetSync AI</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Action Engine for Meetings</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>support@meetsyncai.net</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>INVOICE</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>#{invoiceDetail.invoice_number}</div>
            <span style={{
              display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 12,
              fontSize: 11, fontWeight: 600, color: badge.color, background: badge.bg,
            }}>
              {badge.label}
            </span>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />

        {/* Billed To + Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
              Billed To
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {invoiceDetail.workspace_name || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
              Invoice Details
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              Date: {formatDate(invoiceDetail.created_at)}
            </div>
            {invoiceDetail.paid_at && (
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                Paid: {formatDate(invoiceDetail.paid_at)}
              </div>
            )}
            {invoiceDetail.period_start && invoiceDetail.period_end && (
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                Period: {formatDate(invoiceDetail.period_start)} — {formatDate(invoiceDetail.period_end)}
              </div>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
            <span>
              {invoiceDetail.plan_name || 'Subscription'}
              {invoiceDetail.hours_limit ? ` — ${invoiceDetail.hours_limit} hours/month` : ''}
            </span>
            <span>{formatCents(invoiceDetail.amount_cents)}</span>
          </div>

          {invoiceDetail.tax_cents > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
              <span>Tax</span>
              <span>{formatCents(invoiceDetail.tax_cents)}</span>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              <span>Total</span>
              <span>{formatCents(invoiceDetail.total_cents)} {invoiceDetail.currency?.toUpperCase() || 'USD'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
          This is a computer-generated invoice and does not require a signature.<br />
          Thank you for your business!
        </div>
      </div>
    </div>
  );
}
