/**
 * Marketplace — Student Portal
 *
 * Browse active listings, post a new listing, mark own listing as sold/delete it.
 * IDOR enforced server-side: sellers can only edit/delete their own listings.
 */

import { useState, useMemo } from 'react';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { communityApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Marketplace.css';

const CATS = ['all', 'books', 'stationary', 'electronics', 'clothing', 'other'];

const BLANK = { title: '', price: '', category: 'books', description: '', contact_info: '' };

export default function Marketplace() {
  const { user } = useAuth();
  const showToast = useToast();

  const [cat,   setCat]   = useState('all');
  const [modal, setModal] = useState(false);
  const [form,  setForm]  = useState(BLANK);
  const [posting,  setPosting]  = useState(false);
  const [deleting, setDeleting] = useState({});

  const { data: apiData, loading, error, isEmpty, refetch } = useApiData(
    '/community/marketplace',
    { items: [] },
  );
  const items = useMemo(() => apiData?.items || [], [apiData]);

  const filtered = useMemo(() =>
    cat === 'all' ? items : items.filter(l => l.category === cat),
    [items, cat],
  );

  async function handleSell(e) {
    e.preventDefault();
    if (!form.title || !form.price) {
      showToast('Title and price are required.', 'error'); return;
    }
    setPosting(true);
    const res = await communityApi.createListing({
      title:        form.title,
      price:        form.price,
      category:     form.category,
      description:  form.description,
      contact_info: form.contact_info,
    });
    setPosting(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`"${form.title}" listed for sale!`, 'success', 3000);
    setModal(false);
    setForm(BLANK);
    refetch();
  }

  async function handleMarkSold(id, title) {
    const res = await communityApi.markSold(id);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`"${title}" marked as sold.`, 'success');
    refetch();
  }

  async function handleDelete(id, title) {
    if (!window.confirm(`Remove listing "${title}"?`)) return;
    setDeleting(p => ({ ...p, [id]: true }));
    const res = await communityApi.deleteListing(id);
    setDeleting(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Listing removed.', 'info');
    refetch();
  }

  function handleContact(l) {
    showToast(
      `Seller: ${l.seller} · Contact: ${l.contact || 'Not provided'}`,
      'info', 4000,
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketplace</h1>
          <p className="page-sub">Buy &amp; sell campus items · {items.length} active listing{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="action-btn" onClick={() => setModal(true)}>+ Sell Item</button>
      </div>

      <div className="filter-row">
        {CATS.map(c => (
          <button key={c}
            className={`filter-btn${cat === c ? ' active' : ''}`}
            onClick={() => setCat(c)}>
            {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      <StateContainer loading={loading} error={error} isEmpty={isEmpty}
        emptyMessage="No listings yet. Be the first to post!">
        <div className="market-grid">
          {filtered.map(l => (
            <div className="listing-card" key={l.id}>
              <div className="listing-img-box">
                <span className="listing-emoji"><ShoppingBag size={24} /></span>
                <span className="listing-badge">{(l.category || 'ITEM').toUpperCase()}</span>
              </div>
              <div className="listing-body">
                <div className="listing-header">
                  <h3 className="listing-title">{l.title}</h3>
                  <span className="listing-price">{l.price}</span>
                </div>
                <p className="listing-seller">
                  {l.seller}
                  {l.contact ? ` · ${l.contact}` : ''}
                </p>
                {l.desc && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', margin: '0.25rem 0' }}>
                    {l.desc}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <button className="action-btn" style={{ flex: 1 }}
                    onClick={() => handleContact(l)}>
                    Contact Seller
                  </button>
                  {/* Show owner actions if this is user's listing */}
                  {l.seller_id === user?.id && (
                    <>
                      <button className="action-btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        onClick={() => handleMarkSold(l.id, l.title)}>
                        Sold
                      </button>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--clr-danger, #ef4444)',
                                 cursor: 'pointer', fontSize: '1rem', padding: '0.35rem' }}
                        disabled={deleting[l.id]}
                        onClick={() => handleDelete(l.id, l.title)}
                        title="Remove listing">
                        {deleting[l.id] ? '…' : <Trash2 size={16} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </StateContainer>

      {/* Sell Modal */}
      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">List an Item for Sale</h2>
            <form onSubmit={handleSell} className="sell-form">
              <label>
                Item Title *
                <input required value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. CLRS Textbook 3rd Ed." />
              </label>
              <label>
                Price *
                <input required value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="e.g. ₹350" />
              </label>
              <label>
                Category
                <select value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATS.filter(c => c !== 'all').map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label>
                Contact Info (phone / email)
                <input value={form.contact_info}
                  onChange={e => setForm(p => ({ ...p, contact_info: e.target.value }))}
                  placeholder="How can buyer reach you?" />
              </label>
              <label>
                Description
                <textarea rows={3} value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Condition, edition, notes…"
                  style={{ resize: 'vertical', width: '100%' }} />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }}
                disabled={posting}>
                {posting ? 'Posting…' : 'Post Listing'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
