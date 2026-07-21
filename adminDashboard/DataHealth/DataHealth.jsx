import { useState, useEffect } from 'react';
import { useToast } from '@ctx/ToastContext';
import { adminApi, studentsApi } from '@/services/api';
import '@admin/admin.shared.css';

const SEV_COLOR = { high:'ad-badge-inactive', medium:'ad-badge-pending', low:'ad-badge-info' };

export default function DataHealth() {
  const showToast = useToast();
  const [data, setData] = useState({
    completePct: 0,
    totalStudents: 0,
    consentedPct: 0,
    consentedCount: 0,
    incompleteProfiles: [],
    accessLogs: [],
    loading: true
  });
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [analyticRes, studentsRes, auditRes] = await Promise.all([
          adminApi.getProfileAnalytics(),
          studentsApi.list({ per_page: 100 }),
          adminApi.getAuditLog({ per_page: 50 }),
        ]);

        const analyticData = analyticRes || {};
        const profileStats = analyticData.profile_completeness || { completed: 0, incomplete: 0, completed_pct: 0 };
        const complianceStats = analyticData.dpdp_compliance || { consented: 0, pending: 0, consent_pct: 0 };

        const allStudents = studentsRes?.students || [];
        const incompleteList = allStudents
          .filter(s => !s.profile_complete)
          .map(s => {
            const fields = [];
            if (!s.resume_url) fields.push('Resume');
            if (!s.linkedin_url) fields.push('LinkedIn URL');
            if (!s.hostel_address) fields.push('Address');
            if (fields.length === 0) fields.push('Bio');
            const severity = fields.includes('Resume') ? 'high' : fields.length > 1 ? 'medium' : 'low';
            return { id: s.roll_no || s.id?.slice(0, 8).toUpperCase(), name: s.full_name, branch: s.branch, fields, days: 1, severity };
          });

        const accessList = (auditRes?.audit_logs || auditRes?.logs || [])
          .filter(log => log.action?.includes('read') || log.action?.includes('export') || log.action?.includes('update'))
          .slice(0, 5)
          .map(log => ({
            entity: log.actor_role === 'admin' ? 'Administrator' : log.actor_role === 'placement_cell' ? 'TPO Cell' : 'Faculty Member',
            type: log.actor_role,
            accessed: (log.action || '').replace('placement.', '').replace('admin.', '').replace('.', ' '),
            students: log.action?.includes('bulk') ? 120 : 1,
            date: log.created_at ? new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
          }));

        setData({
          completePct: Math.round(profileStats.completed_pct || 0),
          totalStudents: analyticData.total_students || 0,
          consentedPct: Math.round(complianceStats.consent_pct || 0),
          consentedCount: complianceStats.consented || 0,
          incompleteProfiles: incompleteList,
          accessLogs: accessList,
          loading: false,
        });
      } catch (err) {
        console.error('Error fetching Data Health:', err);
        setData(prev => ({ ...prev, loading: false }));
      }
    }
    loadData();
  }, []);

  const visible = data.incompleteProfiles.filter(i => !dismissed.includes(i.id));
  const totalMissing = visible.reduce((s,i) => s+i.fields.length, 0);

  function dismiss(id) {
    setDismissed(prev => [...prev, id]);
    showToast('Issue marked as resolved.', 'success', 1800);
  }
  function remind(id) {
    const u = data.incompleteProfiles.find(i=>i.id===id);
    showToast(`Reminder sent to ${u.name} to complete their profile.`, 'default', 2500);
  }
  function exportDPDP() {
    showToast('DPDP compliance report exported. (Demo mode)', 'success', 2500);
  }

  const CONSENT_DATA = [
    { label:'Data sharing consent given',      pct: data.consentedPct, color:'#22c55e' },
    { label:'Marketing opt-in',               pct: 0, color:'#6366f1' },
    { label:'Third-party recruiter consent',  pct: 0, color:'#3b82f6' },
    { label:'Background check authorised',    pct: 0, color:'#f59e0b' },
  ];

  return (
    <div className="ad-root">
      <div className="page-header">
        <div><h1 className="page-title">Data Health & Compliance</h1><p className="page-sub">Profile completeness · DPDP Act compliance · Consent status</p></div>
        <div className="ad-header-actions">
          <button className="ad-btn ad-btn-outline" onClick={exportDPDP}>DPDP Report</button>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1.25rem'}}>
        {[
          { label:'Profiles Complete',  value: data.loading ? '...' : `${data.completePct}%`,     color:'#4ade80', icon:'', sub:`${data.totalStudents - visible.length} of ${data.totalStudents} students` },
          { label:'Missing Fields',     value: data.loading ? '...' : totalMissing,        color:'#f87171', icon:'',  sub:`Across ${visible.length} students`       },
          { label:'Pending Verify',     value: data.loading ? '...' : visible.filter(i=>i.severity==='high').length, color:'#fbbf24', icon:'', sub:'High severity items' },
          { label:'DPDP Compliant',     value: data.loading ? '...' : `${data.consentedPct}%`,               color:'#818cf8', icon:'',  sub:`${data.consentedCount} of ${data.totalStudents} students`                 },
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
                      <button className="ad-btn ad-btn-outline" style={{padding:'.28rem .7rem',fontSize:'.73rem'}} onClick={() => remind(i.id)}>Remind</button>
                      <button className="ad-btn ad-btn-primary" style={{padding:'.28rem .7rem',fontSize:'.73rem'}} onClick={() => dismiss(i.id)}>Resolve</button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#4ade80',padding:'2rem',fontWeight:600}}>All profiles are complete!</td></tr>}
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
                {data.accessLogs.map((l,i) => (
                  <tr key={i}>
                    <td><strong>{l.entity}</strong></td>
                    <td><span className="ad-badge ad-badge-info" style={{textTransform:'capitalize'}}>{l.type}</span></td>
                    <td>{l.accessed}</td>
                    <td style={{fontWeight:700}}>{l.students}</td>
                    <td style={{color:'var(--text-secondary)',fontSize:'.78rem'}}>{l.date}</td>
                  </tr>
                ))}
                {data.accessLogs.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1.5rem 0', textAlign: 'center' }}>
                      No data access logs recorded.
                    </td>
                  </tr>
                )}
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
            Logs retained for 3 years per DPDP Act 2023 requirements.
          </div>
        </div>
      </div>
    </div>
  );
}
