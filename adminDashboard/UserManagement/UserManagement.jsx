import { useState, useEffect } from 'react';
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
  const showToast = useToast();
  const [tab, setTab]           = useState(0);
  const [search, setSearch]     = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [perms, setPerms]       = useState(PERMISSIONS);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newUser, setNewUser]   = useState({ email:'', role:'professor' });
  const [inviteTokenResult, setInviteTokenResult] = useState('');

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
        <div className="ad-header-actions">
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
                      <button
                        className={`ad-btn ${u.is_active ? 'ad-btn-outline' : 'ad-btn-primary'}`}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                        onClick={() => toggleUserActive(u)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="ad-card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>System Permission Matrix Policy</h2>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>Server-side enforced RBAC rules across user role types</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {perms.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#e2e8f0' }}>{p.label}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{p.desc}</div>
              </div>
              <Toggle on={p.on} onToggle={() => setPerms(prev => prev.map(item => item.id === p.id ? { ...item, on: !item.on } : item))} />
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="ad-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>Generate Single-Use Staff Invite</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Create a secure invitation token for Faculty, Placement Cell, or Administrator accounts.
            </p>

            {inviteTokenResult ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '1rem', borderRadius: '10px', color: '#6ee7b7', marginBottom: '1rem' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>✓ Invite Token Generated Successfully:</p>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                  {inviteTokenResult}
                </div>
                <p style={{ fontSize: '0.78rem', marginTop: '0.5rem', color: '#a7f3d0' }}>
                  Share this token link with the invited staff member: <code>/login?token={inviteTokenResult}</code>
                </p>
              </div>
            ) : (
              <>
                <div className="field" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Target Email Address</label>
                  <input
                    type="email"
                    placeholder="faculty@college.edu.in"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  />
                </div>

                <div className="field" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Assigned Role</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
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
    </div>
  );
}
