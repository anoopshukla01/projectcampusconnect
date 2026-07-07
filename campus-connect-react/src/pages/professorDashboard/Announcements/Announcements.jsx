import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import './Announcements.css';

const DEFAULT_ANNOUNCEMENTS = [
  { id: 1, title: 'Mid-semester exam schedule released', content: 'The mid-semester examinations will begin from December 8, 2026. Detailed schedule and classroom allocations are available on the notices board.', source: 'Academic office', time: '2h ago', category: 'academic' },
  { id: 2, title: 'Google Summer of Code info session', content: 'Join us for an info session about GSoC 2027 application timelines, tips, and guidelines in LH-108 at 5:00 PM today.', source: 'Placement cell', time: '5h ago', category: 'placement' },
  { id: 3, title: 'Hackathon Hyperion 4.0 registrations open', content: 'E-Cell invites teams to register for Hyperion 4.0. Prize pool worth INR 1,50,000. Registration closes Nov 30.', source: 'E-Cell', time: '1d ago', category: 'event' }
];

export default function Announcements() {
  const { user } = useAuth();
  const showToast = useToast();
  const [announcements, setAnnouncements] = useState(() => {
    const saved = localStorage.getItem('ss_announcements');
    return saved ? JSON.parse(saved) : DEFAULT_ANNOUNCEMENTS;
  });

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'academic' });

  const isProf = user?.role === 'professor';

  useEffect(() => {
    localStorage.setItem('ss_announcements', JSON.stringify(announcements));
  }, [announcements]);

  function handlePost(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;

    const newAnn = {
      id: Date.now(),
      title: form.title.trim(),
      content: form.content.trim(),
      source: user.name || 'Professor',
      time: 'Just now',
      category: form.category
    };

    setAnnouncements(prev => [newAnn, ...prev]);
    setModal(false);
    setForm({ title: '', content: '', category: 'academic' });
    showToast('Announcement posted successfully! 📢', 'success', 3000);
  }

  function handleDelete(id) {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    showToast('Announcement deleted.', 'info', 1500);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-sub">Latest news, notifications and official alerts</p>
        </div>
        {isProf && (
          <button className="action-btn" onClick={() => setModal(true)}>
            📢 Post Announcement
          </button>
        )}
      </div>

      <div className="announcements-list">
        {announcements.length > 0 ? (
          announcements.map(ann => (
            <div className={`ann-card ${ann.category}`} key={ann.id}>
              <div className="ann-card-header">
                <span className="ann-source">✍️ {ann.source}</span>
                <span className="ann-time">{ann.time}</span>
              </div>
              <h2 className="ann-title">{ann.title}</h2>
              <p className="ann-content">{ann.content}</p>
              <div className="ann-card-footer">
                <span className={`ann-category-tag ${ann.category}`}>{ann.category}</span>
                {isProf && (
                  <button className="delete-ann-btn" onClick={() => handleDelete(ann.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="lib-empty">No announcements yet.</div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Post New Announcement</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handlePost} className="sell-form">
              <label>
                Title
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Lab schedule change"
                />
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                >
                  <option value="academic">Academic</option>
                  <option value="placement">Placement</option>
                  <option value="event">Event</option>
                  <option value="general">General</option>
                </select>
              </label>
              <label>
                Content
                <textarea
                  required
                  rows="4"
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Type the announcement details here…"
                />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }}>Post Now</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
