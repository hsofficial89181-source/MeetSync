import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Loader2, Pencil } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import api from '../../services/api';
import { useAuthStore } from '../../store/auth';

const AVATAR_COLORS = [
  { bg: 'rgba(91,106,240,0.2)',  text: 'var(--accent2)' },
  { bg: 'rgba(34,197,94,0.15)',  text: 'var(--green)' },
  { bg: 'rgba(245,158,11,0.15)', text: 'var(--amber)' },
  { bg: 'rgba(236,72,153,0.15)', text: '#EC4899' },
];

const EMPTY_FORM = { role: '', userId: '' };

const INTEGRATION_LABELS = {
  slack:       'Slack',
  notion:      'Notion',
  zoom:        'Zoom',
  google_meet: 'Google Meet',
};

const INTEGRATION_ICONS = {
  slack:       '\uD83D\uDCAc',
  notion:      '\uD83D\uDDDD\uFE0F',
  zoom:        '\uD83D\uDCF9',
  google_meet: '\uD83D\uDCF7',
};

export default function Team() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [members,  setMembers]  = useState([]);
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [deleting, setDeleting] = useState(null);
  const [editing,  setEditing]  = useState(null);
  const [editForm, setEditForm] = useState({ role: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [teamRes, usersRes] = await Promise.all([
        api.get('/team'),
        api.get('/settings/members'),
      ]);
      setMembers(teamRes.data);
      setWorkspaceUsers(usersRes.data);
    } finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!form.userId) return;
    const selectedUser = workspaceUsers.find(u => u.id === form.userId);
    if (!selectedUser) return;
    setSaving(true);
    try {
      await api.post('/team', {
        name: selectedUser.name,
        email: selectedUser.email,
        role: form.role || null,
      });
      setForm(EMPTY_FORM); setAdding(false); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }

  function startEdit(m) {
    setEditing(m.id);
    setEditForm({ role: m.role || '' });
    setAdding(false);
  }

  function cancelEdit() {
    setEditing(null);
    setEditForm({ role: '' });
  }

  async function handleEditSave(id) {
    setEditSaving(true);
    try {
      await api.patch(`/team/${id}`, { role: editForm.role || null });
      cancelEdit(); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setEditSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this team member?')) return;
    setDeleting(id);
    try { await api.delete(`/team/${id}`); setMembers(m => m.filter(t => t.id !== id)); }
    finally { setDeleting(null); }
  }

  const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader
        title="Team"
        subtitle="Members are matched to task assignees extracted from meetings"
        actions={isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => { setAdding(a => !a); setEditing(null); }}>
            <UserPlus size={13} /> Add Member
          </button>
        )}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="page-content">

        {/* Add form */}
        {adding && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>Add Team Member</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Job Title</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. Engineering"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Member *</label>
                <select
                  className="input"
                  value={form.userId}
                  onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Select a workspace member…</option>
                  {workspaceUsers
                    .filter(u => !members.some(m => m.email === u.email))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))
                  }
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving || !form.userId}>
                {saving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save member'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setForm(EMPTY_FORM); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>Edit Job Title</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Job Title</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Engineering"
                value={editForm.role}
                onChange={e => setEditForm(d => ({ ...d, role: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleEditSave(editing)} disabled={editSaving}>
                {editSaving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save changes'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Members list */}
        {loading ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40 }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 13 }}>
            <UserPlus size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div>No team members yet.</div>
            <div style={{ marginTop: 6 }}>Add members so AI can auto-assign extracted tasks.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m, i) => {
              const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <div key={m.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: av.bg, color: av.text,
                    fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                      {m.email}
                      {m.role && <span style={{ color: 'var(--text3)' }}> · {m.role}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {m.integrations && m.integrations.length > 0 ? (
                        m.integrations.map((intg) => (
                          <span key={intg.provider} className="badge badge-blue" style={{ fontSize: 10 }}>
                            {INTEGRATION_ICONS[intg.provider] || '⚙️'} {INTEGRATION_LABELS[intg.provider] || intg.provider}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>No integrations connected</span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--text2)' }}
                        onClick={() => startEdit(m)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)' }}
                        disabled={deleting === m.id}
                        onClick={() => handleDelete(m.id)}
                      >
                        {deleting === m.id
                          ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
