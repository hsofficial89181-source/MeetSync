import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{
          width: 56, height: 56, background: 'var(--accent)', borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Zap size={28} color="white" fill="white" />
        </div>

        <div style={{ fontSize: 64, fontWeight: 700, fontFamily: 'Space Mono', color: 'var(--border2)', lineHeight: 1, marginBottom: 16 }}>
          404
        </div>

        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Page not found
        </div>
        <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 28, maxWidth: 320, margin: '0 auto 28px' }}>
          The page you're looking for doesn't exist or has been moved.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Go back
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
