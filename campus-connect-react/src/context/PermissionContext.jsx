import { createContext, useContext, useState, useCallback } from 'react';

const PermissionContext = createContext(null);

export const PERMISSION_TYPES = {
  DOCUMENTS: {
    key: 'documents',
    title: 'Photos & Document Access Required',
    icon: '📄',
    description: 'Campus Connect needs permission to access your documents and file storage.',
    useCase: 'Used for uploading Resume PDFs, assignment submissions, profile pictures, and certificate documents.',
    privacyNote: 'Files are stored securely on encrypted database storage and shared only with authorized placement cells/faculty.'
  },
  CAMERA: {
    key: 'camera',
    title: 'Camera Access Required',
    icon: '📸',
    description: 'Campus Connect needs permission to access your camera.',
    useCase: 'Used for AI Mock Interviews, online proctored viva exams, and student ID verification.',
    privacyNote: 'Video feed is processed locally for interview analysis and is never recorded without explicit prompt.'
  },
  MICROPHONE: {
    key: 'microphone',
    title: 'Microphone Access Required',
    icon: '🎙️',
    description: 'Campus Connect needs permission to access your microphone.',
    useCase: 'Used for speech analysis during AI Mock Interviews and live viva evaluations.',
    privacyNote: 'Audio is used strictly for speech-to-text response scoring.'
  },
  NOTIFICATIONS: {
    key: 'notifications',
    title: 'Push Notifications Consent',
    icon: '🔔',
    description: 'Stay updated with real-time placement drive alerts and class schedules.',
    useCase: 'Get instant alerts when shortlisted for a Placement Drive, interview calls, or urgent assignment deadlines.',
    privacyNote: 'You can customize or mute notification categories anytime in account settings.'
  },
  DPDP_CONSENT: {
    key: 'dpdpConsent',
    title: 'Legal Data & DPDP Consent',
    icon: '🛡️',
    description: 'Digital Personal Data Protection (DPDP) Act 2023 Compliance',
    useCase: 'Authorizes Campus Connect to store your academic metrics (CGPA, Attendance, Backlogs) and share them exclusively with verified recruiters for placement drives.',
    privacyNote: 'Protected under DPDP Act 2023. You retain full rights to correct, access, or revoke data consent.'
  }
};

export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState(() => {
    try {
      const saved = localStorage.getItem('cc_permissions');
      return saved ? JSON.parse(saved) : {
        documents: false,
        camera: false,
        microphone: false,
        notifications: false,
        dpdpConsent: true
      };
    } catch {
      return { documents: false, camera: false, microphone: false, notifications: false, dpdpConsent: true };
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
