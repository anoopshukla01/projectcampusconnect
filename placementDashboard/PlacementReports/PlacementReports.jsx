import { useToast } from '@ctx/ToastContext';
import './PlacementReports.css';

const BRANCH_DATA = [
  { branch: 'Computer Science',         total: 120, placed: 78, avg: 14.2, highest: 42.0, companies: 18 },
  { branch: 'Electronics & Comm.',      total: 90,  placed: 51, avg: 10.8, highest: 28.0, companies: 12 },
  { branch: 'Mechanical Engineering',   total: 72,  placed: 28, avg: 7.5,  highest: 14.0, companies: 8  },
  { branch: 'Civil Engineering',        total: 58,  placed: 18, avg: 6.2,  highest: 9.5,  companies: 5  },
  { branch: 'Electrical Engineering',   total: 48,  placed: 12, avg: 7.8,  highest: 16.0, companies: 6  },
];

const YOY_DATA = [
  { year: '2020–21', placed: 142, total: 310, avg: 8.2,  highest: 24.0 },
  { year: '2021–22', placed: 158, total: 315, avg: 9.5,  highest: 28.0 },
  { year: '2022–23', placed: 175, total: 320, avg: 11.2, highest: 36.0 },
  { year: '2023–24', placed: 187, total: 320, avg: 12.4, highest: 42.0 },
];

const TOP_RECRUITERS = [
  { name: 'TCS',       hired: 62, ctc: '₹7 LPA' },
  { name: 'Infosys',   hired: 55, ctc: '₹6.5 LPA' },
  { name: 'Wipro',     hired: 28, ctc: '₹6 LPA' },
  { name: 'Google',    hired: 8,  ctc: '₹42 LPA' },
  { name: 'Microsoft', hired: 6,  ctc: '₹38 LPA' },
  { name: 'Amazon',    hired: 4,  ctc: '₹28 LPA' },
];

export default function PlacementReports() {
  const showToast = useToast();

  const total = BRANCH_DATA.reduce((s, b) => s + b.total, 0);
  const placed = BRANCH_DATA.reduce((s, b) => s + b.placed, 0);
  const overallPct = Math.round((placed / total) * 100);
  const maxBar = Math.max(...BRANCH_DATA.map(b => b.placed));

  function printReport() {
    showToast('Opening print dialog…', 'info');
    setTimeout(() => window.print(), 400);
  }

  function exportCSV() {
    const rows = [['Branch', 'Total', 'Placed', 'Placement %', 'Avg CTC', 'Highest CTC', 'Companies']];
    BRANCH_DATA.forEach(b => rows.push([b.branch, b.total, b.placed, `${Math.round(b.placed/b.total*100)}%`, `₹${b.avg} LPA`, `₹${b.highest} LPA`, b.companies]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'placement_report_2024.csv'; a.click();
    showToast('Report exported!', 'success');
  }

  return (
    <div className="pr-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement Reports</h1>
          <p className="page-sub">Branch-wise stats, year-on-year trends and NAAC-ready summaries</p>
        </div>
        <div className="pd-header-actions">
          <button className="pd-btn pd-btn-outline" onClick={exportCSV}>↓ Export CSV</button>
          <button className="pd-btn pd-btn-primary" onClick={printReport}>🖨 Print PDF</button>
        </div>
      </div>

      {/* NAAC Summary Banner */}
      <div className="pr-naac-banner">
        <div className="pr-naac-title">NAAC / NBA Placement Summary — Batch 2021</div>
        <div className="pr-naac-stats">
          <div className="pr-naac-stat"><span className="pr-naac-val">{placed}</span><span className="pr-naac-lbl">Students Placed</span></div>
          <div className="pr-naac-stat"><span className="pr-naac-val">{overallPct}%</span><span className="pr-naac-lbl">Placement Rate</span></div>
          <div className="pr-naac-stat"><span className="pr-naac-val">₹12.4 LPA</span><span className="pr-naac-lbl">Average CTC</span></div>
          <div className="pr-naac-stat"><span className="pr-naac-val">₹42 LPA</span><span className="pr-naac-lbl">Highest Package</span></div>
          <div className="pr-naac-stat"><span className="pr-naac-val">34</span><span className="pr-naac-lbl">Companies Visited</span></div>
        </div>
      </div>

      <div className="pr-grid">
        {/* Branch-wise Bar Chart */}
        <div className="pd-card pr-chart-card">
          <div className="pd-card-header"><h2 className="pd-card-title">Branch-wise Placement</h2></div>
          <div className="pr-chart">
            {BRANCH_DATA.map(b => {
              const pct = Math.round((b.placed / b.total) * 100);
              const barH = Math.round((b.placed / maxBar) * 160);
              return (
                <div key={b.branch} className="pr-bar-col">
                  <span className="pr-bar-val">{b.placed}</span>
                  <div className="pr-bar-wrap">
                    <div className="pr-bar" style={{ height: barH + 'px' }} title={`${b.branch}: ${pct}%`} />
                  </div>
                  <span className="pr-bar-label">{b.branch.split(' ')[0]}</span>
                  <span className="pr-bar-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Recruiters */}
        <div className="pd-card pr-recruiter-card">
          <div className="pd-card-header"><h2 className="pd-card-title">Top Recruiters</h2></div>
          <div className="pr-recruiter-list">
            {TOP_RECRUITERS.map((r, i) => (
              <div key={r.name} className="pr-recruiter-row">
                <span className="pr-rank">#{i + 1}</span>
                <div className="co-logo">{r.name.slice(0,2).toUpperCase()}</div>
                <span className="pr-recruiter-name">{r.name}</span>
                <span className="pr-recruiter-hired">{r.hired} hired</span>
                <span className="pr-recruiter-ctc">{r.ctc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Year-on-Year Table */}
      <div className="pd-card">
        <div className="pd-card-header"><h2 className="pd-card-title">Year-on-Year Comparison</h2></div>
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr><th>Batch Year</th><th>Total Students</th><th>Placed</th><th>Placement %</th><th>Avg Package</th><th>Highest Package</th></tr>
            </thead>
            <tbody>
              {YOY_DATA.map(y => (
                <tr key={y.year}>
                  <td><strong>{y.year}</strong></td>
                  <td>{y.total}</td>
                  <td>{y.placed}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 999 }}>
                        <div style={{ width: `${Math.round(y.placed/y.total*100)}%`, height: '100%', background: '#6366f1', borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: '.8rem', fontWeight: 700 }}>{Math.round(y.placed/y.total*100)}%</span>
                    </div>
                  </td>
                  <td className="pd-ctc">₹{y.avg} LPA</td>
                  <td className="pd-ctc">₹{y.highest} LPA</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Branch Detail Table */}
      <div className="pd-card">
        <div className="pd-card-header"><h2 className="pd-card-title">Branch-wise Detailed Report</h2></div>
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr><th>Branch</th><th>Total</th><th>Placed</th><th>Rate</th><th>Avg CTC</th><th>Highest CTC</th><th>Companies</th></tr>
            </thead>
            <tbody>
              {BRANCH_DATA.map(b => {
                const pct = Math.round((b.placed / b.total) * 100);
                return (
                  <tr key={b.branch}>
                    <td><strong>{b.branch}</strong></td>
                    <td>{b.total}</td>
                    <td>{b.placed}</td>
                    <td>
                      <span style={{ color: pct >= 50 ? '#4ade80' : pct >= 30 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>{pct}%</span>
                    </td>
                    <td className="pd-ctc">₹{b.avg} LPA</td>
                    <td className="pd-ctc">₹{b.highest} LPA</td>
                    <td>{b.companies}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
