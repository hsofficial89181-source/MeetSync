import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, CreditCard, Eye, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import adminApi from '../../../services/adminApi';

const STATUS_BADGE = {
  active:    { label: 'Active',         color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  trial:     { label: 'Trial',          color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  past_due:  { label: 'Past Due',       color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  canceled:  { label: 'Canceled',       color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  inactive:  { label: 'Inactive',       color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  none:      { label: 'No Subscription',color: '#8B92B3', bg: 'rgba(139,146,179,0.1)' },
};

function getSubStatus(row) {
  if (!row.subscription_id) return 'none';
  if (row.status === 'canceled' || row.canceled_at) return 'canceled';
  if (row.status === 'past_due') return 'past_due';
  if (row.status === 'trial') return 'trial';
  if (row.status === 'active') {
    if (row.current_period_end && new Date(row.current_period_end) < new Date()) return 'canceled';
    return 'active';
  }
  return row.status || 'inactive';
}

function formatCents(cents) {
  if (!cents) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SubscriptionsTab() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data } = await adminApi.get('/subscriptions');
      setSubscriptions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = subscriptions.filter(s =>
    s.workspace_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.workspace_slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.admin?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderPagination = () => {
    if (filtered.length === 0) return null;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filtered.length);
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    for (let i = startPage; i <= endPage; i++) pages.push(i);

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderTop: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text2)' }}>
            Showing {start}–{end} of {filtered.length}
          </span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            style={{
              padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', outline: 'none',
            }}
          >
            {[10, 25, 50].map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn btn-ghost btn-sm"
            style={{ opacity: currentPage === 1 ? 0.4 : 1, padding: '6px 8px' }}
          >
            <ChevronLeft size={14} />
          </button>
          {startPage > 1 && (
            <>
              <button onClick={() => setCurrentPage(1)} className="btn btn-ghost btn-sm" style={{ padding: '6px 10px', fontSize: '13px' }}>1</button>
              {startPage > 2 && <span style={{ color: 'var(--text3)', fontSize: '13px', padding: '0 2px' }}>…</span>}
            </>
          )}
          {pages.map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className="btn btn-ghost btn-sm"
              style={{
                padding: '6px 10px', fontSize: '13px',
                background: p === currentPage ? 'var(--accent)' : 'transparent',
                color: p === currentPage ? 'white' : 'var(--text2)',
                fontWeight: p === currentPage ? 600 : 400,
              }}
            >{p}</button>
          ))}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span style={{ color: 'var(--text3)', fontSize: '13px', padding: '0 2px' }}>…</span>}
              <button onClick={() => setCurrentPage(totalPages)} className="btn btn-ghost btn-sm" style={{ padding: '6px 10px', fontSize: '13px' }}>{totalPages}</button>
            </>
          )}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="btn btn-ghost btn-sm"
            style={{ opacity: currentPage === totalPages ? 0.4 : 1, padding: '6px 8px' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  const stats = {
    active: subscriptions.filter(s => getSubStatus(s) === 'active').length,
    none: subscriptions.filter(s => getSubStatus(s) === 'none').length,
    expired: subscriptions.filter(s => ['canceled', 'past_due', 'inactive'].includes(getSubStatus(s))).length,
    trial: subscriptions.filter(s => getSubStatus(s) === 'trial').length,
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <RefreshCw size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--text3)', marginBottom: '16px' }} />
        <div style={{ color: 'var(--text2)', fontSize: '13px' }}>Loading subscriptions...</div>
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
        <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>Error Loading Subscriptions</div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>{error}</div>
        <button onClick={fetchSubscriptions} className="btn btn-primary" style={{ background: '#ef4444' }}>
          <RefreshCw size={14} /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
            Manage Subscriptions
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text2)' }}>
            View all workspace subscriptions and invoices
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '2px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '260px',
          }}>
            <Search size={14} color="var(--text3)" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: '13px',
                outline: 'none',
                height: '34px',
                width: '100%',
              }}
            />
          </div>
          <button onClick={fetchSubscriptions} className="btn btn-ghost">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {[
          { label: 'Active', value: stats.active, color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
          { label: 'No Subscription', value: stats.none, color: '#8B92B3', bg: 'rgba(139,146,179,0.1)' },
          { label: 'Expired/Canceled', value: stats.expired, color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Trial', value: stats.trial, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
        ].map((card) => (
          <div key={card.label} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: card.color, marginBottom: '4px' }}>
              {card.value}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Subscriptions Table */}
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
                {['Workspace', 'Admin', 'Plan', 'Status', 'Period', 'Price', 'Actions'].map((h, i) => (
                  <th key={h} style={{
                    padding: '16px',
                    textAlign: i >= 3 && i <= 5 ? 'center' : 'left',
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
              {paginated.map((row) => {
                const status = getSubStatus(row);
                const badge = STATUS_BADGE[status] || STATUS_BADGE.inactive;
                return (
                  <tr key={row.workspace_id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                        {row.workspace_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                        {row.workspace_slug}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {row.admin ? (
                        <div>
                          <div style={{ fontSize: '14px', color: 'var(--text)' }}>{row.admin.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{row.admin.email}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: '14px' }}>No admin</span>
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 500 }}>
                        {row.plan_name || '—'}
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
                      <span style={{ fontSize: '13px', color: 'var(--text2)' }}>
                        {row.current_period_start ? `${formatDate(row.current_period_start)} — ${formatDate(row.current_period_end)}` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600 }}>
                        {row.price_cents ? formatCents(row.price_cents) : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button
                        onClick={() => navigate(`/admin/subscriptions/${row.workspace_id}`)}
                        className="btn btn-ghost btn-sm"
                        title="View Details"
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
              No subscriptions found
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text2)' }}>
              {searchQuery ? 'Try adjusting your search query' : 'There are no workspaces in the system yet'}
            </div>
          </div>
        )}

        {renderPagination()}
      </div>
    </div>
  );
}
