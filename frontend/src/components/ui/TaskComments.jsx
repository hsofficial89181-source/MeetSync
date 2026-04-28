import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';

export default function TaskComments({ taskId }) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [body,     setBody]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const [posting,  setPosting]  = useState(false);

  useEffect(() => {
    if (!taskId) return;
    api.get(`/tasks/${taskId}/comments`)
      .then(r => setComments(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskId]);

  async function handlePost(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/comments`, { body: body.trim() });
      setComments(c => [...c, data]);
      setBody('');
    } catch (err) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId) {
    await api.delete(`/tasks/${taskId}/comments/${commentId}`);
    setComments(c => c.filter(x => x.id !== commentId));
  }

  const initials = (name) => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <MessageSquare size={14} color="var(--text2)" />
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)' }}>
          Comments {comments.length > 0 && `(${comments.length})`}
        </span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 12 }}>Loading…</div>
      ) : (
        <>
          {comments.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>No comments yet.</div>
          )}

          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'rgba(91,106,240,0.2)', color: 'var(--accent2)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {initials(c.user_name)}
              </div>
              <div style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.user_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(c.created_at).toLocaleString()}</span>
                  {c.user_id === user?.id && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, margin: 0 }}>{c.body}</p>
              </div>
            </div>
          ))}

          {/* Post comment */}
          <form onSubmit={handlePost} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'rgba(91,106,240,0.2)', color: 'var(--accent2)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {initials(user?.name)}
            </div>
            <input
              className="input"
              placeholder="Add a comment…"
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={posting || !body.trim()}
              style={{ flexShrink: 0 }}
            >
              {posting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
