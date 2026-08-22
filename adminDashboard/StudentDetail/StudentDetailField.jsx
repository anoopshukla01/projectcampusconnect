/**
 * StudentDetailField Component
 * ============================
 * Schema-driven, modular field renderer supporting:
 * - Specific input types (Text, Number, Select, Boolean toggle, Textarea, Phone, URL, Photo)
 * - Granular client-side validation & inline error messaging
 * - Input sanitization (e.g. phone number digit stripping)
 * - Safe null/undefined fallback ('—')
 * - Optimistic editing with smooth saving state
 */

import { useState, useEffect } from 'react';
import { Edit3, Check, X, Mail, Phone, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { getFieldSchema, formatFieldValue } from './fieldSchema';
import PhotoUploader from './PhotoUploader';

export default function StudentDetailField({
  field,
  value,
  isEditing,
  draftValue,
  canEdit = true,
  isSensitive = false,
  saving = false,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSave,
}) {
  const schema = getFieldSchema(field);
  const label = schema.label;

  const validationError = isEditing && schema.validate ? schema.validate(draftValue) : null;

  const handleChange = (e) => {
    let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (schema.sanitize && typeof val === 'string') {
      val = schema.sanitize(val);
    }
    onDraftChange(field, val);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && schema.type !== 'textarea' && schema.type !== 'photo') {
      e.preventDefault();
      if (!validationError && !saving) {
        onSave(field);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit(field);
    }
  };

  // ── Read View Rendering ───────────────────────────────────────────────────
  const renderReadView = () => {
    if (value === null || value === undefined || value === '') {
      return <span className="sd-field-value sd-field-empty">—</span>;
    }

    if (schema.type === 'email') {
      return (
        <a
          href={`mailto:${value}`}
          className="sd-link-email"
          style={{
            color: 'var(--clr-secondary)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '.45rem',
            fontWeight: 500,
          }}
        >
          <Mail size={14} style={{ flexShrink: 0, opacity: 0.85 }} />
          <span>{String(value)}</span>
        </a>
      );
    }

    if (schema.type === 'url') {
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--clr-secondary)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '.45rem',
            fontWeight: 500,
          }}
        >
          <span style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {String(value)}
          </span>
          <ExternalLink size={13} style={{ flexShrink: 0 }} />
        </a>
      );
    }

    if (schema.type === 'phone') {
      return (
        <a
          href={`tel:${String(value).replace(/\D/g, '')}`}
          style={{
            color: 'var(--text-primary)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '.45rem',
            fontWeight: 500,
          }}
        >
          <Phone size={14} style={{ color: 'var(--clr-secondary)', flexShrink: 0, opacity: 0.85 }} />
          <span>{String(value)}</span>
        </a>
      );
    }

    if (schema.type === 'boolean') {
      return (
        <span
          className={`ad-badge ${value ? 'ad-badge-active' : 'ad-badge-inactive'}`}
          style={{ fontSize: '.75rem' }}
        >
          {formatFieldValue(field, value)}
        </span>
      );
    }

    if (field === 'cgpa') {
      const num = parseFloat(value);
      const badgeCls = isNaN(num) ? '' : num >= 8.0 ? 'sd-cgpa-high' : num >= 6.0 ? 'sd-cgpa-mid' : 'sd-cgpa-low';
      return <span className={`sd-cgpa-badge ${badgeCls}`}>{formatFieldValue(field, value)}</span>;
    }

    if (field === 'active_backlogs') {
      const count = parseInt(value, 10) || 0;
      return (
        <span className={`sd-cgpa-badge ${count > 0 ? 'sd-cgpa-low' : 'sd-cgpa-high'}`}>
          {count > 0 ? `${count} Backlog(s)` : 'Clear ✓'}
        </span>
      );
    }

    return <span className="sd-field-value">{formatFieldValue(field, value)}</span>;
  };

  // ── Edit Input Control Rendering ──────────────────────────────────────────
  const renderEditControl = () => {
    switch (schema.type) {
      case 'select':
        return (
          <select
            className="sd-edit-input sd-select"
            value={draftValue ?? ''}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            autoFocus
            aria-label={`Select ${label}`}
          >
            <option value="">-- Select {label} --</option>
            {(schema.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <label className="sd-toggle" title={`Toggle ${label}`}>
            <input
              type="checkbox"
              checked={Boolean(draftValue)}
              onChange={handleChange}
              aria-label={`Toggle ${label}`}
            />
            <span className="sd-toggle-track">
              <span className="sd-toggle-thumb" />
            </span>
            <span style={{ fontSize: '.84rem', color: 'var(--text-primary)' }}>
              {draftValue ? 'Enabled / Yes' : 'Disabled / No'}
            </span>
          </label>
        );

      case 'textarea':
        return (
          <textarea
            className="sd-edit-input sd-textarea"
            rows={3}
            value={draftValue ?? ''}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancelEdit(field);
            }}
            placeholder={schema.placeholder || `Enter ${label}`}
            autoFocus
            aria-label={`Edit ${label}`}
          />
        );

      case 'photo':
        return (
          <PhotoUploader
            currentUrl={value}
            saving={saving}
            onSave={(newUrl) => onSave(field, newUrl)}
            onCancel={() => onCancelEdit(field)}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            className={`sd-edit-input ${validationError ? 'sd-input-invalid' : ''}`}
            step={schema.step || 'any'}
            min={schema.min}
            max={schema.max}
            value={draftValue ?? ''}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={schema.placeholder || `Enter ${label}`}
            autoFocus
            aria-label={`Edit ${label}`}
          />
        );

      case 'phone':
        return (
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="tel"
              className={`sd-edit-input ${validationError ? 'sd-input-invalid' : ''}`}
              value={draftValue ?? ''}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={schema.placeholder || '10-digit phone'}
              maxLength={10}
              autoFocus
              aria-label={`Edit ${label}`}
            />
          </div>
        );

      default: // text, email, url, etc.
        return (
          <input
            type={schema.type === 'email' ? 'email' : schema.type === 'url' ? 'url' : 'text'}
            className={`sd-edit-input ${validationError ? 'sd-input-invalid' : ''}`}
            value={draftValue ?? ''}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={schema.placeholder || `Enter ${label}`}
            autoFocus
            aria-label={`Edit ${label}`}
          />
        );
    }
  };

  const isPhoto = schema.type === 'photo';

  return (
    <div className={`sd-field ${schema.fullWidth ? 'sd-field-full' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sd-field-label">
          {label}
          {isSensitive && (
            <span
              title="Sensitive field — requires confirmation to edit"
              style={{ marginLeft: '.35rem', color: 'var(--clr-warning)', cursor: 'help' }}
            >
              ⚠️
            </span>
          )}
        </span>
      </div>

      {isEditing ? (
        <div className="sd-field-edit-container">
          <div className="sd-editable-row" style={{ alignItems: schema.type === 'textarea' ? 'flex-start' : 'center' }}>
            {renderEditControl()}

            {!isPhoto && (
              <div style={{ display: 'flex', gap: '.35rem', flexShrink: 0 }}>
                <button
                  type="button"
                  className="ad-btn ad-btn-primary"
                  style={{ padding: '.35rem .65rem' }}
                  onClick={() => onSave(field)}
                  disabled={saving || Boolean(validationError)}
                  aria-label="Save"
                  title="Save changes"
                >
                  {saving ? <Loader2 size={13} className="sd-spin-icon" /> : <Check size={13} />}
                </button>
                <button
                  type="button"
                  className="ad-btn ad-btn-outline"
                  style={{ padding: '.35rem .65rem' }}
                  onClick={() => onCancelEdit(field)}
                  disabled={saving}
                  aria-label="Cancel"
                  title="Cancel edit"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {validationError && (
            <div className="sd-field-error">
              <AlertCircle size={12} />
              <span>{validationError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="sd-editable-row">
          {renderReadView()}
          {canEdit && !schema.readOnly && (
            <button
              type="button"
              className="ad-btn ad-btn-outline sd-field-edit-btn"
              style={{ padding: '.25rem .5rem', marginLeft: 'auto', flexShrink: 0 }}
              onClick={() => onStartEdit(field, value)}
              aria-label={`Edit ${label}`}
              title={`Edit ${label}`}
            >
              <Edit3 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
