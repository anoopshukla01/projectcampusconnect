/**
 * ImageDropzone.jsx
 * ─────────────────
 * Drag-and-drop profile image uploader with:
 *   • file-type validation (.jpg, .jpeg, .png, .webp)
 *   • max file size check (default 5 MB)
 *   • live image preview
 *   • initials-based fallback avatar
 *   • accessible keyboard + click trigger
 *
 * Props
 * ─────
 *   currentImage   {string|null}  – existing photo URL/data-URL
 *   name           {string}       – user name (for initials fallback)
 *   accent         {string}       – hex accent colour
 *   onImageChange  {fn(dataURL)}  – called with new image as base64 data-URL
 *   maxSizeMB      {number}       – max file size in MB (default 5)
 */

import { useState, useRef, useCallback } from 'react';
import { UploadCloud, X, User } from 'lucide-react';
import './ImageDropzone.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXTS  = '.jpg, .jpeg, .png, .webp';

export default function ImageDropzone({
  currentImage,
  name = '',
  accent = '#3b82f6',
  onImageChange,
  maxSizeMB = 5,
}) {
  const [dragging,  setDragging]  = useState(false);
  const [preview,   setPreview]   = useState(currentImage ?? null);
  const [error,     setError]     = useState('');
  const inputRef = useRef(null);

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'CC';

  // ── Validate and read file ──────────────────────────────────────
  const processFile = useCallback((file) => {
    setError('');
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, or WebP images are supported.');
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${maxSizeMB} MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataURL = e.target.result;
      setPreview(dataURL);
      onImageChange?.(dataURL);
    };
    reader.readAsDataURL(file);
  }, [maxSizeMB, onImageChange]);

  // ── Drag events ─────────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  };
  const onInputChange = (e) => processFile(e.target.files?.[0]);

  const clearImage = (e) => {
    e.stopPropagation();
    setPreview(null);
    setError('');
    onImageChange?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="idz-root">
      {/* ── Drop zone ────────────────────────────────────────────── */}
      <div
        className={`idz-zone ${dragging ? 'idz-zone--drag' : ''} ${preview ? 'idz-zone--has-image' : ''}`}
        style={{ '--idz-accent': accent }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={!preview ? openPicker : undefined}
        role="button"
        tabIndex={0}
        aria-label="Upload profile photo"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
      >
        {preview ? (
          /* ── Preview ─────────────────────────── */
          <div className="idz-preview-wrap">
            <img src={preview} alt="Profile preview" className="idz-preview-img" />
            <div className="idz-preview-overlay">
              <button
                className="idz-change-btn"
                onClick={openPicker}
                style={{ background: accent }}
                title="Change photo"
              >
                <UploadCloud size={15} />
                Change
              </button>
              <button
                className="idz-remove-btn"
                onClick={clearImage}
                title="Remove photo"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* ── Empty state ─────────────────────── */
          <div className="idz-empty">
            <div className="idz-avatar-fallback" style={{ background: `${accent}22`, color: accent }}>
              {name ? (
                <span className="idz-initials">{initials}</span>
              ) : (
                <User size={32} color={accent} />
              )}
            </div>
            <div className="idz-empty-text">
              <UploadCloud size={20} color={accent} />
              <span>
                <strong>Drag & drop</strong> your photo here<br />
                or <span style={{ color: accent, fontWeight: 700 }}>click to browse</span>
              </span>
            </div>
            <p className="idz-hint">Supports {ACCEPTED_EXTS} · Max {maxSizeMB} MB</p>
          </div>
        )}

        {/* ── Drag overlay ─────────────────────────────────────────── */}
        {dragging && (
          <div className="idz-drag-overlay" style={{ borderColor: accent }}>
            <UploadCloud size={36} color={accent} />
            <p>Drop your photo here</p>
          </div>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <p className="idz-error" role="alert">
          <X size={13} /> {error}
        </p>
      )}

      {/* ── 1:1 aspect-ratio guide hint ──────────────────────────── */}
      {preview && (
        <p className="idz-aspect-hint">
          For best results, use a 1:1 square crop (ID-card standard).
        </p>
      )}

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={onInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
