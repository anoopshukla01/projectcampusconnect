import { useState } from 'react';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';

const ISSUES = [
  { id:'S003', name:'Priya Kapoor',    branch:'EC', fields:['Phone number','Resume','10th marksheet'], days:8,  severity:'high'   },
  { id:'S041', name:'Amit Verma',      branch:'ME', fields:['Resume','12th marksheet'],               days:14, severity:'high'   },
  { id:'S077', name:'Rohit Jaiswal',   branch:'CS', fields:['Phone number'],                          days:3,  severity:'medium' },
  { id:'S102', name:'Divya Nair',      branch:'EE', fields:['Photo','Address'],                       days:5,  severity:'medium' },
  { id:'S119', name:'Snehal Patil',    branch:'CE', fields:['Semester marksheet'],                    days:2,  severity:'low'    },
  { id:'S143', name:'Tarun Gupta',     branch:'CS', fields:['LinkedIn URL'],                          days:1,  severity:'low'    },
];

const CONSENT_DATA = [
  { label:'Data sharing consent given',      pct:94, color:'#22c55e' },
  { label:'Marketing opt-in',               pct:61, color:'#6366f1' },
  { label:'Third-party recruiter consent',  pct:79, color:'#3b82f6' },
  { label:'Background check authorised',    pct:88, color:'#f59e0b' },
];

const ACCESS_LOG = [
  { entity:'Google Recruiting',  type:'company',   accessed:'Resume bank',     date:'Dec 5, 09:14', students:48 },
  { entity:'TPO Admin',          type:'staff',     accessed:'CGPA export',     date:'Dec 4, 17:30', students:320},
  { entity:'Dr. Rohan Mehra',    type:'professor', accessed:'Student profiles', date:'Dec 4, 11:05', students:64 },
  { entity:'Microsoft HR',       type:'company',   accessed:'Resume bank',     date:'Dec 3, 14:20', students:36 },
  { entity:'Admin',              type:'admin',     accessed:'Full DB export',  date:'Dec 2, 10:00', students:1248},
];

const SEV_COLOR = { high:'ad-badge-inactive', medium:'ad-badge-pending', low:'ad-badge-info' };

export default function DataHealth() {
  const showToast = useToast();
  const [dismissed, setDismissed] = useState([]);

  const visible = ISSUES.filter(i => !dismissed.includes(i.id));
  const complete = Math.round(((ISSUES.length - visible.length + (1248 - ISSUES.length)) / 1248) * 100);
  const totalMissing = visible.reduce((s,i) => s+i.fields.length, 0);

  function dismiss(id) {
    setDismissed(prev => [...prev, id]);
    showToast('Issue marked as resolved.', 'success', 1800);
  }
  function remind(id) {
    const u = ISSUES.find(i=>i.id===id);
    showToast(`Reminder sent to ${u.name} to complete their profile.`, 'default', 2500);
  }
  function exportDPDP() {
    showToast('DPDP compliance report exported. (Demo mode)', 'success', 2500);
  }

  return (
    <div className="ad-root">
      <div className="page-header">
        <div><h1 className="page-title">Data Health & Compliance</h1><p className="page-sub">Profile completeness · DPDP Act compliance · Consent status</p></div>
        <div className="ad-header-actions">
          <button className="ad-btn ad-btn-outline" onClick={exportDPDP}>📋 DPDP Report</button>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1.25rem'}}>
        {[
          { label:'Profiles Complete',  value:`${complete}%`,     color:'#4ade80', icon:'✅', sub:`${1248-visible.length} of 1248 students` },
          { label:'Missing Fields',     value:totalMissing,        color:'#f87171', icon:'⚠️',  sub:`Across ${visible.length} students`       },
          { label:'Pending Verify',     value:visible.filter(i=>i.severity==='high').length, color:'#fbbf24', icon:'🔍', sub:'High severity items' },
          { label:'DPDP Compliant',     value:'94%',               color:'#818cf8', icon:'🛡️',  sub:'1,173 of 1,248 students'                 },
        ].map(c => (
          <div key={c.label} className="ad-card" style={{padding:'1.25rem 1.35rem'}}>
            <div style={{fontSize:'1.6rem',marginBottom:'.35rem'}}>{c.icon}</div>
            <div style={{fontSize:'1.8rem',fontWeight:800,color:c.color,lineHeight:1}}>{c.value}</div>
            <div style={{fontSize:'.77rem',fontWeight:600,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'.06em',marginTop:'.2rem'}}>{c.label}</div>
            <div style={{fontSize:'.72rem',color:'var(--text-secondary)',marginTop:'.15rem'}}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Issues Table */}
      <div className="ad-card">
        <div className="ad-card-header">
          <h2 className="ad-card-title">Incomplete Profiles — Action Required</h2>
          <span className="ad-badge ad-badge-inactive">{visible.length} flagged</span>
        </div>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead><tr><th>Student</th><th>Branch</th><th>Missing Fields</th><th>Days Pending</th><th>Severity</th><th>Actions</th></tr></thead>
            <tbody>
              {visible.map(i => (
                <tr key={i.id}>
                  <td><strong>{i.name}</strong><div style={{fontSize:'.73rem',color:'var(--text-secondary)'}}>{i.id}</div></td>
                  <td>{i.branch}</td>
                  <td>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'.3rem'}}>
                      {i.fields.map(f=><span key={f} className="ad-ann-chip" style={{background:'rgba(239,68,68,.1)',color:'#f87171'}}>{f}</span>)}
                    </div>
                  </td>
                  <td style={{fontWeight:700,color: i.days>7?'#f87171':i.days>3?'#fbbf24':'var(--text-primary)'}}>{i.days}d</td>
                  <td><span className={`ad-badge ${SEV_COLOR[i.severity]}`} style={{textTransform:'capitalize'}}>{i.severity}</span></td>
                  <td>
                    <div style={{display:'flex',gap:'.4rem'}}>
                      <button className="ad-btn ad-btn-outline" style={{padding:'.28rem .7rem',fontSize:'.73rem'}} onClick={() => remind(i.id)}>📩 Remind</button>
                      <button className="ad-btn ad-btn-primary" style={{padding:'.28rem .7rem',fontSize:'.73rem'}} onClick={() => dismiss(i.id)}>✓ Resolve</button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#4ade80',padding:'2rem',fontWeight:600}}>🎉 All profiles are complete!</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* DPDP Consent + Access Log */}
      <div className="ad-main-grid">
        <div className="ad-card">
          <div className="ad-card-header"><h2 className="ad-card-title">Data Access Log</h2><span className="ad-badge ad-badge-info">DPDP §7</span></div>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Entity</th><th>Type</th><th>Data Accessed</th><th>Students</th><th>Date</th></tr></thead>
              <tbody>
                {ACCESS_LOG.map((l,i) => (
                  <tr key={i}>
                    <td><strong>{l.entity}</strong></td>
                    <td><span className="ad-badge ad-badge-info" style={{textTransform:'capitalize'}}>{l.type}</span></td>
                    <td>{l.accessed}</td>
                    <td style={{fontWeight:700}}>{l.students}</td>
                    <td style={{color:'var(--text-secondary)',fontSize:'.78rem'}}>{l.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-header"><h2 className="ad-card-title">Consent Status</h2></div>
          <div style={{display:'flex',flexDirection:'column',gap:'.9rem'}}>
            {CONSENT_DATA.map(c => (
              <div key={c.label}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.35rem',fontSize:'.82rem'}}>
                  <span style={{color:'var(--text-secondary)'}}>{c.label}</span>
                  <span style={{fontWeight:800,color:c.color}}>{c.pct}%</span>
                </div>
                <div className="ad-progress-wrap">
                  <div className="ad-progress-bar" style={{width:`${c.pct}%`,background:c.color}}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop:'1rem',padding:'.75rem',borderRadius:'.75rem',background:'rgba(99,102,241,.08)',fontSize:'.78rem',color:'var(--text-secondary)'}}>
            🛡️ Logs retained for 3 years per DPDP Act 2023 requirements.
          </div>
        </div>
      </div>
    </div>
  );
}
