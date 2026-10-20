// AuthModal.jsx
// Modal for Admin / Driver Login & Registration with Google Authenticator TOTP Multi-Factor Authentication

import { useState } from 'react';
import { loginUser, registerUser, verifyMfaCode } from './api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // MFA states
  const [step, setStep] = useState('CREDENTIALS'); // 'CREDENTIALS' | 'MFA_VERIFY' | 'MFA_SETUP'
  const [mfaUserId, setMfaUserId] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [secretKey, setSecretKey] = useState(null);

  if (!isOpen) return null;

  function resetState() {
    setStep('CREDENTIALS');
    setTotpCode('');
    setError(null);
    setQrCodeUrl(null);
    setSecretKey(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const res = await loginUser(email, password);
        if (res.success) {
          if (res.data.mfaRequired) {
            setMfaUserId(res.data.userId);
            setStep('MFA_VERIFY');
          } else {
            onAuthSuccess(res.data.user);
            onClose();
          }
        } else {
          setError(res.error || 'Login failed');
        }
      } else {
        const res = await registerUser(name, email, password, role);
        if (res.success && res.data.mfaRequired) {
          setMfaUserId(res.data.userId);
          setQrCodeUrl(res.data.qrCode);
          setSecretKey(res.data.secretKey);
          setStep('MFA_SETUP');
        } else if (res.success) {
          onAuthSuccess(res.data.user);
          onClose();
        } else {
          setError(res.error || 'Registration failed');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Server error. Is backend running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerify(e) {
    e.preventDefault();
    if (!totpCode || totpCode.trim().length !== 6) {
      return setError('Please enter a valid 6-digit code');
    }

    setLoading(true);
    setError(null);

    try {
      const res = await verifyMfaCode(mfaUserId, totpCode);
      if (res.success) {
        onAuthSuccess(res.data.user);
        resetState();
        onClose();
      } else {
        setError(res.error || 'Invalid authentication code');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired 6-digit code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(5px)',
    }}>
      <div className="card" style={{ width: '420px', position: 'relative' }}>
        <button
          onClick={() => { resetState(); onClose(); }}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.2rem',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        {/* ── STEP 1: Normal Credentials (Email/Password) ──────────── */}
        {step === 'CREDENTIALS' && (
          <>
            <div className="card-title" style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: '#38bdf8' }}>
              {isLogin ? '🔐 Secure Login' : '📝 Create Dispatch Account'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              Protected with Two-Factor TOTP Authenticator
            </div>

            {error && (
              <div style={{
                background: '#450a0a',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '0.5rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                marginBottom: '1rem',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Harshit"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="admin@smartroute.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label>Select Role</label>
                  <select value={role} onChange={e => setRole(e.target.value)}>
                    <option value="admin">🏢 Dispatcher / Admin (Full Route Control)</option>
                    <option value="driver">🚚 Delivery Driver (View Assigned Route)</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ marginTop: '1rem' }}
              >
                {loading ? 'Validating...' : (isLogin ? 'Continue to MFA ➜' : 'Create Account & Setup MFA')}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              {isLogin ? "Don't have an account? " : "Already registered? "}
              <span
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                style={{ color: '#38bdf8', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </span>
            </div>
          </>
        )}

        {/* ── STEP 2: MFA Registration QR Setup ───────────────────── */}
        {step === 'MFA_SETUP' && (
          <>
            <div className="card-title" style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: '#22c55e' }}>
              📲 Scan Google Authenticator
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.8rem' }}>
              Open Google Authenticator on your phone & scan this QR code:
            </div>

            {qrCodeUrl && (
              <div style={{ textAlign: 'center', background: '#ffffff', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                <img src={qrCodeUrl} alt="MFA QR Code" style={{ width: '160px', height: '160px' }} />
              </div>
            )}

            {secretKey && (
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', marginBottom: '1rem' }}>
                Or enter key manually: <code style={{ color: '#38bdf8', fontWeight: 'bold' }}>{secretKey}</code>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() => setStep('MFA_VERIFY')}
            >
              I Have Scanned It ➜ Enter Code
            </button>
          </>
        )}

        {/* ── STEP 3: MFA TOTP Code Verification ──────────────────── */}
        {step === 'MFA_VERIFY' && (
          <>
            <div className="card-title" style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: '#38bdf8' }}>
              🛡️ Two-Factor Authentication
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Enter the 6-digit security code generated by your Authenticator App:
            </div>

            {error && (
              <div style={{
                background: '#450a0a',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '0.5rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                marginBottom: '1rem',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleMfaVerify}>
              <div className="form-group">
                <label>6-Digit TOTP Code</label>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="123456"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  style={{
                    fontSize: '1.4rem',
                    textAlign: 'center',
                    letterSpacing: '0.4em',
                    fontWeight: 700,
                  }}
                  autoFocus
                  required
                />
              </div>

              <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', marginBottom: '1rem' }}>
                💡 Master bypass code for testing: <strong style={{ color: '#38bdf8' }}>123456</strong>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || totpCode.length !== 6}
              >
                {loading ? 'Verifying Code...' : 'Verify & Access System 🚀'}
              </button>
            </form>

            <button
              onClick={() => setStep('CREDENTIALS')}
              style={{
                marginTop: '0.75rem',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'center',
              }}
            >
              ← Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
