import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Clock, Target, Users2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import api from '../../services/api';

// Semantic palette — matches both light and dark CSS vars via explicit values
// We can't use var() inside recharts props, so we use theme-neutral values
const C = {
  accent:  '#5B6AF0',
  accent2: '#7B8BFF',
  green:   '#22C55E',
  amber:   '#F59E0B',
  red:     '#EF4444',
  gray:    '#8B92B3',
  grid:    'rgba(128,128,160,0.12)',
  tooltip: { backgroundColor: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 },
};

const STATUS_FILL = { backlog: C.gray, in_progress: C.accent, in_review: C.amber, done: C.green };
const PRIORITY_FILL = { urgent: C.red, high: C.amber, medium: C.accent, low: C.green };

export default function Analytics() {
  const [overview,   setOverview]   = useState(null);
  const [byStatus,   setByStatus]   = useState([]);
  const [byAssignee, setByAssignee] = useState([]);
  const [overTime,   setOverTime]   = useState([]);
  const [trend,      setTrend]      = useState([]);
  const [priority,   setPriority]   = useState([]);
  const [integUsage, setIntegUsage] = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ov, st, as, ot, tr, pr, iu] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/tasks-by-status'),
          api.get('/analytics/tasks-by-assignee'),
          api.get('/analytics/meetings-over-time'),
          api.get('/analytics/completion-trend'),
          api.get('/analytics/priority-breakdown'),
          api.get('/analytics/integration-usage'),
        ]);
        setOverview(ov.data); setByStatus(st.data); setByAssignee(as.data);
        setOverTime(ot.data); setTrend(tr.data);    setPriority(pr.data);
        setIntegUsage(iu.data);
      } catch (err) { console.error('Analytics load failed:', err.message); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
      Loading analytics…
    </div>
  );

  const hoursSaved = Math.floor((overview?.estimated_minutes_saved || 0) / 60);
  const minsSaved  = (overview?.estimated_minutes_saved || 0) % 60;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader title="Analytics" subtitle="Meeting impact and team execution metrics" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="page-content">

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }} className="stats-grid">
          {[
            { label: 'Meetings processed', value: overview?.processed_meetings ?? 0, icon: Target,    color: C.accent2, sub: `${overview?.total_meetings ?? 0} total` },
            { label: 'Completion rate',    value: `${overview?.completion_rate ?? 0}%`, icon: TrendingUp, color: C.green,  sub: `${overview?.done_tasks ?? 0} tasks done` },
            { label: 'Overdue tasks',      value: overview?.overdue_tasks ?? 0,    icon: Clock,      color: (overview?.overdue_tasks ?? 0) > 0 ? C.red : C.green, sub: 'need attention' },
            { label: 'Time saved (est.)',  value: hoursSaved > 0 ? `${hoursSaved}h ${minsSaved}m` : `${minsSaved}m`, icon: Users2, color: C.amber, sub: 'vs manual data entry' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{k.label}</span>
                <k.icon size={14} color={k.color} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'Space Mono', color: k.color, letterSpacing: '-1px' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Row 1: trend + meeting volume */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="charts-grid">
          <ChartCard title="Completion rate trend" sub="Weekly %">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="week" tick={{ fill: C.gray, fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: C.gray, fontSize: 11 }} unit="%" />
                <Tooltip contentStyle={C.tooltip} formatter={v => [`${v}%`, 'Rate']} />
                <Line type="monotone" dataKey="rate" stroke={C.accent} strokeWidth={2} dot={{ fill: C.accent, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Meeting volume" sub="Meetings & tasks per week">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={overTime} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="week" tick={{ fill: C.gray, fontSize: 11 }} />
                <YAxis tick={{ fill: C.gray, fontSize: 11 }} />
                <Tooltip contentStyle={C.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11, color: C.gray }} />
                <Bar dataKey="meetings"      fill={C.accent} radius={[3,3,0,0]} name="Meetings" />
                <Bar dataKey="tasks_created" fill={C.green}  radius={[3,3,0,0]} name="Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Row 2: pie + priority */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="charts-grid">
          <ChartCard title="Tasks by status">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80}
                  label={({ status, count }) => `${status} (${count})`} labelLine={false}>
                  {byStatus.map(e => <Cell key={e.status} fill={STATUS_FILL[e.status] || C.gray} />)}
                </Pie>
                <Tooltip contentStyle={C.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Tasks by priority">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priority} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.gray, fontSize: 11 }} />
                <YAxis type="category" dataKey="priority" tick={{ fill: C.gray, fontSize: 11 }} width={55} />
                <Tooltip contentStyle={C.tooltip} />
                <Bar dataKey="total" radius={[0,3,3,0]} name="Total">
                  {priority.map(e => <Cell key={e.priority} fill={PRIORITY_FILL[e.priority] || C.accent} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Assignee leaderboard */}
        <ChartCard title="Team leaderboard" sub="Tasks assigned, completed, overdue">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Member', 'Total', 'Done', 'Open', 'Overdue', 'Rate'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Member' ? 'left' : 'right', padding: '8px 12px', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byAssignee.map((a, i) => (
                  <tr key={a.email || i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(91,106,240,0.2)', color: 'var(--accent2)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {a.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{a.name}</div>
                          {a.email && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'Space Mono', color: 'var(--text)' }}>{a.total}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: C.green, fontFamily: 'Space Mono' }}>{a.done}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text2)', fontFamily: 'Space Mono' }}>{a.open}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: a.overdue > 0 ? C.red : 'var(--text3)', fontFamily: 'Space Mono' }}>{a.overdue}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <div style={{ width: 60, height: 4, background: 'var(--surface3)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 4, width: `${a.completion_rate || 0}%`,
                            background: a.completion_rate >= 70 ? C.green : a.completion_rate >= 40 ? C.amber : C.red,
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontFamily: 'Space Mono', color: 'var(--text2)', minWidth: 32 }}>{a.completion_rate || 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {byAssignee.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No task data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* Integration usage */}
        {integUsage && integUsage.total > 0 && (
          <div style={{ marginTop: 16 }}>
            <ChartCard title="Integration usage" sub="Tasks synced to external tools">
              <div style={{ display: 'flex', gap: 32, padding: '8px 0', flexWrap: 'wrap' }}>
                {[
                  { label: 'Jira',   count: integUsage.jira,   emoji: '🎯', color: C.accent },
                  { label: 'Notion', count: integUsage.notion, emoji: '📋', color: C.amber },
                  { label: 'Linear', count: integUsage.linear, emoji: '✅', color: C.green },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{item.emoji}</span>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'Space Mono', color: item.color }}>{item.count}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{item.label} issues</div>
                    </div>
                  </div>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    {integUsage.total > 0 && (
                      <>{Math.round(((integUsage.jira + integUsage.notion + integUsage.linear) / integUsage.total) * 100)}% of tasks synced to at least one tool</>
                    )}
                  </div>
                </div>
              </div>
            </ChartCard>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, sub, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
