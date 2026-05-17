import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success') === 'true';
    const provider = params.get('provider') || '';
    const error = params.get('error') || '';

    const payload = { type: 'OAUTH_COMPLETE', success, provider, error };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
    } else {
      if (success) {
        setStatus('success');
        setMessage(`${provider} connected successfully!`);
        setTimeout(() => navigate('/integrations', { replace: true }), 1500);
      } else {
        setStatus('error');
        setMessage(error || 'OAuth failed. Please try again.');
        setTimeout(() => navigate('/integrations', { replace: true }), 3000);
      }
    }
  }, [navigate]);

  const colors = {
    processing: 'var(--text2)',
    success: 'var(--green)',
    error: 'var(--red)',
  };

  const icons = {
    processing: '⟳',
    success: '✓',
    error: '✕',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg)',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{
        fontSize: 40,
        color: colors[status],
        fontWeight: 700,
      }}>
        {icons[status]}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text2)' }}>
        {message || 'Completing authentication…'}
      </div>
    </div>
  );
}
