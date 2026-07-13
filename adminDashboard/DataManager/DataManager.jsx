import { useState, useEffect, useRef } from 'react';
import { useToast } from '@ctx/ToastContext';
import { adminApi, placementApi } from '@/services/api';
import '@admin/admin.shared.css';

const TABS = ['Students', 'Professors', 'Placement Drives', 'Access Requests'];

export default function DataManager() {
  const showToast = useToast();
  const fileInputRef = useRef(null);

  const [tab, setTab]           = useState(0);
  const [search, setSearch]     = useState('');
  const [students, setStudents] = useState([]);
  const [profs, setProfs]       = useState([]);
  const [drives, setDrives]     = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchAllData();
  }, [tab]);

  async function fetchAllData() {
    setLoading(true);
    try {
      if (tab === 0 || tab === 1 || tab === 2) {
        const [sRes, pRes, dRes] = await Promise.all([
          adminApi.listUsers({ role: 'student', per_page: 200 }),
          adminApi.listUsers({ role: 'professor', per_page: 200 }),
          placementApi.listDrives(),
        ]);
        if (sRes?.users)  setStudents(sRes.users);
        if (pRes?.users)  setProfs(pRes.users);
        if (dRes?.drives) setDrives(dRes.drives);
      } else if (tab === 3) {
        const rRes = await adminApi.getDetailRequests();
        setRequests(rRes.detail_requests || rRes.requests || []);
      }
    } catch (err) {
      console.error('Error loading data manager:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    showToast('Importing student CSV roster…', 'info', 2500);
    const res = await adminApi.bulkImportStudents(formData);
    if (res?.error) { showToast(res.error, 'error', 3500); return; }
    showToast(res?.message || 'CSV imported successfully!', 'success', 3500);
    fetchAllData();
  }

  const filteredStudents = students.filter(s =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.roll_no?.toLowerCase().includes(search.toLowerCase()) || s.branch?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredProfs = profs.filter(p =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.department?.toLowerCase().includes(search.toLowerCase()) || p.employee_id?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDrives = drives.filter(d =>
    !search || d.company_name?.toLowerCase().includes(search.toLowerCase()) || d.role_title?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredRequests = requests.filter(r =>
    !search ||
    r.professor_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.student_roll?.toLowerCase().includes(search.toLowerCase()) ||
    r.reason?.toLowerCase().includes(search.toLowerCase())
  );

  // Access Requests Actions
  async function handleApproveRequest(reqId) {
    try {
      await adminApi.approveDetailRequest(reqId);
      showToast('Detail access request approved (7-day window granted).', 'success', 3000);
      fetchAllData();
    } catch (err) {
      showToast(err.message || 'Failed to approve request.', 'error', 3000);
    }
  }

  async function handleRejectRequest(reqId) {
    if (!window.confirm('Reject this access request?')) return;
    try {
      await adminApi.rejectDetailRequest(reqId);
      showToast('Detail access request rejected.', 'success', 3000);
      fetchAllData();
    } catch (err) {
      showToast(err.message || 'Failed to reject request.', 'error', 3000);
    }
  }

  // Profile Edit Modal Actions
  async function handleOpenEdit(user) {
    try {
      const detail = await adminApi.getUserById(user.id);
      setEditingUser(detail);
      setEditForm(detail);
    } catch (err) {
      showToast(err.message || 'Failed to load profile details.', 'error', 3000);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    try {
      const payload = { ...editForm };
      delete payload.id;
      delete payload.created_at;
      delete payload.email;
      delete payload.phone;
      delete payload.role;

      // Type-cast required student/prof fields
      if (editingUser.role === 'student') {
        if (payload.semester) payload.semester = parseInt(payload.semester);
        if (payload.batch_year) payload.batch_year = parseInt(payload.batch_year);
        if (payload.cgpa) payload.cgpa = parseFloat(payload.cgpa);
        if (payload.attendance_pct) payload.attendance_pct = parseFloat(payload.attendance_pct);
        if (payload.active_backlogs) payload.active_backlogs = parseInt(payload.active_backlogs);
      }

      await adminApi.updateUser(editingUser.id, payload);
      showToast('Profile records updated and audited successfully.', 'success', 3000);
      setEditingUser(null);
      fetchAllData();
    } catch (err) {
      showToast(err.message || 'Failed to save changes.', 'error', 3000);
    }
  }

  return (
    <div className="ad-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Master Data Manager</h1>
          <p className="page-sub">Direct access to query and inspect student, faculty, and placement records</p>
        </div>
        <div className="ad-header-actions">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleCsvUpload}
          />
          <button className="ad-btn ad-btn-primary" onClick={() => fileInputRef.current?.click()}>
            📥 Bulk Import Student CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="ad-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Students</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{students.length}</div>
        </div>
        <div className="ad-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faculty Members</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{profs.length}</div>
        </div>
        <div className="ad-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Drives</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{drives.length}</div>
        </div>
      </div>

      <div className="ad-card">
        <div className="ad-tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`ad-tab${tab === i ? ' active' : ''}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>

        <div className="ad-search-row">
          <div className="ad-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ad-search-input" placeholder={`Search ${TABS[tab].toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="ad-table-wrap">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <div className="ad-spinner" style={{ margin: '0 auto 1rem auto' }} />
              Loading database records…
            </div>
          ) : tab === 0 ? (
            filteredStudents.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No student records in database</p>
                <p style={{ fontSize: '0.85rem' }}>Use the <strong>Bulk Import Student CSV</strong> button above to populate student records.</p>
              </div>
            ) : (
              <table className="ad-table">
                <thead><tr><th>Roll No</th><th>Name</th><th>Branch</th><th>Batch</th><th>Sem</th><th>CGPA</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s.id}>
                      <td><code style={{ color: '#818cf8' }}>{s.roll_no}</code></td>
                      <td><div style={{ fontWeight: 600 }}>{s.full_name}</div></td>
                      <td>{s.branch}</td>
                      <td>{s.batch_year}</td>
                      <td>{s.semester}</td>
                      <td><strong>{s.cgpa}</strong></td>
                      <td>
                        <span className={`ad-badge ${s.profile_complete ? 'ad-badge-success' : 'ad-badge-warning'}`}>
                          {s.profile_complete ? 'Claimed' : 'Unclaimed'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="ad-btn ad-btn-outline"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleOpenEdit(s)}
                        >
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === 1 ? (
            filteredProfs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No faculty members found</p>
                <p style={{ fontSize: '0.85rem' }}>Generate an invite token from User & Access Management to invite professors.</p>
              </div>
            ) : (
              <table className="ad-table">
                <thead><tr><th>Emp ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {filteredProfs.map(p => (
                    <tr key={p.id}>
                      <td><code style={{ color: '#818cf8' }}>{p.employee_id}</code></td>
                      <td><div style={{ fontWeight: 600 }}>{p.full_name}</div></td>
                      <td>{p.department}</td>
                      <td>{p.designation}</td>
                      <td><span className="ad-badge ad-badge-success">{p.approval_status || 'Approved'}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="ad-btn ad-btn-outline"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleOpenEdit(p)}
                        >
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === 2 ? (
            filteredDrives.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No placement drives created yet</p>
                <p style={{ fontSize: '0.85rem' }}>Drives created in Placement Dashboard will appear here.</p>
              </div>
            ) : (
              <table className="ad-table">
                <thead><tr><th>Company</th><th>Role Title</th><th>Type</th><th>Batch</th><th>CGPA Cutoff</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredDrives.map(d => (
                    <tr key={d.id}>
                      <td><div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.company_name}</div></td>
                      <td>{d.role_title}</td>
                      <td><span className="ad-badge">{d.drive_type}</span></td>
                      <td>{d.batch_year}</td>
                      <td><strong>{d.cgpa_cutoff}</strong></td>
                      <td><span className="ad-badge ad-badge-success">{d.status || 'Active'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            filteredRequests.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No pending detail access requests</p>
                <p style={{ fontSize: '0.85rem' }}>Requests from professors to view student details will appear here.</p>
              </div>
            ) : (
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Professor</th>
                    <th>Student</th>
                    <th>Reason</th>
                    <th>Requested At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map(r => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.professor_name}</strong>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>ID: {r.professor_id}</div>
                      </td>
                      <td>
                        <strong>{r.student_name}</strong>
                        <div style={{ fontSize: '0.73rem', color: '#818cf8' }}>Roll: {r.student_roll}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {r.reason}
                        </div>
                      </td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button
                            className="ad-btn ad-btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                            onClick={() => handleApproveRequest(r.id)}
                          >
                            Approve
                          </button>
                          <button
                            className="ad-btn ad-btn-outline"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', borderColor: '#ef4444', color: '#ef4444' }}
                            onClick={() => handleRejectRequest(r.id)}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {editingUser && (
        <div className="ad-modal-overlay open" onClick={() => setEditingUser(null)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 className="ad-modal-title">Edit {editingUser.role === 'student' ? 'Student' : 'Professor'} Profile</h2>
            <p className="ad-modal-sub">Modify administrative and background database fields.</p>

            <form onSubmit={handleSaveEdit}>
              {editingUser.role === 'student' ? (
                <>
                  <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={editForm.full_name || ''}
                      onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="ad-input"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <div className="ad-field">
                      <label>Branch</label>
                      <input
                        type="text"
                        value={editForm.branch || ''}
                        onChange={e => setEditForm({ ...editForm, branch: e.target.value })}
                        className="ad-input"
                        required
                      />
                    </div>
                    <div className="ad-field">
                      <label>Batch Year</label>
                      <input
                        type="number"
                        value={editForm.batch_year || ''}
                        onChange={e => setEditForm({ ...editForm, batch_year: e.target.value })}
                        className="ad-input"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <div className="ad-field">
                      <label>Semester</label>
                      <input
                        type="number"
                        value={editForm.semester || ''}
                        onChange={e => setEditForm({ ...editForm, semester: e.target.value })}
                        className="ad-input"
                        required
                      />
                    </div>
                    <div className="ad-field">
                      <label>CGPA</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.cgpa || ''}
                        onChange={e => setEditForm({ ...editForm, cgpa: e.target.value })}
                        className="ad-input"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <div className="ad-field">
                      <label>Fees Submitted</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.fees_submitted || ''}
                        onChange={e => setEditForm({ ...editForm, fees_submitted: e.target.value })}
                        className="ad-input"
                      />
                    </div>
                    <div className="ad-field">
                      <label>Parent Contact</label>
                      <input
                        type="text"
                        value={editForm.parent_contact || ''}
                        onChange={e => setEditForm({ ...editForm, parent_contact: e.target.value })}
                        className="ad-input"
                      />
                    </div>
                  </div>

                  <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                    <label>Scholarship Details</label>
                    <input
                      type="text"
                      value={editForm.scholarship_details || ''}
                      onChange={e => setEditForm({ ...editForm, scholarship_details: e.target.value })}
                      className="ad-input"
                    />
                  </div>

                  <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                    <label>Home Address</label>
                    <textarea
                      value={editForm.home_address || ''}
                      onChange={e => setEditForm({ ...editForm, home_address: e.target.value })}
                      className="ad-input"
                      rows={2}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={editForm.full_name || ''}
                      onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="ad-input"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <div className="ad-field">
                      <label>Department</label>
                      <input
                        type="text"
                        value={editForm.department || ''}
                        onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                        className="ad-input"
                        required
                      />
                    </div>
                    <div className="ad-field">
                      <label>Designation</label>
                      <input
                        type="text"
                        value={editForm.designation || ''}
                        onChange={e => setEditForm({ ...editForm, designation: e.target.value })}
                        className="ad-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                    <label>Monthly Salary</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.monthly_salary || ''}
                      onChange={e => setEditForm({ ...editForm, monthly_salary: e.target.value })}
                      className="ad-input"
                    />
                  </div>

                  <div className="ad-field" style={{ marginBottom: '0.85rem' }}>
                    <label>Home Address</label>
                    <textarea
                      value={editForm.home_address || ''}
                      onChange={e => setEditForm({ ...editForm, home_address: e.target.value })}
                      className="ad-input"
                      rows={2}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="button" className="ad-btn ad-btn-outline" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="ad-btn ad-btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
