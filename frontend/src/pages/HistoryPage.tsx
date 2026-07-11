import { useNavigate } from 'react-router';
import { useSessions } from '@/hooks/useSessions';
import { EXERCISE_COLORS } from '@/types';
import Sidebar from '@/components/Sidebar';

export default function HistoryPage() {
  const { sessions, totalSessions, totalReps, totalXP } = useSessions();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-[#242730]">
      <Sidebar />

      <main className="flex-1 md:ml-[260px] pb-[70px] md:pb-0 flex flex-col min-h-screen">
        {/* Page Header */}
        <div
          className="px-4 md:px-8 py-4 md:py-6"
          style={{ borderBottom: '1px solid rgba(0, 212, 255, 0.15)' }}
        >
          <h1 className="font-orbitron font-bold text-lg md:text-[22px] tracking-[3px] uppercase text-[#e0e0e0]">
            YOUR PROGRESS
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 md:p-8 overflow-auto scrollbar-custom">
          {/* Summary Stats Row */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-4 mb-6 md:mb-8">
            {/* Total Sessions */}
            <div className="neo-card flex-1 p-4 md:p-5 relative">
              <span className="absolute top-4 right-4 text-base text-[#555580]">&#128197;</span>
              <div className="font-orbitron font-bold text-4xl text-[#e0e0e0]">{totalSessions}</div>
              <div className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mt-1">
                TOTAL SESSIONS
              </div>
            </div>

            {/* Total Reps */}
            <div className="neo-card flex-1 p-4 md:p-5 relative">
              <span className="absolute top-4 right-4 text-base text-[#555580]">&#127947;</span>
              <div className="font-orbitron font-bold text-4xl text-[#00d4ff]">{totalReps}</div>
              <div className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mt-1">
                TOTAL REPS
              </div>
            </div>

            {/* XP */}
            <div className="neo-card flex-1 p-4 md:p-5 relative">
              <span className="absolute top-4 right-4 text-base text-[#555580]">&#11088;</span>
              <div className="font-orbitron font-bold text-4xl text-[#7b2ff7]">{totalXP} XP</div>
              <div className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mt-1">
                EXPERIENCE
              </div>
            </div>
          </div>

          {/* Section Header */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg text-[#8888aa]">&#128203;</span>
            <h2 className="font-orbitron font-bold text-base tracking-[2px] uppercase text-[#e0e0e0]">
              SESSION HISTORY
            </h2>
          </div>

          {/* Session Cards */}
          {sessions.length > 0 ? (
            <div className="flex flex-col gap-4">
              {sessions.map(session => {
                const exerciseColor = EXERCISE_COLORS[session.exerciseName] || '#00d4ff';
                const faultList = session.faults || [];

                return (
                  <div
                    key={session.id}
                    className="neo-card p-4 md:p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-default"
                    style={{
                      borderLeft: `3px solid ${exerciseColor}`,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0, 212, 255, 0.35)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0, 212, 255, 0.15)';
                    }}
                  >
                    {/* Top Row */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="font-orbitron font-bold text-base tracking-[2px] uppercase"
                        style={{ color: exerciseColor }}
                      >
                        {session.exerciseName}
                      </span>
                      <span className="font-inter text-xs text-[#555580]">
                        {session.timestamp}
                      </span>
                    </div>

                    {/* Reps */}
                    <div className="mb-2">
                      <span className="font-orbitron font-bold text-xl text-[#e0e0e0]">{session.totalReps}</span>
                      <span className="font-inter text-sm text-[#8888aa] ml-1">reps completed</span>
                    </div>

                    {/* Faults */}
                    {faultList.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                        {faultList.map((fault, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="text-sm text-[#ff4d6d]">&#9888;</span>
                            <span className="font-inter text-xs text-[#ff4d6d]">{fault}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI Tip */}
                    {session.aiSuggestion && (
                      <div className="flex items-start gap-2 mt-2">
                        <span className="text-sm flex-shrink-0" style={{ color: '#7b2ff7' }}>&#129504;</span>
                        <p className="font-inter text-[13px] italic text-[#8888aa] line-clamp-2">
                          {session.aiSuggestion}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="neo-card p-8 md:p-12 flex flex-col items-center text-center">
              <span className="text-5xl mb-4 text-[#555580]">&#128203;</span>
              <p className="font-inter text-sm text-[#8888aa] mb-6 max-w-md">
                No sessions yet. Complete your first workout to see your progress here!
              </p>
              <button
                onClick={() => navigate('/workout')}
                className="gradient-btn px-8 py-3"
              >
                GO TO WORKOUT
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
