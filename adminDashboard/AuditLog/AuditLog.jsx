import { useState, useEffect } from 'react';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';

export default function AuditLog() {
  const showToast = useToast();
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  async function fetchAuditLogs() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/admin/audit-logs?per_page=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.audit_logs || []);
      } else {
        showToast(data.error || 'Failed to fetch audit logs.', 'error', 3000);
      }
    } catch {
      showToast('Network error fetching audit logs.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  }

  const filtered = logs.filter(l =>
    !search ||
    (l.action && l.action.toLowerCase().includes(search.toLowerCase())) ||
    (l.actor_email && l.actor_email.toLowerCase().includes(search.toLowerCase())) ||
    (l.target_type && l.target_type.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="ad-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit & Compliance Log</h1>
          <p className="page-sub">Full accountability trail — immutable record of system administrative actions</p>
        </div>
      </div>

      <div className="ad-card">
        <div className="ad-search-row">
          <div className="ad-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ad-search-input" placeholder="Search by action, email, or entity target…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
        </div>

        <div className="ad-table-wrap">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <div className="ad-spinner" style={{ margin: '0 auto 1rem auto' }} />
              Loading system audit logs…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No audit logs found</p>
              <p style={{ fontSize: '0.85rem' }}>Administrative actions taken in the system will automatically appear here.</p>
            </div>
          ) : (
            <table className="ad-table">
              <thead>
                <tr><th>Time</th><th>Action</th><th>Actor User</th><th>Target Type</th><th>Target ID</th><th>IP Address</th></tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td style={{ color: '#94a3b8', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {l.created_at ? new Date(l.created_at).toLocaleString() : '—'}
                    </td>
                    <td><strong style={{ color: '#818cf8' }}>{l.action}</strong></td>
                    <td>{l.actor_email || l.actor_id || 'System'}</td>
                    <td><span className="ad-badge">{l.target_type || '—'}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#cbd5e1' }}>{l.target_id || '—'}</td>
                    <td style={{ color: '#64748b', fontSize: '0.78rem' }}>{l.ip_address || '127.0.0.1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
