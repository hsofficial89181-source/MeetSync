import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, Download, MessageSquare, X } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import TaskComments from '../ui/TaskComments';
import { useStore } from '../../store';
import { useTaskFilters } from '../../hooks/useTaskFilters';
import api from '../../services/api';

const COLUMNS = [
  { key: 'backlog',     label: 'Backlog',     color: 'var(--text2)' },
  { key: 'in_progress', label: 'In Progress',  color: 'var(--accent2)' },
  { key: 'in_review',   label: 'In Review',    color: 'var(--amber)' },
  { key: 'done',        label: 'Done',         color: 'var(--green)' },
];

const PRIORITY_DOT = { urgent: 'var(--red)', high: 'var(--amber)', medium: 'var(--accent2)', low: 'var(--green)' };
const PRIORITY_BADGE = { urgent: 'badge-red', high: 'badge-amber', medium: 'badge-blue', low: 'badge-green' };

export default function TaskBoard() {
  const navigate  = useNavigate();
  const { tasks, tasksLoading, updateTask, fetchTasks } = useStore();
  const { filter, setFilter } = useTaskFilters();
  const [syncing,        setSyncing]        = useState(false);
  const [selectedTask,   setSelectedTask]   = useState(null);
  const [showComments,   setShowComments]   = useState(false);

  const overdueCount = tasks.filter(t =>
    t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  ).length;

  const filteredTasks = filter === 'overdue'
    ? tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
    : tasks;

  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col.key] = filteredTasks.filter(t => t.status === col.key);
    return acc;
  }, {});

  async function syncJira() {
    setSyncing(true);
    try { await api.post('/integrations/jira/test'); } catch {}
    await fetchTasks();
    setSyncing(false);
  }

  async function handleExportCSV() {
    const token = localStorage.getItem('accessToken');
    const res   = await fetch('/api/export/tasks.csv', { headers: { Authorization: `Bearer ${token}` } });
    const blob  = await res.blob();
    const fname = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'tasks.csv';
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click();
  }

  function openComments(task, e) {
    e.stopPropagation();
    setSelectedTask(task);
    setShowComments(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader
        title="Task Board"
        subtitle={`${tasks.length} tasks from ${new Set(tasks.map(t => t.meeting_id)).size} meetings`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExportCSV}>
              <Download size={12} /> Export CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={syncJira} disabled={syncing}>
              <RefreshCw size={12} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
              Sync Jira
            </button>
          </div>
        }
      />

      {/* Filter bar */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--surface)', flexShrink: 0 }}>
        {[
          { key: 'all',    label: `All (${tasks.length})` },
          { key: 'overdue',label: `Overdue (${overdueCount})`, warn: overdueCount > 0 },
        ].map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f.key)}
            style={f.warn && filter !== f.key ? { borderColor: 'rgba(239,68,68,0.4)', color: 'var(--red)' } : {}}
          >
            {f.warn && <AlertTriangle size={11} />}
            {f.label}
          </button>
        ))}
      </div>

      {/* Kanban */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,280px)', gap: 14, minWidth: 'max-content', height: '100%' }} className="kanban-board">
          {COLUMNS.map(col => (
            <div key={col.key} className="kanban-col" style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: col.color }}>
                  {col.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface3)', padding: '1px 7px', borderRadius: 8 }}>
                  {byStatus[col.key].length}
                </span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {byStatus[col.key].map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={(id, status) => updateTask(id, { status })}
                    onComments={(e) => openComments(task, e)}
                  />
                ))}
                {byStatus[col.key].length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>
                    No tasks
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comments slide-over panel */}
      {showComments && selectedTask && (
        <>
          <div
            onClick={() => setShowComments(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }}
          />
          <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
            background: 'var(--surface)', borderLeft: '1px solid var(--border)',
            zIndex: 200, display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.2)',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--text)' }}>{selectedTask.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                  {selectedTask.meeting_title} · {selectedTask.status}
                </div>
              </div>
              <button onClick={() => setShowComments(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <TaskComments taskId={selectedTask.id} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TaskCard({ task: t, onStatusChange, onComments }) {
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';

  return (
    <div
      className="task-card"
      style={{ opacity: t.status === 'done' ? 0.55 : 1 }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.5, marginBottom: 8, color: 'var(--text)' }}>
        {t.title}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
        {t.assignee_name && (
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: 'rgba(91,106,240,0.2)', color: 'var(--accent2)',
            fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {t.assignee_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className={`badge ${PRIORITY_BADGE[t.priority] || 'badge-blue'}`} style={{ fontSize: 10, padding: '1px 5px' }}>
          {t.priority}
        </span>
        {t.labels?.slice(0, 1).map(l => (
          <span key={l} className="badge badge-gray" style={{ fontSize: 10, padding: '1px 5px' }}>{l}</span>
        ))}
      </div>

      <div style={{ fontSize: 10, color: isOverdue ? 'var(--red)' : 'var(--text3)', fontFamily: 'Space Mono', marginBottom: 8 }}>
        {isOverdue ? `⚠ Due ${t.due_date}` : t.due_date ? `Due ${t.due_date}` : ''}
        {t.meeting_title && (
          <span style={{ color: 'var(--text3)' }}>{t.due_date ? ' · ' : ''}↑ {t.meeting_title.slice(0, 25)}{t.meeting_title.length > 25 ? '…' : ''}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select
          value={t.status}
          onChange={e => { e.stopPropagation(); onStatusChange(t.id, e.target.value); }}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, background: 'var(--surface3)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '4px 6px', fontSize: 11, color: 'var(--text2)',
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <option value="backlog">Backlog</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="done">Done</option>
        </select>
        <button
          onClick={onComments}
          title="Comments"
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent2)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
        >
          <MessageSquare size={12} />
        </button>
      </div>
    </div>
  );
}
