import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function StateContainer({ loading, error, isEmpty, emptyMessage, onRetry, children }) {
  if (loading) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--clr-muted)' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--clr-border)',
          borderTopColor: 'var(--clr-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 1rem auto'
        }} />
        <p style={{ fontSize: '0.9rem', fontWeight: '500' }}>Fetching latest data from server…</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '1.5rem',
        margin: '1rem 0',
        borderRadius: '8px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid var(--clr-danger)',
        color: 'var(--clr-danger)',
        textAlign: 'center'
      }}>
        <p style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <AlertTriangle size={18} /> Couldn't load your data
        </p>
        <p style={{ fontSize: '0.85rem', marginBottom: '1rem', opacity: 0.9 }}>{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--clr-danger)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.825rem'
            }}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{
        padding: '3rem 1.5rem',
        margin: '1rem 0',
        borderRadius: '12px',
        background: 'var(--clr-panel)',
        border: '1px dashed var(--clr-border)',
        textAlign: 'center',
        color: 'var(--clr-muted)'
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '48px', height: '48px', margin: '0 auto 0.75rem auto', opacity: 0.5 }}>
          <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>
        </svg>
        <p style={{ fontSize: '0.95rem', fontWeight: '500', color: 'var(--clr-text)', marginBottom: '0.25rem' }}>
          {emptyMessage || 'No data recorded yet.'}
        </p>
        <p style={{ fontSize: '0.825rem' }}>Data will appear here automatically once added.</p>
      </div>
    );
  }

  return children;
}
