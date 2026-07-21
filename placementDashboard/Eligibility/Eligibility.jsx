import { X } from "lucide-react";
/**
 * Eligibility — TPO Portal (PL6)
 * Select a drive → auto-filter and rank eligible students using weighted scoring,
 * and provide TPO manual overrides (rank, exclude, notes).
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

  // Override modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideStudent,    setOverrideStudent]    = useState(null);
  const [overrideForm,       setOverrideForm]       = useState({ excluded: false, rank: '', notes: '' });
  const [savingOverride,     setSavingOverride]     = useState(false);

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
    setEligible(res?.students || []);
  }, [showToast]);

  useEffect(() => { fetchDrives(); }, [fetchDrives]);
  useEffect(() => { if (selectedDrive) fetchEligible(selectedDrive.id); }, [selectedDrive, fetchEligible]);

  const filtered = eligible.filter(s => {
    const q = search.toLowerCase();
    return s.full_name?.toLowerCase().includes(q) || s.roll_no?.toLowerCase().includes(q) || s.branch?.toLowerCase().includes(q);
  });

  function exportCSV() {
    const rows = [['Rank', 'Roll', 'Name', 'Branch', 'CGPA', 'Weighted Score', 'Excluded', 'Notes']];
    filtered.forEach(s => rows.push([s.rank, s.roll_no, s.full_name, s.branch, s.cgpa, s.score, s.is_excluded ? 'Yes' : 'No', s.notes]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDrive?.company_name || 'drive'}_eligible_ranks.csv`;
    a.click();
    showToast('CSV exported!', 'success');
  }

  async function shortlistAll() {
    if (!selectedDrive || filtered.length === 0) return;
    setShortlisting(true);
    // Only shortlist non-excluded students
    const activeStudents = filtered.filter(s => !s.is_excluded);
    const ids = activeStudents.map(s => s.student_id);
    const res = await placementApi.bulkShortlist(selectedDrive.id, ids);
    setShortlisting(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`${activeStudents.length} students shortlisted for ${selectedDrive.company_name}!`, 'success', 3000);
  }

  function openOverride(student) {
    setOverrideStudent(student);
    setOverrideForm({
      excluded: student.is_excluded,
      rank: student.override_rank !== null ? String(student.override_rank) : '',
      notes: student.notes || ''
    });
    setShowOverrideModal(true);
  }

  async function saveOverride() {
    if (!selectedDrive || !overrideStudent) return;
    setSavingOverride(true);
    try {
      const rankVal = overrideForm.rank.trim() ? parseInt(overrideForm.rank) : null;
      const res = await fetch(`/api/v1/placement/drives/${selectedDrive.id}/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          student_id: overrideStudent.student_id,
          excluded: overrideForm.excluded,
          rank: rankVal,
          notes: overrideForm.notes
        })
      });
      if (res.ok) {
        showToast('Override saved.', 'success');
        setShowOverrideModal(false);
        fetchEligible(selectedDrive.id);
      } else {
        showToast('Failed to save override.', 'error');
      }
    } catch (e) {
      showToast('Network error saving override.', 'error');
    }
    setSavingOverride(false);
  }

  return (
    <div className="el-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Eligibility &amp; Ranks</h1>
          <p className="page-sub">Auto-filter and rank eligible students using weighted scoring formula, and adjust manually</p>
        </div>
        <div className="pd-header-actions">
          <button className="pd-btn pd-btn-outline" onClick={exportCSV} disabled={!selectedDrive || filtered.length === 0}>
            Export CSV
          </button>
          <button className="pd-btn pd-btn-primary" onClick={shortlistAll}
            disabled={shortlisting || !selectedDrive || filtered.length === 0}>
            {shortlisting ? 'Shortlisting…' : 'Shortlist Active'}
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
        <div className="el-criteria-banner" style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <span className="el-criteria-title" style={{ display: 'block', fontWeight: 600 }}>
              Filters for <strong>{selectedDrive.company_name} — {selectedDrive.role_title}</strong>
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Formula: CGPA (40%) + Grades (20%) + Resume overlap (15%) + Event participation (15%) + GitHub connected (10%)
            </span>
          </div>
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
                <tr>
                  <th>Rank</th><th>Roll No.</th><th>Name</th><th>Branch</th>
                  <th>CGPA</th><th>Weighted Score</th><th>GitHub / CV</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.student_id} className={s.is_excluded ? 'excluded-row' : ''} style={s.is_excluded ? { opacity: 0.6 } : {}}>
                    <td>
                      <span className="el-rank-num">#{s.rank}</span>
                      {s.override_rank !== null && <span style={{ fontSize: '0.7rem', color: '#38bdf8', display: 'block' }}>(manual)</span>}
                    </td>
                    <td><code>{s.roll_no}</code></td>
                    <td>
                      <strong>{s.full_name}</strong>
                      {s.notes && <p style={{ fontSize: '0.7rem', color: '#e2e8f0', margin: 0 }}>Note: {s.notes}</p>}
                    </td>
                    <td>{s.branch}</td>
                    <td><span className="el-cgpa pass">{s.cgpa}</span></td>
                    <td><strong>{s.score}</strong></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {s.github_url ? (
                          <a href={s.github_url} target="_blank" rel="noreferrer" title="GitHub Profile">
                            <span style={{ fontSize: '0.8rem', color: '#818cf8' }}>[GitHub]</span>
                          </a>
                        ) : <span style={{ fontSize: '0.8rem', color: '#475569' }}>—</span>}
                        {s.skills && <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.3rem', borderRadius: 4 }}>CV parsed</span>}
                      </div>
                    </td>
                    <td>
                      {s.is_excluded ? (
                        <span className="pd-badge pd-badge-inactive">Excluded</span>
                      ) : (
                        <span className="pd-badge pd-badge-completed">Eligible</span>
                      )}
                    </td>
                    <td>
                      <button className="pd-btn pd-btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => openOverride(s)}>
                        Override
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="co-empty">No eligible students for this drive.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Override Modal */}
      {showOverrideModal && overrideStudent && (
        <div className="modal-overlay" onClick={() => setShowOverrideModal(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Override Eligibility: {overrideStudent.full_name}</h2>
              <button className="modal-close" onClick={() => setShowOverrideModal(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#fff' }}>
                <input type="checkbox" checked={overrideForm.excluded}
                  onChange={e => setOverrideForm(p => ({ ...p, excluded: e.target.checked }))} />
                Exclude student from active recruitment
              </label>

              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Manual Override Rank (optional)
                <input type="number" placeholder="Enter custom rank number" className="co-input" style={{ width: '100%', marginTop: '0.3rem' }}
                  value={overrideForm.rank} onChange={e => setOverrideForm(p => ({ ...p, rank: e.target.value }))} />
              </label>

              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Override Notes
                <input placeholder="Reason for override…" className="co-input" style={{ width: '100%', marginTop: '0.3rem' }}
                  value={overrideForm.notes} onChange={e => setOverrideForm(p => ({ ...p, notes: e.target.value }))} />
              </label>
            </div>
            <div className="modal-footer" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="pd-btn pd-btn-outline" onClick={() => setShowOverrideModal(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" onClick={saveOverride} disabled={savingOverride}>
                {savingOverride ? 'Saving…' : 'Save Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
