import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './ResumeBuilder.css';

export default function ResumeBuilder() {
  const { user }  = useAuth();
  const showToast = useToast();
  const [form, setForm] = useState({
    name: '', email: '',
    phone: '', linkedin: '', github: '',
    summary: '',
    skills: 'Python, JavaScript, React, SQL, Git, Data Structures, Algorithms',
    experience: '', education: '',
    projects: '',
  });

  useEffect(() => {
    if (user) {
      setForm(p => ({
        ...p,
        name: user.name || '',
        email: user.email || '',
        summary: `Motivated ${user.branch || 'Engineering'} student with strong foundation in algorithms and software development. Seeking an internship to apply technical skills in a real-world environment.`,
        education: `B.Tech – ${user.branch || 'Computer Science Engineering'}\nGPA: ${user.cgpa || '8.70'} | Semester ${user.semester || '6'}`
      }));
    }
  }, [user]);

  function handleChange(e) { setForm(p=>({...p,[e.target.name]:e.target.value})); }
  function handleDownload() { showToast('Resume PDF generated & downloading!','success',3000); }
  function handleTemplate() { showToast('LaTeX template downloaded!','success',2000); }

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Resume Builder</h1><p className="page-sub">Build & export your professional resume</p></div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button className="btn-secondary" onClick={handleTemplate}>LaTeX Template</button>
          <button className="action-btn" onClick={handleDownload}>⬇ Download PDF</button>
        </div>
      </div>

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
            <textarea name="experience" rows="3" value={form.experience} onChange={handleChange} placeholder="Company Name – Role (Month Year – Month Year)&#10;• Responsibility 1&#10;• Responsibility 2"/>
          </div>
        </section>

        {/* Live Preview */}
        <section className="panel resume-preview-panel" aria-labelledby="previewTitle">
          <h2 className="panel-title" id="previewTitle">Live Preview</h2>
          <div className="resume-preview">
            <div className="rp-header">
              <h1 className="rp-name">{form.name||'Your Name'}</h1>
              <p className="rp-contact">{[form.email,form.phone,form.linkedin,form.github].filter(Boolean).join(' · ')}</p>
            </div>
            {form.summary && <><div className="rp-section-title">Summary</div><p className="rp-body">{form.summary}</p></>}
            {form.skills && <><div className="rp-section-title">Skills</div><p className="rp-body">{form.skills}</p></>}
            {form.education && <><div className="rp-section-title">Education</div><pre className="rp-body rp-pre">{form.education}</pre></>}
            {form.projects && <><div className="rp-section-title">Projects</div><pre className="rp-body rp-pre">{form.projects}</pre></>}
            {form.experience && <><div className="rp-section-title">Experience</div><pre className="rp-body rp-pre">{form.experience}</pre></>}
          </div>
        </section>
      </div>
    </>
  );
}
