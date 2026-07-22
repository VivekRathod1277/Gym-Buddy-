import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useVoice } from '@/hooks/useVoice';
import { useState } from 'react';
import { VolumeX, Volume2, Home, Dumbbell, BarChart2, Apple, User, LogOut, Menu, X } from 'lucide-react';
import ProfileModal from '@/components/ProfileModal';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isMuted, toggleMute } = useVoice();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleNav = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Hamburger Menu */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 rounded-lg bg-[#242730]/80 text-[#00d4ff] hover:bg-white/5 border border-[#00d4ff]/20 backdrop-blur-md transition-all shadow-[0_0_15px_rgba(0,212,255,0.15)]"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed z-50 flex flex-col neo-card rounded-r-2xl border-none 
                   top-0 left-0 h-[100dvh] w-[260px] items-stretch justify-start px-6 py-6 
                   transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Close Button inside drawer */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-1 text-[#8888aa] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand */}
        <div className="block mb-8 mt-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl text-[#00d4ff]" style={{ textShadow: '0 0 12px rgba(0, 212, 255, 0.6)' }}>
              &#9889;
            </span>
            <span className="font-orbitron font-bold text-base text-[#e0e0e0] tracking-[2px] uppercase">
              GYM BUDDY
            </span>
          </div>
          <p className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase">
            AI-POWERED FORM CORRECTION
          </p>
        </div>

        {/* Divider */}
        <div className="block w-full h-px mb-6 bg-white/5 neo-inset" />

        {/* User Info */}
        <div className="block mb-6">
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

        {/* Divider */}
        <div className="block w-full h-px mb-4 bg-white/5 neo-inset" />

        {/* Navigation */}
        <nav className="flex flex-col gap-4 w-full flex-1 justify-start overflow-y-auto scrollbar-none pr-1 -mr-1">
          <button
            onClick={() => handleNav('/dashboard')}
            className={`sidebar-nav-item ${isActive('/dashboard') || isActive('/') ? 'active' : ''}`}
          >
            <span className="text-lg flex justify-center items-center">
              <Home className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold tracking-wider text-left">HOME</span>
          </button>

          <button
            onClick={() => handleNav('/workout')}
            className={`sidebar-nav-item ${isActive('/workout') ? 'active' : ''}`}
          >
            <span className="text-lg flex justify-center items-center">
              <Dumbbell className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold tracking-wider text-left">WORKOUT</span>
          </button>

          <button
            onClick={() => handleNav('/history')}
            className={`sidebar-nav-item ${isActive('/history') ? 'active' : ''}`}
          >
            <span className="text-lg flex justify-center items-center">
              <BarChart2 className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold tracking-wider text-left">HISTORY</span>
          </button>

          <button
            onClick={() => handleNav('/diet-planner')}
            className={`sidebar-nav-item ${isActive('/diet-planner') || isActive('/diet-dashboard') ? 'active' : ''}`}
          >
            <span className="text-lg flex justify-center items-center">
              <Apple className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold tracking-wider text-left">DIET</span>
          </button>

          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className="sidebar-nav-item"
          >
            <span className="text-lg flex justify-center items-center relative">
              {isMuted ? <VolumeX className="w-5 h-5 text-[#ff4d6d]" /> : <Volume2 className="w-5 h-5 text-[#00d4ff]" />}
            </span>
            <div className="flex w-full items-center justify-between">
              <span className="font-bold tracking-wider text-sm text-left">
                {isMuted ? 'UNMUTE' : 'MUTE'}
              </span>
              {isMuted && (
                <span className="w-2 h-2 rounded-full bg-[#ff4d6d] shadow-[0_0_8px_rgba(255,77,109,0.8)]" />
              )}
            </div>
          </button>

          {/* Divider */}
          <div className="block w-full h-px my-2 bg-white/5 neo-inset" />

          {/* Profile */}
          <button
            onClick={() => { setIsProfileOpen(true); setIsOpen(false); }}
            className={`sidebar-nav-item ${isProfileOpen ? 'active' : ''}`}
          >
            <span className="text-lg flex justify-center items-center text-[#c084fc]">
              <User className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold tracking-wider text-left">PROFILE</span>
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="sidebar-nav-item text-[#ff4d6d] hover:text-[#ff2a55]"
          >
            <span className="text-lg flex justify-center items-center">
              <LogOut className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold tracking-wider text-left">LOGOUT</span>
          </button>
        </nav>

        {/* Profile Modal */}
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      </aside>
    </>
  );
}
