/**
 * PhotoUploader Component
 * =======================
 * Modular Drag-and-Drop Image Uploader with instant preview,
 * client-side validation (types: png, jpeg, webp; size <= 5MB),
 * upload progress, and direct URL fallback mode.
 */

import { useState, useRef } from 'react';
import { UploadCloud, ImagePlus, Link2, Check, X, AlertCircle } from 'lucide-react';
import app from '@/config/firebase';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export default function PhotoUploader({ currentUrl, onSave, onCancel, saving }) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(currentUrl || null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const inputRef = useRef(null);

  function validateFile(f) {
    if (!f) return 'No file selected';
    if (!ALLOWED_TYPES.includes(f.type)) {
      return 'Invalid file type. Please upload a PNG, JPEG, or WEBP image.';
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return 'File size exceeds 5MB limit. Please choose a smaller image.';
    }
    return null;
  }

  function acceptFile(f) {
    setError(null);
    const err = validateFile(f);
    if (err) {
      setError(err);
      return;
    }

    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
    setUrlMode(false);
  }

  function onDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      acceptFile(e.dataTransfer.files[0]);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const storage = getStorage(app);
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `profile_photos/${Date.now()}_${cleanName}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file);

      task.on(
        'state_changed',
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setProgress(pct);
        },
        (err) => {
          console.error('Photo upload error:', err);
          setError('Failed to upload image. Please try again or use direct URL.');
          setUploading(false);
        },
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            setUploading(false);
            setProgress(0);
            onSave(url);
          } catch (urlErr) {
            setError('Failed to get download URL.');
            setUploading(false);
          }
        }
      );
    } catch (err) {
      console.error(err);
      setError('Upload initialization failed.');
      setUploading(false);
    }
  }

  function handleUrlSave() {
    setError(null);
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      setError('Please enter an image URL');
      return;
    }
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError('URL must begin with http:// or https://');
      return;
    }
    onSave(trimmed);
  }

  const circumference = 2 * Math.PI * 22;
  const dash = circumference - (progress / 100) * circumference;

  return (
    <div className="pu-root">
      {error && (
        <div className="sd-field-error" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Drop zone */}
      {!urlMode && (
        <div
          className={`pu-dropzone${isDragging ? ' pu-dropzone--over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          aria-label="Drop image here or click to browse"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
          />

          {preview ? (
            <div className="pu-preview-wrap">
              <img src={preview} alt="Preview" className="pu-preview" />
              {uploading && (
                <div className="pu-progress-overlay">
                  <svg width="52" height="52" viewBox="0 0 52 52" className="pu-ring">
                    <circle cx="26" cy="26" r="22" className="pu-ring-track" />
                    <circle
                      cx="26"
                      cy="26"
                      r="22"
                      className="pu-ring-fill"
                      strokeDasharray={circumference}
                      strokeDashoffset={dash}
                    />
                  </svg>
                  <span className="pu-pct">{progress}%</span>
                </div>
              )}
              {!uploading && (
                <div className="pu-preview-overlay">
                  <ImagePlus size={20} />
                  <span>Click or drop new image to replace</span>
                </div>
              )}
            </div>
          ) : (
            <div className="pu-empty">
              <UploadCloud size={36} className="pu-cloud-icon" />
              <p className="pu-drop-label">Drag & drop student photo here</p>
              <p className="pu-drop-hint">
                or <u>browse from device</u> — JPG, PNG, WEBP · max 5 MB
              </p>
            </div>
          )}
        </div>
      )}

      {/* URL fallback */}
      {urlMode && (
        <div className="pu-url-row">
          <input
            className="sd-edit-input"
            style={{ flex: 1 }}
            placeholder="https://example.com/student-photo.jpg"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            autoFocus
            aria-label="Photo URL"
          />
          <button
            type="button"
            className="ad-btn ad-btn-primary"
            style={{ padding: '.35rem .65rem' }}
            onClick={handleUrlSave}
            disabled={saving || !urlDraft.trim()}
            aria-label="Save URL"
          >
            <Check size={13} />
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="pu-actions">
        <button
          type="button"
          className="ad-btn ad-btn-outline"
          style={{ fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
          onClick={() => {
            setError(null);
            setUrlMode((v) => !v);
          }}
          disabled={uploading}
        >
          <Link2 size={12} /> {urlMode ? 'Upload from device' : 'Use Direct URL instead'}
        </button>

        <div style={{ display: 'flex', gap: '.5rem', marginLeft: 'auto' }}>
          <button
            type="button"
            className="ad-btn ad-btn-outline"
            style={{ padding: '.35rem .65rem' }}
            onClick={onCancel}
            disabled={uploading}
            aria-label="Cancel"
          >
            <X size={13} />
          </button>
          {!urlMode && (
            <button
              type="button"
              className="ad-btn ad-btn-primary"
              style={{ padding: '.35rem .75rem', display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}
              onClick={handleUpload}
              disabled={!file || uploading || saving}
              aria-label="Upload photo"
            >
              {uploading ? `${progress}%` : <><UploadCloud size={13} /> Upload & Save</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
