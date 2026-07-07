import { useState } from 'react';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';

const INITIAL_RULES = {
  eligibility: [
    { id:'e1', label:'Minimum CGPA',          desc:'Students below this CGPA are auto-excluded from all drives',   type:'number', value:6.0, unit:'/ 10'  },
    { id:'e2', label:'Max Active Backlogs',    desc:'Students with more backlogs than this cannot apply',          type:'number', value:0,   unit:'backlogs' },
    { id:'e3', label:'Minimum Attendance',     desc:'Minimum attendance % required to be eligible',                type:'number', value:75,  unit:'%'     },
    { id:'e4', label:'Batch Cutoff Year',      desc:'Only students from this graduation year and above are eligible', type:'number', value:2025, unit:'year' },
  ],
  drive: [
    { id:'d1', label:'One-Student-One-Offer Lock', desc:'Once a student accepts an offer, they are locked out of further drives', type:'toggle', value:true  },
    { id:'d2', label:'Max Drives Per Student',     desc:'Max number of drives a student can participate in',                     type:'number', value:5, unit:'drives' },
    { id:'d3', label:'Offer Acceptance Window',    desc:'Days given to student to accept/reject an offer letter',               type:'number', value:3, unit:'days'   },
    { id:'d4', label:'Re-sit After Rejection',     desc:'Allow students to re-apply to same company after rejection',           type:'toggle', value:false },
  ],
  blackout: [
    { id:'b1', label:'Exam Blackout Start',   desc:'No drives allowed during exam period starting this date', type:'date', value:'2026-11-15' },
    { id:'b2', label:'Exam Blackout End',     desc:'Drives resume after this date',                           type:'date', value:'2026-11-30' },
    { id:'b3', label:'Holiday Blackout',      desc:'No drives on declared college holidays',                  type:'toggle', value:true },
  ],
  data: [
    { id:'da1', label:'CGPA Edit by TPO',      desc:'Allow placement cell to manually correct CGPA if discrepancy', type:'toggle', value:false },
    { id:'da2', label:'Student Profile Lock',  desc:'Lock student profiles during active drive season',              type:'toggle', value:false },
    { id:'da3', label:'Auto-archive Offers',   desc:'Automatically archive offers older than 1 year',               type:'toggle', value:true  },
  ],
};

const SECTION_LABELS = {
  eligibility:'🎯 Eligibility Rules',
  drive:      '🏢 Drive Rules',
  blackout:   '🚫 Blackout Periods',
  data:       '🔐 Data Access Rules',
};

export default function RulesEngine() {
  const showToast = useToast();
  const [rules, setRules] = useState(INITIAL_RULES);
  const [dirty, setDirty] = useState(false);

  function updateRule(section, id, val) {
    setRules(prev => ({
      ...prev,
      [section]: prev[section].map(r => r.id===id ? {...r, value:val} : r)
    }));
    setDirty(true);
  }

  function save() {
    setDirty(false);
    showToast('Rules published successfully. All new drives will use updated settings.', 'success', 3000);
  }

  function reset() {
    setRules(INITIAL_RULES);
    setDirty(false);
    showToast('Rules reset to default values.', 'default', 2000);
  }

  const Toggle = ({ on, onToggle }) => (
    <div className="ad-toggle" onClick={onToggle} style={{cursor:'pointer'}}>
      <div className={`ad-toggle-track${on?' on':''}`}><div className="ad-toggle-thumb"/></div>
      <span className="ad-toggle-label" style={{color: on?'#4ade80':'var(--text-secondary)'}}>{on?'On':'Off'}</span>
    </div>
  );

  return (
    <div className="ad-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rules Engine</h1>
          <p className="page-sub">Institution-wide policies · Set once, applied across all placement drives automatically</p>
        </div>
        <div className="ad-header-actions">
          <button className="ad-btn ad-btn-outline" onClick={reset}>Reset Defaults</button>
          <button className="ad-btn ad-btn-primary" onClick={save} style={{position:'relative'}}>
            {dirty && <span style={{position:'absolute',top:'-4px',right:'-4px',width:'10px',height:'10px',borderRadius:'50%',background:'#f59e0b'}}/>}
            💾 Publish Rules
          </button>
        </div>
      </div>

      {dirty && (
        <div style={{padding:'.75rem 1.1rem',borderRadius:'.875rem',background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.3)',color:'#fbbf24',fontSize:'.83rem',fontWeight:600}}>
          ⚠ You have unsaved changes. Click <strong>Publish Rules</strong> to apply them.
        </div>
      )}

      {Object.entries(rules).map(([section, items]) => (
        <div className="ad-card" key={section}>
          <div className="ad-card-header">
            <h2 className="ad-card-title">{SECTION_LABELS[section]}</h2>
            <span className="ad-badge ad-badge-info">{items.length} rule{items.length!==1?'s':''}</span>
          </div>
          <div className="ad-rule-group">
            {items.map(r => (
              <div className="ad-rule-row" key={r.id}>
                <div className="ad-rule-info">
                  <div className="ad-rule-label">{r.label}</div>
                  <div className="ad-rule-desc">{r.desc}</div>
                </div>
                <div className="ad-rule-control">
                  {r.type==='toggle' && (
                    <Toggle on={r.value} onToggle={() => updateRule(section, r.id, !r.value)} />
                  )}
                  {r.type==='number' && (
                    <>
                      <input
                        type="number"
                        className="ad-number-input"
                        value={r.value}
                        onChange={e => updateRule(section, r.id, parseFloat(e.target.value)||0)}
                      />
                      {r.unit && <span style={{fontSize:'.78rem',color:'var(--text-secondary)'}}>{r.unit}</span>}
                    </>
                  )}
                  {r.type==='date' && (
                    <input
                      type="date"
                      className="ad-number-input"
                      style={{width:'140px'}}
                      value={r.value}
                      onChange={e => updateRule(section, r.id, e.target.value)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
