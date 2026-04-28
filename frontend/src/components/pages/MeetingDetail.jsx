import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Loader2, Share2, Download, Copy, Check, ExternalLink, StopCircle, Trash2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useStore } from '../../store';
import { useMeetingSocket } from '../../hooks/useMeetingSocket';
import api from '../../services/api';

// Fixed values for recharts / inline SVG — these must be hex not CSS vars
const PRIORITY_COLOR = { urgent: '#EF4444', high: '#F59E0B', medium: '#7B8BFF', low: '#22C55E' };
const SPEAKER_BG   = ['rgba(91,106,240,0.2)', 'rgba(34,197,94,0.15)', 'rgba(245,158,11,0.15)', 'rgba(236,72,153,0.15)'];
const SPEAKER_TEXT = ['#7B8BFF', '#22C55E', '#F59E0B', '#EC4899'];
const STEPS        = ['transcribing', 'extracting', 'assigning', 'integrations', 'done'];

function fmt(s) {
  if (!s) return '00:00';
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
}

export default function MeetingDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { processingStates, updateMeeting, removeMeeting } = useStore();

  const [meeting,       setMeeting]       = useState(null);
  const [tasks,         setTasks]         = useState([]);
  const [decisions,     setDecisions]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [shareUrl,      setShareUrl]      = useState('');
  const [copied,        setCopied]        = useState(false);
  const [sharing,       setSharing]       = useState(false);
  const [stopping,      setStopping]      = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Only open WS when meeting is not already terminal
  useMeetingSocket(id, meeting?.status);

  const procState  = processingStates[id];
  const latestStep = procState?.steps?.[procState.steps.length - 1]?.step || meeting?.status;
  const isProcessing = meeting && !['done', 'error', 'cancelled'].includes(meeting.status);
  const stepIdx = STEPS.indexOf(latestStep);

  async function load() {
    setLoading(true);
    try {
      const [m, t, d] = await Promise.all([
        api.get(`/meetings/${id}`),
        api.get(`/meetings/${id}/tasks`),
        api.get(`/meetings/${id}/decisions`),
      ]);
      setMeeting(m.data); setTasks(t.data); setDecisions(d.data);
    } catch { navigate('/meetings'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (procState?.status === 'done') {
      api.get(`/meetings/${id}/tasks`).then(r => setTasks(r.data));
      api.get(`/meetings/${id}/decisions`).then(r => setDecisions(r.data));
      api.get(`/meetings/${id}`).then(r => setMeeting(r.data));
    }
  }, [procState?.status]);

  async function stopMeeting() {
    setStopping(true);
    try {
      await api.post(`/meetings/${id}/cancel`);
      setMeeting(prev => ({ ...prev, status: 'cancelled' }));
      updateMeeting(id, { status: 'cancelled' });
    } catch (err) { alert('Could not stop: ' + err.message); }
    finally { setStopping(false); }
  }

  async function deleteMeeting() {
    setDeleting(true);
    try {
      await api.delete(`/meetings/${id}`);
      removeMeeting(id);
      navigate('/meetings');
    } catch (err) {
      alert('Delete failed: ' + err.message);
      setDeleting(false);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const { data } = await api.post(`/meetings/${id}/share`, { expires_in_days: 30 });
      setShareUrl(data.url);
    } catch (err) { alert(err.message); }
    finally { setSharing(false); }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function handleExport(type) {
    const path  = type === 'csv' ? `/api/export/meeting/${id}.csv` : `/api/export/meeting/${id}/report`;
    const token = localStorage.getItem('accessToken');
    const res   = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    const blob  = await res.blob();
    const fname = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'export';
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click();
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
    </div>
  );
  if (!meeting) return null;

  const transcript = meeting.transcript || [];
  const speakerMap = {};
  let si = 0;
  transcript.forEach(seg => { if (!speakerMap[seg.speaker]) speakerMap[seg.speaker] = si++; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader
        title={meeting.title}
        subtitle={`${new Date(meeting.created_at).toLocaleDateString()} · ${tasks.length} tasks · ${decisions.length} decisions`}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <select
                onChange={e => { if (e.target.value) { handleExport(e.target.value); e.target.value = ''; } }}
                defaultValue=""
                style={{ appearance: 'none', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 28px 5px 10px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}
              >
                <option value="" disabled>⬇ Export</option>
                <option value="csv">Tasks CSV</option>
                <option value="report">Meeting Report (.md)</option>
              </select>
              <Download size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            </div>

            {meeting.status === 'done' && !shareUrl && (
              <button className="btn btn-ghost btn-sm" onClick={handleShare} disabled={sharing}>
                <Share2 size={13} />{sharing ? 'Creating…' : 'Share'}
              </button>
            )}
            {shareUrl && (
              <button className="btn btn-ghost btn-sm" onClick={copyLink}>
                {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy link</>}
              </button>
            )}
            {shareUrl && (
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                <ExternalLink size={13} />
              </a>
            )}

            {(meeting.status === 'error' || meeting.status === 'cancelled') && (
              confirmDelete ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Delete meeting?</span>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6 }}
                    disabled={deleting}
                    onClick={deleteMeeting}
                  >
                    {deleting ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Yes, delete'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </span>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--red)' }}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/meetings')}>
              <ArrowLeft size={13} /> Back
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="page-content">
        {/* Share banner */}
        {shareUrl && (
          <div style={{ background: 'rgba(91,106,240,0.08)', border: '1px solid rgba(91,106,240,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Share2 size={14} style={{ color: 'var(--accent2)' }} />
            <span style={{ fontSize: 13, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareUrl}</span>
            <button className="btn btn-primary btn-sm" onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
        )}

        {/* Pipeline progress */}
        {isProcessing && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>AI Processing…</span>
              <span className="badge badge-amber" style={{ marginLeft: 'auto' }}>{latestStep || 'pending'}</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--amber)', marginLeft: 4 }}
                disabled={stopping}
                onClick={stopMeeting}
                title="Stop processing"
              >
                {stopping
                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  : <><StopCircle size={13} /> Stop</>}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {STEPS.map((step, i) => (
                <div key={step} style={{ flex: 1 }}>
                  <div style={{
                    height: 4, borderRadius: 4, marginBottom: 6,
                    background: i < stepIdx ? 'var(--accent)' : 'var(--surface3)',
                    transition: 'background 0.4s',
                  }} />
                  <div style={{
                    fontSize: 10, textAlign: 'center',
                    color: i < stepIdx ? 'var(--green)' : i === stepIdx - 1 ? 'var(--accent2)' : 'var(--text3)',
                  }}>{step}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }} className="analysis-layout">
          {/* Transcript */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)', marginBottom: 16 }}>
              Transcript
            </div>
            {transcript.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                {isProcessing ? 'Transcript will appear here…' : 'No transcript available.'}
              </div>
            ) : transcript.map((seg, i) => {
              const idx = speakerMap[seg.speaker] || 0;
              const ini = seg.speaker.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: SPEAKER_BG[idx % 4], color: SPEAKER_TEXT[idx % 4], fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {ini}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{seg.speaker}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>{fmt(seg.start)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, paddingLeft: 32 }}>{seg.text}</div>
                </div>
              );
            })}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {meeting.summary && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--accent2)', background: 'rgba(91,106,240,0.1)', border: '1px solid rgba(91,106,240,0.2)', borderRadius: 4, padding: '2px 8px', display: 'inline-block', marginBottom: 10 }}>
                  ✦ AI Summary
                </div>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>{meeting.summary}</p>
              </div>
            )}

            {decisions.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)' }}>Key Decisions</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{decisions.length}</span>
                </div>
                {decisions.map((d, i) => (
                  <div key={d.id || i} style={{ padding: '8px 0', borderBottom: i < decisions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>{d.description}</div>
                    {d.owner_name && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Owner: {d.owner_name}</div>}
                  </div>
                ))}
              </div>
            )}

            {tasks.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text2)' }}>Tasks</span>
                  <span className="badge badge-green">{tasks.length}</span>
                </div>
                {tasks.map((t, i) => (
                  <div key={t.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: PRIORITY_COLOR[t.priority] || '#7B8BFF' }} />
                    <div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>
                        {t.title}
                        {t.assignee_name && <span style={{ color: 'var(--accent2)', marginLeft: 4 }}>→ {t.assignee_name}</span>}
                      </div>
                      {t.due_date && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>Due: {t.due_date}</div>}
                    </div>
                  </div>
                ))}
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => navigate('/tasks')}>
                  <CheckSquare size={13} /> View in Task Board
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
