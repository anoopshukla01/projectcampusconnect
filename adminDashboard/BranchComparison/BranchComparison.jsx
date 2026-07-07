import { useState, useEffect } from 'react';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';

const branchMap = {
  "Computer Science": { code: "CS", hod: "Dr. Vikram Mehta", color: "#6366f1" },
  "Information Technology": { code: "IT", hod: "Dr. Priya Kapoor", color: "#22c55e" },
  "Electronics & Comm.": { code: "EC", hod: "Dr. Anjali Rao", color: "#3b82f6" },
  "Mechanical Engg.": { code: "ME", hod: "Dr. Suresh Kumar", color: "#f59e0b" },
  "Civil Engg.": { code: "CE", hod: "Dr. Ramesh Iyer", color: "#ef4444" },
  "Electrical Engg.": { code: "EE", hod: "Dr. Poonam Sharma", color: "#8b5cf6" },
  "Chemical Engg.": { code: "CH", hod: "Dr. Alok Saxena", color: "#14b8a6" },
  "Biotechnology": { code: "BT", hod: "Dr. Neha Bose", color: "#f43f5e" }
};

const STATUS_OPTS = ['All','good','warn','low'];
const STATUS_LABEL = { good:'🟢 Strong', warn:'🟡 Needs Attention', low:'🔴 Lagging' };
const TAG_CLASS    = { good:'ad-branch-tag-good', warn:'ad-branch-tag-warn', low:'ad-branch-tag-low' };

export default function BranchComparison() {
  const showToast = useToast();
  const [filter, setFilter]   = useState('All');
  const [sort, setSort]       = useState('pct');
  const [view, setView]       = useState('cards');
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/admin/analytics/placement', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          const list = (data.branch_performance || []).map(b => {
            const info = branchMap[b.branch] || { code: b.branch.slice(0, 2).toUpperCase(), hod: "TBD", color: "#6366f1" };
            
            // Determine status based on placement percentage
            let status = 'good';
            if (b.placement_pct < 30) status = 'low';
            else if (b.placement_pct < 50) status = 'warn';

            // Recommendations
            let rec = null;
            if (status === 'low') rec = `Critical: Industry tie-ups and training required urgently.`;
            else if (status === 'warn') rec = `Upskilling and placement training recommended.`;

            return {
              code: info.code,
              name: b.branch,
              students: b.total_students,
              placed: b.placed_students,
              avgPkg: data.avg_package_lpa || 0,
              companies: 0,
              pct: b.placement_pct,
              color: info.color,
              status,
              hod: info.hod,
              rec
            };
          });
          setBranches(list);
        }
      } catch (err) {
        console.error('Error fetching branch performance:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const sorted = [...branches]
    .filter(b => filter==='All' || b.status===filter)
    .sort((a,b) => sort==='pct' ? b.pct-a.pct : sort==='pkg' ? b.avgPkg-a.avgPkg : sort==='students' ? b.students-a.students : 0);

  function contactHOD(b) {
    showToast(`Email drafted to HOD: ${b.hod} (${b.code} Dept).`, 'default', 2500);
  }
  function allocateTraining(b) {
    showToast(`Training resource allocation request sent for ${b.code} dept.`, 'success', 2500);
  }

  const overall = {
    totalEligible: branches.reduce((s,b) => s+b.students, 0),
    totalPlaced:   branches.reduce((s,b) => s+b.placed, 0),
    avgPct:        branches.length > 0 ? Math.round(branches.reduce((s,b)=>s+b.pct,0)/branches.length) : 0,
  };

  return (
    <div className="ad-root">
      <div className="page-header">
        <div><h1 className="page-title">Branch / Department Comparison</h1><p className="page-sub">Identify placement-ready vs lagging departments · Allocate training resources with data</p></div>
      </div>

      {/* Overall Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1.25rem'}}>
        {[
          { label:'Total Eligible Students', value:loading ? '...' : overall.totalEligible, color:'#6366f1' },
          { label:'Total Placed',            value:loading ? '...' : overall.totalPlaced,   color:'#4ade80' },
          { label:'Overall Placement %',     value:loading ? '...' : `${overall.avgPct}%`,  color:'#fbbf24' },
        ].map(s => (
          <div key={s.label} className="ad-card" style={{padding:'1.25rem 1.35rem'}}>
            <div style={{fontSize:'2rem',fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:'.77rem',fontWeight:600,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'.06em',marginTop:'.35rem'}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bar Chart Comparison */}
      <div className="ad-card">
        <div className="ad-card-header">
          <h2 className="ad-card-title">Placement % — All Branches</h2>
          <span className="ad-badge ad-badge-info">Batch 2024–25</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          {branches.length > 0 ? [...branches].sort((a,b) => b.pct-a.pct).map(b => (
            <div key={b.code} style={{display:'flex',alignItems:'center',gap:'1rem'}}>
              <span style={{width:'36px',fontWeight:800,fontSize:'.82rem',color:'var(--text-primary)',flexShrink:0}}>{b.code}</span>
              <div style={{flex:1,height:'11px',background:'var(--border)',borderRadius:'999px',overflow:'hidden'}}>
                <div style={{width:`${b.pct}%`,height:'100%',background:b.color,borderRadius:'999px',transition:'width .7s'}}/>
              </div>
              <span style={{fontSize:'.78rem',fontWeight:700,color:b.color,width:'38px',textAlign:'right',flexShrink:0}}>{b.pct}%</span>
              <span style={{fontSize:'.75rem',color:'var(--text-secondary)',width:'80px',textAlign:'right',flexShrink:0}}>₹{b.avgPkg}L avg</span>
            </div>
          )) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1.5rem 0', textAlign: 'center' }}>
              No department data recorded in the database.
            </div>
          )}
        </div>
      </div>

      {/* Filter + Sort + View */}
      <div style={{display:'flex',gap:'.75rem',flexWrap:'wrap',alignItems:'center'}}>
        <div className="ad-tabs" style={{marginBottom:0,borderBottom:'none',paddingBottom:0}}>
          {STATUS_OPTS.map(s => <button key={s} className={`ad-tab${filter===s?' active':''}`} onClick={() => setFilter(s)}>{s==='All'?'All Departments':STATUS_LABEL[s]}</button>)}
        </div>
        <select className="ad-filter-select" value={sort} onChange={e=>setSort(e.target.value)} style={{marginLeft:'auto'}}>
          <option value="pct">Sort: Placement %</option>
          <option value="pkg">Sort: Avg Package</option>
          <option value="students">Sort: Students</option>
        </select>
        <div style={{display:'flex',gap:'.3rem'}}>
          {['cards','table'].map(v => (
            <button key={v} className={`ad-tab${view===v?' active':''}`} onClick={() => setView(v)} style={{padding:'.4rem .75rem'}}>
              {v==='cards'?'⊞ Cards':'☰ Table'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards View */}
      {view==='cards' && (
        <div className="ad-branch-grid">
          {sorted.length > 0 ? sorted.map(b => (
            <div key={b.code} className="ad-branch-card">
              <div className="ad-branch-header">
                <div>
                  <div className="ad-branch-name">{b.code}</div>
                  <div style={{fontSize:'.73rem',color:'var(--text-secondary)',marginTop:'.1rem'}}>{b.name}</div>
                </div>
                <span className={`ad-branch-tag ${TAG_CLASS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
              </div>
              <div className="ad-branch-stats">
                <div className="ad-branch-stat-item"><span className="ad-branch-stat-val">{b.pct}%</span><span className="ad-branch-stat-key">Placed</span></div>
                <div className="ad-branch-stat-item"><span className="ad-branch-stat-val">₹{b.avgPkg}L</span><span className="ad-branch-stat-key">Avg CTC</span></div>
                <div className="ad-branch-stat-item"><span className="ad-branch-stat-val">{b.placed}/{b.students}</span><span className="ad-branch-stat-key">Students</span></div>
                <div className="ad-branch-stat-item"><span className="ad-branch-stat-val">{b.companies}</span><span className="ad-branch-stat-key">Companies</span></div>
              </div>
              <div className="ad-branch-bar-wrap">
                <div className="ad-branch-bar" style={{width:`${b.pct}%`,background:b.color}}/>
              </div>
              {b.rec && (
                <div style={{marginTop:'.75rem',padding:'.5rem .7rem',borderRadius:'.6rem',background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',fontSize:'.73rem',color:'#f87171'}}>
                  ⚠ {b.rec}
                </div>
              )}
              <div style={{marginTop:'.75rem',display:'flex',gap:'.4rem'}}>
                <button className="ad-btn ad-btn-outline" style={{flex:1,padding:'.35rem',fontSize:'.72rem',justifyContent:'center'}} onClick={() => contactHOD(b)}>📧 HOD</button>
                {b.status!=='good' && <button className="ad-btn ad-btn-primary" style={{flex:1,padding:'.35rem',fontSize:'.72rem',justifyContent:'center'}} onClick={() => allocateTraining(b)}>📚 Train</button>}
              </div>
            </div>
          )) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '2rem 0', width: '100%', textAlign: 'center' }}>
              {loading ? 'Loading department data...' : 'No departments match the selected filter.'}
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {view==='table' && (
        <div className="ad-card">
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr><th>Branch</th><th>HOD</th><th>Students</th><th>Placed</th><th>%</th><th>Avg CTC</th><th>Companies</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {sorted.length > 0 ? sorted.map(b => (
                  <tr key={b.code}>
                    <td><strong>{b.code}</strong><div style={{fontSize:'.72rem',color:'var(--text-secondary)'}}>{b.name}</div></td>
                    <td style={{fontSize:'.8rem',color:'var(--text-secondary)'}}>{b.hod}</td>
                    <td>{b.students}</td>
                    <td style={{fontWeight:700}}>{b.placed}</td>
                    <td style={{fontWeight:800,color:b.color}}>{b.pct}%</td>
                    <td style={{color:'#4ade80',fontWeight:700}}>₹{b.avgPkg}L</td>
                    <td>{b.companies}</td>
                    <td><span className={`ad-branch-tag ${TAG_CLASS[b.status]}`}>{STATUS_LABEL[b.status]}</span></td>
                    <td>
                      <div style={{display:'flex',gap:'.35rem'}}>
                        <button className="ad-btn ad-btn-outline" style={{padding:'.28rem .6rem',fontSize:'.72rem'}} onClick={() => contactHOD(b)}>📧</button>
                        {b.status!=='good' && <button className="ad-btn ad-btn-primary" style={{padding:'.28rem .6rem',fontSize:'.72rem'}} onClick={() => allocateTraining(b)}>📚</button>}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="9" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1.5rem 0', textAlign: 'center' }}>
                      {loading ? 'Loading department data...' : 'No departments match the selected filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
