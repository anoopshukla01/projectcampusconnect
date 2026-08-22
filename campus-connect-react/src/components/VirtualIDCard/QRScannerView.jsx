/**
 * QRScannerView.jsx
 * ─────────────────
 * Live Camera & Image File QR Scanner for Campus Connect ID Badges.
 *
 * Strategy:
 *  - On Android (Capacitor native): uses @capacitor-mlkit/barcode-scanning,
 *    which launches the real native camera scanner overlay.
 *    html5-qrcode can't access the camera inside Android WebView so we bypass it.
 *  - On Web browser: falls back to html5-qrcode (getUserMedia works fine there).
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  Camera, Upload, MessageSquare, RefreshCw,
  CheckCircle2, AlertCircle, Copy, Check
} from 'lucide-react';
import './QRScannerView.css';

// ── Lazy-import helpers so the web bundle still treeshakes cleanly ────────────
const isNative = Capacitor.isNativePlatform();

async function scanWithNativeCamera() {
  const { BarcodeScanner, BarcodeFormat } =
    await import('@capacitor-mlkit/barcode-scanning');

  // Request camera permission
  const { camera } = await BarcodeScanner.requestPermissions();
  if (camera !== 'granted' && camera !== 'limited') {
    throw new Error('Camera permission denied');
  }

  // Open the full-screen native scanner overlay
  const { barcodes } = await BarcodeScanner.scan({
    formats: [BarcodeFormat.QrCode],
  });

  if (!barcodes || barcodes.length === 0) return null;
  return barcodes[0].rawValue;
}

// ── Parse decoded QR content into a Campus Connect member info object ─────────
function parseQRPayload(decodedText) {
  try {
    if (
      decodedText.includes('/chats') ||
      decodedText.includes('userId=') ||
      decodedText.includes('email=')
    ) {
      const url = new URL(
        decodedText.startsWith('http') ? decodedText : `https://dummy.com/${decodedText}`
      );
      const p = url.searchParams;
      return {
        userId: p.get('userId') || '',
        name: p.get('name') || 'Campus Member',
        email: p.get('email') || '',
        role: p.get('role') || 'Student',
        sysId: p.get('sysId') || p.get('rollNo') || '',
        url: decodedText,
      };
    }
    if (decodedText.trim().startsWith('{') && decodedText.trim().endsWith('}')) {
      const obj = JSON.parse(decodedText);
      return {
        userId: obj.userId || obj.id || '',
        name: obj.name || obj.fullName || 'Campus Member',
        email: obj.email || '',
        role: obj.role || 'Student',
        sysId: obj.rollNo || obj.facultyId || obj.id || '',
        url: decodedText,
      };
    }
  } catch {
    // Not a specialized payload
  }
  return { name: 'Decoded QR Content', url: decodedText, raw: decodedText };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function QRScannerView({ onScanSuccess, accent = '#3b82f6' }) {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Web-only refs
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleDecoded = (decodedText) => {
    const info = parseQRPayload(decodedText);
    setScanResult(decodedText);
    setMemberInfo(info);
    setScannerActive(false);
    onScanSuccess?.(info);
  };

  // ── Native Android scanner ─────────────────────────────────────────────────
  const startNativeScanner = async () => {
    setCameraError(null);
    setScanResult(null);
    setMemberInfo(null);
    setScannerActive(true);
    try {
      const decoded = await scanWithNativeCamera();
      if (decoded) {
        handleDecoded(decoded);
      } else {
        setCameraError('No QR code found. Try scanning again.');
        setScannerActive(false);
      }
    } catch (err) {
      console.warn('Native scanner error:', err);
      setCameraError(err?.message || 'Scanner closed without reading a code.');
      setScannerActive(false);
    }
  };

  // ── Web browser scanner (html5-qrcode) ────────────────────────────────────
  const startWebScanner = async () => {
    setCameraError(null);
    setScanResult(null);
    setMemberInfo(null);
    setScannerActive(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('cc-qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
        (decodedText) => {
          stopWebScanner();
          handleDecoded(decodedText);
        },
        () => {} // ignore per-frame errors
      );
    } catch (err) {
      console.warn('Web camera scan failed:', err);
      setCameraError('Camera access unavailable. Upload a QR image below.');
      setScannerActive(false);
    }
  };

  const stopWebScanner = async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* ignore */ }
    }
    setScannerActive(false);
  };

  const startScanner = () => {
    if (isNative) {
      startNativeScanner();
    } else {
      startWebScanner();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('cc-qr-reader-file-temp');
      const decodedText = await html5QrCode.scanFile(file, true);
      handleDecoded(decodedText);
    } catch {
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
    navigate(
      `/chats?userId=${encodeURIComponent(memberInfo.userId || '')}&name=${encodeURIComponent(memberInfo.name || 'Member')}&email=${encodeURIComponent(memberInfo.email || '')}&role=${encodeURIComponent(memberInfo.role || 'student')}`
    );
  };

  useEffect(() => {
    startScanner();
    return () => {
      if (!isNative) stopWebScanner();
    };
  }, []);

  return (
    <div className="qrs-container">
      {!memberInfo ? (
        <div className="qrs-camera-box">
          {/* Web-only viewfinder div — hidden on native */}
          {!isNative && <div id="cc-qr-reader" className="qrs-video-stage" />}
          <div id="cc-qr-reader-file-temp" style={{ display: 'none' }} />

          {/* Native scanning in-progress state */}
          {isNative && scannerActive && (
            <div className="qrs-native-scanning">
              <div className="qrs-native-spinner" />
              <p className="qrs-instruction">Opening camera scanner…</p>
            </div>
          )}

          {/* Web scanning overlay */}
          {!isNative && scannerActive && (
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
                <Camera size={14} /> {isNative ? 'Open Camera Scanner' : 'Start Camera'}
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
            {(memberInfo.userId || memberInfo.email) ? (
              <button
                type="button"
                className="qrs-btn qrs-btn-primary qrs-btn-large"
                style={{ background: accent }}
                onClick={handleDirectChat}
              >
                <MessageSquare size={16} /> Text {memberInfo.name.split(' ')[0]} on App
              </button>
            ) : null}
            <button type="button" className="qrs-btn qrs-btn-outline" onClick={handleCopy}>
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
            <button type="button" className="qrs-btn qrs-btn-outline" onClick={startScanner}>
              <RefreshCw size={14} /> Scan Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
