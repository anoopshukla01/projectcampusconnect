import { Megaphone, X } from "lucide-react";
/**
 * Announcements — Professor Portal
 *
 * Professors can read all announcements and post new ones scoped to
 * their branch (optional).  Admins and TPO posts are also visible here.
 *
 * DELETE is scoped: professors can only delete their own posts.
 * Role enforced server-side; never sent in request body.
 */

import { useState, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useApiData } from '../../../hooks/useApiData';
import { communityApi } from '../../../services/api';
import { StateContainer } from '../../../components/StateContainer';
import './Announcements.css';

const CATEGORIES = ['all', 'academic', 'placement', 'event', 'general'];

const ROLE_COLORS = {
  professor:     '#3b82f6',
  admin:         '#6366f1',
  placement_cell:'#10b981',
  tpo:           '#10b981',
};

export default function Announcements() {
  const { user, isProfessor } = useAuth();
  const showToast = useToast();

  const { data, loading, error, isEmpty, refetch } = useApiData(
    '/community/announcements',
    { announcements: [] },
  );
  const announcements = useMemo(() => data?.announcements || [], [data]);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modal,   setModal]   = useState(false);
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [form, setForm] = useState({
    title: '', content: '', category: 'academic', target_branch: '',
  });

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return announcements;
    return announcements.filter(a => (a.category || a.author_role) === categoryFilter);
  }, [announcements, categoryFilter]);

  async function handlePost(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      showToast('Title and content are required.', 'error'); return;
    }
    setPosting(true);
    const res = await communityApi.createAnnouncement({
      title:         form.title.trim(),
      content:       form.content.trim(),
      target_branch: form.target_branch.trim() || null,
    });
    setPosting(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Announcement posted! 📢', 'success', 3000);
    setModal(false);
    setForm({ title: '', content: '', category: 'academic', target_branch: '' });
    refetch();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this announcement?')) return;
    setDeleting(prev => ({ ...prev, [id]: true }));
    const res = await communityApi.deleteAnnouncement(id);
    setDeleting(prev => ({ ...prev, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Announcement deleted.', 'info');
    refetch();
  }

  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty && !isProfessor}
      emptyMessage="No announcements yet.">
      <div className="page-header">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-sub">Latest news, notifications and official alerts</p>
        </div>
        {isProfessor && (
          <button className="action-btn" onClick={() => setModal(true)}>
            Post Announcement
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="filter-row" role="group" aria-label="Filter by category">
        {CATEGORIES.map(c => (
          <button key={c}
            className={`filter-btn${categoryFilter === c ? ' active' : ''}`}
            onClick={() => setCategoryFilter(c)}>
            {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      <div className="announcements-list">
        {filtered.length === 0 ? (
          <div className="lib-empty">No announcements in this category.</div>
        ) : (
          filtered.map(ann => {
            const dotColor = ROLE_COLORS[ann.author_role] || '#6366f1';
            return (
              <div className={`ann-card ${ann.author_role || 'general'}`} key={ann.id}>
                <div className="ann-card-header">
                  <span className="ann-source" style={{ color: dotColor }}>
                    {ann.source || ann.author_name || 'Staff'}
                    {ann.target_branch && <span style={{ opacity: 0.7 }}> · {ann.target_branch}</span>}
                  </span>
                  <span className="ann-time">{ann.time || new Date(ann.created_at || Date.now()).toLocaleDateString()}</span>
                </div>
                <h2 className="ann-title">{ann.title}</h2>
                <p className="ann-content">{ann.content}</p>
                <div className="ann-card-footer">
                  <span className={`ann-category-tag ${ann.author_role || 'general'}`}>
                    {ann.author_role || 'general'}
                  </span>
                  {isProfessor && (
                    <button className="delete-ann-btn"
                      disabled={deleting[ann.id]}
                      onClick={() => handleDelete(ann.id)}>
                      {deleting[ann.id] ? '…' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Post Modal */}
      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Post New Announcement</h2>
              <button className="modal-close" onClick={() => setModal(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <form onSubmit={handlePost} className="sell-form">
              <label>
                Title
                <input required value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Lab schedule change" />
              </label>
              <label>
                Target Branch (optional — leave blank for all)
                <input value={form.target_branch}
                  onChange={e => setForm(p => ({ ...p, target_branch: e.target.value }))}
                  placeholder="e.g. CSE" />
              </label>
              <label>
                Content
                <textarea required rows={4} value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Type the announcement details here…" />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }}
                disabled={posting}>
                {posting ? 'Posting…' : 'Post Now'}
              </button>
            </form>
          </div>
        </div>
      )}
    </StateContainer>
  );
}
