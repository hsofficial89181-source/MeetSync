import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useStore } from '../../store';
import api from '../../services/api';

const BRAND_ICONS = {
  slack: {
    title: 'Slack',
    hex: '#4A154B',
    path: 'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.527 2.527 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.527 2.527 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.527 2.527 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z',
  },
  notion: {
    title: 'Notion',
    hex: '#000000',
    path: 'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337 7.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.227c0-.839.374-1.54 1.447-1.192z',
  },
  google_meet: {
    title: 'Google Meet',
    hex: '#00897B',
    path: 'M5.53 2.13 0 7.75h5.53zm.398 0v5.62h7.608v3.65l5.47-4.45c-.014-1.22.031-2.25-.025-3.46-.148-1.09-1.287-1.47-2.236-1.36zM23.1 4.32c-.802.295-1.358.995-2.047 1.49-2.506 2.05-4.982 4.12-7.468 6.19 3.025 2.59 6.04 5.18 9.065 7.76 1.218.671 1.428-.814 1.328-1.64v-13a.828.828 0 0 0-.877-.825zM.038 8.15v7.7h5.53v-7.7zm13.577 8.1H6.008v5.62c3.864-.006 7.737.011 11.58-.009 1.02-.07 1.618-1.12 1.468-2.07v-2.51l-5.47-4.68v3.65zm-13.577 0c.02 1.44-.041 2.88.033 4.31.162.948 1.158 1.432 2.047 1.31h3.464v-5.62z',
  },
  zoom: {
    title: 'Zoom',
    hex: '#0B5CFF',
    path: 'M5.033 14.649H.743a.74.74 0 0 1-.686-.458.74.74 0 0 1 .16-.808L3.19 10.41H1.06A1.06 1.06 0 0 1 0 9.35h3.957c.301 0 .57.18.686.458a.74.74 0 0 1-.161.808L1.51 13.59h2.464c.585 0 1.06.475 1.06 1.06zM24 11.338c0-1.14-.927-2.066-2.066-2.066-.61 0-1.158.265-1.537.686a2.061 2.061 0 0 0-1.536-.686c-1.14 0-2.066.926-2.066 2.066v3.311a1.06 1.06 0 0 0 1.06-1.06v-2.251a1.004 1.004 0 0 1 2.013 0v2.251c0 .586.474 1.06 1.06 1.06v-3.311a1.004 1.004 0 0 1 2.012 0v2.251c0 .586.475 1.06 1.06 1.06zM16.265 12a2.728 2.728 0 1 1-5.457 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0zm-4.82 0a2.728 2.728 0 1 1-5.458 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0z',
  },
};

function BrandIcon({ provider, size = 28 }) {
  const icon = BRAND_ICONS[provider];
  if (!icon) return null;
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={icon.hex}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={icon.title}
    >
      <path d={icon.path} />
    </svg>
  );
}

const INTEGRATIONS_META = [
  {
    provider: 'slack',
    name: 'Slack',
    description: 'Post meeting summaries and task notifications to channels. DMs assignees automatically.',
  },
  {
    provider: 'notion',
    name: 'Notion',
    description: 'Creates a structured meeting notes page with decisions and tasks for every meeting.',
  },
  {
    provider: 'google_meet',
    name: 'Google Meet',
    description: 'Auto-import Meet recordings from Google Drive via push notifications.',
  },
  {
    provider: 'zoom',
    name: 'Zoom',
    description: 'Auto-import recordings from Zoom the moment a call ends — no manual upload.',
  },
];

export default function Integrations() {
  const { integrations, fetchIntegrations } = useStore();
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [connecting, setConnecting] = useState(null);
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  const integMap = Object.fromEntries(integrations.map(i => [i.provider, i]));

  useEffect(() => {
    const handler = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'OAUTH_COMPLETE') return;

      const { success, provider, error } = event.data;
      setConnecting(null);
      clearInterval(pollRef.current);

      if (success) {
        fetchIntegrations();
      } else {
        alert(`Could not connect ${provider}: ${error}`);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fetchIntegrations]);

  async function handleConnect(provider) {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }

    setConnecting(provider);
    try {
      const { data } = await api.get(`/oauth/${provider}/start`);
      if (!data?.url) throw new Error('No OAuth URL returned');

      const width = 520;
      const height = 640;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        'about:blank',
        `oauth_${provider}`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      if (!popup) {
        alert('Popup was blocked. Please allow popups for this site and try again.');
        setConnecting(null);
        return;
      }

      popup.location.href = data.url;
      popupRef.current = popup;

      pollRef.current = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollRef.current);
          setConnecting(null);
        }
      }, 500);
    } catch (err) {
      alert(`Could not start OAuth: ${err.message}`);
      setConnecting(null);
    }
  }

  async function handleDisconnect(provider) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    await api.delete(`/integrations/${provider}`);
    await fetchIntegrations();
    setTestResults(r => ({ ...r, [provider]: null }));
  }

  async function handleTest(provider) {
    setTesting(provider);
    try {
      const { data } = await api.post(`/integrations/${provider}/test`);
      setTestResults(r => ({ ...r, [provider]: { success: data.success, message: data.message } }));
    } catch (err) {
      setTestResults(r => ({ ...r, [provider]: { success: false, message: err.message } }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader
        title="Integrations"
        subtitle="Connect your tools — MeetSync pushes tasks and summaries automatically after every meeting"
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="integrations-grid">
          {INTEGRATIONS_META.map(meta => {
            const status = integMap[meta.provider];
            const isConn = status?.enabled;
            const testResult = testResults[meta.provider];
            const isConnecting = connecting === meta.provider;

            return (
              <div key={meta.provider} style={{
                background: isConn ? 'color-mix(in srgb, var(--green) 4%, var(--surface))' : 'var(--surface)',
                border: `1px solid ${isConn ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: 20,
                transition: 'border-color 0.2s',
              }}>
                {/* Brand logo */}
                <div style={{ marginBottom: 12 }}>
                  <BrandIcon provider={meta.provider} size={28} />
                </div>

                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>{meta.name}</div>
                <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>{meta.description}</p>

                {/* Connection status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: isConn ? 'var(--green)' : 'var(--border2)' }} />
                  <span style={{ color: isConn ? 'var(--green)' : 'var(--text2)' }}>{isConn ? 'Connected' : 'Not connected'}</span>
                  {status?.last_synced_at && (
                    <span style={{ color: 'var(--text3)', marginLeft: 'auto', fontSize: 10 }}>
                      Last synced {new Date(status.last_synced_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Test result */}
                {testResult && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 12,
                    padding: '8px 10px', borderRadius: 8, fontSize: 12,
                    background: testResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    color: testResult.success ? 'var(--green)' : 'var(--red)',
                    border: `1px solid ${testResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <span style={{ flex: 1, wordBreak: 'break-word' }}>{testResult.message}</span>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {isConn ? (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleTest(meta.provider)} disabled={testing === meta.provider}>
                        {testing === meta.provider
                          ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Testing…</>
                          : 'Test connection'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}
                        onClick={() => handleDisconnect(meta.provider)}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleConnect(meta.provider)}
                      disabled={isConnecting}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {isConnecting
                        ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…</>
                        : `Connect ${meta.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
