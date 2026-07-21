import { createContext, useContext, useState, useCallback } from 'react';

const PermissionContext = createContext(null);

// ── Icon components (replaces emojis for consistent UI icon style) ────────────
const IcoDocument = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IcoCamera = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
  </svg>
);
const IcoMic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const IcoBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IcoShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

export const PERMISSION_TYPES = {
  DOCUMENTS: {
    key: 'documents',
    title: 'Photos & Document Access Required',
    icon: <IcoDocument />,
    description: 'Campus Connect needs permission to access your documents and file storage.',
    useCase: 'Used for uploading Resume PDFs, assignment submissions, profile pictures, and certificate documents.',
    privacyNote: 'Files are stored securely on encrypted database storage and shared only with authorized placement cells/faculty.'
  },
  CAMERA: {
    key: 'camera',
    title: 'Camera Access Required',
    icon: <IcoCamera />,
    description: 'Campus Connect needs permission to access your camera.',
    useCase: 'Used for AI Mock Interviews, online proctored viva exams, and student ID verification.',
    privacyNote: 'Video feed is processed locally for interview analysis and is never recorded without explicit prompt.'
  },
  MICROPHONE: {
    key: 'microphone',
    title: 'Microphone Access Required',
    icon: <IcoMic />,
    description: 'Campus Connect needs permission to access your microphone.',
    useCase: 'Used for speech analysis during AI Mock Interviews and live viva evaluations.',
    privacyNote: 'Audio is used strictly for speech-to-text response scoring.'
  },
  NOTIFICATIONS: {
    key: 'notifications',
    title: 'Push Notifications Consent',
    icon: <IcoBell />,
    description: 'Stay updated with real-time placement drive alerts and class schedules.',
    useCase: 'Get instant alerts when shortlisted for a Placement Drive, interview calls, or urgent assignment deadlines.',
    privacyNote: 'You can customize or mute notification categories anytime in account settings.'
  },
  DPDP_CONSENT: {
    key: 'dpdpConsent',
    title: 'Legal Data & DPDP Consent',
    icon: <IcoShield />,
    description: 'Digital Personal Data Protection (DPDP) Act 2023 Compliance',
    useCase: 'Authorizes Campus Connect to store your academic metrics (CGPA, Attendance, Backlogs) and share them exclusively with verified recruiters for placement drives.',
    privacyNote: 'Protected under DPDP Act 2023. You retain full rights to correct, access, or revoke data consent.'
  }
};


export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState(() => {
    try {
      const saved = localStorage.getItem('cc_permissions');
      if (saved) {
        const parsed = JSON.parse(saved);
        // One-time migration: if dpdpConsent was previously auto-set to true
        // (old default) without an explicit consent timestamp, reset it to false
        // so the user sees the consent prompt properly.
        if (parsed.dpdpConsent === true && !localStorage.getItem('cc_dpdp_consent_at')) {
          parsed.dpdpConsent = false;
          localStorage.setItem('cc_permissions', JSON.stringify(parsed));
        }
        return parsed;
      }
      return {
        documents: false,
        camera: false,
        microphone: false,
        notifications: false,
        dpdpConsent: false,
      };
    } catch {
      return { documents: false, camera: false, microphone: false, notifications: false, dpdpConsent: false };
    }
  });

  const [activePrompt, setActivePrompt] = useState(null);

  const requestPermission = useCallback((typeKey, onGranted, onDenied) => {
    const config = Object.values(PERMISSION_TYPES).find(p => p.key === typeKey);
    if (!config) return;

    if (permissions[typeKey]) {
      if (onGranted) onGranted();
      return;
    }

    setActivePrompt({ config, onGranted, onDenied });
  }, [permissions]);

  const grantPermission = useCallback((key, sessionOnly = false) => {
    setPermissions(prev => {
      const next = { ...prev, [key]: true };
      if (!sessionOnly) {
        localStorage.setItem('cc_permissions', JSON.stringify(next));
      }
      return next;
    });

    if (activePrompt && activePrompt.onGranted) {
      activePrompt.onGranted();
    }
    setActivePrompt(null);
  }, [activePrompt]);

  const denyPermission = useCallback(() => {
    if (activePrompt && activePrompt.onDenied) {
      activePrompt.onDenied();
    }
    setActivePrompt(null);
  }, [activePrompt]);

  return (
    <PermissionContext.Provider value={{ permissions, requestPermission, activePrompt, grantPermission, denyPermission }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
