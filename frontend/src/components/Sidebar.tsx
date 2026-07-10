import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useVoice } from '@/hooks/useVoice';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isMuted, toggleMute } = useVoice();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[260px] flex flex-col z-50"
      style={{
        background: 'linear-gradient(180deg, #0d0d1a, #11111f)',
        borderRight: '1px solid rgba(0, 212, 255, 0.1)',
        padding: '24px',
      }}
    >
      {/* Brand */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl text-[#00d4ff]" style={{ textShadow: '0 0 12px rgba(0, 212, 255, 0.6)' }}>
            &#9889;
          </span>
          <span className="font-orbitron font-bold text-base text-[#e0e0e0] tracking-[2px] uppercase">
            GYM BUDDY
          </span>
        </div>
        <p className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase">
          BIOMECHANICAL ANALYSIS
        </p>
      </div>

      {/* Divider */}
      <div className="w-full h-px mb-6" style={{ background: 'rgba(0, 212, 255, 0.1)' }} />

      {/* User Info */}
      <div className="mb-6">
        <p className="font-inter text-xs text-[#8888aa] truncate">{user?.email || 'user@email.com'}</p>
        <div className="flex items-center gap-2 mt-1">
          <div
            className="w-2 h-2 rounded-full bg-[#00ff88]"
            style={{ animation: 'pulse-dot 2s infinite' }}
          />
          <span className="font-inter text-[11px] font-semibold text-[#00ff88] tracking-[1.5px] uppercase">
            ACTIVE MEMBER
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-px mb-4" style={{ background: 'rgba(0, 212, 255, 0.1)' }} />

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        <button
          onClick={() => navigate('/workout')}
          className={`sidebar-nav-item ${isActive('/workout') ? 'active' : ''}`}
        >
          <span className="text-lg">&#127947;</span>
          <span>Workout</span>
        </button>

        <button
          onClick={() => navigate('/history')}
          className={`sidebar-nav-item ${isActive('/history') ? 'active' : ''}`}
        >
          <span className="text-lg">&#128202;</span>
          <span>History</span>
        </button>

        {/* Divider */}
        <div className="w-full h-px my-4" style={{ background: 'rgba(0, 212, 255, 0.1)' }} />

        {/* Mute Toggle */}
        <button
          onClick={toggleMute}
          className="sidebar-nav-item hover:bg-white/[0.03]"
        >
          <span className="text-lg">{isMuted ? '&#128263;' : '&#128266;'}</span>
          <span>{isMuted ? 'UNMUTE VOICE' : 'MUTE VOICE'}</span>
          {isMuted && (
            <span className="w-2 h-2 rounded-full bg-[#ff4d6d] ml-auto" />
          )}
        </button>

        {/* Divider */}
        <div className="w-full h-px my-4" style={{ background: 'rgba(0, 212, 255, 0.1)' }} />

        {/* Logout */}
        <button
          onClick={logout}
          className="sidebar-nav-item text-[#ff4d6d] hover:bg-[rgba(255,77,109,0.1)]"
        >
          <span className="text-lg">&#128682;</span>
          <span className="font-inter text-[11px] font-semibold tracking-[1.5px] uppercase">LOGOUT</span>
        </button>
      </nav>
    </aside>
  );
}
