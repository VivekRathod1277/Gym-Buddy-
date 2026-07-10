import { useEffect, useRef } from 'react';

interface SessionSummaryModalProps {
  exerciseName: string;
  exerciseColor: string;
  reps: number;
  faults: string[];
  aiSuggestion: string;
  duration: number;
  onNewSession: () => void;
  onViewHistory: () => void;
  onClose: () => void;
}

export default function SessionSummaryModal({
  exerciseName,
  exerciseColor,
  reps,
  faults,
  aiSuggestion,
  duration,
  onNewSession,
  onViewHistory,
  onClose,
}: SessionSummaryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uniqueFaults = [...new Set(faults)];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        animation: 'modalFadeIn 0.4s ease-out',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[520px] mx-4"
        style={{
          background: 'rgba(18, 18, 36, 0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 12px 64px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 212, 255, 0.1)',
          animation: 'modalScaleIn 0.4s ease-out',
        }}
      >
        {/* Header */}
        <h2 className="font-orbitron font-black text-2xl tracking-[3px] uppercase text-center text-[#00d4ff]">
          SESSION COMPLETE
        </h2>

        {/* Divider */}
        <div className="w-full h-px my-5" style={{ background: 'rgba(0, 212, 255, 0.2)' }} />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Reps */}
          <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(0, 212, 255, 0.05)' }}>
            <div className="font-orbitron font-bold text-4xl text-[#e0e0e0]">{reps}</div>
            <div className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mt-1">
              REPS
            </div>
          </div>

          {/* Exercise */}
          <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(0, 212, 255, 0.05)' }}>
            <div
              className="font-orbitron font-bold text-xl tracking-[2px] uppercase"
              style={{ color: exerciseColor }}
            >
              {exerciseName}
            </div>
            <div className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mt-1">
              EXERCISE
            </div>
          </div>

          {/* Faults */}
          <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(255, 77, 109, 0.05)' }}>
            <div className="font-orbitron font-bold text-4xl text-[#ff4d6d]">
              {uniqueFaults.length}
            </div>
            <div className="font-inter text-[11px] font-semibold text-[#ff4d6d] tracking-[1.5px] uppercase mt-1">
              FAULTS DETECTED
            </div>
          </div>

          {/* Duration */}
          <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(255, 204, 0, 0.05)' }}>
            <div className="font-orbitron font-bold text-4xl text-[#ffcc00]">
              {formatDuration(duration)}
            </div>
            <div className="font-inter text-[11px] font-semibold text-[#ffcc00] tracking-[1.5px] uppercase mt-1">
              DURATION
            </div>
          </div>
        </div>

        {/* Faults List */}
        {uniqueFaults.length > 0 && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(255, 77, 109, 0.08)' }}>
            <span className="font-inter text-[11px] font-semibold text-[#ff4d6d] tracking-[1.5px] uppercase">
              FAULTS:
            </span>
            <div className="flex flex-wrap gap-2 mt-2">
              {uniqueFaults.map((fault, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[#ff4d6d]">&#9888;</span>
                  <span className="font-inter text-sm text-[#e0e0e0]">{fault.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Coaching Recap */}
        {aiSuggestion && (
          <div
            className="mb-6 p-3 rounded-lg"
            style={{
              background: 'rgba(123, 47, 247, 0.08)',
              borderLeft: '3px solid #7b2ff7',
            }}
          >
            <span className="font-inter text-[11px] font-semibold tracking-[1.5px] uppercase" style={{ color: '#7b2ff7' }}>
              AI COACHING TIP:
            </span>
            <p className="font-inter text-sm italic text-[#e0e0e0] mt-1">{aiSuggestion}</p>
          </div>
        )}

        {/* Divider */}
        <div className="w-full h-px my-6" style={{ background: 'rgba(0, 212, 255, 0.2)' }} />

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onNewSession}
            className="gradient-btn w-full py-4 flex items-center justify-center gap-2"
          >
            <span className="text-lg">&#9654;</span>
            START NEW SESSION
          </button>

          <button
            onClick={onViewHistory}
            className="w-full py-4 rounded-lg font-orbitron font-semibold text-sm tracking-[2px] uppercase transition-all duration-200 hover:bg-[rgba(0,212,255,0.08)]"
            style={{
              background: 'transparent',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
            }}
          >
            VIEW HISTORY
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleIn {
          0% { transform: scale(0.9); opacity: 0; }
          80% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
