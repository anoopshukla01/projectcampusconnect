import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './Internships.css';

const TYPES = ['all','tech','management','research'];

export default function Internships() {
  const { user }  = useAuth();
  const showToast = useToast();
  const [type, setType] = useState('all');
  const [applied, setApplied] = useState(new Set());

  const { data: apiData, loading, error, isEmpty } = useApiData('/api/v1/career/internships', { internships: [] });
  const internships = useMemo(() => apiData?.internships || [], [apiData]);

  const filtered = useMemo(() => {
    return type==='all' ? internships : internships.filter(i=>i.type===type);
  }, [internships, type]);

  function handleApply(i) {
    if(applied.has(i.id)){ showToast(`Already applied to ${i.company}!`,'info',2000); return; }
    setApplied(p=>new Set([...p,i.id]));
    showToast(`🎉 Application sent to ${i.company}!`,'success',3000);
  }

  const LOGO_COLORS=['#4285F4','#FF9900','#FC8019','#0F9D58','#00BCF2','#0052CC'];

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Internships</h1><p className="page-sub">AI-matched opportunities for {user?.branch || 'General'}</p></div>
      </div>
      <div className="filter-row">
        {TYPES.map(t=><button key={t} className={`filter-btn${type===t?' active':''}`} onClick={()=>setType(t)}>{t==='all'?'All':t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </div>
      <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No internship postings are active at the moment. Check back soon!">
        <div className="internship-grid">
          {filtered.map((i,idx)=>(
            <div className="intern-card" key={i.id}>
              <div className="intern-header">
                <div className="intern-logo" style={{background:LOGO_COLORS[idx%LOGO_COLORS.length]+'22',color:LOGO_COLORS[idx%LOGO_COLORS.length]}}>{i.logo || i.company.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h3 className="intern-role">{i.role}</h3>
                  <p className="intern-company">{i.company} · {i.location}</p>
                </div>
                <span className="match-badge">{i.match || 100}% match</span>
              </div>
              <div className="intern-details">
                <span>⏱ {i.duration}</span>
                <span>💰 {i.stipend}</span>
                <span>📅 Apply by {i.deadline}</span>
              </div>
              <div className="intern-tags">{i.tags.map(t=><span key={t} className="intern-tag">{t}</span>)}</div>
              <button className={`action-btn intern-apply-btn${applied.has(i.id)?' applied':''}`} onClick={()=>handleApply(i)}>
                {applied.has(i.id)?'Applied ✓':'Apply Now'}
              </button>
            </div>
          ))}
        </div>
      </StateContainer>
    </>
  );
}
