import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#090d16',
          color: '#f8fafc',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}>
          <div style={{
            background: '#131b2e',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '1rem',
            padding: '2.5rem',
            maxWidth: '540px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              color: '#ef4444',
            }}>
              <AlertTriangle size={28} />
            </div>

            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#fff' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              An unexpected error occurred while rendering this page.
            </p>

            {this.state.error?.message && (
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                color: '#fca5a5',
                textAlign: 'left',
                fontFamily: 'monospace',
                marginBottom: '1.5rem',
                wordBreak: 'break-word',
                maxHeight: '120px',
                overflowY: 'auto',
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#3b82f6',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} /> Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent',
                  color: '#cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Home size={14} /> Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
