import { useState, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './LostAndFound.css';

export default function LostAndFound() {
  const showToast = useToast();
  const [filter, setFilter] = useState('all');
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState({ status:'lost', title:'', location:'', date:'', contact:'', desc:'' });

  const { data: apiData, loading, error, isEmpty } = useApiData('/api/v1/community/lost-and-found', { items: [] });
  const items = useMemo(() => apiData?.items || [], [apiData]);

  const filtered = filter==='all' ? items : items.filter(i=>(i.type || i.status)===filter);

  function handleReport(e) { e.preventDefault(); showToast(`Item "${form.title}" reported as ${form.status}!`,'success',3000); setModal(false); setForm({status:'lost',title:'',location:'',date:'',contact:'',desc:''}); }
  function handleClaim(item) { showToast(`Connecting you with ${item.contact || item.reporter || 'reporter'}…`,'info',2500); }

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Lost & Found</h1><p className="page-sub">Campus item recovery board</p></div>
        <button className="action-btn" onClick={()=>setModal(true)}>+ Report Item</button>
      </div>
      <div className="filter-row">
        {['all','lost','found'].map(f=><button key={f} className={`filter-btn${filter===f?' active':''}`} onClick={()=>setFilter(f)}>{f==='all'?'All Items':f.charAt(0).toUpperCase()+f.slice(1)}</button>)}
      </div>

      <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No lost & found reports yet. Be the first to post!">
        <div className="laf-grid">
          {filtered.map(item=>(
            <div className={`laf-card ${item.type || item.status}`} key={item.id}>
              <div className="laf-icon-wrap">🔍</div>
              <div className="laf-body">
                <span className={`laf-badge ${item.type || item.status}`}>{(item.type || item.status || 'item').toUpperCase()}</span>
                <h3 className="laf-title">{item.title}</h3>
                <p className="laf-meta">📍 {item.location} · 📅 {item.date}</p>
                <p className="laf-contact">Contact: {item.contact || item.reporter}</p>
                <button className="action-btn" style={{ width:'100%', marginTop:'0.5rem' }} onClick={()=>handleClaim(item)}>Contact Reporter</button>
              </div>
            </div>
          ))}
        </div>
      </StateContainer>

      {modal && (
        <div className="modal-overlay" onClick={()=>setModal(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h2 className="modal-title">Report Lost or Found Item</h2>
            <form onSubmit={handleReport}>
              <label>Report Type
                <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                  <option value="lost">I Lost Something</option><option value="found">I Found Something</option>
                </select>
              </label>
              <label>Item Title <input required value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Blue Water Bottle" /></label>
              <label>Location <input required value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="e.g. Library 2nd Floor" /></label>
              <label>Contact Info <input required value={form.contact} onChange={e=>setForm(p=>({...p,contact:e.target.value}))} placeholder="e.g. Phone or Email" /></label>
              <button type="submit" className="action-btn" style={{ width:'100%', marginTop:'1rem' }}>Submit Report</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
