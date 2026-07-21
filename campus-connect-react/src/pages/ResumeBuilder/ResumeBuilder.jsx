/**
 * Resume Builder — Student Portal
 *
 * Features:
 *  - 3-slot version saves (POST /students/me/resume)
 *  - Load any saved version (GET /students/me/resume/:version)
 *  - AI-powered suggestions panel (GET /students/me/resume/suggestions)
 *  - Live preview panel
 *  - Download / LaTeX template toasts
 *
 * Security: all requests use JWT cookie; student_id derived server-side.
 */

import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Save, Download, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { careerApi } from '../../services/api';
import './ResumeBuilder.css';

export default function ResumeBuilder() {
  const { user }  = useAuth();
  const showToast = useToast();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', linkedin: '', github: '',
    summary: '', skills: '', experience: '', education: '', projects: '',
  });

  const [versions,     setVersions]     = useState([]);
  const [suggestions,  setSuggestions]  = useState([]);
  const [loadingVers,  setLoadingVers]  = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [showSuggest,  setShowSuggest]  = useState(false);

  // ── Seed form from user profile ──────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setForm(p => ({
        ...p,
        name:      user.name  || '',
        email:     user.email || '',
        summary:   `Motivated ${user.branch || 'Engineering'} student with strong foundation in algorithms and software development.`,
        education: `B.Tech – ${user.branch || 'Computer Science Engineering'}\nGPA: ${user.cgpa || '—'} | Semester ${user.semester || '—'}`,
        skills:    user.skills || 'Python, JavaScript, React, SQL, Git',
      }));
    }
  }, [user]);

  // ── Load saved version list on mount ────────────────────────────────────
  const loadVersions = useCallback(async () => {
    setLoadingVers(true);
    const res = await careerApi.listResumeVersions();
    setLoadingVers(false);
    if (!res?.error) setVersions(res?.versions || []);
  }, []);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  // ── Load suggestions ─────────────────────────────────────────────────────
  async function fetchSuggestions() {
    const res = await careerApi.getResumeSuggestions();
    if (!res?.error) setSuggestions(res?.suggestions || []);
    setShowSuggest(true);
  }

  // ── Load a saved version into the form ───────────────────────────────────
  async function handleLoadVersion(version) {
    const res = await careerApi.getResumeVersion(version);
    if (res?.error) { showToast(res.error, 'error'); return; }
    const rj = res.resume_json || {};
    setForm(p => ({ ...p, ...rj }));
    showToast(`Version ${version} loaded into editor.`, 'success', 2500);
  }

  // ── Save current form as a new version ───────────────────────────────────
  async function handleSave() {
    setSaving(true);
    const res = await careerApi.saveResume({ resume_json: form });
    setSaving(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`Saved as Version ${res.version_number}! (Max 3 slots)`, 'success', 3000);
    loadVersions();
  }

  function handleChange(e) { setForm(p => ({ ...p, [e.target.name]: e.target.value })); }
  function handleDownload() { showToast('Resume PDF generated & downloading!', 'success', 3000); }
  function handleTemplate() { showToast('LaTeX template downloaded!', 'success', 2000); }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resume Builder</h1>
          <p className="page-sub">Build, save & export your professional resume</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={fetchSuggestions} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Lightbulb size={14} /> Suggestions
          </button>
          <button className="btn-secondary" onClick={handleTemplate}>LaTeX Template</button>
          <button className="btn-secondary" disabled={saving} onClick={handleSave} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {saving ? 'Saving…' : <><Save size={14} /> Save Version</>}
          </button>
          <button className="action-btn" onClick={handleDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* AI Suggestions Panel */}
      {showSuggest && suggestions.length > 0 && (
        <section className="panel" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--clr-primary)' }}>
          <div className="panel-header">
            <h2 className="panel-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lightbulb size={16} /> Profile Suggestions
            </h2>
            <button className="modal-close" onClick={() => setShowSuggest(false)}><X size={16} /></button>
          </div>
          <ul style={{ margin: '0 0 0 1.25rem', padding: 0 }}>
            {suggestions.map((s, i) => (
              <li key={i} style={{ marginBottom: '0.35rem', fontSize: '0.9rem', color: 'var(--clr-text)' }}>
                <strong style={{ color: 'var(--clr-primary)' }}>{s.field}:</strong> {s.tip}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Saved Versions */}
      <section className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panel-header">
          <h2 className="panel-title" style={{ fontSize: '1rem' }}>Saved Versions (max 3)</h2>
        </div>
        {loadingVers ? (
          <p style={{ padding: '0.5rem 1rem', color: 'var(--clr-muted)', fontSize: '0.875rem' }}>Loading…</p>
        ) : versions.length === 0 ? (
          <p style={{ padding: '0.5rem 1rem', color: 'var(--clr-muted)', fontSize: '0.875rem' }}>
            No saved versions yet. Click "Save Version" to snapshot your current resume.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', flexWrap: 'wrap' }}>
            {versions.map(v => (
              <button key={v.id}
                className="filter-btn active"
                style={{ fontSize: '0.8rem' }}
                onClick={() => handleLoadVersion(v.version_number)}>
                v{v.version_number} — {v.created_at}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="resume-layout">
        {/* Form */}
        <section className="panel resume-form-panel" aria-labelledby="resumeFormTitle">
          <h2 className="panel-title" id="resumeFormTitle">Your Information</h2>

          <div className="form-section"><h3 className="form-section-title">Personal</h3>
            <div className="resume-grid-2">
              <label>Full Name<input name="name" value={form.name} onChange={handleChange} placeholder="Ananya Sharma"/></label>
              <label>Phone<input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210"/></label>
              <label>Email<input name="email" type="email" value={form.email} onChange={handleChange}/></label>
              <label>LinkedIn<input name="linkedin" value={form.linkedin} onChange={handleChange} placeholder="linkedin.com/in/..."/></label>
              <label className="full-width">GitHub<input name="github" value={form.github} onChange={handleChange} placeholder="github.com/..."/></label>
            </div>
          </div>

          <div className="form-section"><h3 className="form-section-title">Summary</h3>
            <textarea name="summary" rows="3" value={form.summary} onChange={handleChange}/>
          </div>

          <div className="form-section"><h3 className="form-section-title">Skills</h3>
            <textarea name="skills" rows="2" value={form.skills} onChange={handleChange} placeholder="Python, React, SQL…"/>
          </div>

          <div className="form-section"><h3 className="form-section-title">Education</h3>
            <textarea name="education" rows="3" value={form.education} onChange={handleChange}/>
          </div>

          <div className="form-section"><h3 className="form-section-title">Projects</h3>
            <textarea name="projects" rows="4" value={form.projects} onChange={handleChange} placeholder="Project Name – description and technologies used…"/>
          </div>

          <div className="form-section"><h3 className="form-section-title">Experience</h3>
            <textarea name="experience" rows="3" value={form.experience} onChange={handleChange}
              placeholder={"Company Name – Role (Month Year – Month Year)\n• Responsibility 1\n• Responsibility 2"}/>
          </div>
        </section>

        {/* Live Preview */}
        <section className="panel resume-preview-panel" aria-labelledby="previewTitle">
          <h2 className="panel-title" id="previewTitle">Live Preview</h2>
          <div className="resume-preview">
            <div className="rp-header">
              <h1 className="rp-name">{form.name || 'Your Name'}</h1>
              <p className="rp-contact">{[form.email, form.phone, form.linkedin, form.github].filter(Boolean).join(' · ')}</p>
            </div>
            {form.summary    && <><div className="rp-section-title">Summary</div><p className="rp-body">{form.summary}</p></>}
            {form.skills     && <><div className="rp-section-title">Skills</div><p className="rp-body">{form.skills}</p></>}
            {form.education  && <><div className="rp-section-title">Education</div><pre className="rp-body rp-pre">{form.education}</pre></>}
            {form.projects   && <><div className="rp-section-title">Projects</div><pre className="rp-body rp-pre">{form.projects}</pre></>}
            {form.experience && <><div className="rp-section-title">Experience</div><pre className="rp-body rp-pre">{form.experience}</pre></>}
          </div>
        </section>
      </div>
    </>
  );
}
