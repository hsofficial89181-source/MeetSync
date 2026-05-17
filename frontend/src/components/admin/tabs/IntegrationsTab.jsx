import React from 'react';
import { Plug, Zap } from 'lucide-react';

export default function IntegrationsTab() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 20px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        background: 'rgba(91,106,240,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px',
        color: 'var(--accent)',
      }}>
        <Plug size={32} />
      </div>
      <h2 style={{
        fontSize: '20px',
        fontWeight: '700',
        color: 'var(--text)',
        marginBottom: '12px',
      }}>
        Global Integrations
      </h2>
      <p style={{
        fontSize: '14px',
        color: 'var(--text2)',
        maxWidth: '400px',
        lineHeight: '1.6',
        marginBottom: '24px',
      }}>
        Manage system-wide OAuth applications, webhooks, and third-party platform integrations from this panel.
      </p>
      <div className="badge badge-amber">
        <Zap size={12} style={{ marginRight: '6px' }} />
        Beta
      </div>
    </div>
  );
}

