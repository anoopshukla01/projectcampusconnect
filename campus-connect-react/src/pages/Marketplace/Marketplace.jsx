/**
 * Marketplace — Student Portal
 *
 * Two tabs:
 *  1. P2P Marketplace — students/professors list items for sale peer-to-peer.
 *  2. Official Store  — admin/TPO-listed merchandise with direct purchase flow.
 *
 * IDOR enforced server-side: sellers can only edit/delete their own listings.
 */

import { useState, useMemo } from 'react';
import { ShoppingBag, Trash2, Package, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { communityApi, adminApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Marketplace.css';

const CATS = ['all', 'books', 'stationary', 'electronics', 'clothing', 'other'];
const BLANK = { title: '', price: '', category: 'books', description: '', contact_info: '' };
const BLANK_ORDER = { quantity: 1, payment_reference: '', shipping_address: '' };

export default function Marketplace() {
  const { user } = useAuth();
  const showToast = useToast();

  const [activeTab, setActiveTab] = useState('p2p');
  const [cat,   setCat]   = useState('all');
  const [modal, setModal] = useState(false);
  const [form,  setForm]  = useState(BLANK);
  const [posting,  setPosting]  = useState(false);
  const [deleting, setDeleting] = useState({});

  // Official store purchase modal state
  const [buyModal, setBuyModal] = useState(null); // holds the item being purchased
  const [orderForm, setOrderForm] = useState(BLANK_ORDER);
  const [ordering, setOrdering] = useState(false);

  // ── P2P listings ────────────────────────────────────────────────────────────
  const { data: p2pData, loading: p2pLoading, error: p2pError, isEmpty: p2pEmpty, refetch: refetchP2P } = useApiData(
    '/community/marketplace',
    { items: [] },
  );
  const items = useMemo(() => p2pData?.items || [], [p2pData]);
  const filtered = useMemo(() =>
    cat === 'all' ? items : items.filter(l => l.category === cat),
    [items, cat],
  );

  // ── Official merchandise ─────────────────────────────────────────────────────
  const { data: merchData, loading: merchLoading, error: merchError, isEmpty: merchEmpty, refetch: refetchMerch } = useApiData(
    '/admin/merchandise',
    { merchandise: [] },
  );
  const merchandise = useMemo(() => merchData?.merchandise || [], [merchData]);

  // ── P2P handlers ─────────────────────────────────────────────────────────────
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
    refetchP2P();
  }

  async function handleMarkSold(id, title) {
    const res = await communityApi.markSold(id);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`"${title}" marked as sold.`, 'success');
    refetchP2P();
  }

  async function handleDelete(id, title) {
    if (!window.confirm(`Remove listing "${title}"?`)) return;
    setDeleting(p => ({ ...p, [id]: true }));
    const res = await communityApi.deleteListing(id);
    setDeleting(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Listing removed.', 'info');
    refetchP2P();
  }

  function handleContact(l) {
    showToast(
      `Seller: ${l.seller} · Contact: ${l.contact || 'Not provided'}`,
      'info', 4000,
    );
  }

  // ── Official store handlers ───────────────────────────────────────────────────
  function openBuyModal(item) {
    setBuyModal(item);
    setOrderForm(BLANK_ORDER);
  }

  async function handlePurchase(e) {
    e.preventDefault();
    if (!orderForm.payment_reference || !orderForm.shipping_address) {
      showToast('Payment reference and shipping address are required.', 'error'); return;
    }
    setOrdering(true);
    const res = await adminApi.purchaseMerchandise({
      item_id:           buyModal.id,
      quantity:          orderForm.quantity,
      payment_reference: orderForm.payment_reference,
      shipping_address:  orderForm.shipping_address,
    });
    setOrdering(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`Order placed for "${buyModal.title}"! We'll confirm soon.`, 'success', 4000);
    setBuyModal(null);
    refetchMerch();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketplace</h1>
          <p className="page-sub">Buy &amp; sell campus items · {items.length} active listing{items.length !== 1 ? 's' : ''}</p>
        </div>
        {activeTab === 'p2p' && (
          <button className="action-btn" onClick={() => setModal(true)}>+ Sell Item</button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="filter-row" style={{ marginBottom: '0.5rem' }}>
        <button
          className={`filter-btn${activeTab === 'p2p' ? ' active' : ''}`}
          onClick={() => setActiveTab('p2p')}
        >
          <ShoppingBag size={14} style={{ marginRight: '0.3rem' }} />
          Student Listings
        </button>
        <button
          className={`filter-btn${activeTab === 'store' ? ' active' : ''}`}
          onClick={() => setActiveTab('store')}
        >
          <Package size={14} style={{ marginRight: '0.3rem' }} />
          Official Store
        </button>
      </div>

      {/* ── TAB: P2P MARKETPLACE ── */}
      {activeTab === 'p2p' && (
        <>
          <div className="filter-row">
            {CATS.map(c => (
              <button key={c}
                className={`filter-btn${cat === c ? ' active' : ''}`}
                onClick={() => setCat(c)}>
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>

          <StateContainer loading={p2pLoading} error={p2pError} isEmpty={p2pEmpty}
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
        </>
      )}

      {/* ── TAB: OFFICIAL STORE ── */}
      {activeTab === 'store' && (
        <StateContainer loading={merchLoading} error={merchError} isEmpty={merchEmpty}
          emptyMessage="No official merchandise available right now.">
          <div className="market-grid">
            {merchandise.map(item => (
              <div className="listing-card" key={item.id}>
                <div className="listing-img-box" style={{ background: 'var(--surface-2, #1e1e2e)', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.5rem 0.5rem 0 0' }} />
                    : <Package size={32} style={{ color: 'var(--clr-muted)' }} />
                  }
                  <span className="listing-badge" style={{ background: 'var(--clr-primary)' }}>OFFICIAL</span>
                </div>
                <div className="listing-body">
                  <div className="listing-header">
                    <h3 className="listing-title">{item.title}</h3>
                    <span className="listing-price">₹{parseFloat(item.price).toFixed(2)}</span>
                  </div>
                  {item.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', margin: '0.25rem 0' }}>
                      {item.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', margin: '0.35rem 0' }}>
                    {item.upi_id && <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(99,102,241,.12)', color: 'var(--clr-secondary, #6366f1)' }}>UPI: {item.upi_id}</span>}
                    {item.bank_account && <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(99,102,241,.12)', color: 'var(--clr-secondary, #6366f1)' }}>Bank Transfer</span>}
                  </div>
                  <button className="action-btn" style={{ width: '100%', marginTop: '0.5rem' }}
                    onClick={() => openBuyModal(item)}>
                    <ShoppingCart size={14} style={{ marginRight: '0.4rem' }} />
                    Buy Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </StateContainer>
      )}

      {/* ── SELL MODAL (P2P) ── */}
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

      {/* ── BUY MODAL (Official Store) ── */}
      {buyModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setBuyModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Order: {buyModal.title}</h2>
            <p style={{ color: 'var(--clr-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Price: <strong>₹{parseFloat(buyModal.price).toFixed(2)}</strong> each
              {buyModal.upi_id && ` · Pay to UPI: ${buyModal.upi_id}`}
              {buyModal.bank_account && ` · Bank: ${buyModal.bank_account}`}
            </p>
            <form onSubmit={handlePurchase} className="sell-form">
              <label>
                Quantity
                <input type="number" min={1} value={orderForm.quantity}
                  onChange={e => setOrderForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
              </label>
              <label>
                Payment Reference * <span style={{ fontSize: '0.75rem', color: 'var(--clr-muted)' }}>(UPI txn ID / bank ref)</span>
                <input required value={orderForm.payment_reference}
                  onChange={e => setOrderForm(p => ({ ...p, payment_reference: e.target.value }))}
                  placeholder="e.g. UPI123456789" />
              </label>
              <label>
                Shipping / Delivery Address *
                <textarea rows={2} required value={orderForm.shipping_address}
                  onChange={e => setOrderForm(p => ({ ...p, shipping_address: e.target.value }))}
                  placeholder="Hostel room / campus address…"
                  style={{ resize: 'vertical', width: '100%' }} />
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', marginBottom: '0.75rem' }}>
                Total: <strong>₹{(parseFloat(buyModal.price) * orderForm.quantity).toFixed(2)}</strong>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="action-btn btn-secondary" style={{ flex: 1 }}
                  onClick={() => setBuyModal(null)}>Cancel</button>
                <button type="submit" className="action-btn" style={{ flex: 1 }}
                  disabled={ordering}>
                  {ordering ? 'Placing order…' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
