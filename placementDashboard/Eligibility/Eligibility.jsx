import { useState, useMemo } from 'react';
import { useToast } from '@ctx/ToastContext';
import './Eligibility.css';

const ALL_STUDENTS = [
  { roll: 'CS21B1042', name: 'Ananya Sharma', branch: 'CS', cgpa: 8.94, backlogs: 0, batch: 2021, email: 'ananya@college.edu.in' },
  { roll: 'CS21B1087', name: 'Rahul Mehta',   branch: 'CS', cgpa: 7.65, backlogs: 0, batch: 2021, email: 'rahul@college.edu.in' },
  { roll: 'CS21B1055', name: 'Sneha Roy',      branch: 'CS', cgpa: 9.05, backlogs: 0, batch: 2021, email: 'sneha@college.edu.in' },
  { roll: 'EC21B1015', name: 'Priya Singh',    branch: 'EC', cgpa: 9.21, backlogs: 0, batch: 2021, email: 'priya@college.edu.in' },
  { roll: 'ME21B1033', name: 'Arjun Verma',    branch: 'ME', cgpa: 8.10, backlogs: 0, batch: 2021, email: 'arjun@college.edu.in' },
  { roll: 'CS21B1020', name: 'Arvind Swamy',   branch: 'CS', cgpa: 8.20, backlogs: 0, batch: 2021, email: 'arvind@college.edu.in' },
  { roll: 'CS21B1099', name: 'Kirti Sen',      branch: 'CS', cgpa: 7.10, backlogs: 1, batch: 2021, email: 'kirti@college.edu.in' },
  { roll: 'EC21B1028', name: 'Rohan Das',      branch: 'EC', cgpa: 7.80, backlogs: 0, batch: 2021, email: 'rohan@college.edu.in' },
  { roll: 'ME21B1011', name: 'Divya Kumar',    branch: 'ME', cgpa: 6.50, backlogs: 2, batch: 2021, email: 'divya@college.edu.in' },
  { roll: 'CS21B1060', name: 'Sanjay Patel',   branch: 'CS', cgpa: 8.75, backlogs: 0, batch: 2021, email: 'sanjay@college.edu.in' },
];

const DRIVES = [
  { id: 1, company: 'Google',    role: 'SWE',      cgpa: 8.0, backlogs: 0, branches: ['CS','EC'], batch: 2021 },
  { id: 2, company: 'Microsoft', role: 'SDE',       cgpa: 7.5, backlogs: 0, branches: ['CS'],       batch: 2021 },
  { id: 3, company: 'TCS',       role: 'Analyst',   cgpa: 6.0, backlogs: 0, branches: ['CS','EC','ME','CE','EE'], batch: 2021 },
  { id: 4, company: 'Amazon',    role: 'SDE-I',     cgpa: 7.0, backlogs: 0, branches: ['CS','EC'], batch: 2021 },
];

export default function Eligibility() {
  const showToast = useToast();
  const [selectedDrive, setSelectedDrive] = useState(DRIVES[0]);
  const [search, setSearch] = useState('');

  const eligible = useMemo(() => ALL_STUDENTS.filter(s =>
    s.cgpa >= selectedDrive.cgpa &&
    s.backlogs <= selectedDrive.backlogs &&
    selectedDrive.branches.includes(s.branch) &&
    s.batch === selectedDrive.batch
  ), [selectedDrive]);

  const filtered = eligible.filter(s => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q) || s.branch.toLowerCase().includes(q);
  });

  function exportCSV() {
    const rows = [['Roll', 'Name', 'Branch', 'CGPA', 'Backlogs', 'Email']];
    filtered.forEach(s => rows.push([s.roll, s.name, s.branch, s.cgpa, s.backlogs, s.email]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${selectedDrive.company}_eligible_students.csv`; a.click();
    showToast('Shortlist downloaded!', 'success');
  }

  function shortlistAll() {
    showToast(`${filtered.length} students shortlisted for ${selectedDrive.company}!`, 'success');
  }

  return (
    <div className="el-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Eligibility Engine</h1>
          <p className="page-sub">Auto-filter eligible students per drive based on CGPA, branch, backlogs &amp; batch</p>
        </div>
        <div className="pd-header-actions">
          <button className="pd-btn pd-btn-outline" onClick={exportCSV}>↓ Export CSV</button>
          <button className="pd-btn pd-btn-primary" onClick={shortlistAll}>Shortlist All</button>
        </div>
      </div>

      {/* Drive Selector */}
      <div className="el-drive-selector">
        <p className="co-label" style={{ marginBottom: '.5rem' }}>Select Drive to Filter</p>
        <div className="el-drive-cards">
          {DRIVES.map(d => (
            <button key={d.id} className={`el-drive-card${selectedDrive.id === d.id ? ' active' : ''}`} onClick={() => setSelectedDrive(d)}>
              <span className="el-drive-company">{d.company}</span>
              <span className="el-drive-role">{d.role}</span>
              <div className="el-drive-pills">
                <span className="dr-pill dr-pill-cgpa">≥ {d.cgpa} CGPA</span>
                <span className="dr-pill">{d.branches.join(', ')}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Criteria Banner */}
      <div className="el-criteria-banner">
        <span className="el-criteria-title">Active Filters for <strong>{selectedDrive.company} – {selectedDrive.role}</strong></span>
        <div className="el-criteria-pills">
          <span className="dr-pill dr-pill-cgpa">CGPA ≥ {selectedDrive.cgpa}</span>
          <span className="dr-pill dr-pill-warn">Backlogs ≤ {selectedDrive.backlogs}</span>
          {selectedDrive.branches.map(b => <span key={b} className="dr-pill">{b}</span>)}
          <span className="dr-pill">Batch {selectedDrive.batch}</span>
        </div>
        <span className="el-eligible-count">{eligible.length} students eligible</span>
      </div>

      {/* Search & Table */}
      <div className="pd-card">
        <div className="pd-card-header">
          <div className="lib-search-wrap" style={{ flex: 1 }}>
            <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="lib-search" type="search" placeholder="Search by name, roll or branch…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="el-count-label">{filtered.length} students</span>
        </div>
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr><th>Roll No.</th><th>Name</th><th>Branch</th><th>CGPA</th><th>Backlogs</th><th>Email</th><th>Eligibility</th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.roll}>
                  <td><code>{s.roll}</code></td>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.branch}</td>
                  <td><span className={`el-cgpa ${s.cgpa >= selectedDrive.cgpa ? 'pass' : 'fail'}`}>{s.cgpa}</span></td>
                  <td><span className={`el-cgpa ${s.backlogs <= selectedDrive.backlogs ? 'pass' : 'fail'}`}>{s.backlogs}</span></td>
                  <td className="co-email">{s.email}</td>
                  <td><span className="pd-badge pd-badge-completed">✅ Eligible</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="co-empty">No eligible students for the current drive criteria.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
