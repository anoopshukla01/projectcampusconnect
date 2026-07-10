import { useState, useEffect, useRef } from 'react';
import { useToast } from '@ctx/ToastContext';
import { adminApi, studentsApi, professorsApi, placementApi } from '@/services/api';
import '@admin/admin.shared.css';

const TABS = ['Students', 'Professors', 'Placement Drives'];

export default function DataManager() {
  const showToast = useToast();
  const fileInputRef = useRef(null);

  const [tab, setTab]           = useState(0);
  const [search, setSearch]     = useState('');
  const [students, setStudents] = useState([]);
  const [profs, setProfs]       = useState([]);
  const [drives, setDrives]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    try {
      const [sRes, pRes, dRes] = await Promise.all([
        studentsApi.list({ per_page: 100 }),
        professorsApi.list({ per_page: 100 }),
        placementApi.listDrives(),
      ]);
      if (sRes?.students)   setStudents(sRes.students);
      if (pRes?.professors) setProfs(pRes.professors);
      if (dRes?.drives)     setDrives(dRes.drives);
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
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>{students.length}</div>
        </div>
        <div className="ad-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faculty Members</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>{profs.length}</div>
        </div>
        <div className="ad-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Drives</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>{drives.length}</div>
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
                <thead><tr><th>Roll No</th><th>Name</th><th>Branch</th><th>Batch</th><th>Sem</th><th>CGPA</th><th>Status</th></tr></thead>
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
                <thead><tr><th>Emp ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredProfs.map(p => (
                    <tr key={p.id}>
                      <td><code style={{ color: '#818cf8' }}>{p.employee_id}</code></td>
                      <td><div style={{ fontWeight: 600 }}>{p.full_name}</div></td>
                      <td>{p.department}</td>
                      <td>{p.designation}</td>
                      <td><span className="ad-badge ad-badge-success">{p.approval_status || 'Approved'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
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
                      <td><div style={{ fontWeight: 700, color: '#f8fafc' }}>{d.company_name}</div></td>
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
          )}
        </div>
      </div>
    </div>
  );
}
