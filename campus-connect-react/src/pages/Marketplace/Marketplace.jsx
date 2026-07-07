import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './Marketplace.css';

const CATS = ['all','books','stationary','electronics'];

export default function Marketplace() {
  const { user }  = useAuth();
  const showToast = useToast();
  const [cat, setCat]   = useState('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title:'', price:'', condition:'Good', category:'books', desc:'' });

  const { data: apiData, loading, error, isEmpty } = useApiData('/api/v1/community/marketplace', { items: [] });
  const items = useMemo(() => apiData?.items || [], [apiData]);

  const filtered = cat==='all' ? items : items.filter(l=>l.category===cat);

  function handleContact(l) { showToast(`Contacting ${l.seller || 'seller'}: ${l.contact || 'No contact provided'}`,'info',3000); }
  function handleSell(e) { e.preventDefault(); showToast(`Listing "${form.title}" submitted!`,'success',3000); setModal(false); setForm({title:'',price:'',condition:'Good',category:'books',desc:''}); }

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Marketplace</h1><p className="page-sub">Buy & sell campus items</p></div>
        <button className="action-btn" onClick={()=>setModal(true)}>+ Sell Item</button>
      </div>
      <div className="filter-row">
        {CATS.map(c=><button key={c} className={`filter-btn${cat===c?' active':''}`} onClick={()=>setCat(c)}>{c==='all'?'All':c.charAt(0).toUpperCase()+c.slice(1)}</button>)}
      </div>

      <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No marketplace listings available yet. Be the first to post!">
        <div className="market-grid">
          {filtered.map(l=>(
            <div className="listing-card" key={l.id}>
              <div className="listing-img-box">
                <span className="listing-emoji">🛍️</span>
                <span className="listing-badge">{l.category ? l.category.toUpperCase() : 'ITEM'}</span>
              </div>
              <div className="listing-body">
                <div className="listing-header">
                  <h3 className="listing-title">{l.title}</h3>
                  <span className="listing-price">{l.price}</span>
                </div>
                <p className="listing-seller">Seller: {l.seller} {l.contact ? `· ${l.contact}` : ''}</p>
                {l.desc && <p style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', margin: '0.25rem 0' }}>{l.desc}</p>}
                <button className="action-btn" style={{ width:'100%', marginTop:'0.5rem' }} onClick={()=>handleContact(l)}>Contact Seller</button>
              </div>
            </div>
          ))}
        </div>
      </StateContainer>

      {modal && (
        <div className="modal-overlay" onClick={()=>setModal(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h2 className="modal-title">List an Item for Sale</h2>
            <form onSubmit={handleSell}>
              <label>Item Title <input required value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. CLRS Textbook 3rd Ed." /></label>
              <label>Price <input required value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))} placeholder="e.g. ₹350" /></label>
              <label>Category
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                  {['books','stationary','electronics'].map(c=><option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Description<textarea rows="3" value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} placeholder="Describe the item…"/></label>
              <button type="submit" className="action-btn" style={{width:'100%'}}>Post Listing</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
