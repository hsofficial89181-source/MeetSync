import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';

export default function TermsConditions() {
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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Terms & Conditions</h1>
        <p style={{ color: 'var(--text2)', marginBottom: 32 }}>Last updated: May 2026</p>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>1. Agreement to Terms</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            By accessing or using MeetSync AI, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you disagree with any part of these terms, you may not access the service.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>2. Use License</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            Permission is granted to temporarily download one copy of the materials (information or software) on MeetSync AI's website for personal, non-commercial transitory viewing only.
          </p>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul style={{ paddingLeft: 24, lineHeight: 1.6, color: 'var(--text2)' }}>
            <li style={{ marginBottom: 8 }}>modify or copy the materials;</li>
            <li style={{ marginBottom: 8 }}>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
            <li style={{ marginBottom: 8 }}>attempt to decompile or reverse engineer any software contained on MeetSync AI's website;</li>
            <li style={{ marginBottom: 8 }}>remove any copyright or other proprietary notations from the materials; or</li>
            <li style={{ marginBottom: 8 }}>transfer the materials to another person or "mirror" the materials on any other server.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>3. Disclaimer</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            The materials on MeetSync AI's website are provided on an 'as is' basis. MeetSync AI makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>4. Limitations</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            In no event shall MeetSync AI or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on MeetSync AI's website, even if MeetSync AI or a MeetSync AI authorized representative has been notified orally or in writing of the possibility of such damage.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>5. Revisions and Errata</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 12 }}>
            The materials appearing on MeetSync AI's website could include technical, typographical, or photographic errors. MeetSync AI does not warrant that any of the materials on its website are accurate, complete or current. MeetSync AI may make changes to the materials contained on its website at any time without notice.
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
