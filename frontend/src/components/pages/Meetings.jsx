import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { Upload, Mic, ChevronRight, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, StopCircle, Trash2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useStore } from '../../store';
import api from '../../services/api';

const STATUS_ICON = {
  done:         <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />,
  error:        <XCircle      size={14} style={{ color: 'var(--red)' }} />,
  cancelled:    <StopCircle   size={14} style={{ color: 'var(--text3)' }} />,
  transcribing: <Loader2      size={14} style={{ color: 'var(--accent2)', animation: 'spin 1s linear infinite' }} />,
  extracting:   <Loader2      size={14} style={{ color: 'var(--accent2)', animation: 'spin 1s linear infinite' }} />,
  pending:      <Clock        size={14} style={{ color: 'var(--text2)' }} />,
};

const IN_PROGRESS = new Set(['pending', 'transcribing', 'extracting', 'assigning', 'integrations']);

// Safe date formatter that handles null/undefined/invalid dates
function formatDateSafe(dateValue) {
  if (!dateValue) return 'Just now';
  const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
  if (!isValid(date)) return 'Just now';
  return formatDistanceToNow(date, { addSuffix: true });
}

export default function Meetings() {
  const navigate = useNavigate();
  const { meetings, addMeeting, fetchMeetings, meetingsLoading, updateMeeting, removeMeeting } = useStore();
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState(null);
  const [retrying,       setRetrying]       = useState(null);
  const [stoppingId,     setStoppingId]     = useState(null);
  const [deletingId,     setDeletingId]     = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles[0]) return;
    setUploading(true);
    setUploadError(null);

    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('title', file.name.replace(/\.[^.]+$/, ''));

    try {
      const { data } = await api.post('/meetings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addMeeting({ ...data, id: data.meetingId, task_count: 0, decision_count: 0 });
      navigate(`/meetings/${data.meetingId}`);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.m4a', '.wav', '.ogg', '.webm'], 'video/mp4': ['.mp4'] },
    maxFiles: 1,
    disabled: uploading,
  });

  async function retryMeeting(meetingId, e) {
    e.stopPropagation();
    setRetrying(meetingId);
    try {
      await api.post(`/meetings/${meetingId}/retry`);
      await fetchMeetings();
    } catch (err) {
      alert('Retry failed: ' + err.message);
    } finally {
      setRetrying(null);
    }
  }

  async function stopMeeting(meetingId, e) {
    e.stopPropagation();
    setStoppingId(meetingId);
    try {
      await api.post(`/meetings/${meetingId}/cancel`);
      updateMeeting(meetingId, { status: 'cancelled' });
    } catch (err) {
      alert('Could not stop: ' + err.message);
    } finally {
      setStoppingId(null);
    }
  }

  async function deleteMeeting(meetingId) {
    setDeletingId(meetingId);
    try {
      await api.delete(`/meetings/${meetingId}`);
      removeMeeting(meetingId);
    } catch (err) {
      alert('Delete failed: ' + err.message);
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <PageHeader
        title="Meetings"
        subtitle="Upload a recording to extract tasks and decisions automatically"
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="page-content">

        {/* Drop zone */}
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border2)'}`,
            borderRadius: 12, padding: 32, textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            background: isDragActive ? 'rgba(91,106,240,0.06)' : 'transparent',
            transition: 'border-color 0.2s, background 0.2s',
            marginBottom: 24,
          }}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <Loader2 size={32} style={{ margin: '0 auto 10px', display: 'block', color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Uploading…</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Please wait, this may take a moment</div>
            </>
          ) : (
            <>
              <Upload size={32} style={{ margin: '0 auto 10px', display: 'block', color: isDragActive ? 'var(--accent)' : 'var(--text3)' }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                {isDragActive ? 'Drop your recording here' : 'Drop meeting recording or click to upload'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                Supports .mp4, .mp3, .m4a, .wav, .webm · Max 500 MB · Up to 4 hours
              </div>
            </>
          )}
        </div>

        {/* Upload error */}
        {uploadError && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: 'var(--red)', display: 'flex', gap: 8,
          }}>
            <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {uploadError}
          </div>
        )}

        {/* Meetings list */}
        {meetingsLoading ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40 }}>Loading meetings…</div>
        ) : meetings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
            <Mic size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>No meetings yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Upload a recording above to get started</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meetings.map(m => (
              <div
                key={m.id}
                onClick={() => navigate(`/meetings/${m.id}`)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                  transition: 'border-color 0.15s', display: 'flex', alignItems: 'center', gap: 14,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: 'var(--surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Mic size={16} style={{ color: 'var(--text2)' }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, display: 'flex', gap: 12 }}>
                    <span>{formatDateSafe(m.created_at)}</span>
                    {m.task_count > 0 && <span style={{ color: 'var(--accent2)' }}>⚡ {m.task_count} tasks</span>}
                    {m.decision_count > 0 && <span>✅ {m.decision_count} decisions</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {STATUS_ICON[m.status] || <Clock size={14} style={{ color: 'var(--text2)' }} />}
                  <span className={`badge ${
                    m.status === 'done'      ? 'badge-green' :
                    m.status === 'error'     ? 'badge-red'   :
                    m.status === 'cancelled' ? 'badge-red'   : 'badge-blue'
                  }`}>
                    {m.status}
                  </span>

                  {/* Stop button — in-progress meetings */}
                  {IN_PROGRESS.has(m.status) && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '3px 7px', color: 'var(--amber)' }}
                      disabled={stoppingId === m.id}
                      onClick={e => stopMeeting(m.id, e)}
                      title="Stop processing"
                    >
                      {stoppingId === m.id
                        ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        : <StopCircle size={12} />}
                    </button>
                  )}

                  {/* Retry button — error meetings */}
                  {m.status === 'error' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '3px 7px' }}
                      disabled={retrying === m.id}
                      onClick={e => retryMeeting(m.id, e)}
                      title="Retry processing"
                    >
                      <RefreshCw size={12} style={retrying === m.id ? { animation: 'spin 1s linear infinite' } : {}} />
                    </button>
                  )}

                  {/* Delete button — error or cancelled meetings */}
                  {(m.status === 'error' || m.status === 'cancelled') && (
                    confirmDelete === m.id ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Delete?</span>
                        <button
                          className="btn btn-sm"
                          style={{ padding: '2px 7px', fontSize: 11, background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6 }}
                          disabled={deletingId === m.id}
                          onClick={e => { e.stopPropagation(); setConfirmDelete(null); deleteMeeting(m.id); }}
                        >
                          {deletingId === m.id ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : 'Yes'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 7px', fontSize: 11 }}
                          onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 7px', color: 'var(--red)' }}
                        onClick={e => { e.stopPropagation(); setConfirmDelete(m.id); }}
                        title="Delete meeting"
                      >
                        <Trash2 size={12} />
                      </button>
                    )
                  )}

                  <ChevronRight size={16} style={{ color: 'var(--text3)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
