import React, { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useStore } from '../../store';
import api from '../../services/api';

const INTEGRATIONS_META = [
  {
    provider: 'slack', name: 'Slack', emoji: '💬',
    description: 'Post meeting summaries and task notifications to channels. DMs assignees automatically.',
    docsUrl: 'https://api.slack.com/apps',
    fields: [
      { key: 'bot_token', label: 'Bot Token',        placeholder: 'xoxb-...',          secret: true },
      { key: 'channel',   label: 'Default Channel',  placeholder: '#meeting-actions' },
    ],
  },
  {
    provider: 'notion', name: 'Notion', emoji: '📋',
    description: 'Creates a structured meeting notes page with decisions and tasks for every meeting.',
    docsUrl: 'https://www.notion.so/my-integrations',
    fields: [
      { key: 'token',       label: 'Integration Token', placeholder: 'secret_...',             secret: true },
      { key: 'database_id', label: 'Database ID',       placeholder: 'xxxxxxxx-xxxx-...' },
    ],
  },
  {
    provider: 'jira', name: 'Jira', emoji: '🎯',
    description: 'Auto-creates Jira issues with assignees, priority, and due dates from every meeting.',
    docsUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    fields: [
      { key: 'base_url',    label: 'Jira URL',    placeholder: 'https://company.atlassian.net' },
      { key: 'email',       label: 'Email',        placeholder: 'you@company.com' },
      { key: 'api_token',   label: 'API Token',    placeholder: 'ATATT...',                    secret: true },
      { key: 'project_key', label: 'Project Key',  placeholder: 'ENG' },
    ],
  },
  {
    provider: 'linear', name: 'Linear', emoji: '✅',
    description: 'Create Linear issues from meeting action items with priority and assignees.',
    docsUrl: 'https://linear.app/settings/api',
    fields: [
      { key: 'api_key', label: 'API Key',  placeholder: 'lin_api_...', secret: true },
      { key: 'team_id', label: 'Team ID',  placeholder: 'xxxxxxxx' },
    ],
  },
  {
    provider: 'teams', name: 'Microsoft Teams', emoji: '💼',
    description: 'Post Adaptive Card summaries with decisions and tasks to a Teams channel.',
    docsUrl: 'https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook',
    fields: [
      { key: 'webhook_url', label: 'Incoming Webhook URL', placeholder: 'https://company.webhook.office.com/...', secret: true },
    ],
  },
  {
    provider: 'github', name: 'GitHub Issues', emoji: '🐙',
    description: 'Create labeled GitHub issues from extracted tasks with priority tags.',
    docsUrl: 'https://github.com/settings/tokens',
    fields: [
      { key: 'token', label: 'Personal Access Token', placeholder: 'ghp_...',           secret: true },
      { key: 'owner', label: 'Owner (user or org)',    placeholder: 'acme-corp' },
      { key: 'repo',  label: 'Repository name',        placeholder: 'backend-api' },
    ],
  },
  {
    provider: 'zapier', name: 'Zapier / Make', emoji: '⚡',
    description: 'Fire a webhook after every meeting to connect MeetSync to 5,000+ apps.',
    docsUrl: 'https://zapier.com/apps/webhook/integrations',
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/...', secret: false },
    ],
  },
  {
    provider: 'zoom', name: 'Zoom', emoji: '📹',
    description: 'Auto-import recordings from Zoom the moment a call ends — no manual upload.',
    docsUrl: 'https://marketplace.zoom.us/',
    fields: [
      { key: 'client_id',             label: 'Client ID',             placeholder: '...' },
      { key: 'client_secret',         label: 'Client Secret',         placeholder: '...', secret: true },
      { key: 'webhook_secret_token',  label: 'Webhook Secret Token',  placeholder: '...', secret: true },
    ],
    webhookNote: `Set your Zoom webhook URL to: ${window.location.origin}/api/webhooks/zoom`,
  },
  {
    provider: 'google_meet', name: 'Google Meet', emoji: '🎥',
    description: 'Auto-import Meet recordings from Google Drive via push notifications.',
    docsUrl: 'https://console.cloud.google.com/',
    fields: [
      { key: 'oauth_token',   label: 'OAuth Access Token',  placeholder: 'ya29...', secret: true },
      { key: 'calendar_id',   label: 'Calendar ID',         placeholder: 'primary' },
    ],
    setupNote: 'After connecting, call POST /api/webhooks/google/setup to register the Drive watch.',
  },
];

export default function Integrations() {
  const { integrations, fetchIntegrations } = useStore();
  const [configuring,  setConfiguring]  = useState(null);
  const [formData,     setFormData]     = useState({});
  const [testing,      setTesting]      = useState(null);
  const [testResults,  setTestResults]  = useState({});
  const [saving,       setSaving]       = useState(null);

  const integMap = Object.fromEntries(integrations.map(i => [i.provider, i]));

  async function handleConnect(provider) {
    setSaving(provider);
    try {
      await api.post(`/integrations/${provider}`, { config: formData });
      await fetchIntegrations();
      setConfiguring(null);
      setFormData({});
    } catch (err) { alert(err.message); }
    finally { setSaving(null); }
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
    } finally { setTesting(null); }
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
            const status    = integMap[meta.provider];
            const isConn    = status?.enabled;
            const testResult= testResults[meta.provider];

            return (
              <div key={meta.provider} style={{
                background: isConn ? 'color-mix(in srgb, var(--green) 4%, var(--surface))' : 'var(--surface)',
                border: `1px solid ${isConn ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                borderRadius: 12, padding: 20,
                transition: 'border-color 0.2s',
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{meta.emoji}</div>
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

                {/* Webhook / setup note */}
                {(meta.webhookNote || meta.setupNote) && isConn && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 6, padding: '6px 10px', marginBottom: 10, lineHeight: 1.5 }}>
                    {meta.webhookNote || meta.setupNote}
                  </div>
                )}

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

                {/* Config form */}
                {configuring === meta.provider && (
                  <div style={{ marginBottom: 12 }}>
                    {meta.fields.map(f => (
                      <div key={f.key} style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                        <input
                          className="input"
                          type={f.secret ? 'password' : 'text'}
                          placeholder={f.placeholder}
                          value={formData[f.key] || ''}
                          onChange={e => setFormData(d => ({ ...d, [f.key]: e.target.value }))}
                        />
                      </div>
                    ))}
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
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => handleDisconnect(meta.provider)}>
                        Disconnect
                      </button>
                    </>
                  ) : configuring === meta.provider ? (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => handleConnect(meta.provider)} disabled={saving === meta.provider}>
                        {saving === meta.provider ? 'Saving…' : 'Save & Connect'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setConfiguring(null); setFormData({}); }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => { setConfiguring(meta.provider); setFormData({}); }}>
                        Connect
                      </button>
                      <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        <ExternalLink size={11} /> Docs
                      </a>
                    </>
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
