import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useVoice } from '@/hooks/useVoice';
import { useState } from 'react';
import ProfileModal from '@/components/ProfileModal';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isMuted, toggleMute } = useVoice();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className="fixed z-50 flex md:flex-col neo-card rounded-none md:rounded-r-2xl border-none 
                 bottom-0 left-0 w-full h-[70px] flex-row items-center justify-around px-2
                 md:top-0 md:h-screen md:w-[260px] md:items-stretch md:justify-start md:px-6 md:py-6"
    >
      {/* Brand (Desktop Only) */}
      <div className="hidden md:block mb-8">
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

      {/* Divider (Desktop Only) */}
      <div className="hidden md:block w-full h-px mb-6 bg-white/5 neo-inset" />

      {/* User Info (Desktop Only) */}
      <div className="hidden md:block mb-6">
        <p className="font-inter text-xs text-[#8888aa] truncate">{user?.email || 'user@email.com'}</p>
        <div className="flex items-center gap-2 mt-1">
          <div
            className="w-2 h-2 rounded-full bg-[#00ff88]"
            style={{ animation: 'pulse-dot 2s infinite', boxShadow: '0 0 8px rgba(0, 255, 136, 0.6)' }}
          />
          <span className="font-inter text-[11px] font-semibold text-[#00ff88] tracking-[1.5px] uppercase">
            ACTIVE MEMBER
          </span>
        </div>
      </div>

      {/* Divider (Desktop Only) */}
      <div className="hidden md:block w-full h-px mb-4 bg-white/5 neo-inset" />

      {/* Navigation */}
      <nav className="flex flex-row md:flex-col gap-2 md:gap-4 w-full md:flex-1 justify-around md:justify-start">
        <button
          onClick={() => navigate('/dashboard')}
          className={`sidebar-nav-item flex-col md:flex-row flex-1 md:flex-none h-full md:h-[50px] ${isActive('/dashboard') || isActive('/') ? 'active' : ''}`}
        >
          <span className="w-6 md:w-8 text-center text-xl md:text-lg inline-block">&#127968;</span>
          <span className="text-[10px] md:text-sm mt-1 md:mt-0 font-bold tracking-wider text-left md:flex-1">HOME</span>
        </button>

        <button
          onClick={() => navigate('/workout')}
          className={`sidebar-nav-item flex-col md:flex-row flex-1 md:flex-none h-full md:h-[50px] ${isActive('/workout') ? 'active' : ''}`}
        >
          <span className="w-6 md:w-8 text-center text-xl md:text-lg inline-block">&#127947;</span>
          <span className="text-[10px] md:text-sm mt-1 md:mt-0 font-bold tracking-wider text-left md:flex-1">WORKOUT</span>
        </button>

        <button
          onClick={() => navigate('/history')}
          className={`sidebar-nav-item flex-col md:flex-row flex-1 md:flex-none h-full md:h-[50px] ${isActive('/history') ? 'active' : ''}`}
        >
          <span className="w-6 md:w-8 text-center text-xl md:text-lg inline-block">&#128202;</span>
          <span className="text-[10px] md:text-sm mt-1 md:mt-0 font-bold tracking-wider text-left md:flex-1">HISTORY</span>
        </button>

        <button
          onClick={() => navigate('/diet-planner')}
          className={`sidebar-nav-item flex-col md:flex-row flex-1 md:flex-none h-full md:h-[50px] ${isActive('/diet-planner') || isActive('/diet-dashboard') ? 'active' : ''}`}
        >
          <span className="w-6 md:w-8 text-center text-xl md:text-lg inline-block">&#127822;</span>
          <span className="text-[10px] md:text-sm mt-1 md:mt-0 font-bold tracking-wider text-left md:flex-1">DIET</span>
        </button>

        {/* Mute Toggle (Icon only on mobile, full text on desktop) */}
        <button
          onClick={toggleMute}
          className="sidebar-nav-item flex-col md:flex-row flex-1 md:flex-none h-full md:h-[50px]"
        >
          <span className="w-6 md:w-8 text-center text-xl md:text-lg inline-block relative">
            {isMuted ? '🔇' : '🔊'}
            {isMuted && (
              <span className="md:hidden absolute top-0 right-0 w-2 h-2 rounded-full bg-[#ff4d6d] shadow-[0_0_8px_rgba(255,77,109,0.8)]" />
            )}
          </span>
          <span className="hidden md:inline font-bold tracking-wider text-[10px] md:text-sm text-left md:flex-1">
            {isMuted ? 'UNMUTE' : 'MUTE'}
          </span>
          {isMuted && (
            <span className="hidden md:block w-2 h-2 rounded-full bg-[#ff4d6d] ml-auto shadow-[0_0_8px_rgba(255,77,109,0.8)]" />
          )}
        </button>

        {/* Divider (Desktop Only) */}
        <div className="hidden md:block w-full h-px my-2 bg-white/5 neo-inset" />

        {/* Profile */}
        <button
          onClick={() => setIsProfileOpen(true)}
          className={`sidebar-nav-item flex-col md:flex-row flex-1 md:flex-none h-full md:h-[50px] ${isProfileOpen ? 'active' : ''}`}
        >
          <span className="w-6 md:w-8 text-center text-xl md:text-lg inline-block text-[#c084fc]">&#128100;</span>
          <span className="text-[10px] md:text-sm mt-1 md:mt-0 font-bold tracking-wider text-left md:flex-1">PROFILE</span>
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="sidebar-nav-item flex-col md:flex-row flex-1 md:flex-none h-full md:h-[50px] text-[#ff4d6d] hover:text-[#ff2a55]"
        >
          <span className="w-6 md:w-8 text-center text-xl md:text-lg inline-block">&#128682;</span>
          <span className="text-[10px] md:text-sm mt-1 md:mt-0 font-bold tracking-wider text-left md:flex-1">LOGOUT</span>
        </button>
      </nav>

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </aside>
  );
}
