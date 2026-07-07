import { useNavigate } from 'react-router-dom';
import './PagePlaceholder.css';

export default function PagePlaceholder({ title, icon, description }) {
  const navigate = useNavigate();
  return (
    <div className="placeholder-page">
      <div className="placeholder-card">
        <div className="placeholder-icon" aria-hidden="true">{icon}</div>
        <h1 className="placeholder-title">{title}</h1>
        <p className="placeholder-desc">{description || 'This module is being migrated to React. Full feature parity coming soon!'}</p>
        <button className="action-btn" onClick={() => navigate('/')}>← Back to Dashboard</button>
      </div>
    </div>
  );
}
