import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@ctx/ToastContext';
import { adminApi } from '@/services/api';
import '@admin/admin.shared.css';

const PERMISSIONS = [
  { id:'p1', label:'Placement Cell can edit student CGPA',  desc:'Allow TPO to modify academic records',    on: false },
  { id:'p2', label:'Professors can view placement data',    desc:'Faculty access to offer/drive details',   on: true  },
  { id:'p3', label:'Students can self-update profile',      desc:'Allow students to edit bio, skills, etc', on: true  },
  { id:'p4', label:'Bulk student import via CSV',           desc:'Allow CSV roster upload by admin/TPO',    on: true  },
  { id:'p5', label:'Auto-approve student signups',          desc:'Skip manual approval for student accounts',on: false },
  { id:'p6', label:'TPO can broadcast announcements',       desc:'Allow placement cell to send college-wide notices', on: true },
];

const TABS = ['All Users','Students','Faculty','Placement Cell'];

export default function UserManagement() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [tab, setTab]           = useState(0);
  const [search, setSearch]     = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [perms, setPerms]       = useState(PERMISSIONS);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);

  // Restrictions & Tags Library State
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRestrictionsModal, setShowRestrictionsModal] = useState(false);
  const [userTags, setUserTags] = useState([]);
  const [userSuspensions, setUserSuspensions] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [newUser, setNewUser]   = useState({ email:'', role:'professor' });
  const [inviteTokenResult, setInviteTokenResult] = useState('');
  const [manualUser, setManualUser] = useState({
    role: 'student',
    email: '',
    phone: '',
    password: '',
    roll_no: '',
    full_name: '',
    branch: 'Computer Science',
    batch_year: '2026',
    semester: '6',
    cgpa: '8.0',
    employee_id: '',
    department: 'Computer Science',
    designation: 'Assistant Professor'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const res = await adminApi.listUsers({ per_page: 100 });
    setLoading(false);
    if (res?.error) { showToast(res.error, 'error', 3000); return; }
    setUsers(res?.users || []);
  }

  const roleFilterMap = ['', 'student', 'professor', 'placement_cell'];
  const filtered = users.filter(u => {
    const roleMatch = !roleFilterMap[tab] || u.role === roleFilterMap[tab];
    const searchMatch = !search || (u.email && u.email.toLowerCase().includes(search.toLowerCase())) || (u.phone && u.phone.includes(search));
    return roleMatch && searchMatch;
  });

  async function toggleUserActive(user) {
    const res = await adminApi.toggleUserActive(user.id, !user.is_active);
    if (res?.error) { showToast(res.error, 'error', 3000); return; }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !user.is_active } : u));
    showToast(`User account ${!user.is_active ? 'activated' : 'deactivated'}.`, 'success', 2000);
  }

  async function generateInvite() {
    if (!newUser.email) { showToast('Email address is required.', 'error', 2000); return; }
    const res = await adminApi.createInvite({ email: newUser.email, role: newUser.role });
    if (res?.error) { showToast(res.error, 'error', 3000); return; }
    showToast('Invite generated successfully!', 'success', 3000);
    if (res?.token) {
      setInviteTokenResult(res.token);
    } else {
      setModalOpen(false);
      setNewUser({ email: '', role: 'professor' });
    }
    fetchUsers();
  }

  async function handleAddUserManually() {
    if (!manualUser.role) return;
    
    // basic validations
    if (manualUser.role === 'student') {
      if (!manualUser.roll_no) { showToast('Roll number is required for students.', 'error', 2000); return; }
    } else if (manualUser.role === 'professor') {
      if (!manualUser.email) { showToast('Email address is required for professors.', 'error', 2000); return; }
      if (!manualUser.employee_id) { showToast('Employee ID is required for professors.', 'error', 2000); return; }
    } else {
      // TPO / Admin
      if (!manualUser.email) { showToast('Email address is required.', 'error', 2000); return; }
    }

    const payload = {
      role: manualUser.role,
      email: manualUser.email || undefined,
      phone: manualUser.phone || undefined,
      password: manualUser.password || undefined,
      roll_no: manualUser.role === 'student' ? manualUser.roll_no : undefined,
      full_name: manualUser.full_name || undefined,
      branch: manualUser.role === 'student' ? manualUser.branch : undefined,
      batch_year: manualUser.role === 'student' ? parseInt(manualUser.batch_year) : undefined,
      semester: manualUser.role === 'student' ? parseInt(manualUser.semester) : undefined,
      cgpa: manualUser.role === 'student' ? parseFloat(manualUser.cgpa) : undefined,
      employee_id: manualUser.role === 'professor' ? manualUser.employee_id : undefined,
      department: manualUser.role === 'professor' ? manualUser.department : undefined,
      designation: manualUser.role === 'professor' ? manualUser.designation : undefined,
    };

    showToast('Creating user...', 'info', 2000);
    const res = await adminApi.createUserManually(payload);
    if (res?.error) { showToast(res.error, 'error', 3000); return; }
    
    showToast(`${manualUser.role.toUpperCase()} added successfully!`, 'success', 3000);
    setManualModalOpen(false);
    // reset form
    setManualUser({
      role: 'student',
      email: '',
      phone: '',
      password: '',
      roll_no: '',
      full_name: '',
      branch: 'Computer Science',
      batch_year: '2026',
      semester: '6',
      cgpa: '8.0',
      employee_id: '',
      department: 'Computer Science',
      designation: 'Assistant Professor'
    });
    fetchUsers();
  }

  async function openRestrictionsModal(user) {
    setSelectedUser(user);
    try {
      const detail = await adminApi.getUserById(user.id);
      setUserTags(detail.tags || []);
      setUserSuspensions(detail.suspended_features || []);
      setShowRestrictionsModal(true);
    } catch (err) {
      showToast(err.message || 'Failed to load user details.', 'error', 3000);
    }
  }

  async function handleSaveRestrictions() {
    try {
      await adminApi.updateUser(selectedUser.id, {
        tags: userTags,
        suspended_features: userSuspensions
      });
      showToast('User restrictions and tags updated successfully.', 'success', 2000);
      setShowRestrictionsModal(false);
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Failed to update user restrictions.', 'error', 3000);
    }
  }

  function handleAddTag() {
    const cleanTag = newTagInput.trim();
    if (!cleanTag) return;
    if (userTags.includes(cleanTag)) {
      showToast('Tag already exists.', 'warning', 2000);
      return;
    }
    setUserTags([...userTags, cleanTag]);
    setNewTagInput('');
  }

  function handleRemoveTag(tag) {
    setUserTags(userTags.filter(t => t !== tag));
  }

  const PRESET_TAGS = ['Probation', 'Academic Warning', 'TPO Star', 'Suspended', 'Guest Faculty', 'Dean'];
  const SUSPENDABLE_FEATURES = [
    { id: 'chat', label: 'Direct Messaging' },
    { id: 'marketplace_listing', label: 'List Marketplace Items' },
    { id: 'notes_upload', label: 'Study Notes Upload' },
    { id: 'event_creation', label: 'Event Creation' },
  ];

  const Toggle = ({ on, onToggle }) => (
    <div className="ad-toggle" onClick={onToggle}>
      <div className={`ad-toggle-track${on?' on':''}`}>
        <div className="ad-toggle-thumb"/>
      </div>
    </div>
  );

  return (
    <div className="ad-root">
      <div className="page-header">
        <div><h1 className="page-title">User & Access Management</h1><p className="page-sub">Add, approve, and control role permissions across the college portal</p></div>
        <div className="ad-header-actions" style={{ display: 'flex', gap: '0.65rem' }}>
          <button className="ad-btn ad-btn-outline" onClick={() => { 
            setManualUser({
              role: 'student',
              email: '',
              phone: '',
              password: '',
              roll_no: '',
              full_name: '',
              branch: 'Computer Science',
              batch_year: '2026',
              semester: '6',
              cgpa: '8.0',
              employee_id: '',
              department: 'Computer Science',
              designation: 'Assistant Professor'
            });
            setManualModalOpen(true); 
          }}>+ Add User Manually</button>
          <button className="ad-btn ad-btn-primary" onClick={() => { setInviteTokenResult(''); setModalOpen(true); }}>+ Generate Invite Token</button>
        </div>
      </div>

      <div className="ad-card">
        <div className="ad-tabs">
          {TABS.map((t,i) => <button key={t} className={`ad-tab${tab===i?' active':''}`} onClick={() => setTab(i)}>{t}</button>)}
        </div>
        <div className="ad-search-row">
          <div className="ad-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ad-search-input" placeholder="Search by email or phone…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="ad-table-wrap">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <div className="ad-spinner" style={{ margin: '0 auto 1rem auto' }} />
              Loading system user directory…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No users found in database</p>
              <p style={{ fontSize: '0.85rem' }}>Try clearing filters or generate new staff invite tokens.</p>
            </div>
          ) : (
            <table className="ad-table">
              <thead><tr><th>Email / Identity</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.email || u.phone || u.id}</div>
                    </td>
                    <td><span className="ad-badge" style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                    <td>
                      <span className={`ad-badge ${u.is_active ? 'ad-badge-success' : 'ad-badge-warning'}`}>
                        {u.is_active ? 'Active' : 'Inactive / Pending Claim'}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          className={`ad-btn ${u.is_active ? 'ad-btn-outline' : 'ad-btn-primary'}`}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                          onClick={() => toggleUserActive(u)}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="ad-btn ad-btn-outline"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                          onClick={() => openRestrictionsModal(u)}
                        >
                          ⚙️ Restrictions
                        </button>
                        <button
                          className="ad-btn ad-btn-outline"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                          onClick={() => navigate(`/admin/audit?actor=${encodeURIComponent(u.email || u.id)}`)}
                        >
                          🔍 Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="ad-card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>System Permission Matrix Policy</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Server-side enforced RBAC rules across user role types</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {perms.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg-subtle, rgba(0,0,0,.02))', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{p.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.desc}</div>
              </div>
              <Toggle on={p.on} onToggle={() => setPerms(prev => prev.map(item => item.id === p.id ? { ...item, on: !item.on } : item))} />
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="ad-modal-overlay open" onClick={() => setModalOpen(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <h2 className="ad-modal-title">Generate Single-Use Staff Invite</h2>
            <p className="ad-modal-sub">
              Create a secure invitation token for Faculty, Placement Cell, or Administrator accounts.
            </p>

            {inviteTokenResult ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '1rem', borderRadius: '10px', color: '#10b981', marginBottom: '1rem' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>✓ Invite Token Generated Successfully:</p>
                <div style={{ background: 'var(--bg-subtle, rgba(0,0,0,0.03))', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', marginBottom: '0.5rem' }}>
                  {inviteTokenResult}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Share this token link with the invited staff member:
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/login?token=${inviteTokenResult}`}
                    className="ad-input"
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
                    onClick={e => e.target.select()}
                  />
                  <button
                    className="ad-btn ad-btn-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/login?token=${inviteTokenResult}`);
                      showToast('Invite link copied to clipboard!', 'success', 2000);
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="ad-field" style={{ marginBottom: '1rem' }}>
                  <label>Target Email Address</label>
                  <input
                    type="email"
                    placeholder="faculty@college.edu.in"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    className="ad-input"
                    autoComplete="off"
                  />
                </div>

                <div className="ad-field" style={{ marginBottom: '1.25rem' }}>
                  <label>Assigned Role</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="ad-select"
                  >
                    <option value="professor">Professor / Faculty</option>
                    <option value="placement_cell">Placement Cell Member (TPO)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="ad-btn ad-btn-outline" onClick={() => setModalOpen(false)}>Close</button>
              {!inviteTokenResult && (
                <button className="ad-btn ad-btn-primary" onClick={generateInvite}>Generate Token</button>
              )}
            </div>
          </div>
        </div>
      )}

      {manualModalOpen && (
        <div className="ad-modal-overlay open" onClick={() => setManualModalOpen(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 className="ad-modal-title">Add User Manually</h2>
            <p className="ad-modal-sub">Create a new user account directly in the database.</p>

            <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
              <label>Role</label>
              <select
                value={manualUser.role}
                onChange={e => setManualUser({ ...manualUser, role: e.target.value })}
                className="ad-select"
              >
                <option value="student">Student</option>
                <option value="professor">Professor / Faculty</option>
                <option value="placement_cell">Placement Cell (TPO)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
              <label>Email Address</label>
              <input
                type="email"
                placeholder="user@college.edu.in"
                value={manualUser.email}
                onChange={e => setManualUser({ ...manualUser, email: e.target.value })}
                className="ad-input"
                autoComplete="off"
              />
            </div>

            <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
              <label>Phone Number (Optional)</label>
              <input
                type="tel"
                placeholder="e.g. +919876543210"
                value={manualUser.phone}
                onChange={e => setManualUser({ ...manualUser, phone: e.target.value })}
                className="ad-input"
                autoComplete="off"
              />
            </div>

            <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
              <label>Password (Defaults to password123)</label>
              <input
                type="password"
                placeholder="password123"
                value={manualUser.password}
                onChange={e => setManualUser({ ...manualUser, password: e.target.value })}
                className="ad-input"
                autoComplete="new-password"
              />
            </div>

            {manualUser.role === 'student' && (
              <>
                <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                  <label>Roll Number (Required)</label>
                  <input
                    type="text"
                    placeholder="e.g. CS21DEM001"
                    value={manualUser.roll_no}
                    onChange={e => setManualUser({ ...manualUser, roll_no: e.target.value })}
                    className="ad-input"
                    autoComplete="off"
                  />
                </div>
                <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Arjun Mehta"
                    value={manualUser.full_name}
                    onChange={e => setManualUser({ ...manualUser, full_name: e.target.value })}
                    className="ad-input"
                    autoComplete="off"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <div className="ad-field">
                    <label>Branch</label>
                    <input
                      type="text"
                      value={manualUser.branch}
                      onChange={e => setManualUser({ ...manualUser, branch: e.target.value })}
                      className="ad-input"
                      autoComplete="off"
                    />
                  </div>
                  <div className="ad-field">
                    <label>Batch Year</label>
                    <input
                      type="number"
                      value={manualUser.batch_year}
                      onChange={e => setManualUser({ ...manualUser, batch_year: e.target.value })}
                      className="ad-input"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <div className="ad-field">
                    <label>Semester</label>
                    <input
                      type="number"
                      value={manualUser.semester}
                      onChange={e => setManualUser({ ...manualUser, semester: e.target.value })}
                      className="ad-input"
                      autoComplete="off"
                    />
                  </div>
                  <div className="ad-field">
                    <label>CGPA</label>
                    <input
                      type="number"
                      step="0.01"
                      value={manualUser.cgpa}
                      onChange={e => setManualUser({ ...manualUser, cgpa: e.target.value })}
                      className="ad-input"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </>
            )}

            {manualUser.role === 'professor' && (
              <>
                <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                  <label>Employee ID (Required)</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-101"
                    value={manualUser.employee_id}
                    onChange={e => setManualUser({ ...manualUser, employee_id: e.target.value })}
                    className="ad-input"
                    autoComplete="off"
                  />
                </div>
                <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={manualUser.full_name}
                    onChange={e => setManualUser({ ...manualUser, full_name: e.target.value })}
                    className="ad-input"
                    autoComplete="off"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <div className="ad-field">
                    <label>Department</label>
                    <input
                      type="text"
                      value={manualUser.department}
                      onChange={e => setManualUser({ ...manualUser, department: e.target.value })}
                      className="ad-input"
                      autoComplete="off"
                    />
                  </div>
                  <div className="ad-field">
                    <label>Designation</label>
                    <input
                      type="text"
                      value={manualUser.designation}
                      onChange={e => setManualUser({ ...manualUser, designation: e.target.value })}
                      className="ad-input"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button className="ad-btn ad-btn-outline" onClick={() => setManualModalOpen(false)}>Cancel</button>
              <button className="ad-btn ad-btn-primary" onClick={handleAddUserManually}>Add User</button>
            </div>
          </div>
        </div>
      )}

      {/* Restrictions & Tags Modal */}
      {showRestrictionsModal && selectedUser && (
        <div className="ad-modal-overlay open" onClick={() => setShowRestrictionsModal(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <h2 className="ad-modal-title">Restrictions & Tags Manager</h2>
            <p className="ad-modal-sub">
              Manage platform restrictions and tags for <strong>{selectedUser.email || selectedUser.phone}</strong>
            </p>

            {/* Feature Suspensions */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Suspended Features</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {SUSPENDABLE_FEATURES.map(f => (
                  <label key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={userSuspensions.includes(f.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setUserSuspensions([...userSuspensions, f.id]);
                        } else {
                          setUserSuspensions(userSuspensions.filter(id => id !== f.id));
                        }
                      }}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Tags Manager */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>User Tags</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                {userTags.length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No tags assigned.</span>
                ) : (
                  userTags.map(tag => (
                    <span key={tag} className="ad-badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontWeight: 700, fontSize: '0.75rem' }}>✕</button>
                    </span>
                  ))
                )}
              </div>

              {/* Add Custom Tag */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Type custom tag..."
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  className="ad-input"
                  style={{ flexGrow: 1, padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
                />
                <button type="button" className="ad-btn ad-btn-outline" onClick={handleAddTag}>Add Tag</button>
              </div>

              {/* Preset Tag Library */}
              <div>
                <small style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Preset Tag Library:</small>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {PRESET_TAGS.map(t => (
                    <button
                      key={t}
                      type="button"
                      disabled={userTags.includes(t)}
                      onClick={() => setUserTags([...userTags, t])}
                      className="ad-btn ad-btn-outline"
                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px' }}
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button className="ad-btn ad-btn-outline" onClick={() => setShowRestrictionsModal(false)}>Cancel</button>
              <button className="ad-btn ad-btn-primary" onClick={handleSaveRestrictions}>Save Restrictions</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


