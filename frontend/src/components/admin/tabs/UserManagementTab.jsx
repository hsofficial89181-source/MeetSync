import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, RefreshCw, Users, Layout, Activity, 
  Eye, Edit2, Trash2, AlertTriangle, X 
} from 'lucide-react';
import adminApi from '../../../services/adminApi';

export default function UserManagementTab() {
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data } = await adminApi.get('/workspaces');
      setWorkspaces(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminApi.delete(`/workspaces/${id}`);
      setWorkspaces(workspaces.filter(w => w.id !== id));
      setDeleteConfirm(null);
      showNotification('Workspace deleted successfully', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredWorkspaces = workspaces.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.admin?.email && w.admin.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <RefreshCw size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--text3)', marginBottom: '16px' }} />
        <div style={{ color: 'var(--text2)', fontSize: '13px' }}>Loading workspaces...</div>
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
        <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>Error Loading Workspaces</div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>{error}</div>
        <button
          onClick={fetchWorkspaces}
          className="btn btn-primary"
          style={{ background: '#ef4444' }}
        >
          <RefreshCw size={14} /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          padding: '16px 24px',
          borderRadius: '8px',
          background: notification.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          fontSize: '14px',
          fontWeight: '500',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--text)',
            marginBottom: '4px',
          }}>
            User Management
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--text2)',
          }}>
            Manage workspaces and their members
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '2px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '260px',
        }}>
          <Search size={14} color="var(--text3)" />
          <input
            type="text"
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: '13px',
              outline: 'none',
              height: '34px',
              width: '100%',
            }}
          />
        </div>

        <button
          onClick={fetchWorkspaces}
          className="btn btn-ghost"
        >
          <RefreshCw size={14} /> Refresh
        </button>
        </div>
      </div>

      {/* Stats Cards */}
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
        }}>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: 'var(--primary)',
            marginBottom: '4px',
          }}>
            {workspaces.length}
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--text2)',
          }}>
            Total Workspaces
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#10b981',
            marginBottom: '4px',
          }}>
            {workspaces.reduce((acc, w) => acc + (parseInt(w.member_count) || 0), 0)}
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--text2)',
          }}>
            Total Users
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#8b5cf6',
            marginBottom: '4px',
          }}>
            {workspaces.filter(w => parseInt(w.member_count) > 0).length}
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--text2)',
          }}>
            Active Workspaces
          </div>
        </div>
      </div>

      {/* Workspaces Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <div style={{
          overflowX: 'auto',
        }}>
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
                  Workspace
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
                  Admin
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
                  Members
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
                  Created
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkspaces.map((workspace) => (
                <tr
                  key={workspace.id}
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
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'var(--text)',
                      marginBottom: '4px',
                    }}>
                      {workspace.name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text3)',
                    }}>
                      {workspace.slug}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {workspace.admin ? (
                      <div>
                        <div style={{
                          fontSize: '14px',
                          color: 'var(--text)',
                        }}>
                          {workspace.admin.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text3)',
                        }}>
                          {workspace.admin.email}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text3)', fontSize: '14px' }}>
                        No admin assigned
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px 12px',
                      background: 'var(--surface2)',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: 'var(--text)',
                    }}>
                      {workspace.member_count || 0}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      fontSize: '14px',
                      color: 'var(--text2)',
                    }}>
                      {formatDate(workspace.created_at)}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'center',
                    }}>
                      <button
                        onClick={() => navigate(`/admin/workspaces/${workspace.id}`)}
                        className="btn btn-ghost btn-sm"
                        title="View Details"
                      >
                        <Eye size={13} /> View
                      </button>
                      <button
                        onClick={() => navigate(`/admin/workspaces/${workspace.id}/edit`)}
                        className="btn btn-ghost btn-sm"
                        title="Edit Workspace"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(workspace)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        title="Delete Workspace"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredWorkspaces.length === 0 && (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--text)',
              marginBottom: '8px',
            }}>
              No workspaces found
            </div>
            <div style={{
              fontSize: '14px',
              color: 'var(--text2)',
            }}>
              {searchQuery ? 'Try adjusting your search query' : 'There are no workspaces in the system yet'}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
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
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
          }}>
            <div style={{
              fontSize: '24px',
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              ⚠️
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--text)',
              marginBottom: '12px',
              textAlign: 'center',
            }}>
              Delete Workspace?
            </h3>
            <p style={{
              fontSize: '14px',
              color: 'var(--text2)',
              marginBottom: '24px',
              textAlign: 'center',
              lineHeight: '1.5',
            }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This will permanently delete the workspace and all associated data including meetings, tasks, and user accounts. This action cannot be undone.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
            }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
