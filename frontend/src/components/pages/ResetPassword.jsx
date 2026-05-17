import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Zap, Eye, EyeOff, Loader2, CheckCircle, ArrowLeft, Lock } from 'lucide-react';
import api from '../../services/api';

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good', color: '#3b82f6' };
  return { score, label: 'Strong', color: '#10b981' };
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const resetToken = location.state?.resetToken || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (!resetToken) navigate('/forgot-password', { replace: true });
  }, [resetToken, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { resetToken, password });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--accent)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <Zap size={24} color="white" fill="white" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            MeetSync AI
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            Set new password
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 28,
        }}>
          {!done ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(91,106,240,0.1)',
                  border: '2px solid rgba(91,106,240,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <Lock size={20} color="var(--accent)" />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', textAlign: 'center' }}>
                  Create new password
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, lineHeight: 1.6, textAlign: 'center' }}>
                  Choose a strong password for your account.
                </p>
              </div>

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 20,
                  fontSize: 13,
                  color: 'var(--red)',
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                    New password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      type={showPw ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoFocus
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                        display: 'flex', alignItems: 'center', padding: 0,
                      }}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {password && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{
                        height: 4,
                        borderRadius: 4,
                        background: 'var(--border)',
                        overflow: 'hidden',
                        marginBottom: 4,
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(strength.score / 5) * 100}%`,
                          background: strength.color,
                          borderRadius: 4,
                          transition: 'width 0.3s, background 0.3s',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: strength.color, fontWeight: 500 }}>
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                    Confirm new password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      style={{
                        paddingRight: 40,
                        borderColor: confirm && confirm !== password ? 'rgba(239,68,68,0.5)' : undefined,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(s => !s)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                        display: 'flex', alignItems: 'center', padding: 0,
                      }}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirm && confirm !== password && (
                    <p style={{ fontSize: 11, color: 'var(--red)', margin: '4px 0 0' }}>
                      Passwords do not match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
                  disabled={loading}
                >
                  {loading
                    ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Updating…</>
                    : 'Set new password'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '2px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <CheckCircle size={26} color="#10b981" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
                Password updated!
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 24px', lineHeight: 1.6 }}>
                Your password has been changed successfully. Sign in with your new credentials.
              </p>
              <Link
                to="/login"
                className="btn btn-primary"
                style={{ display: 'flex', justifyContent: 'center', padding: '10px 16px', textDecoration: 'none' }}
              >
                Sign in to MeetSync →
              </Link>
            </div>
          )}
        </div>

        {!done && (
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text2)' }}>
            <Link
              to="/login"
              style={{ color: 'var(--accent2)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeft size={13} /> Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
