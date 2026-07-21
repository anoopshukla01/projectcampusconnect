import { usePermissions } from '../../context/PermissionContext';
import { Lock, X } from 'lucide-react';
import './PermissionModal.css';

export function PermissionModal() {
  const { activePrompt, grantPermission, denyPermission } = usePermissions();

  if (!activePrompt || !activePrompt.config) return null;

  const { config } = activePrompt;

  return (
    <div className="perm-modal-overlay" onClick={denyPermission}>
      <div className="perm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="perm-modal-header">
          <div className="perm-modal-badge">{config.icon}</div>
          <button className="perm-modal-close" onClick={denyPermission} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="perm-modal-body">
          <h3 className="perm-modal-title">{config.title}</h3>
          <p className="perm-modal-desc">{config.description}</p>

          <div className="perm-use-case-box">
            <span className="perm-use-case-label">Why Campus Connect needs this:</span>
            <p className="perm-use-case-text">{config.useCase}</p>
          </div>

          <div className="perm-privacy-note">
            <span className="perm-lock-icon"><Lock size={14} /></span>
            <span>{config.privacyNote}</span>
          </div>
        </div>

        <div className="perm-modal-footer">
          <button className="perm-btn perm-btn-allow" onClick={() => grantPermission(config.key, false)}>
            Allow Always
          </button>
          <button className="perm-btn perm-btn-session" onClick={() => grantPermission(config.key, true)}>
            Only This Session
          </button>
          <button className="perm-btn perm-btn-deny" onClick={denyPermission}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
