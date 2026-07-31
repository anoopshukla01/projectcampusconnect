import { useState, useEffect } from 'react';
import { Building, Plus, Edit2, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@ctx/ToastContext';
import { adminApi } from '@/services/api';
import '@admin/admin.shared.css';
import './Branches.css';

export default function Branches() {
  const showToast = useToast();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all'); // 'all', 'active', 'inactive'

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  async function fetchBranches() {
    setLoading(true);
    try {
      const res = await adminApi.listBranches();
      if (res?.error) {
        showToast(res.error, 'error', 3000);
      } else {
        setBranches(res?.branches || []);
      }
    } catch (err) {
      showToast('Failed to load branches', 'error', 3000);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingBranch(null);
    setForm({ name: '', code: '' });
    setShowModal(true);
  }

  function handleOpenEdit(branch) {
    setEditingBranch(branch);
    setForm({ name: branch.name, code: branch.code });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      showToast('Name and short code are required.', 'error', 3000);
      return;
    }
    setSaving(true);
    try {
      if (editingBranch) {
        const res = await adminApi.updateBranch(editingBranch.id, {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase()
        });
        if (res?.error) {
          showToast(res.error, 'error', 3000);
        } else {
          showToast(res?.message || 'Branch updated successfully', 'success', 3000);
          setShowModal(false);
          fetchBranches();
        }
      } else {
        const res = await adminApi.createBranch({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase()
        });
        if (res?.error) {
          showToast(res.error, 'error', 3000);
        } else {
          showToast(res?.message || 'Branch created successfully', 'success', 3000);
          setShowModal(false);
          fetchBranches();
        }
      }
    } catch (err) {
      showToast('Action failed. Try again.', 'error', 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(branch) {
    const action = branch.is_active ? 'deactivate' : 'activate';
    if (branch.is_active) {
      if (!window.confirm(`Deactivate branch "${branch.code}" (${branch.name})?\n\nDeactivated branches will no longer appear in new selection dropdowns, but existing historical records will stay intact.`)) {
        return;
      }
    }

    try {
      const res = branch.is_active
        ? await adminApi.deactivateBranch(branch.id)
        : await adminApi.activateBranch(branch.id);

      if (res?.error) {
        showToast(res.error, 'error', 3000);
      } else {
        showToast(res?.message || `Branch ${action}d successfully.`, 'success', 3000);
        fetchBranches();
      }
    } catch (err) {
      showToast(`Failed to ${action} branch`, 'error', 3000);
    }
  }

  const filteredBranches = branches.filter(b => {
    if (filter === 'active') return b.is_active;
    if (filter === 'inactive') return !b.is_active;
    return true;
  });

  return (
    <div className="ad-root">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Manage Academic Branches</h1>
          <p className="page-sub">Configure per-college branches (e.g. CSE, ECE, ME) used across attendance, timetables, and assignments</p>
        </div>
        <div className="ad-header-actions">
          <button className="ad-btn ad-btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add Branch
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="branches-summary-grid">
        <div className="branches-summary-card">
          <span className="branches-card-label">Total Branches</span>
          <span className="branches-card-value">{branches.length}</span>
        </div>
        <div className="branches-summary-card text-success">
          <span className="branches-card-label">Active</span>
          <span className="branches-card-value">{branches.filter(b => b.is_active).length}</span>
        </div>
        <div className="branches-summary-card text-muted">
          <span className="branches-card-label">Deactivated</span>
          <span className="branches-card-value">{branches.filter(b => !b.is_active).length}</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="ad-card">
        <div className="ad-card-header" style={{ justifyContent: 'space-between' }}>
          <h2 className="ad-card-title"><Building size={18} style={{ display: 'inline', marginRight: '6px' }} /> College Branches</h2>
          <div className="branches-filter-pills">
            <button
              className={`branches-pill ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({branches.length})
            </button>
            <button
              className={`branches-pill ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Active ({branches.filter(b => b.is_active).length})
            </button>
            <button
              className={`branches-pill ${filter === 'inactive' ? 'active' : ''}`}
              onClick={() => setFilter('inactive')}
            >
              Deactivated ({branches.filter(b => !b.is_active).length})
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <div className="ad-spinner" style={{ margin: '0 auto 1rem auto' }} />
            <p>Loading college branches...</p>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="branches-empty-state">
            <AlertCircle size={32} />
            <p>No branches found.</p>
            {branches.length === 0 && (
              <button className="ad-btn ad-btn-primary" style={{ marginTop: '1rem' }} onClick={handleOpenCreate}>
                + Create Your First Branch
              </button>
            )}
          </div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Branch Name</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBranches.map(b => (
                  <tr key={b.id} className={!b.is_active ? 'row-deactivated' : ''}>
                    <td>
                      <span className="branch-code-badge">{b.code}</span>
                    </td>
                    <td>
                      <strong style={{ color: b.is_active ? '#f8fafc' : '#64748b' }}>{b.name}</strong>
                    </td>
                    <td>
                      {b.is_active ? (
                        <span className="ad-status-pill ad-pill-up">
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="ad-status-pill ad-pill-down">
                          <XCircle size={12} /> Deactivated
                        </span>
                      )}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          className="ad-btn ad-btn-outline"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => handleOpenEdit(b)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          className={`ad-btn ${b.is_active ? 'ad-btn-danger' : 'ad-btn-secondary'}`}
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => handleToggleActive(b)}
                        >
                          {b.is_active ? (
                            <><XCircle size={12} /> Deactivate</>
                          ) : (
                            <><RefreshCw size={12} /> Re-activate</>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="ad-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="ad-modal-box">
            <h3 className="ad-modal-title">{editingBranch ? 'Edit Branch' : 'Add New Branch'}</h3>
            <p className="ad-modal-sub">
              {editingBranch ? 'Modify branch details' : 'Add an academic branch to your college roster'}
            </p>
            <form onSubmit={handleSubmit}>
              <div className="ad-modal-fields">
                <div className="ad-field">
                  <label>Short Code (e.g. CSE, ECE, ME)</label>
                  <input
                    required
                    type="text"
                    maxLength={20}
                    placeholder="e.g. CSE"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    className="ad-input"
                  />
                </div>
                <div className="ad-field">
                  <label>Full Branch Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Computer Science & Engineering"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="ad-input"
                  />
                </div>
              </div>
              <div className="ad-modal-actions">
                <button type="button" className="ad-btn ad-btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="ad-btn ad-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
