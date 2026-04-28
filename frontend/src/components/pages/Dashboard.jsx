import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, TrendingUp, CheckCircle2, Zap, Clock, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import PageHeader from '../ui/PageHeader';
import { useStore } from '../../store';
import api from '../../services/api';

const STATUS_COLOR = {
  done:         'var(--green)',
  in_progress:  'var(--amber)',
  transcribing: 'var(--accent2)',
  extracting:   'var(--accent2)',
  pending:      'var(--text3)',
  error:        'var(--red)',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { meetings, tasks, stats, integrations, fetchStats, meetingsLoading, fetchMeetings } = useStore();

  useEffect(() => { fetchStats(); }, []);

  const connectedCount = integrations.filter(i => i.enabled).length;
  const overdueTasks   = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done');
  const recentMeetings = meetings.slice(0, 5);

  // Retry a failed meeting
  async function retryMeeting(meetingId, e) {
    e.stopPropagation();
    try {
      await api.post(`/meetings/${meetingId}/retry`);
      fetchMeetings();
    } catch (err) {
      alert('Retry failed: ' + err.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader
        title="Dashboard"
        subtitle={`${meetings.length} meetings · ${tasks.length} tasks tracked`}
        actions={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/meetings')}>
              + Upload Meeting
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/tasks')}>
              <Zap size={13} /> Task Board
            </button>
          </>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="page-content">

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }} className="stats-grid">
          <StatCard label="Meetings Processed" value={meetings.length} sub={`${meetings.filter(m=>m.status==='done').length} done`}  color="var(--accent2)" loading={meetingsLoading} />
          <StatCard label="Tasks Created"       value={tasks.length}   sub={`${tasks.filter(t=>t.status!=='done').length} open`}       color="var(--green)"  loading={meetingsLoading} />
          <StatCard label="Completion Rate"     value={stats ? `${stats.completion_rate || 0}%` : '—'} sub={`${stats?.done||0} done`} color="var(--amber)"  loading={!stats} down={(stats?.completion_rate||0) < 60} />
          <StatCard label="Integrations Active" value={connectedCount} sub="Slack · Notion · Jira"                                    color="var(--red)"    loading={false} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="two-col">

          {/* Recent meetings */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)' }}>Recent Meetings</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/meetings')}>View all</button>
            </div>

            {meetingsLoading ? (
              <SkeletonList rows={3} />
            ) : recentMeetings.length === 0 ? (
              <EmptyMeetings onUpload={() => navigate('/meetings')} />
            ) : recentMeetings.map(m => (
              <div
                key={m.id}
                onClick={() => navigate(`/meetings/${m.id}`)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                  background: STATUS_COLOR[m.status] || 'var(--text3)',
                  animation: ['transcribing','extracting'].includes(m.status) ? 'pulse-dot 1.5s infinite' : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    {m.task_count > 0 && <span style={{ color: 'var(--accent2)' }}> · ⚡ {m.task_count} tasks</span>}
                    {m.decision_count > 0 && ` · ✅ ${m.decision_count} decisions`}
                  </div>
                  {m.task_count > 0 && (
                    <div style={{ height: 3, background: 'var(--surface3)', borderRadius: 4, marginTop: 5 }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: m.status === 'done' ? 'var(--green)' : 'var(--accent)',
                        width: m.status === 'done' ? '100%' : '40%',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`badge ${m.status === 'done' ? 'badge-green' : m.status === 'error' ? 'badge-red' : 'badge-blue'}`}>
                    {m.status}
                  </span>
                  {m.status === 'error' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={e => retryMeeting(m.id, e)}
                      title="Retry processing"
                    >
                      <RefreshCw size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Overdue tasks */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)' }}>Overdue Tasks</span>
              {overdueTasks.length > 0 && <span className="badge badge-red">{overdueTasks.length} overdue</span>}
            </div>

            {overdueTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)' }}>
                <CheckCircle2 size={28} style={{ margin: '0 auto 10px', display: 'block', color: 'var(--green)' }} />
                <div style={{ fontSize: 13 }}>All tasks are on track</div>
              </div>
            ) : overdueTasks.slice(0, 5).map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <AlertCircle size={14} style={{ color: 'var(--red)', marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                    {t.assignee_name && <span style={{ color: 'var(--accent2)' }}>{t.assignee_name}</span>}
                    {t.meeting_title && ` · from ${t.meeting_title}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>
                    Due {t.due_date} — {formatDistanceToNow(new Date(t.due_date), { addSuffix: true })}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>View</button>
              </div>
            ))}

            {overdueTasks.length > 5 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 12, cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
                +{overdueTasks.length - 5} more overdue →
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, loading, down }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{label}</div>
      {loading ? (
        <div style={{ height: 32, background: 'var(--surface2)', borderRadius: 6, animation: 'pulse-dot 1.5s infinite' }} />
      ) : (
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-1px', fontFamily: 'Space Mono', color }}>{value}</div>
      )}
      <div style={{ fontSize: 11, color: down ? 'var(--red)' : 'var(--green)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function SkeletonList({ rows }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--surface3)', marginTop: 4, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 13, background: 'var(--surface2)', borderRadius: 4, width: `${60 + i * 15}%`, marginBottom: 6, animation: 'pulse-dot 1.5s infinite' }} />
            <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 4, width: '40%', animation: 'pulse-dot 1.5s infinite' }} />
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyMeetings({ onUpload }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🎙️</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>No meetings yet</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Upload a recording to extract tasks automatically</div>
      <button className="btn btn-primary btn-sm" onClick={onUpload}>
        + Upload your first meeting
      </button>
    </div>
  );
}
