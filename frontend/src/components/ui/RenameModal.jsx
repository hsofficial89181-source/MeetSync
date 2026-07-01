import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';

export default function RenameModal({ open, currentTitle, onSave, onClose, saving }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTitle(currentTitle || '');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, currentTitle]);

  if (!open) return null;

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }
    onSave(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          padding: 0,
          maxWidth: '360px',
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          border: '1px solid var(--border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            Rename Meeting
          </span>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text3)', padding: 2, display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px' }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, padding: '6px 10px', marginBottom: 10,
              fontSize: 12, color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Meeting title"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 10px', fontSize: 13,
              borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--text)',
              fontFamily: 'DM Sans, sans-serif', outline: 'none',
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '10px 16px', borderTop: '1px solid var(--border)',
        }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
