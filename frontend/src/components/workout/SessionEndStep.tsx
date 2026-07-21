import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useVoice } from '@/hooks/useVoice';
import { useSessions } from '@/hooks/useSessions';
import { EXERCISE_DISPLAY_NAMES, EXERCISE_COLORS } from '@/types';

interface SetData {
  reps: number;
  faults: string[];
  aiTip: string;
}

interface SessionEndStepProps {
  exercise: string;
  sets: SetData[];
  totalDuration: number;
  onNewWorkout: () => void;
}

export default function SessionEndStep({ exercise, sets, totalDuration, onNewWorkout }: SessionEndStepProps) {
  const { speak } = useVoice();
  const { addSession } = useSessions();
  const navigate = useNavigate();

  const exerciseColor = EXERCISE_COLORS[exercise] || '#00d4ff';
  const exerciseName = EXERCISE_DISPLAY_NAMES[exercise] || exercise;
  const totalReps = sets.reduce((sum, s) => sum + s.reps, 0);
  const allFaults = sets.flatMap(s => s.faults);
  const uniqueFaults = [...new Set(allFaults)];
  const lastTip = sets[sets.length - 1]?.aiTip || 'Great workout!';

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Save session + voice goodbye
  useEffect(() => {
    const greeting = `Awesome workout! ${sets.length} sets, ${totalReps} total reps. Great effort today. See you next time!`;
    speak(greeting);

    // Save to backend
    addSession({
      exerciseName,
      totalReps,
      faults: uniqueFaults,
      aiSuggestion: lastTip,
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      duration: totalDuration,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center py-12 px-6 text-center w-full max-w-4xl mx-auto">
      {/* Trophy icon */}
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 204, 0, 0.15), rgba(255, 153, 0, 0.15))',
          border: '2px solid rgba(255, 204, 0, 0.4)',
          boxShadow: '0 0 40px rgba(255, 204, 0, 0.15)',
          animation: 'trophyGlow 2s ease-in-out infinite',
        }}
      >
        <span className="text-5xl">🏆</span>
      </div>

      <h2 className="font-orbitron font-black text-2xl tracking-[3px] uppercase text-[#00d4ff] mb-2">
        WORKOUT COMPLETE
      </h2>
      <p className="font-inter text-sm text-[#8888aa] mb-8">{exerciseName}</p>

      {/* Full stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-[600px] mb-8">
        <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(0, 212, 255, 0.06)' }}>
          <div className="font-orbitron font-black text-3xl text-[#e0e0e0]">{totalReps}</div>
          <div className="font-inter text-[10px] font-semibold text-[#8888aa] tracking-wider uppercase mt-1">TOTAL REPS</div>
        </div>

        <div className="p-4 rounded-xl text-center" style={{ background: `${exerciseColor}10` }}>
          <div className="font-orbitron font-black text-3xl" style={{ color: exerciseColor }}>{sets.length}</div>
          <div className="font-inter text-[10px] font-semibold tracking-wider uppercase mt-1" style={{ color: exerciseColor }}>SETS</div>
        </div>

        <div className="p-4 rounded-xl text-center" style={{ background: uniqueFaults.length > 0 ? 'rgba(255, 77, 109, 0.06)' : 'rgba(0, 255, 136, 0.06)' }}>
          <div className="font-orbitron font-black text-3xl" style={{ color: uniqueFaults.length > 0 ? '#ff4d6d' : '#00ff88' }}>
            {uniqueFaults.length}
          </div>
          <div className="font-inter text-[10px] font-semibold tracking-wider uppercase mt-1"
            style={{ color: uniqueFaults.length > 0 ? '#ff4d6d' : '#00ff88' }}
          >
            FAULTS
          </div>
        </div>

        <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(255, 204, 0, 0.06)' }}>
          <div className="font-orbitron font-black text-3xl text-[#ffcc00]">{formatDuration(totalDuration)}</div>
          <div className="font-inter text-[10px] font-semibold text-[#ffcc00] tracking-wider uppercase mt-1">DURATION</div>
        </div>
      </div>

      {/* Per-set breakdown */}
      <div className="w-full max-w-[600px] mb-6">
        <h3 className="font-orbitron text-xs tracking-[2px] text-[#8888aa] uppercase mb-3">SET BREAKDOWN</h3>
        <div className="grid gap-2">
          {sets.map((set, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'rgba(18, 18, 36, 0.5)', border: '1px solid rgba(255, 255, 255, 0.04)' }}
            >
              <span className="font-orbitron text-xs text-[#8888aa]">SET {i + 1}</span>
              <span className="font-inter text-sm text-[#e0e0e0]">{set.reps} reps</span>
              <span className="font-inter text-xs" style={{ color: set.faults.length > 0 ? '#ff4d6d' : '#00ff88' }}>
                {set.faults.length > 0 ? `${set.faults.length} faults` : '✓ Clean'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Faults list */}
      {uniqueFaults.length > 0 && (
        <div className="w-full max-w-[600px] mb-6 p-3 rounded-lg" style={{ background: 'rgba(255, 77, 109, 0.08)' }}>
          <span className="font-inter text-[11px] font-semibold text-[#ff4d6d] tracking-[1.5px] uppercase">AREAS TO IMPROVE:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {uniqueFaults.map((f, i) => (
              <span key={i} className="font-inter text-sm text-[#e0e0e0]">• {f.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </div>
      )}

      {/* AI recap */}
      {lastTip && (
        <div
          className="w-full max-w-[600px] mb-8 p-4 rounded-xl"
          style={{ background: 'rgba(123, 47, 247, 0.08)', borderLeft: '3px solid #7b2ff7' }}
        >
          <span className="font-inter text-[11px] font-semibold tracking-[1.5px] uppercase" style={{ color: '#7b2ff7' }}>
            AI COACHING TIP:
          </span>
          <p className="font-inter text-sm italic text-[#e0e0e0] mt-1">{lastTip}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-full max-w-[400px] mt-4 mb-8">
        <button
          onClick={onNewWorkout}
          className="w-full py-4 rounded-xl font-orbitron font-bold text-lg tracking-widest text-black transition-all bg-[#00d4ff] hover:bg-[#00e5ff] shadow-[0_0_15px_rgba(0,212,255,0.4)] hover:shadow-[0_0_25px_rgba(0,212,255,0.6)] flex items-center justify-center gap-2"
        >
          <span className="text-lg">🔄</span>
          NEW WORKOUT
        </button>

        <button
          onClick={() => navigate('/history')}
          className="w-full py-4 rounded-xl font-orbitron font-semibold text-sm tracking-[2px] uppercase transition-all duration-200 hover:bg-[rgba(0,212,255,0.08)]"
          style={{ background: 'transparent', border: '1px solid rgba(0, 212, 255, 0.3)', color: '#00d4ff' }}
        >
          VIEW HISTORY
        </button>
      </div>

      <style>{`
        @keyframes trophyGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 204, 0, 0.15); }
          50% { box-shadow: 0 0 40px rgba(255, 204, 0, 0.3), 0 0 60px rgba(255, 153, 0, 0.15); }
        }
      `}</style>
    </div>
  );
}
