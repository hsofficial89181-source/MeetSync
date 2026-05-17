import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 8
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--accent)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={16} color="white" fill="white" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px' }}>MeetSync AI</div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '40px 24px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: 'var(--text2)', marginBottom: 32 }}>Last updated: May 2026</p>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>1. Introduction</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            Welcome to MeetSync AI. We respect your privacy and are committed to protecting your personal data.
            This privacy policy will inform you as to how we look after your personal data when you visit our
            website and tell you about your privacy rights and how the law protects you.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>2. The Data We Collect</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
          </p>
          <ul style={{ paddingLeft: 24, lineHeight: 1.6, color: 'var(--text2)' }}>
            <li style={{ marginBottom: 8 }}><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
            <li style={{ marginBottom: 8 }}><strong>Contact Data</strong> includes email address and telephone numbers.</li>
            <li style={{ marginBottom: 8 }}><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version.</li>
            <li style={{ marginBottom: 8 }}><strong>Usage Data</strong> includes information about how you use our website, products and services.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>3. How We Use Your Data</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
          </p>
          <ul style={{ paddingLeft: 24, lineHeight: 1.6, color: 'var(--text2)' }}>
            <li style={{ marginBottom: 8 }}>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
            <li style={{ marginBottom: 8 }}>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
            <li style={{ marginBottom: 8 }}>Where we need to comply with a legal obligation.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>4. Data Security</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>5. Contact Us</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            If you have any questions about this privacy policy or our privacy practices, please contact us at support@meetsync.ai.
          </p>
        </section>
      </main>
      
      {/* Footer */}
      <footer style={{ padding: '24px', textAlign: 'center', borderTop: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 13 }}>
        &copy; {new Date().getFullYear()} MeetSync AI. All rights reserved.
      </footer>
    </div>
  );
}
