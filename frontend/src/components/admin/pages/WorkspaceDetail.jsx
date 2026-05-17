import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Shield, Activity, 
  RefreshCw, AlertTriangle, CheckCircle,
  Calendar, Users
} from 'lucide-react';
import adminApi from '../../../services/adminApi';

export default function WorkspaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  

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
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };


  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <RefreshCw size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--text3)', marginBottom: '16px' }} />
        <div style={{ color: 'var(--text2)', fontSize: '13px' }}>Loading workspace details...</div>
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
            {workspace?.name}
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'Space Mono' }}>{workspace?.slug}</div>
        </div>
      </div>

      {/* Workspace Details Cards */}
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--text)',
        marginBottom: '16px',
      }}>
        Workspace Details
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Calendar size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px', fontWeight: 500 }}>
              Created
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 600 }}>
              {formatDate(workspace?.created_at)}
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Users size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px', fontWeight: 500 }}>
              Total Members
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 600 }}>
              {members.length}
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Shield size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px', fontWeight: 500 }}>
              Admins
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 600 }}>
              {members.filter(m => m.role === 'admin').length}
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Activity size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px', fontWeight: 500 }}>
              Active Members
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 600 }}>
              {members.filter(m => m.is_active).length}
            </div>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text)',
          }}>
            Members
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}>
            <thead>
              <tr style={{
                background: 'var(--surface2)',
                borderBottom: '1px solid var(--border)',
              }}>
                <th style={{
                  padding: '16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  User
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Role
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Status
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Last Login
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={{ padding: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}>
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
                      }}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: 'var(--text)',
                        }}>
                          {member.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text3)',
                        }}>
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: member.role === 'admin' ? 'rgba(139, 92, 246, 0.1)' : 'var(--surface2)',
                      color: member.role === 'admin' ? '#8b5cf6' : 'var(--text2)',
                      textTransform: 'capitalize',
                    }}>
                      {member.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: member.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: member.is_active ? '#10b981' : '#ef4444',
                    }}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      fontSize: '14px',
                      color: 'var(--text2)',
                    }}>
                      {formatDate(member.last_login)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {members.length === 0 && (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
            <div style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--text)',
              marginBottom: '8px',
            }}>
              No members found
            </div>
            <div style={{
              fontSize: '14px',
              color: 'var(--text2)',
            }}>
              This workspace has no members
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
