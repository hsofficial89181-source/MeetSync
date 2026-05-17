import React from 'react';
import { BarChart2, TrendingUp } from 'lucide-react';

export default function AnalyticsTab() {
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
        <BarChart2 size={32} />
      </div>
      <h2 style={{
        fontSize: '20px',
        fontWeight: '700',
        color: 'var(--text)',
        marginBottom: '12px',
      }}>
        System Analytics
      </h2>
      <p style={{
        fontSize: '14px',
        color: 'var(--text2)',
        maxWidth: '400px',
        lineHeight: '1.6',
        marginBottom: '24px',
      }}>
        Real-time system-wide analytics, usage metrics, and growth tracking will be available here soon.
      </p>
      <div className="badge badge-blue">
        <TrendingUp size={12} style={{ marginRight: '6px' }} />
        Coming Soon
      </div>
    </div>
  );
}

