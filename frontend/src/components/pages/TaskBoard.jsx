import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, Download, MessageSquare, X, Pencil, Loader2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import TaskComments from '../ui/TaskComments';
import { useStore } from '../../store';
import { useTaskFilters } from '../../hooks/useTaskFilters';
import { useAuthStore } from '../../store/auth';
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
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [syncing,        setSyncing]        = useState(false);
  const [selectedTask,   setSelectedTask]   = useState(null);
  const [showComments,   setShowComments]   = useState(false);
  const [teamMembers,    setTeamMembers]    = useState([]);
  const [editingTask,    setEditingTask]    = useState(null);
  const [editForm,       setEditForm]       = useState({ due_date: '', assignee_email: '' });
  const [editSaving,     setEditSaving]     = useState(false);

  useEffect(() => {
    api.get('/team').then(({ data }) => setTeamMembers(data)).catch(() => {});
  }, []);

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

  function openEdit(task, e) {
    e.stopPropagation();
    setEditingTask(task);
    setEditForm({ due_date: task.due_date || '', assignee_email: task.assignee_email || '' });
  }

  function closeEdit() {
    setEditingTask(null);
    setEditForm({ due_date: '', assignee_email: '' });
  }

  async function handleEditSave() {
    if (!editingTask) return;
    setEditSaving(true);
    const member = teamMembers.find(m => m.email === editForm.assignee_email);
    try {
      await updateTask(editingTask.id, {
        due_date: editForm.due_date || null,
        assignee_email: editForm.assignee_email || null,
        assignee_name: member ? member.name : null,
      });
      closeEdit();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setEditSaving(false);
    }
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
                    isAdmin={isAdmin}
                    teamMembers={teamMembers}
                    onStatusChange={(id, status) => updateTask(id, { status })}
                    onComments={(e) => openComments(task, e)}
                    onEdit={(e) => openEdit(task, e)}
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

      {/* Edit modal */}
      {editingTask && (
        <>
          <div
            onClick={closeEdit}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 199 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 400, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, zIndex: 200, boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Edit Task</div>
              <button onClick={closeEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Task</div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{editingTask.title}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Deadline</label>
                <input
                  className="input"
                  type="date"
                  value={editForm.due_date}
                  onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Assignee</label>
                <select
                  className="input"
                  value={editForm.assignee_email}
                  onChange={e => setEditForm(f => ({ ...f, assignee_email: e.target.value }))}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.email}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={closeEdit}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleEditSave} disabled={editSaving}>
                  {editSaving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TaskCard({ task: t, isAdmin, teamMembers, onStatusChange, onComments, onEdit }) {
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
  const assigneeMember = teamMembers.find(m => m.email === t.assignee_email);
  const assigneeTitle = assigneeMember?.role;

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
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: 'rgba(91,106,240,0.12)', color: 'var(--accent2)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {t.assignee_name}
            {assigneeTitle && (
              <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text3)' }}>· {assigneeTitle}</span>
            )}
          </span>
        )}
        <span className={`badge ${PRIORITY_BADGE[t.priority] || 'badge-blue'}`} style={{ fontSize: 10, padding: '1px 5px' }}>
          {t.priority}
        </span>
        {t.labels?.slice(0, 1).map(l => (
          <span key={l} className="badge badge-gray" style={{ fontSize: 10, padding: '1px 5px' }}>{l}</span>
        ))}
      </div>

      <div style={{ fontSize: 10, color: isOverdue ? 'var(--red)' : 'var(--text3)', fontFamily: 'Space Mono', marginBottom: 8 }}>
        {isOverdue ? `\u26A0 Due ${t.due_date}` : t.due_date ? `Due ${t.due_date}` : ''}
        {t.meeting_title && (
          <span style={{ color: 'var(--text3)' }}>{t.due_date ? ' \u00B7 ' : ''}\u2191 {t.meeting_title.slice(0, 25)}{t.meeting_title.length > 25 ? '\u2026' : ''}</span>
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
        {isAdmin && (
          <button
            onClick={onEdit}
            title="Edit task"
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent2)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
          >
            <Pencil size={12} />
          </button>
        )}
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
