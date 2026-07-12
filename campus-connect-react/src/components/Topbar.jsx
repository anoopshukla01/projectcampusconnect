import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { notificationsApi } from '../services/api';

export default function Topbar({ onMenuToggle }) {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();

  /* ── Notifications — live from backend ── */
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [notifs,     setNotifs]     = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Poll unread count every 30 s; full list fetched on first open
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const res = await notificationsApi.unreadCount();
    if (res?.count !== undefined) setUnreadCount(res.count);
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoadingNotifs(true);
    const res = await notificationsApi.list({ per_page: 20 });
    setLoadingNotifs(false);
    if (res?.notifications) {
      setNotifs(res.notifications);
      setUnreadCount(res.unread ?? 0);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  async function toggleNotif() {
    const willOpen = !notifOpen;
    setNotifOpen(willOpen);
    if (willOpen) {
      await fetchNotifications();
      // Mark all read on open (fire-and-forget)
      notificationsApi.markAllRead().then(() => setUnreadCount(0));
    }
  }

  async function clearNotifs() {
    // Best-effort: mark all read and clear locally
    await notificationsApi.markAllRead();
    setNotifs([]);
    setUnreadCount(0);
    showToast('Notifications cleared', 'success');
  }

  async function removeNotif(id, e) {
    e.stopPropagation();
    // Mark single notification as read and remove from list
    await notificationsApi.markRead(id);
    setNotifs(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  /* ── Profile & Settings Modal ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'preferences'
  
  // Profile Form
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [socialVisibility, setSocialVisibility] = useState(true);
  
  // Security Form
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');

  // Preferences
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [desktopAlerts, setDesktopAlerts] = useState(true);

  // Close dropdowns on click outside
  const notifRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormName(user.name || '');
      setFormEmail(user.email || '');
    }
  }, [user]);

  useEffect(() => {
    if (modalOpen && user?.role === 'student') {
      import('../services/api').then(({ studentsApi }) => {
        studentsApi.getMe().then(res => {
          if (res && !res.error) {
            setGithubUrl(res.github_url || '');
            setSocialVisibility(res.social_links_visibility !== false);
          }
        });
      });
    }
  }, [modalOpen, user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    showToast('Signing out…', 'info', 1200);
    setTimeout(() => navigate('/login'), 800);
  }

  function handleSaveProfile() {
    if (!formName.trim() || !formEmail.trim()) {
      showToast('Name and email cannot be blank.', 'error');
      return;
    }
    updateUser({ name: formName, email: formEmail });

    if (user?.role === 'student') {
      import('../services/api').then(({ studentsApi }) => {
        studentsApi.updateMe({
          github_url: githubUrl,
          social_links_visibility: socialVisibility
        }).then(res => {
          if (res?.error) {
            showToast(res.error, 'error');
          }
        });
      });
    }

    showToast('Profile updated successfully!', 'success');
    setModalOpen(false);
  }

  function handleChangePassword() {
    if (!newPw || newPw.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    // Call the real backend password change endpoint
    import('../services/api').then(({ authApi }) => {
      authApi.changePassword({ current_password: oldPw, new_password: newPw })
        .then(res => {
          if (res?.error) { showToast(res.error, 'error'); return; }
          showToast('Password updated successfully!', 'success');
          setOldPw('');
          setNewPw('');
          setModalOpen(false);
        });
    });
  }

  function handleSavePreferences() {
    showToast('Preferences updated successfully!', 'success');
    setModalOpen(false);
  }

  const initials   = user?.initials || (user?.name ? user.name.slice(0, 2).toUpperCase() : 'ST');
  const roleLabel  = user?.role === 'tpo' ? 'TPO / Placement' : user?.role === 'professor' ? 'Professor' : user?.role === 'admin' ? 'Admin' : 'Student';

  return (
    <header className="topbar" role="banner">
      {/* Mobile menu toggle */}
      <button className="menu-toggle" id="menuToggle" aria-label="Toggle sidebar" aria-expanded="false" onClick={onMenuToggle}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <div className="topbar-right">
        {/* Notification Bell with Dropdown */}
        <div className="topbar-dropdown-wrap" ref={notifRef}>
          <button className={`icon-btn${unreadCount > 0 ? ' has-unread' : ''}`} id="notifBtn" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`} onClick={toggleNotif}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className="notif-dot" aria-hidden="true">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-header">
                <h3>Notifications</h3>
                {notifs.length > 0 && <button onClick={clearNotifs}>Clear all</button>}
              </div>
              <div className="notif-dropdown-body">
                {loadingNotifs ? (
                  <div className="notif-empty">
                    <span>⏳</span><p>Loading…</p>
                  </div>
                ) : notifs.map(n => (
                  <div key={n.id} className={`notif-item${n.unread ? ' unread' : ''}`}>
                    <div className="notif-item-content"
                         style={n.link ? { cursor: 'pointer' } : {}}
                         onClick={() => n.link && navigate(n.link)}>
                      <h4>{n.title}</h4>
                      <p>{n.text}</p>
                      <span>{n.time}</span>
                    </div>
                    <button className="notif-item-close" onClick={(e) => removeNotif(n.id, e)}>✕</button>
                  </div>
                ))}
                {!loadingNotifs && notifs.length === 0 && (
                  <div className="notif-empty">
                    <span>🔔</span>
                    <p>No new notifications</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sign out */}
        <button className="logout-btn" id="logoutBtn" aria-label="Sign out" onClick={handleLogout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>

        {/* Avatar / Profile button triggers Modal */}
        <button className="avatar-btn" id="avatarBtn" aria-label="Profile menu" onClick={() => setModalOpen(true)}>
          <span className="avatar" id="avatarInitials" aria-hidden="true">{initials}</span>
          <div className="avatar-info">
            <span className="avatar-name" id="avatarName">{user?.name || 'Student'}</span>
            <span className="avatar-role">{roleLabel}</span>
          </div>
        </button>
      </div>

      {/* Profile & Settings Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box profile-settings-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h2>Account Settings</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            
            <div className="profile-settings-layout">
              {/* Sidebar Tabs */}
              <div className="profile-settings-sidebar">
                <button className={`ps-tab-btn${activeTab === 'profile' ? ' active' : ''}`} onClick={() => setActiveTab('profile')}>
                  👤 Profile Info
                </button>
                <button className={`ps-tab-btn${activeTab === 'security' ? ' active' : ''}`} onClick={() => setActiveTab('security')}>
                  🔒 Security
                </button>
                <button className={`ps-tab-btn${activeTab === 'preferences' ? ' active' : ''}`} onClick={() => setActiveTab('preferences')}>
                  ⚙️ Preferences
                </button>
              </div>

              {/* Form Content */}
              <div className="profile-settings-content">
                {activeTab === 'profile' && (
                  <div className="ps-form">
                    <h3>Personal Details</h3>
                    <div className="co-field">
                      <label className="co-label">Full Name</label>
                      <input className="co-input" value={formName} onChange={e => setFormName(e.target.value)} />
                    </div>
                    <div className="co-field">
                      <label className="co-label">Email Address</label>
                      <input className="co-input" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                    </div>
                    <div className="co-field">
                      <label className="co-label">Role</label>
                      <input className="co-input" value={roleLabel} disabled style={{ opacity: 0.6 }} />
                    </div>
                    {user?.role === 'student' && (
                      <>
                        <div className="co-field">
                          <label className="co-label">GitHub URL</label>
                          <input className="co-input" placeholder="https://github.com/username"
                            value={githubUrl} onChange={e => setGithubUrl(e.target.value)} />
                        </div>
                        <div className="co-field" style={{ marginTop: '0.5rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.85rem' }}>
                            <input type="checkbox" checked={socialVisibility}
                              onChange={e => setSocialVisibility(e.target.checked)} />
                            Make resume and social links visible to recruiters
                          </label>
                        </div>
                      </>
                    )}
                    <button className="pd-btn pd-btn-primary" style={{ marginTop: '0.5rem' }} onClick={handleSaveProfile}>
                      Save Profile
                    </button>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="ps-form">
                    <h3>Change Password</h3>
                    <div className="co-field">
                      <label className="co-label">Current Password</label>
                      <input className="co-input" type="password" placeholder="••••••••" value={oldPw} onChange={e => setOldPw(e.target.value)} />
                    </div>
                    <div className="co-field">
                      <label className="co-label">New Password</label>
                      <input className="co-input" type="password" placeholder="At least 6 characters" value={newPw} onChange={e => setNewPw(e.target.value)} />
                    </div>
                    <button className="pd-btn pd-btn-primary" style={{ marginTop: '0.5rem' }} onClick={handleChangePassword}>
                      Update Password
                    </button>
                  </div>
                )}

                {activeTab === 'preferences' && (
                  <div className="ps-form">
                    <h3>System Preferences</h3>
                    <div className="ps-preference-row">
                      <label className="pn-checkbox-label">
                        <input type="checkbox" checked={emailAlerts} onChange={e => setEmailAlerts(e.target.checked)} />
                        Send email updates for drive shortlists
                      </label>
                    </div>
                    <div className="ps-preference-row" style={{ marginTop: '0.5rem' }}>
                      <label className="pn-checkbox-label">
                        <input type="checkbox" checked={desktopAlerts} onChange={e => setDesktopAlerts(e.target.checked)} />
                        Enable desktop push notifications
                      </label>
                    </div>
                    <button className="pd-btn pd-btn-primary" style={{ marginTop: '1rem' }} onClick={handleSavePreferences}>
                      Save Preferences
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
