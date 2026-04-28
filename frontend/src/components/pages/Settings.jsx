import React, { useState, useEffect } from 'react';
import { Building2, User, Lock, Users, Check, Loader2, AlertCircle } from 'lucide-react';
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
          {tab === 'workspace' && <WorkspaceTab />}
          {tab === 'profile'   && <ProfileTab />}
          {tab === 'password'  && <PasswordTab />}
          {tab === 'members'   && <MembersTab />}
        </div>
      </div>
    </div>
  );
}

function WorkspaceTab() {
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
      <Field label="Workspace name"><input className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Workspace slug" hint="Used in URLs — cannot be changed">
        <input className="input" value={workspace?.slug || ''} disabled style={{ opacity: 0.5 }} />
      </Field>
      <SaveButton onClick={save} loading={saving} saved={saved} />
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

function MembersTab() {
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [invite,  setInvite]    = useState({ name: '', email: '', role: 'member' });
  const [inviting, setInviting] = useState(false);
  const [result,   setResult]   = useState(null);

  useEffect(() => {
    api.get('/settings/members').then(r => setMembers(r.data)).finally(() => setLoading(false));
  }, []);

  async function handleInvite() {
    setInviting(true);
    try {
      const { data } = await api.post('/settings/members/invite', invite);
      setResult(data); setMembers(m => [...m, data.user]);
      setInvite({ name: '', email: '', role: 'member' }); setShowAdd(false);
    } catch (err) { alert(err.message); }
    finally { setInviting(false); }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <SectionTitle style={{ margin: 0 }}>Workspace members</SectionTitle>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>+ Invite member</button>
      </div>

      {result && (
        <Alert type="success" style={{ marginBottom: 16 }}>
          Invited {result.user.email}. Temp password: <strong style={{ fontFamily: 'Space Mono' }}>{result.tempPassword}</strong>
        </Alert>
      )}

      {showAdd && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Name"><input className="input" placeholder="Sara Malik" value={invite.name} onChange={e => setInvite(i => ({ ...i, name: e.target.value }))} /></Field>
            <Field label="Email"><input className="input" type="email" placeholder="sara@company.com" value={invite.email} onChange={e => setInvite(i => ({ ...i, email: e.target.value }))} /></Field>
          </div>
          <Field label="Role">
            <select className="input" value={invite.role} onChange={e => setInvite(i => ({ ...i, role: e.target.value }))} style={{ cursor: 'pointer' }}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={handleInvite} disabled={inviting}>{inviting ? 'Inviting…' : 'Send invite'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 32 }}>Loading members…</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {members.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'rgba(91,106,240,0.2)', color: 'var(--accent2)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{m.email}</div>
              </div>
              <span className={`badge ${m.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>{m.role}</span>
              {m.last_login && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Last login {new Date(m.last_login).toLocaleDateString()}</span>}
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
