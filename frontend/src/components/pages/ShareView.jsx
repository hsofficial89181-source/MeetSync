import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckSquare, Lightbulb, Zap, Clock, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const PRIORITY_DOT = { urgent: 'var(--red)', high: 'var(--amber)', medium: 'var(--accent2)', low: 'var(--green)' };
const STATUS_BADGE = { done: 'badge-green', in_progress: 'badge-blue', in_review: 'badge-amber', backlog: 'badge-gray' };

export default function ShareView() {
  const { token }  = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get(`/share/public/${token}`)
      .then(r => setData(r.data))
      .catch(err => setError(err.message || 'This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={28} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <AlertCircle size={40} style={{ color: 'var(--red)', margin: '0 auto 16px', display: 'block' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Link unavailable</div>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>{error}</div>
      </div>
    </div>
  );

  const { meeting, tasks, decisions, view_count } = data;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'DM Sans, sans-serif', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Zap size={14} color="white" fill="white" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>MeetSync AI</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>Shared meeting summary</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          {view_count} view{view_count !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 6 }}>
            {meeting.title}
          </h1>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap' }}>
            <span>{new Date(meeting.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            {meeting.duration_seconds && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} />{Math.round(meeting.duration_seconds / 60)} min
              </span>
            )}
            <span style={{ color: 'var(--green)' }}>✓ {doneCount}/{tasks.length} tasks done</span>
          </div>
        </div>

        {/* Summary */}
        {meeting.summary && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--accent2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>✦ Summary</div>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>{meeting.summary}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: decisions.length > 0 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }} className="two-col">
          {/* Decisions */}
          {decisions.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <Lightbulb size={14} style={{ color: 'var(--amber)' }} />
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)' }}>Decisions ({decisions.length})</span>
              </div>
              {decisions.map((d, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: i < decisions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{d.description}</div>
                  {d.owner_name && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Owner: {d.owner_name}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Progress */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <CheckSquare size={14} style={{ color: 'var(--accent2)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)' }}>Progress</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'Space Mono', color: 'var(--green)', marginBottom: 4 }}>{pct}%</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{doneCount} of {tasks.length} tasks completed</div>
            <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--green)', borderRadius: 4, width: `${pct}%`, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>

        {/* Tasks */}
        {tasks.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)' }}>Action Items ({tasks.length})</span>
            </div>
            {tasks.map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px',
                borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: t.status === 'done' ? 0.55 : 1,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_DOT[t.priority] || 'var(--accent2)', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                    {t.title}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                    {t.assignee_name && <span style={{ fontSize: 11, color: 'var(--accent2)' }}>→ {t.assignee_name}</span>}
                    {t.due_date && (
                      <span style={{ fontSize: 11, color: new Date(t.due_date) < new Date() && t.status !== 'done' ? 'var(--red)' : 'var(--text2)' }}>
                        Due {t.due_date}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`badge ${STATUS_BADGE[t.status] || 'badge-gray'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                  {(t.status || 'backlog').replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'var(--text3)' }}>
          Shared via <span style={{ color: 'var(--accent2)' }}>MeetSync AI</span> — turning meetings into action
        </div>
      </div>
    </div>
  );
}
