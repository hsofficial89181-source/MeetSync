import React, { useState, useEffect } from 'react';
import {
  Settings, Shield, Save, RefreshCw, AlertTriangle,
  CheckCircle, User, Mail, Lock, Eye, EyeOff
} from 'lucide-react';
import adminApi from '../../../services/adminApi';
import { useAdminAuthStore } from '../../../store/adminAuth';

export default function SettingsTab() {
  const { user, updateUser } = useAdminAuthStore();

  const [profile, setProfile] = useState({ name: '', email: '' });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name || '', email: user.email || '' });
    }
  }, [user]);

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setIsSavingProfile(true);
      const payload = {};
      if (profile.name !== user?.name) payload.name = profile.name;
      if (profile.email !== user?.email) payload.email = profile.email;

      if (!Object.keys(payload).length) {
        showNotification('No changes to save', 'success');
        return;
      }

      const { data } = await adminApi.patch('/auth/profile', payload);
      updateUser(data);
      showNotification('Profile updated successfully', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      showNotification('Current password and new password are required', 'error');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      showNotification('New password must be at least 8 characters', 'error');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showNotification('New passwords do not match', 'error');
      return;
    }

    try {
      setIsSavingPassword(true);
      await adminApi.post('/auth/profile/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showNotification('Password updated. Please log in again.', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text)',
    marginBottom: '8px',
  };

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
          animation: 'fadeIn 0.3s ease-out',
        }}>
          {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {notification.message}
        </div>
      )}

      <div className="settings-layout" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
      }}>
        {/* Profile Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <User size={18} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
                Admin Profile
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text3)' }}>
                Update your name and email
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Admin Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                required
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="btn btn-primary"
              style={{ padding: '10px 20px' }}
            >
              {isSavingProfile
                ? <><RefreshCw size={14} style={{ animation: 'spin 2s linear infinite' }} /> Saving...</>
                : <><Save size={14} /> Save Profile</>}
            </button>
          </form>
        </div>

        {/* Password Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Lock size={18} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
                Change Password
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text3)' }}>
                Update your login credentials
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                  style={{ ...inputStyle, padding: '12px 44px 12px 16px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
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
                  }}
                >
                  {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  style={{ ...inputStyle, padding: '12px 44px 12px 16px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
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
                  }}
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  style={{ ...inputStyle, padding: '12px 44px 12px 16px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
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
                  }}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingPassword}
              className="btn btn-primary"
              style={{ padding: '10px 20px' }}
            >
              {isSavingPassword
                ? <><RefreshCw size={14} style={{ animation: 'spin 2s linear infinite' }} /> Updating...</>
                : <><Lock size={14} /> Update Password</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

