import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Loader2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import api from '../../services/api';

const AVATAR_COLORS = [
  { bg: 'rgba(91,106,240,0.2)',  text: 'var(--accent2)' },
  { bg: 'rgba(34,197,94,0.15)',  text: 'var(--green)' },
  { bg: 'rgba(245,158,11,0.15)', text: 'var(--amber)' },
  { bg: 'rgba(236,72,153,0.15)', text: '#EC4899' },
];

const FIELDS = [
  { key: 'name',            label: 'Full Name *',       placeholder: 'Sara Malik' },
  { key: 'email',           label: 'Email *',            placeholder: 'sara@company.com' },
  { key: 'role',            label: 'Role',               placeholder: 'Engineering' },
  { key: 'slack_user_id',   label: 'Slack User ID',     placeholder: 'U0123ABC' },
  { key: 'jira_account_id', label: 'Jira Account ID',   placeholder: 'accountId...' },
  { key: 'linear_user_id',  label: 'Linear User ID',    placeholder: 'xxxxxxxx' },
];

const EMPTY_FORM = { name: '', email: '', role: '', slack_user_id: '', jira_account_id: '', linear_user_id: '' };

export default function Team() {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/team'); setMembers(data); }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      await api.post('/team', form);
      setForm(EMPTY_FORM); setAdding(false); await load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
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
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(a => !a)}>
            <UserPlus size={13} /> Add Member
          </button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="page-content">

        {/* Add form */}
        {adding && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>Add Team Member</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    className="input"
                    type={f.key === 'email' ? 'email' : 'text'}
                    placeholder={f.placeholder}
                    value={form[f.key] || ''}
                    onChange={e => setForm(d => ({ ...d, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving || !form.name || !form.email}>
                {saving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save member'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setForm(EMPTY_FORM); }}>
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
                      {m.slack_user_id   && <span className="badge badge-blue" style={{ fontSize: 10 }}>💬 Slack</span>}
                      {m.jira_account_id && <span className="badge badge-blue" style={{ fontSize: 10 }}>🎯 Jira</span>}
                      {m.linear_user_id  && <span className="badge badge-blue" style={{ fontSize: 10 }}>✅ Linear</span>}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--red)', flexShrink: 0 }}
                    disabled={deleting === m.id}
                    onClick={() => handleDelete(m.id)}
                  >
                    {deleting === m.id
                      ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Trash2 size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
