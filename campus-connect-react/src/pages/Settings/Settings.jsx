import { useState, useEffect } from 'react';
import { studentsApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './Settings.css';

export default function Settings() {
  const showToast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubVisible, setGithubVisible] = useState(false);
  const [linkedinVisible, setLinkedinVisible] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await studentsApi.getMe();
      setGithubUrl(res.github_url || '');
      setLinkedinUrl(res.linkedin_url || '');
      
      const visibility = res.social_links_visibility || {};
      setGithubVisible(!!visibility.github);
      setLinkedinVisible(!!visibility.linkedin);
    } catch (err) {
      showToast(err.message || 'Failed to load profile settings.', 'error');
    }
    setLoading(false);
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await studentsApi.updateMe({
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        social_links_visibility: {
          github: githubVisible,
          linkedin: linkedinVisible,
        },
      });
      showToast('Profile settings saved successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save settings.', 'error');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="settings-loading-container">
        <div className="ad-spinner"></div>
        <span>Loading settings…</span>
      </div>
    );
  }

  return (
    <div className="settings-page-wrapper">
      <div className="settings-page-header">
        <h1 className="settings-page-title">Profile Settings</h1>
        <p className="settings-page-sub">Manage your profile connections and resume visibility consent.</p>
      </div>

      <div className="settings-card-shell">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Connected Platforms (DPDP Compliant)</h2>
        </div>

        <form onSubmit={handleSaveSettings}>
          <p className="dpdp-consent-notice">
            ⚠️ <strong>DPDP Act Compliance:</strong> Connecting your platform accounts will NOT automatically expose them on your resume. You must explicitly check the boxes below to grant consent for placement cell and recruiters to view each link.
          </p>

          <div className="settings-form-group">
            <label className="settings-field-label" htmlFor="github-url-input">GitHub Profile URL</label>
            <input
              id="github-url-input"
              type="url"
              className="settings-text-input"
              placeholder="https://github.com/yourusername"
              value={githubUrl}
              onChange={e => setGithubUrl(e.target.value)}
            />
            <label className="settings-checkbox-container">
              <input
                type="checkbox"
                checked={githubVisible}
                onChange={e => setGithubVisible(e.target.checked)}
              />
              <span className="settings-checkbox-label">Show GitHub Link on my Resume</span>
            </label>
          </div>

          <div className="settings-form-group">
            <label className="settings-field-label" htmlFor="linkedin-url-input">LinkedIn Profile URL</label>
            <input
              id="linkedin-url-input"
              type="url"
              className="settings-text-input"
              placeholder="https://linkedin.com/in/yourusername"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
            />
            <label className="settings-checkbox-container">
              <input
                type="checkbox"
                checked={linkedinVisible}
                onChange={e => setLinkedinVisible(e.target.checked)}
              />
              <span className="settings-checkbox-label">Show LinkedIn Link on my Resume</span>
            </label>
          </div>

          <div className="settings-actions">
            <button type="submit" className="pd-btn pd-btn-primary" disabled={saving}>
              {saving ? 'Saving changes…' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
