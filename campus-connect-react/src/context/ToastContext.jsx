import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'default' });
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'default', duration = 3000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ visible: true, message, type });
    timerRef.current = setTimeout(() => {
      setToast(t => ({ ...t, visible: false }));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`toast${toast.visible ? ' show' : ''}${toast.type !== 'default' ? ' ' + toast.type : ''}`}
        >
          {toast.message}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
