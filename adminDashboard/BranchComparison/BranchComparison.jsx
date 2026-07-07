import { useState } from 'react';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';

const BRANCHES = [
  { code:'CS', name:'Computer Science',    students:120, placed:78, avgPkg:18.2, topPkg:42, companies:22, pct:65, color:'#6366f1', status:'good',   hod:'Dr. Vikram Mehta',   rec:null                                         },
  { code:'EC', name:'Electronics & Comm.', students:90,  placed:51, avgPkg:12.6, topPkg:28, companies:15, pct:57, color:'#3b82f6', status:'good',   hod:'Dr. Anjali Rao',     rec:null                                         },
  { code:'ME', name:'Mechanical Engg.',    students:72,  placed:28, avgPkg:7.4,  topPkg:14, companies:9,  pct:39, color:'#f59e0b', status:'warn',   hod:'Dr. Suresh Kumar',   rec:'Upskilling needed: Core + Coding'           },
  { code:'CE', name:'Civil Engg.',         students:58,  placed:18, avgPkg:6.8,  topPkg:12, companies:7,  pct:31, color:'#ef4444', status:'low',    hod:'Dr. Ramesh Iyer',    rec:'Critical: Training in AutoCAD + BIM urgent' },
  { code:'EE', name:'Electrical Engg.',    students:48,  placed:12, avgPkg:6.2,  topPkg:11, companies:5,  pct:25, color:'#8b5cf6', status:'low',    hod:'Dr. Poonam Sharma',  rec:'Critical: Only 5 companies visited this year'},
  { code:'CH', name:'Chemical Engg.',      students:40,  placed:10, avgPkg:6.0,  topPkg:10, companies:4,  pct:25, color:'#14b8a6', status:'low',    hod:'Dr. Alok Saxena',    rec:'Critical: Industry tie-ups required urgently'},
  { code:'IT', name:'Information Tech.',   students:95,  placed:55, avgPkg:14.8, topPkg:32, companies:18, pct:58, color:'#22c55e', status:'good',   hod:'Dr. Priya Kapoor',   rec:null                                         },
  { code:'BT', name:'Biotechnology',       students:35,  placed:8,  avgPkg:5.5,  topPkg:9,  companies:3,  pct:23, color:'#f43f5e', status:'low',    hod:'Dr. Neha Bose',      rec:'Critical: Very low industry engagement'     },
];

const STATUS_OPTS = ['All','good','warn','low'];
const STATUS_LABEL = { good:'🟢 Strong', warn:'🟡 Needs Attention', low:'🔴 Lagging' };
const TAG_CLASS    = { good:'ad-branch-tag-good', warn:'ad-branch-tag-warn', low:'ad-branch-tag-low' };

export default function BranchComparison() {
  const showToast = useToast();
  const [filter, setFilter]   = useState('All');
  const [sort, setSort]       = useState('pct');
  const [view, setView]       = useState('cards');

  const sorted = [...BRANCHES]
    .filter(b => filter==='All' || b.status===filter)
    .sort((a,b) => sort==='pct' ? b.pct-a.pct : sort==='pkg' ? b.avgPkg-a.avgPkg : sort==='students' ? b.students-a.students : 0);

  function contactHOD(b) {
    showToast(`Email drafted to HOD: ${b.hod} (${b.code} Dept). (Demo)`, 'default', 2500);
  }
  function allocateTraining(b) {
    showToast(`Training resource allocation request sent for ${b.code} dept.`, 'success', 2500);
  }

  const overall = {
    totalStudents: BRANCHES.reduce((s,b) => s+b.students, 0),
    totalPlaced:   BRANCHES.reduce((s,b) => s+b.placed, 0),
    avgPct:        Math.round(BRANCHES.reduce((s,b)=>s+b.pct,0)/BRANCHES.length),
  };

  return (
    <div className="ad-root">
      <div className="page-header">
        <div><h1 className="page-title">Branch / Department Comparison</h1><p className="page-sub">Identify placement-ready vs lagging departments · Allocate training resources with data</p></div>
      </div>

      {/* Overall Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1.25rem'}}>
        {[
          { label:'Total Eligible Students', value:overall.totalStudents, color:'#6366f1' },
          { label:'Total Placed',            value:overall.totalPlaced,   color:'#4ade80' },
          { label:'Overall Placement %',     value:`${overall.avgPct}%`,  color:'#fbbf24' },
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
          {[...BRANCHES].sort((a,b) => b.pct-a.pct).map(b => (
            <div key={b.code} style={{display:'flex',alignItems:'center',gap:'1rem'}}>
              <span style={{width:'36px',fontWeight:800,fontSize:'.82rem',color:'var(--text-primary)',flexShrink:0}}>{b.code}</span>
              <div style={{flex:1,height:'11px',background:'var(--border)',borderRadius:'999px',overflow:'hidden'}}>
                <div style={{width:`${b.pct}%`,height:'100%',background:b.color,borderRadius:'999px',transition:'width .7s'}}/>
              </div>
              <span style={{fontSize:'.78rem',fontWeight:700,color:b.color,width:'38px',textAlign:'right',flexShrink:0}}>{b.pct}%</span>
              <span style={{fontSize:'.75rem',color:'var(--text-secondary)',width:'80px',textAlign:'right',flexShrink:0}}>₹{b.avgPkg}L avg</span>
            </div>
          ))}
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
          {sorted.map(b => (
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
          ))}
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
                {sorted.map(b => (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
