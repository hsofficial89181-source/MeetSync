import React, { useState, useEffect } from 'react';
import { Building2, User, Lock, Users, Check, Loader2, AlertCircle, Pencil, Trash2, UserPlus } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';

const TABS = [
  { key: 'workspace', label: 'Workspace', icon: Building2 },
  { key: 'profile',   label: 'Profile',   icon: User },
  { key: 'password',  label: 'Password',  icon: Lock },
  { key: 'members',   label: 'Members',   icon: Users },
];

export default function Settings() {
  const [tab, setTab] = useState('workspace');
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader title="Settings" subtitle="Manage your workspace and account" />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '200px 1fr', overflow: 'hidden' }} className="settings-layout">
        {/* Sidebar tabs */}
        <div style={{ borderRight: '1px solid var(--border)', padding: '16px 12px', background: 'var(--surface)' }} className="settings-tabs">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'rgba(91,106,240,0.1)' : 'transparent',
              color: tab === t.key ? 'var(--accent2)' : 'var(--text2)',
              fontSize: 13, fontFamily: 'DM Sans, sans-serif', marginBottom: 2, textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (tab !== t.key) e.currentTarget.style.background = 'var(--surface2)'; }}
            onMouseLeave={e => { if (tab !== t.key) e.currentTarget.style.background = 'transparent'; }}
            >
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', padding: 28, background: 'var(--bg)' }}>
          {tab === 'workspace' && <WorkspaceTab isAdmin={isAdmin} />}
          {tab === 'profile'   && <ProfileTab />}
          {tab === 'password'  && <PasswordTab />}
          {tab === 'members'   && <MembersTab isAdmin={isAdmin} currentUser={user} />}
        </div>
      </div>
    </div>
  );
}

function WorkspaceTab({ isAdmin }) {
  const { workspace } = useAuthStore();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  useEffect(() => { setName(workspace?.name || ''); }, [workspace]);
  async function save() {
    setSaving(true);
    try { await api.patch('/settings/workspace', { name }); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    finally { setSaving(false); }
  }
  return (
    <div style={{ maxWidth: 480 }}>
      <SectionTitle>Workspace settings</SectionTitle>
      <Field label="Workspace name">
        <input className="input" value={name} onChange={e => setName(e.target.value)} disabled={!isAdmin} style={!isAdmin ? { opacity: 0.5 } : {}} />
      </Field>
      <Field label="Workspace slug" hint="Used in URLs — cannot be changed">
        <input className="input" value={workspace?.slug || ''} disabled style={{ opacity: 0.5 }} />
      </Field>
      {isAdmin && <SaveButton onClick={save} loading={saving} saved={saved} />}
    </div>
  );
}

function ProfileTab() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  useEffect(() => { setName(user?.name || ''); }, [user]);
  async function save() {
    setSaving(true);
    try { const { data } = await api.patch('/settings/profile', { name }); updateUser(data); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    finally { setSaving(false); }
  }
  return (
    <div style={{ maxWidth: 480 }}>
      <SectionTitle>Profile</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(91,106,240,0.2)', color: 'var(--accent2)', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{user?.email} · {user?.role}</div>
        </div>
      </div>
      <Field label="Full name"><input className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Email" hint="Contact your admin to change email">
        <input className="input" value={user?.email || ''} disabled style={{ opacity: 0.5 }} />
      </Field>
      <SaveButton onClick={save} loading={saving} saved={saved} />
    </div>
  );
}

function PasswordTab() {
  const [form, setForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  async function save() {
    setError(''); setSuccess('');
    if (form.newPassword !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.newPassword.length < 8)       { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await api.post('/settings/profile/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess('Password updated. You may need to sign in again on other devices.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  return (
    <div style={{ maxWidth: 480 }}>
      <SectionTitle>Change password</SectionTitle>
      {error   && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}
      {[['currentPassword','Current password'],['newPassword','New password'],['confirm','Confirm new password']].map(([k,l]) => (
        <Field key={k} label={l}>
          <input className="input" type="password" placeholder="••••••••" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
        </Field>
      ))}
      <SaveButton label="Update password" onClick={save} loading={loading} />
    </div>
  );
}

function MembersTab({ isAdmin, currentUser }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'member', password: '' });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'member' });
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/settings/members'); setMembers(data); }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!form.name || !form.email || !form.password) return;
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post('/settings/members', form);
      setMembers(m => [...m, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: '', email: '', role: 'member', password: '' });
      setAdding(false);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }

  function startEdit(m) {
    setEditing(m.id);
    setEditForm({ name: m.name, email: m.email, role: m.role });
    setAdding(false);
    setError('');
  }

  function cancelEdit() {
    setEditing(null);
    setEditForm({ name: '', email: '', role: 'member' });
  }

  async function handleEditSave(id) {
    if (!editForm.name || !editForm.email) return;
    setEditSaving(true);
    try {
      const { data } = await api.patch(`/settings/members/${id}`, editForm);
      setMembers(m => m.map(x => x.id === id ? data : x).sort((a, b) => a.name.localeCompare(b.name)));
      cancelEdit();
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setEditSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this member? They will lose access to the workspace.')) return;
    setDeleting(id);
    setError('');
    try {
      await api.delete(`/settings/members/${id}`);
      setMembers(m => m.filter(x => x.id !== id));
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setDeleting(null); }
  }

  const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <SectionTitle style={{ marginBottom: 0 }}>Workspace Members</SectionTitle>
        {isAdmin && !adding && !editing && (
          <button className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setError(''); }}>
            <UserPlus size={13} /> Add Member
          </button>
        )}
      </div>

      {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

      {/* Add form */}
      {adding && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>Add New Member</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Name *</label>
              <input className="input" type="text" placeholder="Sara Malik" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Email *</label>
              <input className="input" type="email" placeholder="sara@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Role *</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Password *</label>
              <input className="input" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving || !form.name || !form.email || !form.password}>
              {saving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save member'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setForm({ name: '', email: '', role: 'member', password: '' }); setError(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>Edit Member</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Name *</label>
              <input className="input" type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Email *</label>
              <input className="input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Role *</label>
            <select className="input" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} style={{ cursor: 'pointer' }}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => handleEditSave(editing)} disabled={editSaving || !editForm.name || !editForm.email}>
              {editSaving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save changes'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}

      {/* Members list */}
      {loading ? (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : members.length === 0 ? (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 13 }}>
          <Users size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <div>No members yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(m => (
            <div key={m.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(91,106,240,0.15)', color: 'var(--accent2)',
                fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {initials(m.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                  {m.name}
                  {m.id === currentUser?.id && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>(you)</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  {m.email} · <span style={{ textTransform: 'capitalize' }}>{m.role}</span>
                </div>
              </div>
              {isAdmin && m.id !== currentUser?.id && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text2)' }} onClick={() => startEdit(m)}>
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
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, style }) {
  return <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: 'var(--text)', ...style }}>{children}</h2>;
}
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
function SaveButton({ label = 'Save changes', onClick, loading, saved }) {
  return (
    <button className="btn btn-primary" onClick={onClick} disabled={loading} style={{ marginTop: 8 }}>
      {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> :
       saved   ? <><Check size={14} /> Saved!</> : label}
    </button>
  );
}
function Alert({ type, children, style }) {
  const cfg = {
    error:   { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   color: 'var(--red)',   Icon: AlertCircle },
    success: { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)',   color: 'var(--green)', Icon: Check },
  }[type];
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: cfg.color, display: 'flex', gap: 8, alignItems: 'flex-start', ...style }}>
      <cfg.Icon size={14} style={{ flexShrink: 0, marginTop: 1 }} /><span>{children}</span>
    </div>
  );
}
