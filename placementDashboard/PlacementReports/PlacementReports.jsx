/**
 * PlacementReports — TPO Portal  (PL15)
 * Reads live stats from /placement/stats and renders NAAC-ready summary.
 * Falls back gracefully to empty state while loading.
 */

import { useToast } from '@ctx/ToastContext';
import { useApiData } from '@/hooks/useApiData';
import './PlacementReports.css';

export default function PlacementReports() {
  const showToast = useToast();

  const { data: statsData, loading } = useApiData(
    '/placement/stats',
    { branch_stats: [], yoy: [], top_recruiters: [], placed: 0, total_students: 0,
      avg_package: '—', highest_package: '—', drives_this_year: 0 },
  );

  const s              = statsData || {};
  const branchData     = s.branch_stats   || [];
  const yoyData        = s.yoy            || [];
  const topRecruiters  = s.top_recruiters || [];
  const totalPlaced    = s.placed         || 0;
  const totalStudents  = s.total_students || 0;
  const overallPct     = totalStudents > 0 ? Math.round((totalPlaced / totalStudents) * 100) : 0;
  const maxBar         = Math.max(...branchData.map(b => b.placed || 0), 1);

  function printReport() {
    showToast('Opening print dialog…', 'info');
    setTimeout(() => window.print(), 400);
  }

  function exportCSV() {
    const rows = [['Branch','Total','Placed','Placement %','Avg CTC','Highest CTC','Companies']];
    branchData.forEach(b => {
      const pct = b.total > 0 ? Math.round((b.placed / b.total) * 100) : 0;
      rows.push([b.branch, b.total, b.placed, `${pct}%`,
                 `₹${b.avg_ctc ?? '—'} LPA`, `₹${b.highest_ctc ?? '—'} LPA`, b.companies ?? '—']);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'placement_report.csv'; a.click();
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

      {/* NAAC Summary */}
      <div className="pr-naac-banner">
        <div className="pr-naac-title">NAAC / NBA Placement Summary</div>
        <div className="pr-naac-stats">
          {[
            { val: loading ? '…' : totalPlaced,              lbl: 'Students Placed' },
            { val: loading ? '…' : `${overallPct}%`,         lbl: 'Placement Rate'  },
            { val: loading ? '…' : s.avg_package || '—',     lbl: 'Average CTC'     },
            { val: loading ? '…' : s.highest_package || '—', lbl: 'Highest Package' },
            { val: loading ? '…' : s.drives_this_year || 0,  lbl: 'Companies Visited'},
          ].map(x => (
            <div key={x.lbl} className="pr-naac-stat">
              <span className="pr-naac-val">{x.val}</span>
              <span className="pr-naac-lbl">{x.lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading report data…</div>
      ) : (
        <>
          <div className="pr-grid">
            {/* Bar Chart */}
            {branchData.length > 0 && (
              <div className="pd-card pr-chart-card">
                <div className="pd-card-header"><h2 className="pd-card-title">Branch-wise Placement</h2></div>
                <div className="pr-chart">
                  {branchData.map(b => {
                    const pct  = b.total > 0 ? Math.round((b.placed / b.total) * 100) : 0;
                    const barH = Math.round(((b.placed || 0) / maxBar) * 160);
                    return (
                      <div key={b.branch} className="pr-bar-col">
                        <span className="pr-bar-val">{b.placed}</span>
                        <div className="pr-bar-wrap">
                          <div className="pr-bar" style={{ height: barH + 'px' }} title={`${b.branch}: ${pct}%`} />
                        </div>
                        <span className="pr-bar-label">{b.branch}</span>
                        <span className="pr-bar-pct">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Recruiters */}
            {topRecruiters.length > 0 && (
              <div className="pd-card pr-recruiter-card">
                <div className="pd-card-header"><h2 className="pd-card-title">Top Recruiters</h2></div>
                <div className="pr-recruiter-list">
                  {topRecruiters.map((r, i) => (
                    <div key={r.name || i} className="pr-recruiter-row">
                      <span className="pr-rank">#{i + 1}</span>
                      <div className="co-logo">{(r.name || 'NA').slice(0,2).toUpperCase()}</div>
                      <span className="pr-recruiter-name">{r.name}</span>
                      <span className="pr-recruiter-hired">{r.hired} hired</span>
                      <span className="pr-recruiter-ctc">₹{r.ctc} LPA</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* YoY Table */}
          {yoyData.length > 0 && (
            <div className="pd-card">
              <div className="pd-card-header"><h2 className="pd-card-title">Year-on-Year Comparison</h2></div>
              <div className="pd-table-wrap">
                <table className="pd-table">
                  <thead>
                    <tr><th>Batch</th><th>Total</th><th>Placed</th><th>Rate</th><th>Avg Package</th><th>Highest</th></tr>
                  </thead>
                  <tbody>
                    {yoyData.map(y => (
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
                        <td className="pd-ctc">₹{y.avg_package} LPA</td>
                        <td className="pd-ctc">₹{y.highest_package} LPA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Branch Detail */}
          {branchData.length > 0 && (
            <div className="pd-card">
              <div className="pd-card-header"><h2 className="pd-card-title">Branch-wise Detailed Report</h2></div>
              <div className="pd-table-wrap">
                <table className="pd-table">
                  <thead>
                    <tr><th>Branch</th><th>Total</th><th>Placed</th><th>Rate</th><th>Avg CTC</th><th>Highest CTC</th><th>Companies</th></tr>
                  </thead>
                  <tbody>
                    {branchData.map(b => {
                      const pct = b.total > 0 ? Math.round((b.placed / b.total) * 100) : 0;
                      return (
                        <tr key={b.branch}>
                          <td><strong>{b.branch}</strong></td>
                          <td>{b.total}</td>
                          <td>{b.placed}</td>
                          <td><span style={{ color: pct >= 50 ? '#4ade80' : pct >= 30 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>{pct}%</span></td>
                          <td className="pd-ctc">{b.avg_ctc ? `₹${b.avg_ctc} LPA` : '—'}</td>
                          <td className="pd-ctc">{b.highest_ctc ? `₹${b.highest_ctc} LPA` : '—'}</td>
                          <td>{b.companies ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {branchData.length === 0 && yoyData.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              No placement data recorded yet. Stats will appear once drives complete.
            </div>
          )}
        </>
      )}
    </div>
  );
}
