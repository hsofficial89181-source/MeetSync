import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, FileText, CheckSquare, Lightbulb, Loader2, ArrowRight } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import api from '../../services/api';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const [query,   setQuery]   = useState(initialQ);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState('all');
  const inputRef = useRef(null);

  const debouncedQ = useDebounce(query, 300);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debouncedQ.length < 2) {
      setResults(null);
      if (debouncedQ.length === 0) setSearchParams({});
      return;
    }
    runSearch(debouncedQ);
    setSearchParams({ q: debouncedQ });
  }, [debouncedQ]);

  async function runSearch(q) {
    setLoading(true);
    try {
      const { data } = await api.get('/search', { params: { q, limit: 30 } });
      setResults(data.results);
    } catch (err) {
      console.error('Search failed:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const meetings  = results?.meetings  || [];
  const tasks     = results?.tasks     || [];
  const decisions = results?.decisions || [];

  const filtered = {
    meetings:  filter === 'all' || filter === 'meetings'  ? meetings  : [],
    tasks:     filter === 'all' || filter === 'tasks'     ? tasks     : [],
    decisions: filter === 'all' || filter === 'decisions' ? decisions : [],
  };
  const total = meetings.length + tasks.length + decisions.length;

  // Navigate to the right page and highlight context
  function handleResultClick(type, item) {
    if (type === 'task' || type === 'decision') {
      navigate(`/meetings/${item.meeting_id}`);
    } else if (type === 'meeting') {
      navigate(`/meetings/${item.id}`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader title="Search" subtitle="Find anything across meetings, tasks, and decisions" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="page-content">

        {/* Input */}
        <div style={{ position: 'relative', marginBottom: 20, maxWidth: 640 }}>
          <SearchIcon size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            ref={inputRef}
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search meetings, tasks, decisions, assignees…"
            style={{ paddingLeft: 44, paddingRight: 44, fontSize: 15, height: 46 }}
          />
          {loading && (
            <Loader2 size={16} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          )}
        </div>

        {/* Filter tabs */}
        {results && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {[
              { key: 'all',       label: `All (${total})` },
              { key: 'tasks',     label: `Tasks (${tasks.length})` },
              { key: 'meetings',  label: `Meetings (${meetings.length})` },
              { key: 'decisions', label: `Decisions (${decisions.length})` },
            ].map(f => (
              <button
                key={f.key}
                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Empty / hint states */}
        {!query && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
            <SearchIcon size={36} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>Type to search your workspace</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Titles, summaries, assignees, transcript quotes</div>
          </div>
        )}

        {query.length > 0 && query.length < 2 && (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Type at least 2 characters…</div>
        )}

        {results && total === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>No results for "{query}"</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Try different keywords or check spelling</div>
          </div>
        )}

        {/* Tasks */}
        {filtered.tasks.length > 0 && (
          <ResultSection title="Tasks" icon={CheckSquare} color="var(--accent2)" count={filtered.tasks.length}>
            {filtered.tasks.map(t => (
              <ResultRow
                key={t.id}
                onClick={() => handleResultClick('task', t)}
                title={t.title}
                meta={[
                  t.assignee_name && `→ ${t.assignee_name}`,
                  t.meeting_title && `from: ${t.meeting_title}`,
                  t.due_date      && `due: ${t.due_date}`,
                ].filter(Boolean).join(' · ')}
                badge={t.status}
                badgeClass={t.status === 'done' ? 'badge-green' : 'badge-blue'}
                priorityColor={
                  t.priority === 'urgent' ? 'var(--red)'  :
                  t.priority === 'high'   ? 'var(--amber)':
                  t.priority === 'medium' ? 'var(--accent2)': 'var(--green)'
                }
                query={query}
              />
            ))}
          </ResultSection>
        )}

        {/* Meetings */}
        {filtered.meetings.length > 0 && (
          <ResultSection title="Meetings" icon={FileText} color="var(--text2)">
            {filtered.meetings.map(m => (
              <ResultRow
                key={m.id}
                onClick={() => handleResultClick('meeting', m)}
                title={m.title}
                meta={m.summary ? m.summary.slice(0, 120) + '…' : new Date(m.created_at).toLocaleDateString()}
                badge={m.status}
                badgeClass="badge-green"
                query={query}
              />
            ))}
          </ResultSection>
        )}

        {/* Decisions */}
        {filtered.decisions.length > 0 && (
          <ResultSection title="Decisions" icon={Lightbulb} color="var(--amber)">
            {filtered.decisions.map((d, i) => (
              <ResultRow
                key={d.id || i}
                onClick={() => handleResultClick('decision', d)}
                title={d.description}
                meta={[
                  d.owner_name   && `Owner: ${d.owner_name}`,
                  d.meeting_title && `from: ${d.meeting_title}`,
                ].filter(Boolean).join(' · ')}
                query={query}
              />
            ))}
          </ResultSection>
        )}
      </div>
    </div>
  );
}

function ResultSection({ title, icon: Icon, color, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)' }}>{title}</span>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function ResultRow({ title, meta, badge, badgeClass, priorityColor, onClick, query }) {
  function highlight(text) {
    if (!query || !text) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'rgba(91,106,240,0.25)', color: 'var(--text)', borderRadius: 2, padding: '0 1px' }}>
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        cursor: 'pointer', transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {priorityColor && (
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: priorityColor, marginTop: 5, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: 'var(--text)' }}>
          {highlight(title)}
        </div>
        {meta && (
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {badge && <span className={`badge ${badgeClass || 'badge-blue'}`} style={{ fontSize: 10 }}>{badge}</span>}
        <ArrowRight size={12} color="var(--text3)" />
      </div>
    </div>
  );
}
