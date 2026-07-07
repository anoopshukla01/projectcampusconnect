import { useState, useEffect } from 'react';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';

const AUDIENCE_OPTS = ['All', 'Students', 'Faculty', 'Placement Cell', 'Admin'];
const PRIORITY_OPTS = ['high','medium','low'];

export default function Announcements() {
  const showToast = useToast();
  const [past, setPast]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [title, setTitle]       = useState('');
  const [body, setBody]         = useState('');
  const [audience, setAudience] = useState(['All']);
  const [priority, setPriority] = useState('medium');
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/community/announcements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPast(data.announcements || []);
      } else {
        showToast(data.error || 'Failed to load announcements.', 'error', 3000);
      }
    } catch {
      showToast('Network error fetching announcements.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  }

  function toggleAudience(a) {
    setAudience(prev =>
      prev.includes(a) ? prev.filter(x=>x!==a) : [...prev, a]
    );
  }

  async function send() {
    if (!title.trim() || !body.trim()) { showToast('Title and message content are required.','error',2000); return; }
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/community/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, content: body })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Announcement broadcast successfully!', 'success', 3000);
        setTitle('');
        setBody('');
        fetchAnnouncements();
      } else {
        showToast(data.error || 'Failed to post announcement.', 'error', 3000);
      }
    } catch {
      showToast('Error broadcasting announcement.', 'error', 3000);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ad-root">
      <div className="page-header">
        <div><h1 className="page-title">Broadcast Announcements</h1><p className="page-sub">Push college-wide notices to all user roles</p></div>
      </div>

      {/* Compose */}
      <div className="ad-card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem' }}>Compose Announcement</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="ad-field">
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Title</label>
            <input className="ad-input" placeholder="e.g. Mid-semester exam dates released" value={title} onChange={e=>setTitle(e.target.value)} />
          </div>
          <div className="ad-field">
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Message</label>
            <textarea className="ad-textarea" placeholder="Write your announcement here…" value={body} onChange={e=>setBody(e.target.value)} rows={4} style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {AUDIENCE_OPTS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAudience(a)}
                  style={{
                    padding: '0.3rem 0.85rem', borderRadius: '999px', border: '1.5px solid',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    borderColor: audience.includes(a) ? '#6366f1' : 'rgba(255,255,255,0.12)',
                    background: audience.includes(a) ? 'rgba(99,102,241,.2)' : 'transparent',
                    color: audience.includes(a) ? '#818cf8' : '#94a3b8',
                  }}
                >{a}</button>
              ))}
            </div>
            <button className="ad-btn ad-btn-primary" onClick={send} disabled={sending}>
              {sending ? 'Broadcasting…' : '📢 Broadcast Notice'}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="ad-card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem' }}>Broadcast History</h2>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading notices…</div>
        ) : past.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No announcements found in database. Broadcast your first notice above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {past.map(a => (
              <div key={a.id} style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>{a.title}</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{a.time} · by {a.source || 'Admin'}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0 }}>{a.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
