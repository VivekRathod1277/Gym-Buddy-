import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Zap } from 'lucide-react';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { login, register, isLoading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!password.trim()) newErrors.password = 'Password is required';
    if (password.trim() && password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const success = await login(email, password);
    if (success) {
      addToast('Welcome back!', 'success');
      navigate('/dashboard');
    } else {
      addToast('Invalid credentials', 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const success = await register(email, password);
    if (success) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setActiveTab('login');
      }, 2000);
    } else {
      addToast('Registration failed', 'error');
    }
  };

  return (
    <div className="auth-page">

      {/* ===== LEFT: Video Side ===== */}
      <div className="auth-video-side">
        <video autoPlay loop muted playsInline className="auth-video">
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>

        {/* Vignette */}
        <div className="auth-video-vignette" />

        {/* Gradient fade into panel */}
        <div className="auth-video-fade" />

        {/* Branding on video */}
        <div
          className="auth-video-brand"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          <div className="auth-video-brand-bar" />
          <h1 className="auth-video-title font-orbitron">
            GYM<br />BUDDY
          </h1>
          <p className="auth-video-subtitle">AI-Powered Form Analysis</p>
        </div>
      </div>

      {/* ===== RIGHT: Form Panel ===== */}
      <div
        className="auth-panel"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateX(0)' : 'translateX(20px)',
        }}
      >
        {/* Accent line */}
        <div className="auth-panel-accent" />

        {/* Header */}
        <div className="auth-panel-header">
          <div className="auth-panel-header-row items-center gap-2">
            <span className="auth-panel-icon flex items-center justify-center"><Zap className="w-6 h-6 text-[#00d4ff]" /></span>
            <span className="auth-panel-logo font-orbitron">GYM BUDDY</span>
          </div>
          <p className="auth-panel-welcome">
            {activeTab === 'login' ? 'Welcome back' : 'Get started'}
          </p>
          <h2 className="auth-panel-heading">
            {activeTab === 'login' ? (
              <>Sign in to your <span>training session</span></>
            ) : (
              <>Create your <span>athlete profile</span></>
            )}
          </h2>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          {(['login', 'register'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setErrors({}); setShowSuccess(false); }}
              className={`auth-tab ${activeTab === tab ? 'auth-tab--active' : ''}`}
            >
              {tab === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Success */}
        {showSuccess && (
          <div className="auth-success">✓ Account created successfully</div>
        )}

        {/* Form */}
        <form
          key={activeTab}
          onSubmit={activeTab === 'login' ? handleLogin : handleRegister}
          className="auth-form"
        >
          {/* Email */}
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={`auth-input ${errors.email ? 'auth-input--error' : ''}`}
              />
            </div>
            {errors.email && <p className="auth-error">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={activeTab === 'login' ? 'Enter your password' : 'Create a password (min 6 chars)'}
                className={`auth-input ${errors.password ? 'auth-input--error' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-toggle-pw"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <p className="auth-error">{errors.password}</p>}
          </div>

          {/* Submit */}
          <button type="submit" disabled={isLoading} className="auth-submit">
            {isLoading ? (
              <div className="auth-spinner" />
            ) : (
              activeTab === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          <button
            onClick={() => { setActiveTab(activeTab === 'login' ? 'register' : 'login'); setErrors({}); }}
            className="auth-footer-link"
          >
            {activeTab === 'login'
              ? "Don't have an account? Register"
              : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Bottom decoration */}
        <div className="auth-panel-bottom">
          <div className="auth-panel-bottom-line" />
          <span className="auth-panel-bottom-text">Biomechanical AI</span>
          <div className="auth-panel-bottom-line" />
        </div>
      </div>

      {/* ===== Styles ===== */}
      <style>{`
        .auth-page {
          display: flex;
          min-height: 100vh;
          width: 100%;
          overflow: hidden;
          background: #080810;
        }

        /* ---- Video Side ---- */
        .auth-video-side {
          position: relative;
          flex: 1 1 55%;
          min-height: 100vh;
          overflow: hidden;
        }

        .auth-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .auth-video-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 100%);
          pointer-events: none;
        }

        .auth-video-fade {
          position: absolute;
          top: 0;
          right: 0;
          width: 180px;
          height: 100%;
          background: linear-gradient(to right, transparent, #080810);
          pointer-events: none;
        }

        .auth-video-brand {
          position: absolute;
          bottom: 64px;
          left: 48px;
          z-index: 2;
          transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s;
        }

        .auth-video-brand-bar {
          width: 48px;
          height: 3px;
          margin-bottom: 20px;
          background: linear-gradient(90deg, #00d4ff, #7b2ff7);
          border-radius: 2px;
        }

        .auth-video-title {
          font-size: 44px;
          font-weight: 900;
          letter-spacing: 6px;
          line-height: 1.05;
          color: #fff;
          text-transform: uppercase;
          text-shadow: 0 4px 40px rgba(0,0,0,0.6);
          margin: 0;
        }

        .auth-video-subtitle {
          margin-top: 14px;
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
        }

        /* ---- Panel Side ---- */
        .auth-panel {
          position: relative;
          flex: 0 0 460px;
          max-width: 460px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 52px;
          background: #080810;
          transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
          overflow-y: auto;
        }

        .auth-panel-accent {
          position: absolute;
          top: 15%;
          left: 0;
          width: 2px;
          height: 70%;
          background: linear-gradient(to bottom, transparent, #00d4ff 25%, #7b2ff7 75%, transparent);
          opacity: 0.5;
        }

        /* Header */
        .auth-panel-header {
          margin-bottom: 32px;
        }

        .auth-panel-header-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }

        .auth-panel-icon {
          font-size: 20px;
          filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.5));
        }

        .auth-panel-logo {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #00e5ff, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .auth-panel-welcome {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #00d4ff;
          margin: 0 0 10px;
        }

        .auth-panel-heading {
          font-family: 'Inter', sans-serif;
          font-size: 26px;
          font-weight: 300;
          color: rgba(255,255,255,0.9);
          line-height: 1.35;
          letter-spacing: -0.3px;
          margin: 0;
        }

        .auth-panel-heading span {
          font-weight: 700;
          color: #fff;
        }

        /* Tabs */
        .auth-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 32px;
          background: rgba(255,255,255,0.04);
          border-radius: 12px;
          padding: 4px;
        }

        .auth-tab {
          flex: 1;
          padding: 10px 0;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.5px;
          border: none;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: transparent;
          color: rgba(255,255,255,0.3);
        }

        .auth-tab--active {
          background: rgba(0, 212, 255, 0.12);
          color: #fff;
          box-shadow: 0 2px 12px rgba(0, 212, 255, 0.12);
        }

        .auth-tab:not(.auth-tab--active):hover {
          color: rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.03);
        }

        /* Success */
        .auth-success {
          margin-bottom: 16px;
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(0, 255, 136, 0.08);
          border: 1px solid rgba(0, 255, 136, 0.15);
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #00ff88;
          text-align: center;
          animation: fadeSlide 0.3s ease;
        }

        /* Form */
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 22px;
          animation: fadeSlide 0.35s ease;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .auth-label {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
        }

        .auth-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .auth-input-icon {
          position: absolute;
          left: 14px;
          color: rgba(255,255,255,0.18);
          display: flex;
          pointer-events: none;
          transition: color 0.2s;
        }

        .auth-input-wrap:focus-within .auth-input-icon {
          color: rgba(0, 212, 255, 0.6);
        }

        .auth-input {
          width: 100%;
          padding: 14px 14px 14px 42px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          outline: none;
          transition: all 0.25s ease;
        }

        .auth-input::placeholder {
          color: rgba(255,255,255,0.16);
        }

        .auth-input:focus {
          border-color: rgba(0, 212, 255, 0.4);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.07), 0 0 20px rgba(0, 212, 255, 0.05);
        }

        .auth-input--error {
          border-color: rgba(255, 77, 109, 0.5) !important;
        }

        .auth-toggle-pw {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.2);
          cursor: pointer;
          padding: 4px;
          display: flex;
          transition: color 0.2s;
        }

        .auth-toggle-pw:hover {
          color: rgba(255,255,255,0.6);
        }

        .auth-error {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: #ff4d6d;
          margin: 0;
          padding-left: 2px;
        }

        /* Submit */
        .auth-submit {
          width: 100%;
          padding: 15px 0;
          margin-top: 6px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #00d4ff, #7b2ff7);
          color: #fff;
          font-family: 'Orbitron', sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 3px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 24px rgba(0, 212, 255, 0.2), 0 2px 8px rgba(123, 47, 247, 0.15);
        }

        .auth-submit:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 40px rgba(0, 212, 255, 0.3), 0 4px 16px rgba(123, 47, 247, 0.2);
          filter: brightness(1.1);
        }

        .auth-submit:active {
          transform: translateY(0);
        }

        .auth-submit:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
          filter: none !important;
        }

        .auth-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin: 0 auto;
        }

        /* Footer */
        .auth-footer {
          margin-top: 24px;
          text-align: center;
        }

        .auth-footer-link {
          background: none;
          border: none;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: rgba(255,255,255,0.25);
          cursor: pointer;
          transition: color 0.2s;
        }

        .auth-footer-link:hover {
          color: #00d4ff;
        }

        /* Bottom decoration */
        .auth-panel-bottom {
          position: absolute;
          bottom: 28px;
          left: 52px;
          right: 52px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .auth-panel-bottom-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.05);
        }

        .auth-panel-bottom-text {
          font-family: 'Inter', sans-serif;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.12);
        }

        /* Animations */
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 900px) {
          .auth-video-side {
            display: none !important;
          }
          .auth-panel {
            flex: 1 1 100% !important;
            max-width: 100% !important;
            padding: 40px 28px;
          }
          .auth-panel-bottom {
            left: 28px;
            right: 28px;
          }
        }
      `}</style>
    </div>
  );
}
