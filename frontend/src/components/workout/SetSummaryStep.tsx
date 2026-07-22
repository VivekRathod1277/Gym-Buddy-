import { useEffect, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { EXERCISE_DISPLAY_NAMES, EXERCISE_COLORS } from '@/types';
import api from '@/lib/api';
import { Dumbbell } from 'lucide-react';

interface SetSummaryStepProps {
  exercise: string;
  reps: number;
  faults: string[];
  aiTip: string;
  setNumber: number;
  onNextSet: () => void;
  onEndWorkout: () => void;
}

export default function SetSummaryStep({
  exercise,
  reps,
  faults,
  setNumber,
  onNextSet,
  onEndWorkout,
}: SetSummaryStepProps) {
  const { speak } = useVoice();
  const [summary, setSummary] = useState('');
  const [motivation, setMotivation] = useState('');
  const [loading, setLoading] = useState(true);

  const exerciseColor = EXERCISE_COLORS[exercise] || '#00d4ff';
  const exerciseName = EXERCISE_DISPLAY_NAMES[exercise] || exercise;
  const uniqueFaults = [...new Set(faults)];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post('/coach/set-summary', {
          exercise,
          reps,
          faults: uniqueFaults,
          set_number: setNumber,
        });
        if (!cancelled) {
          setSummary(res.data.summary);
          setMotivation(res.data.motivation);
          // Speak summary then motivation
          speak(res.data.summary);
          setTimeout(() => speak(res.data.motivation), 3000);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const fallbackSummary = `Set ${setNumber} done. ${reps} reps.${uniqueFaults.length > 0 ? ` Watch your ${uniqueFaults[0].replace(/_/g, ' ').toLowerCase()}.` : ' Great form!'}`;
          const fallbackMotivation = "Ready for another set? Let's keep pushing!";
          setSummary(fallbackSummary);
          setMotivation(fallbackMotivation);
          speak(fallbackSummary);
          setTimeout(() => speak(fallbackMotivation), 3000);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      {/* Set badge */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{
          background: `${exerciseColor}15`,
          border: `2px solid ${exerciseColor}40`,
          boxShadow: `0 0 30px ${exerciseColor}15`,
        }}
      >
        <span className="font-orbitron font-black text-2xl" style={{ color: exerciseColor }}>
          S{setNumber}
        </span>
      </div>

      <h2 className="font-orbitron font-bold text-xl tracking-[3px] uppercase text-[#e0e0e0] mb-2">
        SET COMPLETE
      </h2>
      <p className="font-inter text-sm text-[#8888aa] mb-8">{exerciseName}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-[400px] mb-6">
        <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(0, 212, 255, 0.06)' }}>
          <div className="font-orbitron font-black text-4xl text-[#e0e0e0]">{reps}</div>
          <div className="font-inter text-[10px] font-semibold text-[#8888aa] tracking-wider uppercase mt-1">REPS</div>
        </div>
        <div className="p-4 rounded-xl text-center" style={{ background: uniqueFaults.length > 0 ? 'rgba(255, 77, 109, 0.06)' : 'rgba(0, 255, 136, 0.06)' }}>
          <div className="font-orbitron font-black text-4xl" style={{ color: uniqueFaults.length > 0 ? '#ff4d6d' : '#00ff88' }}>
            {uniqueFaults.length}
          </div>
          <div className="font-inter text-[10px] font-semibold tracking-wider uppercase mt-1"
            style={{ color: uniqueFaults.length > 0 ? '#ff4d6d' : '#00ff88' }}
          >
            FAULTS
          </div>
        </div>
      </div>

      {/* Fault list */}
      {uniqueFaults.length > 0 && (
        <div className="w-full max-w-[400px] mb-4 p-3 rounded-lg" style={{ background: 'rgba(255, 77, 109, 0.08)' }}>
          <div className="flex flex-wrap gap-2">
            {uniqueFaults.map((f, i) => (
              <span key={i} className="font-inter text-xs text-[#ff4d6d] px-2 py-1 rounded"
                style={{ background: 'rgba(255, 77, 109, 0.15)' }}
              >
                ⚠ {f.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI summary */}
      {!loading && (
        <div
          className="w-full max-w-[400px] mb-8 p-4 rounded-xl"
          style={{
            background: 'rgba(123, 47, 247, 0.08)',
            borderLeft: '3px solid #7b2ff7',
          }}
        >
          <p className="font-inter text-sm italic text-[#e0e0e0] mb-2">{summary}</p>
          <p className="font-inter text-sm font-semibold" style={{ color: '#00ff88' }}>{motivation}</p>
        </div>
      )}

      {loading && (
        <div className="mb-8 text-[#8888aa] text-sm animate-pulse">
          Your trainer is reviewing your set...
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-full max-w-[400px]">
        <button
          onClick={onNextSet}
          className="gradient-btn w-full py-4 flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${exerciseColor}, #7b2ff7)`,
          }}
        >
          <Dumbbell className="w-5 h-5" />
          NEXT SET
        </button>

        <button
          onClick={onEndWorkout}
          className="w-full py-4 rounded-lg font-orbitron font-semibold text-sm tracking-[2px] uppercase transition-all duration-200 hover:bg-[rgba(255,77,109,0.08)]"
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 77, 109, 0.3)',
            color: '#ff4d6d',
          }}
        >
          END WORKOUT
        </button>
      </div>
    </div>
  );
}
