/**
 * Admin Announcements — Admin Portal
 *
 * Admin can compose and broadcast college-wide announcements.
 * Full history loaded from /community/announcements.
 * Role enforced server-side.
 */

import { useState, useMemo } from 'react';
import { useToast } from '@ctx/ToastContext';
import { communityApi } from '@/services/api';
import { useApiData } from '@/hooks/useApiData';
import '@admin/admin.shared.css';

const AUDIENCE_OPTS = ['All', 'Students', 'Faculty', 'Placement Cell'];

export default function Announcements() {
  const showToast = useToast();

  const { data: annData, loading, refetch } = useApiData(
    '/community/announcements',
    { announcements: [] },
  );
  const past = useMemo(() => annData?.announcements || [], [annData]);

  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [audience, setAudience] = useState(['All']);
  const [sending,  setSending]  = useState(false);
  const [deleting, setDeleting] = useState({});

  function toggleAudience(a) {
    setAudience(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a],
    );
  }

  async function send() {
    if (!title.trim() || !body.trim()) {
      showToast('Title and message are required.', 'error', 2000); return;
    }
    setSending(true);
    const res = await communityApi.createAnnouncement({
      title,
      content: body,
      audience: audience.join(', '),
    });
    setSending(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Announcement broadcast!', 'success', 3000);
    setTitle('');
    setBody('');
    refetch();
  }

  async function deleteAnn(id) {
    setDeleting(prev => ({ ...prev, [id]: true }));
    const res = await communityApi.deleteAnnouncement(id);
    setDeleting(prev => ({ ...prev, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Announcement deleted.', 'info');
    refetch();
  }

  return (
    <div className="ad-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Broadcast Announcements</h1>
          <p className="page-sub">Push college-wide notices to all user roles</p>
        </div>
      </div>

      {/* Compose */}
      <div className="ad-card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem' }}>
          Compose Announcement
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="ad-field">
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Title
            </label>
            <input className="ad-input" placeholder="e.g. Mid-semester exam dates released"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="ad-field">
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Message
            </label>
            <textarea className="ad-textarea" rows={4}
              placeholder="Write your announcement here…"
              value={body} onChange={e => setBody(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: 8,
                       background: 'rgba(255,255,255,0.06)',
                       border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {AUDIENCE_OPTS.map(a => (
                <button key={a} type="button" onClick={() => toggleAudience(a)}
                  style={{
                    padding: '0.3rem 0.85rem', borderRadius: 999, border: '1.5px solid',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    borderColor: audience.includes(a) ? '#6366f1' : 'rgba(255,255,255,0.12)',
                    background: audience.includes(a) ? 'rgba(99,102,241,.2)' : 'transparent',
                    color: audience.includes(a) ? '#818cf8' : '#94a3b8',
                  }}>
                  {a}
                </button>
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
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem' }}>
          Broadcast History
        </h2>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : past.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No announcements yet. Broadcast your first notice above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {past.map(a => (
              <div key={a.id} style={{ padding: '1rem', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>{a.title}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {a.time || new Date(a.created_at || Date.now()).toLocaleDateString()} · by {a.source || a.author_name || 'Admin'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0 }}>{a.content}</p>
                </div>
                <button onClick={() => deleteAnn(a.id)} disabled={deleting[a.id]}
                  style={{ background: 'none', border: 'none', color: '#ef4444',
                           cursor: 'pointer', fontSize: '1rem', padding: '0.25rem', flexShrink: 0 }}
                  title="Delete announcement">
                  {deleting[a.id] ? '…' : '🗑'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
