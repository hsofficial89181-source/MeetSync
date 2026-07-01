import React, { useState, useEffect } from 'react';
import {
  Loader2, Search, Download, FileText, ChevronLeft, ChevronRight,
  CheckCircle, Clock, AlertCircle, Ban,
} from 'lucide-react';
import { useSubscriptionStore } from '../../../store/subscription';
import InvoiceDetail from './InvoiceDetail';

function formatCents(cents) {
  if (!cents && cents !== 0) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_BADGE = {
  paid:          { label: 'Paid',          color: '#16a34a', bg: 'rgba(22,163,74,0.1)',    icon: CheckCircle },
  open:          { label: 'Open',          color: '#5B6AF0', bg: 'rgba(91,106,240,0.1)',   icon: Clock },
  void:          { label: 'Void',          color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  icon: Ban },
  uncollectible: { label: 'Uncollectible', color: '#dc2626', bg: 'rgba(220,38,38,0.1)',    icon: AlertCircle },
};

export default function InvoicesTab() {
  const { invoices, invoicePagination, loading, fetchInvoices, downloadInvoice } = useSubscriptionStore();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    fetchInvoices({ page, limit: 10, search, status: statusFilter });
  }, [fetchInvoices, page, search, statusFilter]);

  function handleSearch(e) { setSearch(e.target.value); setPage(1); }
  function handleStatusChange(e) { setStatusFilter(e.target.value); setPage(1); }

  async function handleDownload(id) {
    setDownloading(id);
    try { await downloadInvoice(id); }
    catch (err) { console.error('Download failed:', err.message); }
    finally { setDownloading(null); }
  }

  if (selectedInvoice) {
    return <InvoiceDetail invoiceId={selectedInvoice} onBack={() => setSelectedInvoice(null)} />;
  }

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={13} style={{
            position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text3)', pointerEvents: 'none',
          }} />
          <input
            className="input"
            placeholder="Search by invoice number or plan…"
            value={search}
            onChange={handleSearch}
            style={{ paddingLeft: 34, fontSize: 13 }}
          />
        </div>
        <select
          className="input"
          value={statusFilter}
          onChange={handleStatusChange}
          style={{ width: 130, cursor: 'pointer', fontSize: 13 }}
        >
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="open">Open</option>
          <option value="void">Void</option>
        </select>
      </div>

      {/* Content */}
      {loading.invoices && (!invoices || invoices.length === 0) ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: 'var(--text3)' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent2)' }} />
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16,
          padding: 48, textAlign: 'center',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 13, background: 'var(--surface2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <FileText size={22} style={{ color: 'var(--text3)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No invoices yet</p>
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
            Your invoices will appear here automatically after each payment is processed.
          </p>
        </div>
      ) : (
        <>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            overflow: 'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 44px',
              padding: '9px 16px', borderBottom: '1px solid var(--border)',
              fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em',
              background: 'var(--surface2)',
            }}>
              <span>Invoice</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span />
            </div>

            {/* Rows */}
            {invoices.map((inv, i) => {
              const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.open;
              const BadgeIcon = badge.icon;
              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 44px',
                    padding: '13px 16px',
                    borderBottom: i < invoices.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer', transition: 'background 0.12s', alignItems: 'center',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      #{inv.invoice_number}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                      {inv.plan_name || 'Subscription'}
                    </div>
                  </div>

                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {formatDate(inv.created_at)}
                  </span>

                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {formatCents(inv.total_cents)}
                  </span>

                  <span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      color: badge.color, background: badge.bg,
                    }}>
                      <BadgeIcon size={10} />
                      {badge.label}
                    </span>
                  </span>

                  <button
                    onClick={e => { e.stopPropagation(); handleDownload(inv.id); }}
                    disabled={downloading === inv.id}
                    title="Download PDF"
                    style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: 7,
                      cursor: 'pointer', padding: '5px 7px', color: 'var(--text3)', display: 'flex', alignItems: 'center',
                      opacity: downloading === inv.id ? 0.5 : 1,
                    }}
                  >
                    {downloading === inv.id
                      ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Download size={13} style={{ margin: '0 auto'}} />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {invoicePagination && invoicePagination.total_pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {invoicePagination.total} invoice{invoicePagination.total !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setPage(p => p - 1)} disabled={page === 1}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '5px 10px', cursor: 'pointer', color: 'var(--text2)', fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 4, opacity: page === 1 ? 0.4 : 1,
                  }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: 12, color: 'var(--text2)', padding: '0 4px' }}>
                  {page} / {invoicePagination.total_pages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)} disabled={page >= invoicePagination.total_pages}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '5px 10px', cursor: 'pointer', color: 'var(--text2)', fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 4,
                    opacity: page >= invoicePagination.total_pages ? 0.4 : 1,
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
