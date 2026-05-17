import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Zap, ArrowLeft, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '../../services/api';

const OTP_LENGTH = 6;
const EXPIRY_SECONDS = 10 * 60;
const RESEND_COOLDOWN = 60;

export default function OtpVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef([]);

  // Redirect if arrived without an email
  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true });
  }, [email, navigate]);

  // OTP expiry countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function handleChange(index, value) {
    // Allow only digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setDigits(next);
    const lastFilled = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastFilled]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setError('Please enter all 6 digits');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp });
      navigate('/forgot-password/reset', { state: { resetToken: data.resetToken }, replace: true });
    } catch (err) {
      setError(err.message || 'Invalid or expired code. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResending(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setTimeLeft(EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  }

  const otp = digits.join('');
  const isExpired = timeLeft <= 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
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
            Enter verification code
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 28,
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(91,106,240,0.1)',
              border: '2px solid rgba(91,106,240,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <ShieldCheck size={22} color="var(--accent)" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
              Verify your email
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
              We sent a 6-digit code to<br />
              <strong style={{ color: 'var(--text)' }}>{email}</strong>
            </p>
          </div>

          {/* Timer */}
          <div style={{
            textAlign: 'center',
            marginBottom: 20,
            fontSize: 13,
            color: isExpired ? 'var(--red)' : timeLeft < 60 ? '#f59e0b' : 'var(--text3)',
            fontWeight: 500,
          }}>
            {isExpired
              ? 'Code expired — please request a new one'
              : `Code expires in ${formatTime(timeLeft)}`}
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
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* OTP input boxes */}
          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 24,
            }}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  disabled={isExpired || loading}
                  autoFocus={i === 0}
                  style={{
                    width: 48,
                    height: 56,
                    textAlign: 'center',
                    fontSize: 24,
                    fontWeight: 700,
                    borderRadius: 10,
                    border: `2px solid ${d ? 'var(--accent)' : error ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    caretColor: 'transparent',
                    cursor: isExpired ? 'not-allowed' : 'text',
                    opacity: isExpired ? 0.5 : 1,
                  }}
                />
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '10px 16px',
                marginBottom: 16,
              }}
              disabled={loading || isExpired || otp.length < OTP_LENGTH}
            >
              {loading
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Verifying…</>
                : 'Verify code'}
            </button>
          </form>

          {/* Resend */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              style={{
                background: 'none',
                border: 'none',
                cursor: resendCooldown > 0 || resending ? 'not-allowed' : 'pointer',
                color: resendCooldown > 0 ? 'var(--text3)' : 'var(--accent2)',
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: 0,
                opacity: resendCooldown > 0 ? 0.6 : 1,
              }}
            >
              {resending
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
                : resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : <><RefreshCw size={13} /> Resend code</>}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text2)' }}>
          <Link
            to="/forgot-password"
            style={{ color: 'var(--accent2)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <ArrowLeft size={13} /> Use a different email
          </Link>
        </p>
      </div>
    </div>
  );
}
