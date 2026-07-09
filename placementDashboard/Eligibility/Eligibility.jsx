/**
 * Eligibility — TPO Portal  (PL6)
 * Select a drive → auto-filter eligible students from backend.
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@ctx/ToastContext';
import { placementApi } from '@/services/api';
import './Eligibility.css';

export default function Eligibility() {
  const showToast = useToast();
  const [drives,         setDrives]         = useState([]);
  const [selectedDrive,  setSelectedDrive]  = useState(null);
  const [eligible,       setEligible]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [shortlisting,   setShortlisting]   = useState(false);

  const fetchDrives = useCallback(async () => {
    const res = await placementApi.listDrives();
    const list = res?.drives || [];
    setDrives(list);
    if (list.length > 0) {
      setSelectedDrive(list[0]);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchEligible = useCallback(async (driveId) => {
    setLoading(true);
    const res = await placementApi.getEligibleStudents(driveId);
    setLoading(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    setEligible(Array.isArray(res) ? res : []);
  }, []);

  useEffect(() => { fetchDrives(); }, [fetchDrives]);
  useEffect(() => { if (selectedDrive) fetchEligible(selectedDrive.id); }, [selectedDrive, fetchEligible]);

  const filtered = eligible.filter(s => {
    const q = search.toLowerCase();
    return s.full_name?.toLowerCase().includes(q) || s.roll_no?.toLowerCase().includes(q) || s.branch?.toLowerCase().includes(q);
  });

  function exportCSV() {
    const rows = [['Roll', 'Name', 'Branch', 'CGPA', 'Backlogs']];
    filtered.forEach(s => rows.push([s.roll_no, s.full_name, s.branch, s.cgpa, s.active_backlogs]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDrive?.company_name || 'drive'}_eligible.csv`;
    a.click();
    showToast('CSV exported!', 'success');
  }

  async function shortlistAll() {
    if (!selectedDrive || filtered.length === 0) return;
    setShortlisting(true);
    const ids = filtered.map(s => s.user_id);
    const res = await placementApi.bulkShortlist(selectedDrive.id, ids);
    setShortlisting(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`${filtered.length} students shortlisted for ${selectedDrive.company_name}!`, 'success', 3000);
  }

  return (
    <div className="el-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Eligibility Engine</h1>
          <p className="page-sub">Auto-filter eligible students per drive based on CGPA, branch, backlogs &amp; batch</p>
        </div>
        <div className="pd-header-actions">
          <button className="pd-btn pd-btn-outline" onClick={exportCSV} disabled={!selectedDrive || filtered.length === 0}>
            ↓ Export CSV
          </button>
          <button className="pd-btn pd-btn-primary" onClick={shortlistAll}
            disabled={shortlisting || !selectedDrive || filtered.length === 0}>
            {shortlisting ? 'Shortlisting…' : 'Shortlist All'}
          </button>
        </div>
      </div>

      {/* Drive Selector */}
      <div className="el-drive-selector">
        <p className="co-label" style={{ marginBottom: '.5rem' }}>Select Drive to Filter</p>
        {drives.length === 0 && !loading ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No drives available.</p>
        ) : (
          <div className="el-drive-cards">
            {drives.map(d => (
              <button key={d.id}
                className={`el-drive-card${selectedDrive?.id === d.id ? ' active' : ''}`}
                onClick={() => setSelectedDrive(d)}>
                <span className="el-drive-company">{d.company_name}</span>
                <span className="el-drive-role">{d.role_title}</span>
                <div className="el-drive-pills">
                  <span className="dr-pill dr-pill-cgpa">≥ {d.cgpa_cutoff} CGPA</span>
                  <span className="dr-pill">Batch {d.batch_year}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Criteria Banner */}
      {selectedDrive && (
        <div className="el-criteria-banner">
          <span className="el-criteria-title">
            Filters for <strong>{selectedDrive.company_name} — {selectedDrive.role_title}</strong>
          </span>
          <div className="el-criteria-pills">
            <span className="dr-pill dr-pill-cgpa">CGPA ≥ {selectedDrive.cgpa_cutoff}</span>
            <span className="dr-pill dr-pill-warn">Backlogs ≤ {selectedDrive.backlog_cutoff ?? 0}</span>
            <span className="dr-pill">Batch {selectedDrive.batch_year}</span>
          </div>
          <span className="el-eligible-count">{eligible.length} students eligible</span>
        </div>
      )}

      {/* Table */}
      <div className="pd-card">
        <div className="pd-card-header">
          <div className="lib-search-wrap" style={{ flex: 1 }}>
            <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="lib-search" type="search"
              placeholder="Search by name, roll or branch…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="el-count-label">{filtered.length} students</span>
        </div>
        <div className="pd-table-wrap">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
          ) : (
            <table className="pd-table">
              <thead>
                <tr><th>Roll No.</th><th>Name</th><th>Branch</th><th>CGPA</th><th>Backlogs</th><th>Eligibility</th></tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.user_id || s.roll_no}>
                    <td><code>{s.roll_no}</code></td>
                    <td><strong>{s.full_name}</strong></td>
                    <td>{s.branch}</td>
                    <td><span className="el-cgpa pass">{s.cgpa}</span></td>
                    <td><span className={`el-cgpa ${s.active_backlogs === 0 ? 'pass' : 'fail'}`}>{s.active_backlogs}</span></td>
                    <td><span className="pd-badge pd-badge-completed">✅ Eligible</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="co-empty">No eligible students for this drive.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
