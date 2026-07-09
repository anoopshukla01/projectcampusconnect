/**
 * Internships / Placement Drives — Student Portal  (PL7, PL8, PL14)
 *
 * Shows the student:
 *   - Active placement drives they are potentially eligible for
 *   - Their own application status per drive
 *   - Any offers issued to them (with accept/decline)
 *
 * Role enforced server-side. We never send role in request body.
 */

import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { placementApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Internships.css';

const TABS = ['Drives', 'My Applications', 'Offers'];

export default function Internships() {
  const { user }  = useAuth();
  const showToast = useToast();

  const [tab,    setTab]    = useState('Drives');
  const [search, setSearch] = useState('');
  const [applying, setApplying] = useState({});
  const [responding, setResponding] = useState({});

  // ── Drives list (active) ──────────────────────────────────────────────────
  const { data: drivesData, loading: drivesLoading, error: drivesError,
          isEmpty: drivesEmpty, refetch: refetchDrives } = useApiData(
    '/placement/drives',
    { drives: [] },
  );
  const drives = useMemo(() => drivesData?.drives || [], [drivesData]);

  // ── My applications ────────────────────────────────────────────────────────
  const { data: appsData, loading: appsLoading, refetch: refetchApps } = useApiData(
    user?.id ? `/students/${user.id}/applications` : null,
    [],
  );
  const applications = useMemo(() => (Array.isArray(appsData) ? appsData : []), [appsData]);

  // ── My offers ─────────────────────────────────────────────────────────────
  const { data: offersData, loading: offersLoading, refetch: refetchOffers } = useApiData(
    user?.id ? `/students/${user.id}/offers` : null,
    [],
  );
  const offers = useMemo(() => (Array.isArray(offersData) ? offersData : []), [offersData]);

  // Applied drive IDs for quick lookup
  const appliedIds = useMemo(
    () => new Set(applications.map(a => a.drive_id)),
    [applications],
  );

  // ── Apply to a drive ───────────────────────────────────────────────────────
  async function apply(driveId, companyName) {
    setApplying(prev => ({ ...prev, [driveId]: true }));
    const res = await placementApi.applyToDrive(driveId);
    setApplying(prev => ({ ...prev, [driveId]: false }));
    if (res?.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Applied to ${companyName}!`, 'success', 3000);
      refetchDrives();
      refetchApps();
    }
  }

  async function withdraw(driveId, companyName) {
    if (!window.confirm(`Withdraw application to ${companyName}?`)) return;
    const res = await placementApi.withdrawApplication(driveId);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Application withdrawn.', 'info');
    refetchDrives();
    refetchApps();
  }

  // ── Accept / Decline offer ─────────────────────────────────────────────────
  async function respondOffer(offerId, accept) {
    setResponding(prev => ({ ...prev, [offerId]: true }));
    const res = await placementApi.respondToOffer(offerId, accept);
    setResponding(prev => ({ ...prev, [offerId]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(accept ? 'Offer accepted! Congratulations 🎉' : 'Offer declined.', accept ? 'success' : 'info', 3000);
    refetchOffers();
  }

  const filteredDrives = useMemo(() => {
    const q = search.toLowerCase();
    return drives.filter(d =>
      d.company_name?.toLowerCase().includes(q) || d.role_title?.toLowerCase().includes(q)
    );
  }, [drives, search]);

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement &amp; Internships</h1>
          <p className="page-sub">Active drives · {applications.length} applications · {offers.length} offers</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-row" role="tablist">
        {TABS.map(t => (
          <button key={t} role="tab" aria-selected={tab === t}
            className={`filter-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}>
            {t}
            {t === 'My Applications' && applications.length > 0 &&
              <span style={{ marginLeft: '0.4rem', background: 'var(--clr-primary)', color: '#fff',
                             borderRadius: '999px', padding: '0 0.4rem', fontSize: '0.72rem' }}>
                {applications.length}
              </span>}
            {t === 'Offers' && offers.length > 0 &&
              <span style={{ marginLeft: '0.4rem', background: '#10b981', color: '#fff',
                             borderRadius: '999px', padding: '0 0.4rem', fontSize: '0.72rem' }}>
                {offers.length}
              </span>}
          </button>
        ))}
      </div>

      {/* ── Drives Tab ────────────────────────────────────────────────────── */}
      {tab === 'Drives' && (
        <StateContainer loading={drivesLoading} error={drivesError} isEmpty={drivesEmpty}
          emptyMessage="No active placement drives right now. Check back soon.">
          <div style={{ marginBottom: '1rem' }}>
            <input className="lib-search" type="search"
              placeholder="Search company or role…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', maxWidth: 360 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {filteredDrives.map(d => {
              const hasApplied = appliedIds.has(d.id);
              const isApplying = applying[d.id];
              return (
                <div key={d.id} className="panel"
                  style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{d.company_name}</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--clr-primary)', fontWeight: 600, margin: '0.15rem 0 0' }}>
                        {d.role_title}
                      </p>
                    </div>
                    <span className={`status-badge ${d.status === 'active' ? 'submitted' : 'graded'}`}>
                      {d.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {d.ctc_lpa && (
                      <span className="filter-btn active" style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem' }}>
                        ₹{d.ctc_lpa} LPA
                      </span>
                    )}
                    {d.drive_type && (
                      <span className="filter-btn" style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem' }}>
                        {d.drive_type}
                      </span>
                    )}
                    {d.cgpa_cutoff && (
                      <span className="filter-btn" style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem' }}>
                        CGPA ≥ {d.cgpa_cutoff}
                      </span>
                    )}
                  </div>

                  {d.description && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--clr-muted)', margin: 0,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                overflow: 'hidden' }}>
                      {d.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--clr-muted)' }}>
                      {d.registration_deadline
                        ? `Deadline: ${new Date(d.registration_deadline).toLocaleDateString()}`
                        : 'Open registration'}
                    </span>
                    {hasApplied ? (
                      <button className="action-btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                        onClick={() => withdraw(d.id, d.company_name)}>
                        Withdraw
                      </button>
                    ) : (
                      <button className="action-btn"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                        disabled={isApplying || d.status !== 'active'}
                        onClick={() => apply(d.id, d.company_name)}>
                        {isApplying ? 'Applying…' : 'Apply'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </StateContainer>
      )}

      {/* ── My Applications Tab ───────────────────────────────────────────── */}
      {tab === 'My Applications' && (
        <div>
          {appsLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '2rem' }}>Loading…</p>
          ) : applications.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '3rem' }}>
              No applications yet. Go to Drives to apply.
            </p>
          ) : (
            <section className="panel">
              <div className="attend-table-wrap">
                <table className="attend-table">
                  <thead>
                    <tr><th>Company</th><th>Role</th><th>Applied On</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {applications.map(a => (
                      <tr key={a.id}>
                        <td><strong>{a.company_name}</strong></td>
                        <td>{a.role_title}</td>
                        <td style={{ color: 'var(--clr-muted)', fontSize: '0.82rem' }}>
                          {a.applied_at ? new Date(a.applied_at).toLocaleDateString() : '—'}
                        </td>
                        <td><span className="status-badge submitted">{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Offers Tab ────────────────────────────────────────────────────── */}
      {tab === 'Offers' && (
        <div>
          {offersLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '2rem' }}>Loading…</p>
          ) : offers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '3rem' }}>
              No offers yet. Keep applying!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {offers.map(o => (
                <div key={o.id} className="panel" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{o.company_name}</h3>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: 'var(--clr-muted)' }}>
                        {o.role_title} · <strong style={{ color: '#10b981' }}>₹{o.ctc_offered} LPA</strong>
                      </p>
                    </div>
                    <span className={`status-badge ${o.status === 'accepted' ? 'graded' : o.status === 'declined' ? 'critical' : 'submitted'}`}>
                      {o.status}
                    </span>
                  </div>

                  {o.acceptance_deadline && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', margin: '0.5rem 0 0' }}>
                      Deadline: {new Date(o.acceptance_deadline).toLocaleDateString()}
                    </p>
                  )}

                  {o.status === 'issued' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                      <button className="action-btn"
                        disabled={responding[o.id]}
                        onClick={() => respondOffer(o.id, true)}>
                        {responding[o.id] ? '…' : '✅ Accept Offer'}
                      </button>
                      <button className="action-btn btn-secondary"
                        disabled={responding[o.id]}
                        onClick={() => respondOffer(o.id, false)}>
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
