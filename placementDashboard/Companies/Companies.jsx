import { useState } from 'react';
import { useToast } from '@ctx/ToastContext';
import './Companies.css';

const INITIAL_COMPANIES = [
  { id: 1, name: 'Google', sector: 'Tech', contact: 'Rahul Sharma', email: 'rahul.s@google.com', lastVisit: 'Dec 2024', package: '₹42 LPA', drives: 8, status: 'Active' },
  { id: 2, name: 'Microsoft', sector: 'Tech', contact: 'Priya Menon', email: 'priya.m@microsoft.com', lastVisit: 'Nov 2024', package: '₹38 LPA', drives: 6, status: 'Active' },
  { id: 3, name: 'Amazon', sector: 'E-Commerce', contact: 'Ankit Roy', email: 'ankit.r@amazon.com', lastVisit: 'Dec 2024', package: '₹28 LPA', drives: 11, status: 'Active' },
  { id: 4, name: 'TCS', sector: 'IT Services', contact: 'Kavitha Iyer', email: 'kavitha.i@tcs.com', lastVisit: 'Nov 2024', package: '₹7 LPA', drives: 22, status: 'Active' },
  { id: 5, name: 'Infosys', sector: 'IT Services', contact: 'Vijay Kumar', email: 'vijay.k@infosys.com', lastVisit: 'Nov 2024', package: '₹6.5 LPA', drives: 18, status: 'Active' },
  { id: 6, name: 'Wipro', sector: 'IT Services', contact: 'Sneha Das', email: 'sneha.d@wipro.com', lastVisit: 'Oct 2024', package: '₹6 LPA', drives: 14, status: 'Active' },
  { id: 7, name: 'Goldman Sachs', sector: 'Finance', contact: 'Arjun Nair', email: 'arjun.n@gs.com', lastVisit: 'Sep 2024', package: '₹22 LPA', drives: 4, status: 'Inactive' },
  { id: 8, name: 'JP Morgan', sector: 'Finance', contact: 'Deepa Singh', email: 'deepa.s@jpmorgan.com', lastVisit: 'Aug 2024', package: '₹18 LPA', drives: 3, status: 'Inactive' },
];

const SECTORS = ['All', 'Tech', 'IT Services', 'E-Commerce', 'Finance', 'Core', 'Consulting'];

const BLANK = { name: '', sector: 'Tech', contact: '', email: '', lastVisit: '', package: '', status: 'Active' };

export default function Companies() {
  const showToast = useToast();
  const [companies, setCompanies] = useState(INITIAL_COMPANIES);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(BLANK);

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    const matchSector = sector === 'All' || c.sector === sector;
    return matchSearch && matchSector;
  });

  function openAdd() { setForm(BLANK); setEditTarget(null); setShowModal(true); }
  function openEdit(c) { setForm({ ...c }); setEditTarget(c.id); setShowModal(true); }

  function saveCompany() {
    if (!form.name.trim()) { showToast('Company name is required', 'error'); return; }
    if (editTarget) {
      setCompanies(prev => prev.map(c => c.id === editTarget ? { ...c, ...form } : c));
      showToast(`${form.name} updated!`, 'success');
    } else {
      setCompanies(prev => [...prev, { ...form, id: Date.now(), drives: 0 }]);
      showToast(`${form.name} added to company database!`, 'success');
    }
    setShowModal(false);
  }

  function deleteCompany(id, name) {
    setCompanies(prev => prev.filter(c => c.id !== id));
    showToast(`${name} removed`, 'info');
  }

  return (
    <div className="co-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Database</h1>
          <p className="page-sub">Manage recruiters, contacts and visit history</p>
        </div>
        <button className="pd-btn pd-btn-primary" onClick={openAdd}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Company
        </button>
      </div>

      {/* Controls */}
      <div className="co-controls">
        <div className="lib-search-wrap">
          <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="lib-search" type="search" placeholder="Search company, contact, email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="co-sector-tabs">
          {SECTORS.map(s => (
            <button key={s} className={`co-sector-tab${sector === s ? ' active' : ''}`} onClick={() => setSector(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="co-summary">
        <div className="co-sum-card"><span className="co-sum-val">{companies.length}</span><span className="co-sum-label">Total Companies</span></div>
        <div className="co-sum-card"><span className="co-sum-val">{companies.filter(c=>c.status==='Active').length}</span><span className="co-sum-label">Active Partners</span></div>
        <div className="co-sum-card"><span className="co-sum-val">{companies.reduce((a,c)=>a+c.drives,0)}</span><span className="co-sum-label">Total Drives</span></div>
        <div className="co-sum-card"><span className="co-sum-val">₹42 LPA</span><span className="co-sum-label">Highest Package</span></div>
      </div>

      {/* Table */}
      <div className="pd-card">
        <div className="pd-table-wrap">
          <table className="pd-table co-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Sector</th>
                <th>Contact Person</th>
                <th>Email</th>
                <th>Last Visit</th>
                <th>Best Package</th>
                <th>Drives</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="co-company-cell">
                      <div className="co-logo">{c.name.slice(0,2).toUpperCase()}</div>
                      <strong>{c.name}</strong>
                    </div>
                  </td>
                  <td><span className="co-sector-badge">{c.sector}</span></td>
                  <td>{c.contact}</td>
                  <td className="co-email">{c.email}</td>
                  <td>{c.lastVisit}</td>
                  <td className="pd-ctc">{c.package}</td>
                  <td>{c.drives}</td>
                  <td>
                    <span className={`pd-badge ${c.status === 'Active' ? 'pd-badge-completed' : 'pd-badge-inactive'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <div className="co-actions">
                      <button className="co-action-btn" title="Edit" onClick={() => openEdit(c)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="co-action-btn co-action-del" title="Delete" onClick={() => deleteCompany(c.id, c.name)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="co-empty">No companies match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box co-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTarget ? 'Edit Company' : 'Add New Company'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="co-form-grid">
              {[
                { key: 'name', label: 'Company Name', placeholder: 'e.g. Google' },
                { key: 'contact', label: 'Contact Person', placeholder: 'Full name' },
                { key: 'email', label: 'Contact Email', placeholder: 'recruiter@company.com' },
                { key: 'package', label: 'Best Package Offered', placeholder: '₹ LPA' },
                { key: 'lastVisit', label: 'Last Visit', placeholder: 'e.g. Dec 2024' },
              ].map(f => (
                <div key={f.key} className="co-field">
                  <label className="co-label">{f.label}</label>
                  <input className="co-input" placeholder={f.placeholder} value={form[f.key] || ''} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} />
                </div>
              ))}
              <div className="co-field">
                <label className="co-label">Sector</label>
                <select className="co-input" value={form.sector} onChange={e => setForm(p => ({...p, sector: e.target.value}))}>
                  {SECTORS.filter(s=>s!=='All').map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="co-field">
                <label className="co-label">Status</label>
                <select className="co-input" value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="pd-btn pd-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" onClick={saveCompany}>{editTarget ? 'Save Changes' : 'Add Company'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
