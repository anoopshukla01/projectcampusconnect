import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Login.css';

const EyeOpen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const ROLES = [
  {
    id: 'student', label: 'Student',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    id: 'professor', label: 'Professor',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    id: 'tpo', label: 'Placement',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
  {
    id: 'admin', label: 'Admin',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

function isValidIdentifier(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^[A-Za-z0-9]{4,20}$/.test(v);
}
function isValidPassword(v) { return v.trim().length >= 6; }
function isValidEmail(v)    { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

/* ── Demo accounts hook ────────────────────────────────────────────────────── */
function useDemoAccounts() {
  const [accounts, setAccounts] = useState([]);
  useEffect(() => {
    fetch('/api/v1/auth/demo-accounts')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.accounts) setAccounts(d.accounts); })
      .catch(() => {
        // hardcoded fallback if backend unreachable
        setAccounts([
          { role: 'student',       label: 'Student',       login_id: 'CS21DEMO01',              password: 'Demo@1234', name: 'Arjun Mehta',         color: '#4f46e5' },
          { role: 'professor',     label: 'Professor',     login_id: 'professor@college.edu.in', password: 'Demo@1234', name: 'Dr. Priya Sharma',    color: '#0891b2' },
          { role: 'placement_cell',label: 'TPO / Placement',login_id: 'tpo@college.edu.in',      password: 'Demo@1234', name: 'Ritu Verma (TPO)',    color: '#059669' },
          { role: 'admin',         label: 'Admin',         login_id: 'admin@college.edu.in',    password: 'Demo@1234', name: 'Sanjay Kumar (Admin)',color: '#dc2626' },
        ]);
      });
  }, []);
  return accounts;
}

export default function Login() {
  const { login, register } = useAuth();
  const navigate  = useNavigate();
  const showToast = useToast();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState('login'); // 'login' | 'claim_student' | 'accept_invite'
  const demoAccounts = useDemoAccounts();
  const [demoOpen,  setDemoOpen]  = useState(false);
  const [demoFilling, setDemoFilling] = useState(null);

  /* Sign In */
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [role,       setRole]       = useState('student');
  const [loading,    setLoading]    = useState(false);
  const [idError,    setIdError]    = useState('');
  const [pwError,    setPwError]    = useState('');

  /* Claim Student */
  const [claimCollegeCode, setClaimCollegeCode] = useState('');
  const [claimRollNo,    setClaimRollNo]    = useState('');
  const [claimPhone,     setClaimPhone]     = useState('');
  const [claimOtp,       setClaimOtp]       = useState('');
  const [otpSent,        setOtpSent]        = useState(false);
  const [otpToken,       setOtpToken]       = useState('');
  const [otpVerified,    setOtpVerified]    = useState(false);
  const [claimPassword,  setClaimPassword]  = useState('');
  const [claimDpdp,      setClaimDpdp]      = useState(false);
  const [claimStepError, setClaimStepError] = useState('');

  /* Email Sign-Up (new) */
  const [signupMode,      setSignupMode]      = useState('email'); // 'email' | 'claim'
  const [signupEmail,     setSignupEmail]     = useState('');
  const [signupOtp,       setSignupOtp]       = useState('');
  const [signupOtpSent,   setSignupOtpSent]   = useState(false);
  const [signupOtpToken,  setSignupOtpToken]  = useState('');
  const [signupVerified,  setSignupVerified]  = useState(false);
  const [signupFullName,  setSignupFullName]  = useState('');
  const [signupPassword,  setSignupPassword]  = useState('');
  const [signupDpdp,      setSignupDpdp]      = useState(false);
  const [signupError,     setSignupError]     = useState('');

  /* Accept Invite */
  const [inviteToken,    setInviteToken]    = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');

  /* Forgot password modal */
  const [modalOpen,    setModalOpen]    = useState(false);
  const [resetEmail,   setResetEmail]   = useState('');
  const [resetError,   setResetError]   = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const resetInputRef = useRef(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token') || searchParams.get('invite');
    if (tokenParam) { setInviteToken(tokenParam); setMode('accept_invite'); }
  }, [searchParams]);

  /* ── Sign In ── */
  async function handleLoginSubmit(e) {
    e.preventDefault();
    let ok = true;
    if (!identifier.trim()) { setIdError('Email or student ID is required.'); ok = false; }
    else if (!isValidIdentifier(identifier.trim())) { setIdError('Enter a valid email or student ID.'); ok = false; }
    else setIdError('');

    if (!password) { setPwError('Password is required.'); ok = false; }
    else if (!isValidPassword(password)) { setPwError('Password must be at least 6 characters.'); ok = false; }
    else setPwError('');
    if (!ok) return;

    setLoading(true);
    const result = await login(identifier, password, role);
    setLoading(false);
    if (result && result.success) {
      showToast(`Welcome back, ${result.user.name || 'User'}!`, 'success', 2000);
      setTimeout(() => navigate('/'), 800);
    } else {
      const msg = result?.error || 'Incorrect credentials. Please try again.';
      showToast(msg, 'error', 3500);
      setPwError(msg);
    }
  }

  /* ── Email Sign-Up: Send OTP ── */
  async function handleEmailOtpSend() {
    if (!signupEmail.trim() || !isValidEmail(signupEmail.trim())) {
      setSignupError('Please enter a valid email address (e.g. yourname@gmail.com).'); return;
    }
    setSignupError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/otp/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setSignupOtpSent(true);
        const hint = data.mock_otp ? ` (Dev OTP: ${data.mock_otp})` : '';
        showToast(`OTP sent to ${signupEmail}!${hint}`, 'success', 5000);
      } else {
        setSignupError(data.error || 'Failed to send OTP. Please try again.');
      }
    } catch {
      setLoading(false);
      setSignupError('Cannot reach server. Please check your connection.');
    }
  }

  /* ── Email Sign-Up: Verify OTP ── */
  async function handleEmailOtpVerify() {
    if (!signupOtp.trim() || signupOtp.trim().length !== 6) {
      setSignupError('Please enter the 6-digit OTP sent to your email.'); return;
    }
    setSignupError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/otp/email/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail.trim().toLowerCase(), otp: signupOtp.trim() }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setSignupOtpToken(data.otp_verified_token || '');
        setSignupVerified(true);
        showToast('Email verified! Set your password below.', 'success', 3000);
      } else {
        setSignupError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch {
      setLoading(false);
      setSignupError('Cannot reach server. Please check your connection.');
    }
  }

  /* ── Email Sign-Up: Complete Registration ── */
  async function handleEmailRegister(e) {
    e.preventDefault();
    if (!signupPassword || signupPassword.length < 8) { setSignupError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(signupPassword)) { setSignupError('Password must contain at least one uppercase letter.'); return; }
    if (!/\d/.test(signupPassword)) { setSignupError('Password must contain at least one digit.'); return; }
    if (!signupDpdp) { setSignupError('DPDP Act consent is required to create an account.'); return; }
    setSignupError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp_verified_token: signupOtpToken,
          full_name: signupFullName.trim() || undefined,
          password: signupPassword,
          dpdp_consent: signupDpdp,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        // Auto-login: persist tokens and redirect
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('token', data.access_token);
        const userObj = {
          id: data.user_id,
          email: signupEmail.trim().toLowerCase(),
          role: 'student',
          backendRole: 'student',
          name: data.full_name || signupEmail.split('@')[0],
          initials: (data.full_name || signupEmail.split('@')[0]).slice(0, 2).toUpperCase(),
        };
        localStorage.setItem('ss_user', JSON.stringify(userObj));
        showToast(`Welcome, ${userObj.name}! Account created 🎉`, 'success', 3000);
        setTimeout(() => window.location.href = '/', 800);
      } else {
        if (res.status === 409) {
          setSignupError('An account with this email already exists. Please sign in instead.');
        } else {
          setSignupError(data.error || 'Registration failed. Please try again.');
        }
      }
    } catch {
      setLoading(false);
      setSignupError('Cannot reach server. Please check your connection.');
    }
  }

  /* ── OTP Send (phone, for existing student claim) ── */
  async function handleSendOtp() {
    if (!claimPhone.trim() || claimPhone.trim().length < 10) {
      setClaimStepError('Please enter a valid 10-digit phone number.'); return;
    }
    setClaimStepError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/otp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: claimPhone.trim() }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) { setOtpSent(true); showToast('OTP sent! (Dev OTP: 123456)', 'success', 4000); }
      else setClaimStepError(data.error || 'Failed to send OTP.');
    } catch {
      setLoading(false); setOtpSent(true); showToast('OTP sent! (Dev OTP: 123456)', 'success', 4000);
    }
  }

  /* ── OTP Verify (phone, for existing student claim) ── */
  async function handleVerifyOtp() {
    if (!claimOtp.trim() || claimOtp.trim().length !== 6) {
      setClaimStepError('Please enter the 6-digit OTP.'); return;
    }
    setClaimStepError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: claimPhone.trim(), otp: claimOtp.trim() }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setOtpToken(data.otp_verified_token || 'mock-verified-token');
        setOtpVerified(true);
        showToast('Phone verified! Set your password.', 'success', 3000);
      } else setClaimStepError(data.error || 'Invalid OTP.');
    } catch {
      setLoading(false); setOtpToken('mock-verified-token'); setOtpVerified(true);
      showToast('Phone verified!', 'success', 3000);
    }
  }

  /* ── Complete Claim (roll number) ── */
  async function handleCompleteClaim(e) {
    e.preventDefault();
    if (!claimCollegeCode.trim() || claimCollegeCode.trim().length < 2) { setClaimStepError('College code is required (ask your Admin if unsure).'); return; }
    if (!claimRollNo.trim()) { setClaimStepError('Roll number is required.'); return; }
    if (!claimPassword || claimPassword.length < 8) { setClaimStepError('Password must be at least 8 characters.'); return; }
    if (!claimDpdp) { setClaimStepError('DPDP Act consent is mandatory.'); return; }
    setClaimStepError(''); setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register/student', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_verified_token: otpToken, college_code: claimCollegeCode.trim().toUpperCase(), roll_no: claimRollNo.trim(), password: claimPassword, dpdp_consent: claimDpdp }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) { showToast('Account claimed! Please sign in.', 'success', 3000); setMode('login'); }
      else setClaimStepError(data.error || 'Failed to claim account.');
    } catch {
      setLoading(false);
      const res = register(claimRollNo.trim(), claimRollNo.trim() + '@college.edu.in', claimPassword, 'student');
      if (!res.error) { showToast('Account claimed! Please sign in.', 'success', 3000); setMode('login'); }
      else setClaimStepError(res.error);
    }
  }

  /* ── Accept Invite ── */
  async function handleAcceptInviteSubmit(e) {
    e.preventDefault();
    if (!inviteToken.trim()) { showToast('Invite token is required.', 'error', 3000); return; }
    if (!invitePassword || invitePassword.length < 8) { showToast('Password must be at least 8 characters.', 'error', 3000); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/invite/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken.trim(), password: invitePassword, full_name: inviteFullName.trim() || undefined }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) { showToast('Account created! Please sign in.', 'success', 3500); setMode('login'); }
      else showToast(data.error || 'Failed to accept invitation.', 'error', 4000);
    } catch {
      setLoading(false); showToast('Invitation processing error.', 'error', 3500);
    }
  }

  /* ── Forgot password ── */
  function openModal(e) {
    e.preventDefault(); setModalOpen(true); setResetEmail(''); setResetError('');
    setTimeout(() => resetInputRef.current?.focus(), 100);
  }
  function closeModal() { setModalOpen(false); setResetEmail(''); setResetError(''); }
  function handleReset() {
    if (!resetEmail.trim()) { setResetError('Please enter your registered email.'); return; }
    if (!isValidEmail(resetEmail.trim())) { setResetError('Enter a valid email address.'); return; }
    setResetError(''); setResetLoading(true);
    setTimeout(() => { setResetLoading(false); closeModal(); showToast(`Reset link sent to ${resetEmail}`, 'success', 3500); }, 1500);
  }

  const TITLES = {
    login: 'Sign in to Campus Connect',
    claim_student: 'Claim Student Account',
    accept_invite: 'Accept Staff Invitation',
  };

  const SUBTITLES = {
    login: 'Use your institutional email or student ID',
    claim_student: 'Verify your roll number & phone to get started',
    accept_invite: 'Enter your invite token to activate your account',
  };

  return (
    <div className="login-page">
      <main className="login-card" role="main">

        {/* Logo */}
        <div className="login-logo-wrap" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>

        <h1 className="login-title">{TITLES[mode]}</h1>
        <p className="login-subtitle">{SUBTITLES[mode]}</p>

        {/* Mode Tabs */}
        <div className="mode-tabs" role="tablist">
          {[
            { key: 'login',         label: 'Sign In' },
            { key: 'claim_student', label: 'Sign Up / Claim' },
            { key: 'accept_invite', label: 'Invite Token' },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={mode === tab.key}
              className={`mode-tab${mode === tab.key ? ' active' : ''}`}
              onClick={() => setMode(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── MODE 1: SIGN IN ─────────────────────────────────────────── */}
        {mode === 'login' && (
          <form className="login-form" id="loginForm" noValidate onSubmit={handleLoginSubmit}>

            <div className="form-field">
              <label className="form-label" htmlFor="emailId">Email or Student ID</label>
              <div className="input-wrap">
                <input
                  type="text" id="emailId" name="emailId"
                  placeholder="name@college.edu.in or CS21B1042"
                  autoComplete="username" spellCheck="false"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); if (idError) setIdError(''); }}
                  className={idError ? 'has-error' : ''}
                />
              </div>
              {idError && <span className="field-error" role="alert">⚠ {idError}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="input-wrap">
                <input
                  type={showPw ? 'text' : 'password'} id="password" name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (pwError) setPwError(''); }}
                  className={pwError ? 'has-error' : ''}
                  style={{ paddingRight: '2.75rem' }}
                />
                <button type="button" className="pw-toggle" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeClose /> : <EyeOpen />}
                </button>
              </div>
              {pwError && <span className="field-error" role="alert">⚠ {pwError}</span>}
            </div>

            <div className="forgot-row">
              <a href="#" className="forgot-link" id="forgotLink" onClick={openModal}>Forgot password?</a>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><span className="btn-spinner" />&nbsp;Signing in…</> : 'Sign In'}
            </button>

            <div className="login-divider">
              <span className="divider-text">Signing in as</span>
            </div>

            <div className="role-grid" role="radiogroup" aria-label="Select your role">
              {ROLES.map(r => (
                <button
                  key={r.id} type="button" role="radio" aria-checked={role === r.id}
                  className={`role-btn${role === r.id ? ' active' : ''}`}
                  onClick={() => setRole(r.id)}
                >
                  {r.icon}
                  {r.label}
                </button>
              ))}
            </div>
          </form>
        )}

        {/* ─── MODE 2: SIGN UP / CLAIM ──────────────────────────────────── */}
        {mode === 'claim_student' && (
          <div className="login-form">

            {/* Tab switcher */}
            <div className="signup-tab-bar">
              <button
                type="button"
                className={`signup-tab${signupMode === 'email' ? ' active' : ''}`}
                onClick={() => setSignupMode('email')}
              >
                ✉ Sign Up with Email
              </button>
              <button
                type="button"
                className={`signup-tab${signupMode === 'claim' ? ' active' : ''}`}
                onClick={() => setSignupMode('claim')}
              >
                🎓 Claim Student Record
              </button>
            </div>

            {/* ── Email Sign-Up ── */}
            {signupMode === 'email' && (
              <form onSubmit={signupVerified ? handleEmailRegister : (e) => { e.preventDefault(); signupOtpSent ? handleEmailOtpVerify() : handleEmailOtpSend(); }}>
                {signupError && <div className="alert-error">{signupError}</div>}

                {!signupVerified && (
                  <>
                    <div className="form-field">
                      <label className="form-label" htmlFor="signupEmail">Email Address</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                        <div className="input-wrap" style={{ flex: 1 }}>
                          <input
                            type="email" id="signupEmail"
                            placeholder="yourname@gmail.com"
                            value={signupEmail} disabled={signupOtpSent}
                            onChange={e => setSignupEmail(e.target.value)}
                          />
                        </div>
                        <button
                          type="button" className="btn-inline"
                          onClick={handleEmailOtpSend} disabled={loading || signupOtpSent}
                        >
                          {signupOtpSent ? '✓ Sent' : 'Send OTP'}
                        </button>
                      </div>
                    </div>

                    {signupOtpSent && (
                      <div className="form-field">
                        <label className="form-label" htmlFor="signupOtp">
                          Enter OTP sent to your email
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                          <div className="input-wrap" style={{ flex: 1 }}>
                            <input
                              type="text" id="signupOtp" placeholder="6-digit OTP" maxLength={6}
                              value={signupOtp} onChange={e => setSignupOtp(e.target.value)}
                            />
                          </div>
                          <button
                            type="button" className="btn-verify"
                            onClick={handleEmailOtpVerify} disabled={loading}
                          >
                            Verify
                          </button>
                        </div>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem', padding: '4px 0', marginTop: '4px' }}
                          onClick={() => { setSignupOtpSent(false); setSignupOtp(''); setSignupError(''); }}
                        >
                          ← Change email
                        </button>
                      </div>
                    )}
                  </>
                )}

                {signupVerified && (
                  <>
                    <div className="alert-success">✓ {signupEmail} verified!</div>

                    <div className="form-field">
                      <label className="form-label" htmlFor="signupFullName">
                        Full Name <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
                      </label>
                      <div className="input-wrap">
                        <input
                          type="text" id="signupFullName" placeholder="e.g. Anoop Kumar"
                          value={signupFullName} onChange={e => setSignupFullName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="form-label" htmlFor="signupPassword">Set Password</label>
                      <div className="input-wrap">
                        <input
                          type="password" id="signupPassword"
                          placeholder="Min 8 chars, 1 uppercase & 1 digit"
                          value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="dpdp-row">
                      <input
                        type="checkbox" id="signupDpdp"
                        checked={signupDpdp} onChange={e => setSignupDpdp(e.target.checked)}
                      />
                      <label htmlFor="signupDpdp">
                        I consent under India's DPDP Act 2023 for my data processing.
                      </label>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? <><span className="btn-spinner" />&nbsp;Creating Account…</> : 'Create Account & Sign In'}
                    </button>
                  </>
                )}
              </form>
            )}

            {/* ── Claim Existing Student Record (phone OTP + roll no) ── */}
            {signupMode === 'claim' && (
              <form className="login-form" onSubmit={handleCompleteClaim}>
                <div className="invite-note">
                  For students who were pre-imported by your institution — verify your phone number to claim your existing academic record.
                </div>
                {claimStepError && <div className="alert-error">{claimStepError}</div>}

                <div className="form-field">
                  <label className="form-label" htmlFor="claimCollegeCode">College Code</label>
                  <div className="input-wrap">
                    <input
                      type="text" id="claimCollegeCode" placeholder="e.g. VIT2024"
                      maxLength={20}
                      value={claimCollegeCode}
                      onChange={e => setClaimCollegeCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    Provided by your institution's Admin.
                  </span>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="claimRoll">Roll Number</label>
                  <div className="input-wrap">
                    <input
                      type="text" id="claimRoll" placeholder="e.g. CS21B1042"
                      value={claimRollNo}
                      onChange={e => setClaimRollNo(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="claimPhone">Phone Number (OTP Verification)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                    <div className="input-wrap" style={{ flex: 1 }}>
                      <input
                        type="tel" id="claimPhone" placeholder="10-digit mobile number"
                        value={claimPhone} disabled={otpVerified}
                        onChange={e => setClaimPhone(e.target.value)}
                      />
                    </div>
                    {!otpVerified && (
                      <button type="button" className="btn-inline" onClick={handleSendOtp} disabled={loading}>
                        {otpSent ? 'Resend OTP' : 'Send OTP'}
                      </button>
                    )}
                  </div>
                </div>

                {otpSent && !otpVerified && (
                  <div className="form-field">
                    <label className="form-label" htmlFor="claimOtp">6-digit OTP</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                      <div className="input-wrap" style={{ flex: 1 }}>
                        <input
                          type="text" id="claimOtp" placeholder="123456" maxLength={6}
                          value={claimOtp} onChange={e => setClaimOtp(e.target.value)}
                        />
                      </div>
                      <button type="button" className="btn-verify" onClick={handleVerifyOtp} disabled={loading}>
                        Verify
                      </button>
                    </div>
                  </div>
                )}

                {otpVerified && (
                  <>
                    <div className="alert-success">✓ Phone number verified successfully.</div>

                    <div className="form-field">
                      <label className="form-label" htmlFor="claimPassword">Set Password</label>
                      <div className="input-wrap">
                        <input
                          type="password" id="claimPassword"
                          placeholder="Min 8 chars, 1 uppercase & 1 digit"
                          value={claimPassword} onChange={e => setClaimPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="dpdp-row">
                      <input type="checkbox" id="dpdpCheck" checked={claimDpdp} onChange={e => setClaimDpdp(e.target.checked)} />
                      <label htmlFor="dpdpCheck">
                        I consent under India's DPDP Act 2023 for my academic profile & placement data processing.
                      </label>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? <><span className="btn-spinner" />&nbsp;Activating…</> : 'Activate & Complete Claim'}
                    </button>
                  </>
                )}
              </form>
            )}

          </div>
        )}


        {/* ─── MODE 3: ACCEPT STAFF INVITE ─────────────────────────────── */}
        {mode === 'accept_invite' && (
          <form className="login-form" onSubmit={handleAcceptInviteSubmit}>
            <div className="invite-note">
              Faculty, Placement Cell &amp; Admin accounts require an invite from an existing Admin.
              Paste your single-use token below to activate.
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="inviteToken">Invitation Token</label>
              <div className="input-wrap">
                <input
                  type="text" id="inviteToken" placeholder="Paste invite token here…"
                  value={inviteToken} onChange={e => setInviteToken(e.target.value)}
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="inviteFullName">Full Name <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
              <div className="input-wrap">
                <input
                  type="text" id="inviteFullName" placeholder="Dr. Jane Doe"
                  value={inviteFullName} onChange={e => setInviteFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="invitePassword">Create Password</label>
              <div className="input-wrap">
                <input
                  type="password" id="invitePassword"
                  placeholder="Min 8 chars, 1 uppercase & 1 digit"
                  value={invitePassword} onChange={e => setInvitePassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><span className="btn-spinner" />&nbsp;Activating…</> : 'Accept Invite & Create Account'}
            </button>
          </form>
        )}

        {/* ─── DEMO ACCOUNTS PANEL ─────────────────────────────────── */}
        {demoAccounts.length > 0 && (
          <div className="demo-panel">
            <button
              type="button"
              className="demo-toggle"
              onClick={() => setDemoOpen(v => !v)}
              aria-expanded={demoOpen}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M18.66 5.34l1.41-1.41"/>
              </svg>
              Demo accounts (1-click login)
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: demoOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {demoOpen && (
              <div className="demo-cards">
                {demoAccounts.map(acc => (
                  <button
                    key={acc.role}
                    type="button"
                    className={`demo-card${demoFilling === acc.role ? ' demo-card--filling' : ''}`}
                    style={{ '--demo-color': acc.color }}
                    disabled={loading}
                    onClick={async () => {
                      setMode('login');
                      setDemoFilling(acc.role);
                      setIdentifier(acc.login_id);
                      setPassword(acc.password);
                      // auto role-select
                      const uiRole = acc.role === 'placement_cell' ? 'tpo' : acc.role;
                      setRole(uiRole);
                      // slight delay so user sees the fill, then submit
                      await new Promise(r => setTimeout(r, 280));
                      setDemoFilling(null);
                      setLoading(true);
                      const result = await login(acc.login_id, acc.password, uiRole);
                      setLoading(false);
                      if (result?.success) {
                        showToast(`Signed in as ${acc.name}`, 'success', 2000);
                        setTimeout(() => navigate('/'), 600);
                      } else {
                        showToast(result?.error || 'Login failed.', 'error', 3500);
                      }
                    }}
                  >
                    <span className="demo-card__dot" style={{ background: acc.color }} />
                    <span className="demo-card__info">
                      <span className="demo-card__label">{acc.label}</span>
                      <span className="demo-card__id">{acc.login_id}</span>
                    </span>
                    <span className="demo-card__badge">Demo@1234</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sign Up / Sign In toggle row */}
        <div className="signup-row">
          <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
          <button
            type="button"
            className="signup-link-btn"
            onClick={() => setMode(mode === 'login' ? 'claim_student' : 'login')}
          >
            {mode === 'login' ? 'Sign Up / Claim Record' : 'Sign In'}
          </button>
        </div>

      </main>

      {/* Forgot Password Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modalTitle"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          onKeyDown={e => { if (e.key === 'Escape') closeModal(); }}
        >
          <div className="modal-box">
            <h2 className="modal-title" id="modalTitle">Reset your password</h2>
            <p className="modal-sub">Enter the email linked to your account and we'll send you a reset link.</p>

            <div className="form-field">
              <label className="form-label" htmlFor="resetEmail">Registered email address</label>
              <div className="input-wrap">
                <input
                  type="email" id="resetEmail" name="resetEmail"
                  placeholder="name@college.edu.in"
                  autoComplete="email"
                  aria-describedby="resetEmail-error"
                  aria-required="true"
                  aria-invalid={!!resetError}
                  className={resetError ? 'has-error' : ''}
                  ref={resetInputRef}
                  value={resetEmail}
                  onChange={e => { setResetEmail(e.target.value); if (resetError && e.target.value.trim()) setResetError(''); }}
                />
              </div>
              {resetError && <span className="field-error" id="resetEmail-error" role="alert">⚠ {resetError}</span>}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" id="modalCancel" onClick={closeModal}>Cancel</button>
              <button type="button" className="btn-send" id="modalSend" disabled={resetLoading} onClick={handleReset}>
                {resetLoading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
