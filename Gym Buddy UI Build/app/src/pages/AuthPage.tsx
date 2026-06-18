import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import NeuralBackground from '@/components/NeuralBackground';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const { login, register, isLoading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

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
      navigate('/workout');
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden">
      <NeuralBackground />

      {/* Auth Card */}
      <div
        className="relative z-10 w-full max-w-[420px] mx-4"
        style={{
          background: 'rgba(18, 18, 36, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '16px',
          padding: '40px 48px',
          boxShadow: '0 8px 48px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          animation: 'fadeSlideIn 0.6s ease-out',
        }}
      >
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div
            className="text-[32px] mb-2"
            style={{ textShadow: '0 0 12px rgba(0, 212, 255, 0.6)', color: '#00d4ff' }}
          >
            &#9889;
          </div>
          <h1
            className="font-orbitron font-black text-[28px] tracking-[4px] uppercase gradient-text"
          >
            GYM BUDDY
          </h1>
          <p className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[2px] uppercase mt-1">
            BIOMECHANICAL ANALYSIS PLATFORM
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6">
          <button
            onClick={() => { setActiveTab('login'); setErrors({}); setShowSuccess(false); }}
            className={`flex-1 pb-3 font-orbitron font-bold text-base tracking-[2px] uppercase transition-all duration-200 ${
              activeTab === 'login'
                ? 'text-[#e0e0e0] border-b-2 border-[#00d4ff]'
                : 'text-[#8888aa] border-b-2 border-transparent hover:text-[#e0e0e0]'
            }`}
            style={activeTab === 'login' ? { boxShadow: '0 2px 8px rgba(0, 212, 255, 0.3)' } : {}}
          >
            LOGIN
          </button>
          <button
            onClick={() => { setActiveTab('register'); setErrors({}); setShowSuccess(false); }}
            className={`flex-1 pb-3 font-orbitron font-bold text-base tracking-[2px] uppercase transition-all duration-200 ${
              activeTab === 'register'
                ? 'text-[#e0e0e0] border-b-2 border-[#00d4ff]'
                : 'text-[#8888aa] border-b-2 border-transparent hover:text-[#e0e0e0]'
            }`}
            style={activeTab === 'register' ? { boxShadow: '0 2px 8px rgba(0, 212, 255, 0.3)' } : {}}
          >
            REGISTER
          </button>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div
            className="mb-4 text-center font-inter text-sm"
            style={{ color: '#00ff88' }}
          >
            Account created! Redirecting...
          </div>
        )}

        {/* Login Form */}
        {activeTab === 'login' && (
          <form
            key="login"
            onSubmit={handleLogin}
            className="flex flex-col gap-5"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          >
            <div>
              <label className="block font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={`input-field ${errors.email ? 'error' : ''}`}
              />
              {errors.email && (
                <p className="mt-1 font-inter text-xs text-[#ff4d6d]">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`input-field pr-12 ${errors.password ? 'error' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8888aa] hover:text-[#e0e0e0] transition-colors text-lg"
                >
                  {showPassword ? '&#128065;' : '&#128065;&#8205;&#128488;'}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 font-inter text-xs text-[#ff4d6d]">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="gradient-btn w-full py-4 mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-[#0a0a0f] border-t-transparent rounded-full animate-spin-loader" />
              ) : (
                'SIGN IN'
              )}
            </button>
          </form>
        )}

        {/* Register Form */}
        {activeTab === 'register' && (
          <form
            key="register"
            onSubmit={handleRegister}
            className="flex flex-col gap-5"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          >
            <div>
              <label className="block font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={`input-field ${errors.email ? 'error' : ''}`}
              />
              {errors.email && (
                <p className="mt-1 font-inter text-xs text-[#ff4d6d]">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className={`input-field pr-12 ${errors.password ? 'error' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8888aa] hover:text-[#e0e0e0] transition-colors text-lg"
                >
                  {showPassword ? '&#128065;' : '&#128065;&#8205;&#128488;'}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 font-inter text-xs text-[#ff4d6d]">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="gradient-btn w-full py-4 mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-[#0a0a0f] border-t-transparent rounded-full animate-spin-loader" />
              ) : (
                'CREATE ACCOUNT'
              )}
            </button>
          </form>
        )}

        {/* Footer Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => { setActiveTab(activeTab === 'login' ? 'register' : 'login'); setErrors({}); }}
            className="font-inter text-xs text-[#8888aa] hover:text-[#00d4ff] transition-colors"
          >
            {activeTab === 'login'
              ? "Need an account? Register"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
