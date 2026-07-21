/**
 * Announcements — full paginated list (M3)
 * GET /community/announcements?page=N&limit=20
 */
import { useState, useCallback } from 'react';
import { apiGet } from '../../services/api';
import './Announcements.css';

export default function Announcements() {
  const [items,   setItems]   = useState([]);
  const [page,    setPage]    = useState(0);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [expanded, setExpanded] = useState(null);

  const LIMIT = 20;

  const loadPage = useCallback(async (nextPage) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const result = await apiGet('/community/announcements', { page: nextPage, limit: LIMIT });
    if (result?._networkError || result?.error) {
      setError("Couldn't load announcements — check your connection and try again.");
      setLoading(false);
      return;
    }
    const incoming = result.announcements ?? [];
    setItems(prev => nextPage === 1 ? incoming : [...prev, ...incoming]);
    setPage(result.page ?? nextPage);
    setPages(result.pages ?? 1);
    setLoading(false);
  }, [loading]);

  const [booted, setBooted] = useState(false);
  if (!booted) {
    setBooted(true);
    loadPage(1);
  }

  const canLoadMore = page > 0 && page < pages && !loading;

  return (
    <div className="ann-root">
      <div className="ann-header">
        <h1 className="ann-title">Announcements</h1>
        <p className="ann-sub">Campus-wide notices and updates</p>
      </div>

      {error && (
        <div className="ann-error" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
          <button className="ann-retry" onClick={() => loadPage(page || 1)}>Try again</button>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="ann-loading" aria-live="polite">
          <div className="ann-spinner" aria-label="Loading announcements" />
        </div>
      )}

      <ul className="ann-list" aria-label="Announcements list">
        {items.map((a) => {
          const isOpen = expanded === a.id;
          return (
            <li key={a.id} className={`ann-item${isOpen ? ' ann-item--open' : ''}`}>
              <button
                className="ann-item-btn"
                onClick={() => setExpanded(isOpen ? null : a.id)}
                aria-expanded={isOpen}
                aria-controls={`ann-body-${a.id}`}
              >
                <div className="ann-item-dot" aria-hidden="true" />
                <div className="ann-item-meta">
                  <span className="ann-item-title">{a.title}</span>
                  <span className="ann-item-source">{a.source} &nbsp;·&nbsp; {a.time}</span>
                </div>
                <svg className={`ann-chevron${isOpen ? ' ann-chevron--up' : ''}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  width="16" height="16" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isOpen && (
                <div id={`ann-body-${a.id}`} className="ann-item-content" role="region" aria-label={`Full content: ${a.title}`}>
                  <p>{a.content || 'No additional details.'}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {items.length === 0 && !loading && !error && (
        <div className="ann-empty">No announcements yet.</div>
      )}

      {canLoadMore && (
        <div className="ann-more-wrap">
          <button className="ann-load-more" onClick={() => loadPage(page + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
