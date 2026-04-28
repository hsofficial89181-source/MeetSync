import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

const FIELDS = [
  { key: 'workspaceName', label: 'Workspace name', placeholder: 'Acme Corp',      type: 'text' },
  { key: 'name',          label: 'Your full name',  placeholder: 'Ali Khan',        type: 'text' },
  { key: 'email',         label: 'Work email',      placeholder: 'ali@acme.com',    type: 'email' },
  { key: 'password',      label: 'Password',        placeholder: '8+ characters',   type: 'password' },
];

export default function Register() {
  const navigate         = useNavigate();
  const { register }     = useAuthStore();
  const [form, setForm]  = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.workspaceName);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--accent)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <Zap size={24} color="white" fill="white" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            Create your workspace
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            MeetSync AI — free to start
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 28,
        }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              fontSize: 13, color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {FIELDS.map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  {f.label}
                </label>
                <input
                  className="input"
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required
                />
              </div>
            ))}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', marginTop: 8 }}
              disabled={loading}
            >
              {loading
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</>
                : 'Create workspace →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text2)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
