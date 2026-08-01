import { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@ctx/ToastContext';
import { adminApi, professorsApi } from '@/services/api';
import '@admin/admin.shared.css';
import './ProfessorAssignments.css';

export default function ProfessorAssignments() {
  const showToast = useToast();
  const [assignments, setAssignments] = useState([]);
  const [professors, setProfessors]   = useState([]);
  const [branches, setBranches]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [profFilter, setProfFilter]   = useState('all');

  // Modal state
  const [showModal, setShowModal]     = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [form, setForm]               = useState({
    professor_user_id: '',
    course_name: '',
    course_code: '',
    branch: '',
    semester: '1',
    academic_year: `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [assignRes, profsRes, branchRes] = await Promise.all([
        adminApi.listProfessorAssignments(),
        professorsApi.list(),
        adminApi.listBranches({ active_only: true }),
      ]);

      if (assignRes?.error) showToast(assignRes.error, 'error');
      else setAssignments(assignRes?.assignments || []);

      const profList = profsRes?.professors || profsRes?.data || profsRes || [];
      setProfessors(Array.isArray(profList) ? profList : []);

      if (branchRes?.branches) {
        setBranches(branchRes.branches);
      }
    } catch (err) {
      showToast('Failed to load professor class assignments.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingItem(null);
    setForm({
      professor_user_id: professors[0]?.id || professors[0]?.user_id || '',
      course_name: '',
      course_code: '',
      branch: branches[0]?.code || '',
      semester: '1',
      academic_year: `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`,
    });
    setShowModal(true);
  }

  function handleOpenEdit(item) {
    setEditingItem(item);
    setForm({
      professor_user_id: item.professor_user_id,
      course_name: item.course_name,
      course_code: item.course_code,
      branch: item.branch,
      semester: String(item.semester),
      academic_year: item.academic_year || '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.professor_user_id || !form.course_name.trim() || !form.course_code.trim() || !form.branch) {
      showToast('Professor, course name, course code, and branch are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        professor_user_id: form.professor_user_id,
        course_name: form.course_name.trim(),
        course_code: form.course_code.trim().toUpperCase(),
        branch: form.branch.trim().toUpperCase(),
        semester: Number(form.semester),
        academic_year: form.academic_year.trim() || null,
      };

      let res;
      if (editingItem) {
        res = await adminApi.updateProfessorAssignment(editingItem.id, payload);
      } else {
        res = await adminApi.createProfessorAssignment(payload);
      }

      if (res?.error) {
        showToast(res.error, 'error');
      } else {
        showToast(editingItem ? 'Assignment updated.' : 'Professor assigned to course.', 'success');
        setShowModal(false);
        const refreshed = await adminApi.listProfessorAssignments();
        if (refreshed?.assignments) setAssignments(refreshed.assignments);
      }
    } catch (err) {
      showToast('Failed to save assignment.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item) {
    try {
      let res;
      if (item.is_active) {
        res = await adminApi.deactivateProfessorAssignment(item.id);
      } else {
        res = await adminApi.updateProfessorAssignment(item.id, { is_active: true });
      }
      if (res?.error) {
        showToast(res.error, 'error');
      } else {
        showToast(item.is_active ? 'Assignment deactivated.' : 'Assignment reactivated.', 'success');
        setAssignments(prev =>
          prev.map(a => (a.id === item.id ? { ...a, is_active: !item.is_active } : a))
        );
      }
    } catch (err) {
      showToast('Failed to toggle status.', 'error');
    }
  }

  const filteredAssignments = assignments.filter(a => {
    const matchesSearch =
      a.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.course_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.professor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.branch.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProf = profFilter === 'all' || a.professor_user_id === profFilter;
    return matchesSearch && matchesProf;
  });

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">
            <BookOpen size={24} className="title-icon" aria-hidden="true" />
            Professor Class Assignments
          </h1>
          <p className="admin-page-subtitle">
            Assign professors to teach specific courses, branches, and semesters across your college.
          </p>
        </div>
        <button className="action-btn" onClick={handleOpenCreate}>
          <Plus size={16} aria-hidden="true" /> Assign Class
        </button>
      </div>

      {/* Controls & Search */}
      <div className="prof-assign-controls">
        <div className="search-bar">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by course, code, branch, or professor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="prof-select-filter">Professor:</label>
          <select
            id="prof-select-filter"
            value={profFilter}
            onChange={e => setProfFilter(e.target.value)}
          >
            <option value="all">All Professors</option>
            {professors.map(p => (
              <option key={p.id || p.user_id} value={p.id || p.user_id}>
                {p.name || p.full_name || p.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state">
          <RefreshCw size={24} className="spinner" aria-hidden="true" />
          <p>Loading assignments...</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={40} aria-hidden="true" />
          <h3>No Class Assignments Found</h3>
          <p>Assign a professor to a course using the "+ Assign Class" button above.</p>
        </div>
      ) : (
        <div className="prof-assign-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Professor</th>
                <th>Course Name</th>
                <th>Course Code</th>
                <th>Branch</th>
                <th>Semester</th>
                <th>Academic Year</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map(item => (
                <tr key={item.id} className={!item.is_active ? 'inactive-row' : ''}>
                  <td>
                    <div className="prof-info">
                      <span className="prof-name">{item.professor_name || 'Professor'}</span>
                      <span className="prof-email">{item.professor_email}</span>
                    </div>
                  </td>
                  <td><strong>{item.course_name}</strong></td>
                  <td><code>{item.course_code}</code></td>
                  <td><span className="badge branch-badge">{item.branch}</span></td>
                  <td>Sem {item.semester}</td>
                  <td>{item.academic_year || '—'}</td>
                  <td>
                    <span className={`badge ${item.is_active ? 'badge-success' : 'badge-muted'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => handleOpenEdit(item)}
                        title="Edit Assignment"
                      >
                        Edit
                      </button>
                      <button
                        className={`btn-icon ${item.is_active ? 'btn-deactivate' : 'btn-activate'}`}
                        onClick={() => handleToggleActive(item)}
                        title={item.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        {item.is_active ? (
                          <>
                            <XCircle size={14} aria-hidden="true" /> Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle size={14} aria-hidden="true" /> Activate
                          </>
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-card">
            <div className="modal-header">
              <h2>{editingItem ? 'Edit Class Assignment' : 'Assign Professor to Class'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="prof-assign-form">
              <label>
                Professor <span className="req">*</span>
                <select
                  required
                  disabled={Boolean(editingItem)}
                  value={form.professor_user_id}
                  onChange={e => setForm(p => ({ ...p, professor_user_id: e.target.value }))}
                >
                  <option value="" disabled>Select a professor...</option>
                  {professors.map(p => (
                    <option key={p.id || p.user_id} value={p.id || p.user_id}>
                      {p.name || p.full_name || p.email} ({p.department || 'Faculty'})
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-grid-2">
                <label>
                  Course Name <span className="req">*</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures & Algorithms"
                    value={form.course_name}
                    onChange={e => setForm(p => ({ ...p, course_name: e.target.value }))}
                  />
                </label>
                <label>
                  Course Code <span className="req">*</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS101"
                    value={form.course_code}
                    onChange={e => setForm(p => ({ ...p, course_code: e.target.value.toUpperCase() }))}
                  />
                </label>
              </div>

              <div className="form-grid-2">
                <label>
                  Branch <span className="req">*</span>
                  <select
                    required
                    value={form.branch}
                    onChange={e => setForm(p => ({ ...p, branch: e.target.value }))}
                  >
                    <option value="" disabled>Select branch...</option>
                    {branches.map(b => (
                      <option key={b.id || b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Semester <span className="req">*</span>
                  <select
                    required
                    value={form.semester}
                    onChange={e => setForm(p => ({ ...p, semester: e.target.value }))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Academic Year (optional)
                <input
                  type="text"
                  placeholder="e.g. 2025-26"
                  value={form.academic_year}
                  onChange={e => setForm(p => ({ ...p, academic_year: e.target.value }))}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="action-btn secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="action-btn primary" disabled={saving}>
                  {saving ? 'Saving...' : editingItem ? 'Update Assignment' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
