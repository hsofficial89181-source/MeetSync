import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, RefreshCw, AlertTriangle, 
  CheckCircle, User, Shield, Activity,
  Pencil, Trash2, Eye, EyeOff
} from 'lucide-react';
import adminApi from '../../../services/adminApi';

export default function WorkspaceEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [formData, setFormData] = useState({ name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [editModal, setEditModal] = useState({
    isOpen: false,
    memberId: null,
    name: '',
    email: '',
    password: '',
    isSubmitting: false,
    error: null,
  });

  useEffect(() => {
    fetchWorkspaceDetails();
  }, [id]);

  const fetchWorkspaceDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data } = await adminApi.get(`/workspaces/${id}`);
      setWorkspace(data.workspace);
      setMembers(data.members);
      setFormData({ name: data.workspace.name });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await adminApi.put(`/workspaces/${id}`, { name: formData.name });
      showNotification('Workspace updated successfully', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMemberRole = async (memberId, newRole) => {
    try {
      await adminApi.put(`/users/${memberId}`, { role: newRole });
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      showNotification('Member role updated', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleToggleMemberStatus = async (memberId, currentStatus) => {
    try {
      await adminApi.put(`/users/${memberId}`, { is_active: !currentStatus });
      setMembers(members.map(m => m.id === memberId ? { ...m, is_active: !currentStatus } : m));
      showNotification('Member status updated', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteMember = async (memberId, memberName) => {
    if (!confirm(`Are you sure you want to delete ${memberName}?`)) return;

    try {
      await adminApi.delete(`/users/${memberId}`);
      setMembers(members.filter(m => m.id !== memberId));
      showNotification('Member deleted successfully', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const openEditModal = (member) => {
    setEditModal({
      isOpen: true,
      memberId: member.id,
      name: member.name,
      email: member.email,
      password: '',
      isSubmitting: false,
      error: null,
    });
  };

  const closeEditModal = () => {
    setEditModal(prev => ({ ...prev, isOpen: false, error: null }));
  };

  const handleUpdateMember = async () => {
    const { memberId, name, email, password } = editModal;

    if (!name.trim()) {
      setEditModal(prev => ({ ...prev, error: 'Name is required' }));
      return;
    }
    if (!email.trim()) {
      setEditModal(prev => ({ ...prev, error: 'Email is required' }));
      return;
    }

    const payload = { name, email };
    if (password && password.length > 0) {
      if (password.length < 8) {
        setEditModal(prev => ({ ...prev, error: 'Password must be at least 8 characters' }));
        return;
      }
      payload.password = password;
    }

    setEditModal(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      await adminApi.put(`/users/${memberId}`, payload);
      setMembers(members.map(m => m.id === memberId ? { ...m, name, email } : m));
      closeEditModal();
      showNotification('Member updated successfully', 'success');
    } catch (err) {
      setEditModal(prev => ({ ...prev, error: err.message, isSubmitting: false }));
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <RefreshCw size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--text3)', marginBottom: '16px' }} />
        <div style={{ color: 'var(--text2)', fontSize: '13px' }}>Loading workspace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '12px',
        padding: '32px',
        textAlign: 'center',
        maxWidth: '500px',
        margin: '40px auto',
      }}>
        <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '16px' }} />
        <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>Error Loading Workspace</div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>{error}</div>
        <button
          onClick={() => navigate('/admin/users')}
          className="btn btn-primary"
          style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <ArrowLeft size={14} /> Back to Workspaces
        </button>
      </div>
    );
  }

  return (
    <div>
      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          padding: '12px 20px',
          borderRadius: '10px',
          background: notification.type === 'success' ? 'var(--surface)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${notification.type === 'success' ? 'var(--green)' : 'rgba(239, 68, 68, 0.2)'}`,
          color: notification.type === 'success' ? 'var(--green)' : '#ef4444',
          fontSize: '13px',
          fontWeight: '500',
          zIndex: 1200,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          maxWidth: '400px',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        marginBottom: '32px',
      }}>
        <button
          onClick={() => navigate('/admin/users')}
          className="btn btn-ghost"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h2 style={{
            fontSize: '22px',
            fontWeight: '700',
            color: 'var(--text)',
            letterSpacing: '-0.5px',
          }}>
            Edit Workspace
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{workspace?.name}</div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
      }}>
        {/* Workspace Settings */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '20px',
          }}>
            Workspace Settings
          </h3>

          <form onSubmit={handleSave}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text)',
                marginBottom: '8px',
              }}>
                Workspace Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text2)',
                marginBottom: '8px',
              }}>
                Slug (read-only)
              </label>
              <input
                type="text"
                value={workspace?.slug || ''}
                disabled
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text3)',
                  fontSize: '14px',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary"
              style={{ padding: '10px 20px' }}
            >
              {isSaving ? <><RefreshCw size={14} style={{ animation: 'spin 2s linear infinite' }} /> Saving...</> : <><Save size={14} /> Save Changes</>}
            </button>
          </form>
        </div>

        {/* Member Management */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '20px',
          }}>
            Manage Members ({members.length})
          </h3>

          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
          }}>
            {members.map((member) => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'white',
                  flexShrink: 0,
                }}>
                  {member.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {member.name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {member.email}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flexShrink: 0,
                  alignItems: 'center',
                }}>
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>

                  <button
                    onClick={() => handleToggleMemberStatus(member.id, member.is_active)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: member.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: member.is_active ? '#10b981' : '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {member.is_active ? 'Active' : 'Inactive'}
                  </button>

                  <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 2px' }} />

                  <button
                    onClick={() => openEditModal(member)}
                    className="btn btn-ghost btn-sm"
                    title="Edit Member"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteMember(member.id, member.name)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    title="Delete Member"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Member Modal */}
      {editModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '24px',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Pencil size={24} color="white" />
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--text)',
                marginBottom: '8px',
              }}>
                Edit Member
              </h3>
              <p style={{
                fontSize: '14px',
                color: 'var(--text2)',
              }}>
                Update details for <strong>{editModal.name}</strong>
              </p>
            </div>

            {editModal.error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#ef4444',
                fontSize: '13px',
              }}>
                {editModal.error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--text)',
                marginBottom: '8px',
              }}>
                Name
              </label>
              <input
                type="text"
                value={editModal.name}
                onChange={(e) => setEditModal(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Member name"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--text)',
                marginBottom: '8px',
              }}>
                Email
              </label>
              <input
                type="email"
                value={editModal.email}
                onChange={(e) => setEditModal(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Member email"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--text)',
                marginBottom: '8px',
              }}>
                New Password <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(leave blank to keep current)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={editModal.password}
                  onChange={(e) => setEditModal(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter new password (min 8 characters)"
                  style={{
                    width: '100%',
                    padding: '12px 44px 12px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text3)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
            }}>
              <button
                onClick={closeEditModal}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateMember}
                disabled={editModal.isSubmitting}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: editModal.isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: editModal.isSubmitting ? 0.7 : 1,
                }}
              >
                {editModal.isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
