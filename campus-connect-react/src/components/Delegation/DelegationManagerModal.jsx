/**
 * DelegationManagerModal Component
 * ================================
 * Allows Professors & Admins to assign or revoke special student sub-roles:
 * - Class Representative (CR)
 * - Core Student (CS)
 * - Placement Coordinator
 * with fine-grained permission scopes (canBroadcast, canEditSchedule, canViewLogs).
 */

import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, X, Check, Trash2, Megaphone, Calendar, FileText, AlertCircle } from 'lucide-react';
import { delegationsApi } from '../../services/api';
import './DelegationManagerModal.css';

export default function DelegationManagerModal({
  isOpen,
  onClose,
  students = [],
  batchId = 'General',
  onDelegationUpdated = null,
}) {
  const [delegations, setDelegations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [delegatedRole, setDelegatedRole] = useState('CLASS_REPRESENTATIVE');
  const [canBroadcast, setCanBroadcast] = useState(true);
  const [canEditSchedule, setCanEditSchedule] = useState(false);
  const [canViewLogs, setCanViewLogs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch active delegations for this batch
  const fetchDelegations = async () => {
    setLoading(true);
    try {
      const res = await delegationsApi.getDelegations({ batch_id: batchId });
      if (res && res.delegations) {
        setDelegations(res.delegations);
      }
    } catch (err) {
      console.error('Failed to load delegations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDelegations();
      setError(null);
      setSuccessMsg(null);
      if (students.length > 0) {
        setSelectedStudentId(students[0].id || students[0].student_id || students[0].roll_no);
      }
    }
  }, [isOpen, batchId, students]);

  if (!isOpen) return null;

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setError('Please select a student.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const studentObj = students.find(s => (s.id === selectedStudentId || s.student_id === selectedStudentId || s.roll_no === selectedStudentId));

    try {
      const payload = {
        student_id: studentObj?.id || studentObj?.student_id,
        roll_no: studentObj?.roll_no || selectedStudentId,
        delegated_role: delegatedRole,
        batch_id: batchId,
        can_broadcast: canBroadcast,
        can_edit_schedule: canEditSchedule,
        can_view_logs: canViewLogs,
      };

      const res = await delegationsApi.grantDelegation(payload);
      if (res && (res.success || !res.error)) {
        setSuccessMsg(res.message || 'Delegation granted successfully!');
        fetchDelegations();
        onDelegationUpdated?.();
      } else {
        setError(res?.error || 'Failed to grant delegation.');
      }
    } catch (err) {
      setError(err.message || 'Network error.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (delegationId) => {
    if (!window.confirm('Are you sure you want to revoke this student delegation?')) return;
    try {
      const res = await delegationsApi.revokeDelegation(delegationId);
      if (res && (res.success || !res.error)) {
        fetchDelegations();
        onDelegationUpdated?.();
      }
    } catch (err) {
      console.error('Revoke failed:', err);
    }
  };

  return (
    <div className="modal-overlay dmm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dmm-dialog" role="dialog" aria-modal="true" aria-labelledby="dmmTitle">
        {/* Header */}
        <div className="dmm-header">
          <div className="dmm-header-left">
            <div className="dmm-icon-wrap">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="dmm-title" id="dmmTitle">Student Role Delegation</h2>
              <p className="dmm-sub">Assign CR, Core Student, or Placement Lead privileges for {batchId}</p>
            </div>
          </div>
          <button className="dmm-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="dmm-content">
          {/* Grant Section */}
          <form className="dmm-form" onSubmit={handleGrant}>
            <div className="dmm-form-grid">
              <div className="dmm-field">
                <label className="dmm-label">Select Student</label>
                <select
                  className="dmm-select"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="">— Select from roster —</option>
                  {students.map((s) => (
                    <option key={s.id || s.roll_no} value={s.id || s.roll_no}>
                      {s.name || s.full_name} ({s.roll_no})
                    </option>
                  ))}
                </select>
              </div>

              <div className="dmm-field">
                <label className="dmm-label">Delegated Sub-Role</label>
                <select
                  className="dmm-select"
                  value={delegatedRole}
                  onChange={(e) => setDelegatedRole(e.target.value)}
                >
                  <option value="CLASS_REPRESENTATIVE">👑 Class Representative (CR)</option>
                  <option value="CORE_STUDENT">⚡ Core Student / Department Committee</option>
                  <option value="PLACEMENT_COORDINATOR">💼 Student Placement Coordinator</option>
                </select>
              </div>
            </div>

            {/* Permission Checkboxes */}
            <div className="dmm-perms-box">
              <span className="dmm-perms-title">Granted Administrative Capabilities:</span>
              <div className="dmm-checkbox-list">
                <label className="dmm-checkbox-item">
                  <input
                    type="checkbox"
                    checked={canBroadcast}
                    onChange={(e) => setCanBroadcast(e.target.checked)}
                  />
                  <Megaphone size={15} className="dmm-perm-icon text-blue" />
                  <div>
                    <span className="dmm-perm-name">Broadcast Section Announcements</span>
                    <span className="dmm-perm-desc">Post official notices to students in this batch</span>
                  </div>
                </label>

                <label className="dmm-checkbox-item">
                  <input
                    type="checkbox"
                    checked={canEditSchedule}
                    onChange={(e) => setCanEditSchedule(e.target.checked)}
                  />
                  <Calendar size={15} className="dmm-perm-icon text-violet" />
                  <div>
                    <span className="dmm-perm-name">Propose & Draft Timetable Adjustments</span>
                    <span className="dmm-perm-desc">Propose extra class slots or room adjustments</span>
                  </div>
                </label>

                <label className="dmm-checkbox-item">
                  <input
                    type="checkbox"
                    checked={canViewLogs}
                    onChange={(e) => setCanViewLogs(e.target.checked)}
                  />
                  <FileText size={15} className="dmm-perm-icon text-teal" />
                  <div>
                    <span className="dmm-perm-name">Inspect Raw Attendance Sheets</span>
                    <span className="dmm-perm-desc">View batch attendance records & export rosters</span>
                  </div>
                </label>
              </div>
            </div>

            {error && (
              <div className="dmm-alert dmm-alert-error">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="dmm-alert dmm-alert-success">
                <Check size={14} />
                <span>{successMsg}</span>
              </div>
            )}

            <button type="submit" className="dmm-submit-btn" disabled={saving}>
              <UserCheck size={16} />
              {saving ? 'Assigning Privileges...' : 'Assign Delegated Role'}
            </button>
          </form>

          {/* Active Delegations Table */}
          <div className="dmm-active-section">
            <h3 className="dmm-section-title">Active Batch Representatives & Leads</h3>
            {loading ? (
              <p className="dmm-empty">Loading active delegations...</p>
            ) : delegations.length === 0 ? (
              <p className="dmm-empty">No active CR or Core Student delegations for this batch.</p>
            ) : (
              <div className="dmm-table-wrap">
                <table className="dmm-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Delegated Tag</th>
                      <th>Permissions</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delegations.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{d.student_name}</div>
                          <code style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.roll_no}</code>
                        </td>
                        <td>
                          <span className={`dmm-role-badge badge-${d.delegated_role.toLowerCase()}`}>
                            {d.delegated_role === 'CLASS_REPRESENTATIVE' ? '👑 CR' : d.delegated_role === 'CORE_STUDENT' ? '⚡ Core' : '💼 Placement'}
                          </span>
                        </td>
                        <td>
                          <div className="dmm-pill-row">
                            {d.can_broadcast && <span className="dmm-perm-pill">Broadcast</span>}
                            {d.can_edit_schedule && <span className="dmm-perm-pill">Timetable</span>}
                            {d.can_view_logs && <span className="dmm-perm-pill">Attendance</span>}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="dmm-revoke-btn"
                            onClick={() => handleRevoke(d.id)}
                            title="Revoke Delegation"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
