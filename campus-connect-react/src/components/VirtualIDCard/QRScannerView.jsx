/**
 * QRScannerView.jsx
 * ─────────────────
 * Live Camera & Image File QR Scanner for Campus Connect ID Badges.
 * - Scans member QR codes via device camera or gallery upload.
 * - Detects member identity (Name, Role, Roll/ID, Email).
 * - Instant "Text on App" direct chat action or profile lookup.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera, Upload, MessageSquare, ExternalLink, RefreshCw,
  CheckCircle2, AlertCircle, User, ShieldCheck, Copy, Check
} from 'lucide-react';
import './QRScannerView.css';

export default function QRScannerView({ onScanSuccess, accent = '#3b82f6' }) {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [copied, setCopied] = useState(false);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Parse QR content to check if it's a Campus Connect chat / profile payload
  const parseQRPayload = (decodedText) => {
    try {
      if (decodedText.includes('/chats') || decodedText.includes('userId=') || decodedText.includes('email=')) {
        const url = new URL(decodedText.startsWith('http') ? decodedText : `https://dummy.com/${decodedText}`);
        const params = url.searchParams;
        return {
          userId: params.get('userId') || '',
          name: params.get('name') || 'Campus Member',
          email: params.get('email') || '',
          role: params.get('role') || 'Student',
          sysId: params.get('sysId') || params.get('rollNo') || '',
          url: decodedText,
        };
      }
      // JSON format
      if (decodedText.trim().startsWith('{') && decodedText.trim().endsWith('}')) {
        const parsed = JSON.parse(decodedText);
        return {
          userId: parsed.userId || parsed.id || '',
          name: parsed.name || parsed.fullName || 'Campus Member',
          email: parsed.email || '',
          role: parsed.role || 'Student',
          sysId: parsed.rollNo || parsed.facultyId || parsed.id || '',
          url: decodedText,
        };
      }
    } catch {
      // Not a specialized URL
    }
    return {
      name: 'Decoded QR Content',
      url: decodedText,
      raw: decodedText,
    };
  };

  const handleDecoded = (decodedText) => {
    const info = parseQRPayload(decodedText);
    setScanResult(decodedText);
    setMemberInfo(info);
    stopScanner();
    onScanSuccess?.(info);
  };

  const startScanner = async () => {
    setCameraError(null);
    setScanResult(null);
    setMemberInfo(null);
    setScannerActive(true);

    try {
      const html5QrCode = new Html5Qrcode('cc-qr-reader');
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleDecoded(decodedText);
        },
        () => {
          // ignore scan frame errors
        }
      );
    } catch (err) {
      console.warn('Camera scan initialization failed:', err);
      setCameraError('Camera access unavailable. You can upload a QR image below.');
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
    setScannerActive(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode('cc-qr-reader-file-temp');
      const decodedText = await html5QrCode.scanFile(file, true);
      handleDecoded(decodedText);
    } catch (err) {
      setCameraError('No valid QR code detected in the uploaded image.');
    }
  };

  const handleCopy = () => {
    if (scanResult && navigator.clipboard) {
      navigator.clipboard.writeText(scanResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDirectChat = () => {
    if (!memberInfo) return;
    const targetId = memberInfo.userId || '';
    const targetName = memberInfo.name || 'Member';
    const targetEmail = memberInfo.email || '';
    const targetRole = memberInfo.role || 'student';
    navigate(`/chats?userId=${encodeURIComponent(targetId)}&name=${encodeURIComponent(targetName)}&email=${encodeURIComponent(targetEmail)}&role=${encodeURIComponent(targetRole)}`);
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="qrs-container">
      {/* ── Viewfinder / Active Camera ── */}
      {!memberInfo ? (
        <div className="qrs-camera-box">
          <div id="cc-qr-reader" className="qrs-video-stage" />
          <div id="cc-qr-reader-file-temp" style={{ display: 'none' }} />

          {scannerActive && (
            <div className="qrs-overlay">
              <div className="qrs-reticle">
                <div className="qrs-laser-line" />
              </div>
              <p className="qrs-instruction">Point camera at any Campus ID QR Code</p>
            </div>
          )}

          {cameraError && (
            <div className="qrs-error-banner">
              <AlertCircle size={16} />
              <span>{cameraError}</span>
            </div>
          )}

          <div className="qrs-controls">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="qrs-btn qrs-btn-outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} /> Scan from Image File
            </button>
            {!scannerActive && (
              <button
                type="button"
                className="qrs-btn qrs-btn-primary"
                style={{ background: accent }}
                onClick={startScanner}
              >
                <RefreshCw size={14} /> Start Camera
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ── Scanned Result Card ── */
        <div className="qrs-result-card">
          <div className="qrs-result-header">
            <div className="qrs-success-icon">
              <CheckCircle2 size={24} color="#10b981" />
            </div>
            <div>
              <h3 className="qrs-result-title">QR Code Verified</h3>
              <p className="qrs-result-sub">Member card successfully recognized</p>
            </div>
          </div>

          <div className="qrs-member-details">
            <div className="qrs-detail-row">
              <span className="qrs-label">Name</span>
              <strong className="qrs-value">{memberInfo.name}</strong>
            </div>
            {memberInfo.sysId && (
              <div className="qrs-detail-row">
                <span className="qrs-label">Roll / ID</span>
                <span className="qrs-value">{memberInfo.sysId}</span>
              </div>
            )}
            {memberInfo.role && (
              <div className="qrs-detail-row">
                <span className="qrs-label">Role</span>
                <span className="qrs-value" style={{ textTransform: 'capitalize' }}>{memberInfo.role}</span>
              </div>
            )}
            {memberInfo.email && (
              <div className="qrs-detail-row">
                <span className="qrs-label">Email</span>
                <span className="qrs-value">{memberInfo.email}</span>
              </div>
            )}
          </div>

          <div className="qrs-actions">
            {memberInfo.userId || memberInfo.email ? (
              <button
                type="button"
                className="qrs-btn qrs-btn-primary qrs-btn-large"
                style={{ background: accent }}
                onClick={handleDirectChat}
              >
                <MessageSquare size={16} /> Text {memberInfo.name.split(' ')[0]} on App
              </button>
            ) : null}

            <button
              type="button"
              className="qrs-btn qrs-btn-outline"
              onClick={handleCopy}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>

            <button
              type="button"
              className="qrs-btn qrs-btn-outline"
              onClick={startScanner}
            >
              <RefreshCw size={14} /> Scan Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
