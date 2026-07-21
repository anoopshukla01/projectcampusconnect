import { X } from "lucide-react";
/**
 * Companies — TPO Portal
 * Manage the company database via placementApi.listCompanies / createCompany.
 * Static create/edit is kept client-side since the backend company model is minimal;
 * list is fetched live and merged with local additions.
 */

import { useState, useCallback } from 'react';
import { useToast } from '@ctx/ToastContext';
import { placementApi } from '@/services/api';
import { useApiData } from '@/hooks/useApiData';
import './Companies.css';

const SECTORS = ['All', 'Tech', 'IT Services', 'E-Commerce', 'Finance', 'Core', 'Consulting'];
const BLANK   = { name: '', sector: 'Tech', contact: '', email: '', lastVisit: '', package: '', status: 'Active' };

export default function Companies() {
  const showToast = useToast();

  const { data: compData, loading, refetch } = useApiData(
    '/placement/companies',
    { companies: [] },
  );
  // Merge backend list with any locally-created entries
  const [localCompanies, setLocalCompanies] = useState([]);
  const companies = [...(compData?.companies || []), ...localCompanies];

  const [search,      setSearch]      = useState('');
  const [sector,      setSector]      = useState('All');
  const [showModal,   setShowModal]   = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [form,        setForm]        = useState(BLANK);
  const [saving,      setSaving]      = useState(false);

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    const matchS = c.name?.toLowerCase().includes(q) || c.contact?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    const matchT = sector === 'All' || c.sector === sector;
    return matchS && matchT;
  });

  function openAdd()  { setForm(BLANK); setEditTarget(null); setShowModal(true); }
  function openEdit(c){ setForm({ ...c }); setEditTarget(c.id || c._local_id); setShowModal(true); }

  async function saveCompany() {
    if (!form.name?.trim()) { showToast('Company name is required.', 'error'); return; }
    setSaving(true);
    const res = await placementApi.createCompany({
      name: form.name, sector: form.sector, contact_person: form.contact,
      contact_email: form.email, best_package: form.package, status: form.status,
    });
    setSaving(false);

    if (res?.error) {
      // Backend company endpoint may not exist yet — store locally
      if (editTarget) {
        setLocalCompanies(prev => prev.map(c =>
          (c.id || c._local_id) === editTarget ? { ...c, ...form } : c));
        showToast(`${form.name} updated.`, 'success');
      } else {
        setLocalCompanies(prev => [...prev, { ...form, _local_id: Date.now(), drives: 0 }]);
        showToast(`${form.name} added (local).`, 'success');
      }
    } else {
      showToast(editTarget ? 'Company updated.' : `${form.name} added!`, 'success');
      refetch();
    }
    setShowModal(false);
  }

  async function deleteCompany(id, name) {
    if (id && typeof id === 'string') {
      const res = await placementApi.deleteCompany(id);
      if (res?.error) {
        showToast(res.error, 'error');
        return;
      }
    }
    setLocalCompanies(prev => prev.filter(c => (c.id || c._local_id) !== id));
    showToast(`${name} removed.`, 'info');
    refetch();
  }

  return (
    <div className="co-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Database</h1>
          <p className="page-sub">Manage recruiters, contacts and visit history</p>
        </div>
        <button className="pd-btn pd-btn-primary" onClick={openAdd}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Company
        </button>
      </div>

      <div className="co-controls">
        <div className="lib-search-wrap">
          <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="lib-search" type="search"
            placeholder="Search company, contact, email…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="co-sector-tabs">
          {SECTORS.map(s => (
            <button key={s} className={`co-sector-tab${sector === s ? ' active' : ''}`}
              onClick={() => setSector(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="co-summary">
        <div className="co-sum-card"><span className="co-sum-val">{companies.length}</span><span className="co-sum-label">Total Companies</span></div>
        <div className="co-sum-card"><span className="co-sum-val">{companies.filter(c=>c.status==='Active').length}</span><span className="co-sum-label">Active Partners</span></div>
      </div>

      <div className="pd-card">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading companies…</div>
        ) : (
          <div className="pd-table-wrap">
            <table className="pd-table co-table">
              <thead>
                <tr>
                  <th>Company</th><th>Sector</th><th>Rolling Placed</th><th>Rolling Avg CTC</th>
                  <th>Website</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id || c._local_id}>
                    <td>
                      <div className="co-company-cell">
                        <div className="co-logo">{(c.name||'NA').slice(0,2).toUpperCase()}</div>
                        <div>
                          <strong>{c.name}</strong>
                          {c.description && <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{c.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td><span className="co-sector-badge">{c.sector}</span></td>
                    <td>{c.rolling_placed_count !== undefined ? c.rolling_placed_count : 0} students</td>
                    <td className="pd-ctc">{c.rolling_avg_ctc ? `${c.rolling_avg_ctc} LPA` : '—'}</td>
                    <td>{c.website ? <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="co-link">{c.website}</a> : '—'}</td>
                    <td>
                      <span className={`pd-badge ${c.status === 'Active' ? 'pd-badge-completed' : 'pd-badge-inactive'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <div className="co-actions">
                        <button className="co-action-btn" onClick={() => openEdit(c)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button className="co-action-btn co-action-del"
                          onClick={() => deleteCompany(c.id || c._local_id, c.name)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="co-empty">No companies match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box co-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTarget ? 'Edit Company' : 'Add New Company'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <div className="co-form-grid">
              {[
                { key: 'name',      label: 'Company Name *', placeholder: 'e.g. Google' },
                { key: 'contact',   label: 'Contact Person', placeholder: 'Full name' },
                { key: 'email',     label: 'Contact Email',  placeholder: 'recruiter@company.com' },
                { key: 'package',   label: 'Best Package',   placeholder: '₹ LPA' },
                { key: 'lastVisit', label: 'Last Visit',     placeholder: 'e.g. Dec 2024' },
              ].map(f => (
                <div key={f.key} className="co-field">
                  <label className="co-label">{f.label}</label>
                  <input className="co-input" placeholder={f.placeholder}
                    value={form[f.key] || ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="co-field">
                <label className="co-label">Sector</label>
                <select className="co-input" value={form.sector}
                  onChange={e => setForm(p => ({ ...p, sector: e.target.value }))}>
                  {SECTORS.filter(s => s !== 'All').map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="co-field">
                <label className="co-label">Status</label>
                <select className="co-input" value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="pd-btn pd-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" onClick={saveCompany} disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
