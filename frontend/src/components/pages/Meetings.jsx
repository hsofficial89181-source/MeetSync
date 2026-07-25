import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { Upload, Mic, ChevronRight, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, StopCircle, Trash2, AlertCircle, CreditCard, FileAudio, Video, AlertTriangle } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { useStore } from '../../store';
import { useSubscriptionStore } from '../../store/subscription';
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
  const { usage, fetchUsage } = useSubscriptionStore();
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState(null);
  const [quotaError,     setQuotaError]     = useState(null);
  const [retrying,       setRetrying]       = useState(null);
  const [stoppingId,     setStoppingId]     = useState(null);
  const [deletingId,     setDeletingId]     = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile,  setUploadingFile]  = useState(null);
  const [uploadStage,    setUploadStage]    = useState('uploading');
  const [validationError, setValidationError] = useState(null);
  const uploadXhrRef     = React.useRef(null);

  const MAX_FILE_SIZE = 300 * 1024 * 1024;
  const MAX_DURATION_SECONDS = 2 * 60 * 60;

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const hasActiveSub = usage?.has_subscription && ['active', 'trial'].includes(usage?.status);
  const remainingMinutes = usage?.remaining_seconds ? Math.floor(usage.remaining_seconds / 60) : 0;

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles[0]) return;
    const file = acceptedFiles[0];

    // 1. File size pre-check
    if (file.size > MAX_FILE_SIZE) {
      setValidationError({
        fileName: file.name,
        fileSize: formatBytes(file.size),
        message: `This file is ${formatBytes(file.size)}, which exceeds the maximum allowed size of 300 MB.`,
      });
      return;
    }

    // 2. Duration pre-check
    let durationSec = 0;
    try {
      durationSec = await getFileDuration(file);
      if (durationSec > MAX_DURATION_SECONDS) {
        const hrs = Math.floor(durationSec / 3600);
        const mins = Math.ceil((durationSec % 3600) / 60);
        setValidationError({
          fileName: file.name,
          fileSize: formatBytes(file.size),
          message: `This file is ${hrs}h ${mins}m long, which exceeds the maximum allowed duration of 2 hours.`,
        });
        return;
      }
    } catch {
      // Can't read duration — let backend handle it
    }

    // 3. Quota pre-check
    if (hasActiveSub && durationSec > 0 && durationSec > usage.remaining_seconds) {
      const fileMin = Math.ceil(durationSec / 60);
      setQuotaError({
        fileMinutes: fileMin,
        remainingMinutes,
        message: `This file is ~${fileMin} minutes but you have ${remainingMinutes} minutes remaining.`,
      });
      return;
    }

    // 4. Upload with XHR for progress tracking
    setUploading(true);
    setUploadError(null);
    setQuotaError(null);
    setUploadProgress(0);
    setUploadStage('uploading');
    setUploadingFile({ name: file.name, size: file.size, isVideo: file.type.startsWith('video/') });

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('title', file.name.replace(/\.[^.]+$/, ''));

    return new Promise(() => {
      const xhr = new XMLHttpRequest();
      uploadXhrRef.current = xhr;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(pct);
        }
      };

      xhr.onload = () => {
        uploadXhrRef.current = null;
        if (xhr.status === 202) {
          setUploadProgress(100);
          setUploadStage('done');
          try {
            const data = JSON.parse(xhr.responseText);
            addMeeting({ ...data, id: data.meetingId, task_count: 0, decision_count: 0 });
            setTimeout(() => {
              setUploading(false);
              setUploadingFile(null);
              setUploadProgress(0);
              setUploadStage('uploading');
              navigate(`/meetings/${data.meetingId}`);
            }, 600);
          } catch {
            setUploading(false);
            setUploadingFile(null);
          }
        } else {
          let errMsg = 'Upload failed';
          try {
            const data = JSON.parse(xhr.responseText);
            errMsg = data.error || errMsg;
          } catch {}
          if (xhr.status === 402 || errMsg.includes('quota') || errMsg.includes('subscription')) {
            setQuotaError({ message: errMsg });
          } else {
            setUploadError(errMsg);
          }
          setUploadStage('error');
        }
      };

      xhr.onerror = () => {
        uploadXhrRef.current = null;
        setUploadStage('error');
        setUploadError('Network error during upload. Please check your connection and try again.');
      };

      xhr.onabort = () => {
        uploadXhrRef.current = null;
        setUploading(false);
        setUploadingFile(null);
        setUploadProgress(0);
        setUploadStage('uploading');
      };

      const token = localStorage.getItem('accessToken');
      xhr.open('POST', '/api/meetings');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  }, [hasActiveSub, usage, remainingMinutes]);

  const onDropRejected = useCallback((rejections) => {
    const r = rejections[0];
    if (!r) return;
    const file = r.file;
    const sizeErr = r.errors.find(e => e.code === 'file-too-large');
    if (sizeErr) {
      setValidationError({
        fileName: file.name,
        fileSize: formatBytes(file.size),
        message: `This file is ${formatBytes(file.size)}, which exceeds the maximum allowed size of 300 MB.`,
      });
    } else {
      const msg = r.errors.map(e => e.message).join(', ');
      setValidationError({
        fileName: file.name,
        fileSize: formatBytes(file.size),
        message: msg || 'This file could not be uploaded.',
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
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

        {/* Drop zone — or upload gate if no subscription */}
        {!hasActiveSub ? (
          <div style={{
            border: '2px dashed var(--border2)', borderRadius: 12, padding: 32, textAlign: 'center',
            background: 'var(--surface)', marginBottom: 24,
          }}>
            <CreditCard size={32} style={{ margin: '0 auto 10px', display: 'block', color: 'var(--text3)' }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
              Choose a plan to start uploading
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
              You need an active subscription to upload meeting recordings.
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/billing')}>
              View Plans
            </button>
          </div>
        ) : (
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
                  Supports .mp4, .mp3, .m4a, .wav, .webm · Max 300 MB · Up to 2 hours
                </div>
                {usage && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                    {remainingMinutes} minutes remaining this period
                  </div>
                )}
              </>
            )}
          </div>
        )}

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

        {/* Quota error */}
        {quotaError && (
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 8, padding: '12px 14px', marginBottom: 16,
            fontSize: 13, color: 'var(--amber)', display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Insufficient Quota</div>
              <div style={{ fontSize: 12 }}>{quotaError.message}</div>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: 8, fontSize: 12 }}
                onClick={() => navigate('/billing')}
              >
                <CreditCard size={12} /> Upgrade Plan
              </button>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 4px' }}
              onClick={() => setQuotaError(null)}
            >
              <XCircle size={14} />
            </button>
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

      {/* Validation Error Modal */}
      {validationError && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '12px',
                background: 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <AlertTriangle size={24} style={{ color: 'var(--amber)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {validationError.fileName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {validationError.fileSize}
                </div>
              </div>
            </div>
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '20px',
              fontSize: 13,
              color: 'var(--amber)',
              lineHeight: 1.5,
            }}>
              {validationError.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={() => setValidationError(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Modal */}
      {uploading && uploadingFile && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {/* File info header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '12px',
                background: uploadStage === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(91,106,240,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {uploadStage === 'error' ? (
                  <XCircle size={24} style={{ color: 'var(--red)' }} />
                ) : uploadStage === 'done' ? (
                  <CheckCircle2 size={24} style={{ color: 'var(--green)' }} />
                ) : uploadingFile.isVideo ? (
                  <Video size={22} style={{ color: 'var(--accent2)' }} />
                ) : (
                  <FileAudio size={22} style={{ color: 'var(--accent2)' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {uploadingFile.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {formatBytes(uploadingFile.size)}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {uploadStage !== 'error' && (
              <>
                <div style={{
                  height: '8px',
                  background: 'var(--surface3)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '12px',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${uploadProgress}%`,
                    background: uploadStage === 'done'
                      ? 'var(--green)'
                      : 'linear-gradient(90deg, var(--accent), var(--accent2))',
                    borderRadius: '4px',
                    transition: 'width 0.2s ease',
                  }} />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {uploadStage === 'done' ? 'Upload complete!' : 'Uploading...'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent2)' }}>
                    {uploadProgress}%
                  </span>
                </div>
              </>
            )}

            {/* Error message */}
            {uploadStage === 'error' && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '20px',
                fontSize: 13,
                color: 'var(--red)',
                lineHeight: 1.5,
              }}>
                {uploadError || 'Upload failed. Please try again.'}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {uploadStage === 'error' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setUploading(false);
                    setUploadingFile(null);
                    setUploadProgress(0);
                    setUploadStage('uploading');
                    setUploadError(null);
                  }}
                >
                  Close
                </button>
              )}
              {uploadStage === 'uploading' && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    if (uploadXhrRef.current) {
                      uploadXhrRef.current.abort();
                    }
                  }}
                >
                  Cancel
                </button>
              )}
              {uploadStage === 'done' && (
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Redirecting...</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getFileDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const el = document.createElement(isVideo ? 'video' : 'audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(el.duration || 0);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read file metadata'));
    };
    el.src = url;
  });
}
