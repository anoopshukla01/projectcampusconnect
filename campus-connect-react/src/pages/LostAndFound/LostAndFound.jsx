/**
 * Lost & Found — Student Portal
 *
 * Browse open reports, report a new item (lost or found),
 * mark own item as resolved (closes the report), delete own report.
 * IDOR enforced server-side.
 */

import { useState, useMemo, useCallback } from 'react';
import { Search, MapPin, Calendar, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { communityApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './LostAndFound.css';

const BLANK = {
  item_type: 'lost', title: '', category: 'other',
  location: '', contact_info: '',
};

export default function LostAndFound() {
  const { user } = useAuth();
  const showToast = useToast();

  const [filter,  setFilter]  = useState('all');
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(BLANK);
  const [posting,  setPosting]  = useState(false);
  const [resolving, setResolving] = useState({});
  const [deleting,  setDeleting]  = useState({});

  const { data: apiData, loading, error, isEmpty, refetch } = useApiData(
    '/community/lost-and-found',
    { items: [] },
  );
  const items = useMemo(() => apiData?.items || [], [apiData]);

  const filtered = useMemo(() =>
    filter === 'all' ? items : items.filter(i => (i.type || i.item_type) === filter),
    [items, filter],
  );

  async function handleReport(e) {
    e.preventDefault();
    if (!form.title) { showToast('Item title is required.', 'error'); return; }
    setPosting(true);
    const res = await communityApi.reportItem({
      item_type:    form.item_type,
      title:        form.title,
      category:     form.category,
      location:     form.location || 'Unknown',
      contact_info: form.contact_info,
    });
    setPosting(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(
      `Item "${form.title}" reported as ${form.item_type}!`,
      'success', 3000,
    );
    setModal(false);
    setForm(BLANK);
    refetch();
  }

  async function handleResolve(id, title) {
    if (!window.confirm(`Mark "${title}" as resolved?`)) return;
    setResolving(p => ({ ...p, [id]: true }));
    const res = await communityApi.resolveItem(id);
    setResolving(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Item marked as resolved.', 'success');
    refetch();
  }

  async function handleDelete(id, title) {
    if (!window.confirm(`Delete report for "${title}"?`)) return;
    setDeleting(p => ({ ...p, [id]: true }));
    const res = await communityApi.deleteItem(id);
    setDeleting(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Report deleted.', 'info');
    refetch();
  }

  function handleContact(item) {
    showToast(
      `Reporter: ${item.reporter || item.reporter_name} · Contact: ${item.contact || item.contact_info || 'Not provided'}`,
      'info', 4000,
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lost &amp; Found</h1>
          <p className="page-sub">Campus item recovery board · {items.length} open report{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="action-btn" onClick={() => setModal(true)}>+ Report Item</button>
      </div>

      <div className="filter-row">
        {['all', 'lost', 'found'].map(f => (
          <button key={f}
            className={`filter-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All Items' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <StateContainer loading={loading} error={error} isEmpty={isEmpty}
        emptyMessage="No lost & found reports. Be the first to post!">
        <div className="laf-grid">
          {filtered.map(item => {
            const typeVal = item.type || item.item_type || 'lost';
            const isOwner = item.reporter_id === user?.id;
            return (
              <div className={`laf-card ${typeVal}`} key={item.id}>
                <div className="laf-icon-wrap"><Search size={20} /></div>
                <div className="laf-body">
                  <span className={`laf-badge ${typeVal}`}>{typeVal.toUpperCase()}</span>
                  <h3 className="laf-title">{item.title}</h3>
                  <p className="laf-meta">
                    <MapPin size={12} style={{ display: 'inline', marginRight: '2px' }} /> {item.location} · <Calendar size={12} style={{ display: 'inline', marginRight: '2px' }} /> {item.date || item.date_reported}
                  </p>
                  <p className="laf-contact">
                    Reporter: {item.reporter || item.reporter_name}
                  </p>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="action-btn" style={{ flex: 1 }}
                      onClick={() => handleContact(item)}>
                      Contact Reporter
                    </button>
                    {isOwner && (
                      <>
                        <button className="action-btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          disabled={resolving[item.id]}
                          onClick={() => handleResolve(item.id, item.title)}>
                          {resolving[item.id] ? '…' : <><Check size={12} /> Resolved</>}
                        </button>
                        <button
                          style={{ background: 'none', border: 'none',
                                   color: 'var(--clr-danger, #ef4444)',
                                   cursor: 'pointer', fontSize: '1rem', padding: '0.35rem', display: 'inline-flex', alignItems: 'center' }}
                          disabled={deleting[item.id]}
                          onClick={() => handleDelete(item.id, item.title)}
                          title="Delete report">
                          {deleting[item.id] ? '…' : <Trash2 size={16} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </StateContainer>

      {/* Report Modal */}
      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Report Lost or Found Item</h2>
            <form onSubmit={handleReport} className="sell-form">
              <label>
                Report Type
                <select value={form.item_type}
                  onChange={e => setForm(p => ({ ...p, item_type: e.target.value }))}>
                  <option value="lost">I Lost Something</option>
                  <option value="found">I Found Something</option>
                </select>
              </label>
              <label>
                Item Title *
                <input required value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Blue Water Bottle" />
              </label>
              <label>
                Category
                <select value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {['books', 'electronics', 'clothing', 'accessories', 'documents', 'other'].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <input value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Library 2nd Floor" />
              </label>
              <label>
                Contact Info
                <input value={form.contact_info}
                  onChange={e => setForm(p => ({ ...p, contact_info: e.target.value }))}
                  placeholder="Phone or email" />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={posting}>
                {posting ? 'Submitting…' : 'Submit Report'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
