import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { dietApi } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function DietDashboardPage() {
  const [plan, setPlan] = useState<any>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    // Try to load from localStorage first (just generated)
    const stored = localStorage.getItem('latestDietPlan');
    if (stored) {
      setPlan(JSON.parse(stored));
      localStorage.removeItem('latestDietPlan'); // clear it so we fetch fresh next time
    } else {
      // Fetch latest from history
      dietApi.getHistory()
        .then(history => {
          if (history && history.length > 0) {
            setPlan(history[0].plan_json);
          } else {
            // No plan found, redirect to planner
            navigate('/diet-planner');
          }
        })
        .catch(err => {
          console.error("Error fetching history:", err);
          navigate('/diet-planner');
        });
    }
  }, [navigate]);

  const handleDownloadPdf = async () => {
    if (!plan) return;
    setLoadingPdf(true);
    try {
      await dietApi.downloadPdf(JSON.stringify(plan));
      addToast('PDF downloaded successfully!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Failed to download PDF', 'error');
    } finally {
      setLoadingPdf(false);
    }
  };

  if (!plan) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen pt-24 pb-32 md:pb-12 px-4 md:px-8 max-w-6xl mx-auto space-y-8">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-orbitron text-2xl md:text-3xl text-white font-bold mb-1">
            YOUR CUSTOM PLAN
          </h1>
          <p className="text-[#00ff88] font-inter font-bold tracking-widest text-sm uppercase">
            Goal: {plan.goal}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/diet-planner')}
            className="px-6 py-2 rounded-xl font-orbitron font-bold text-sm tracking-wider text-white border border-white/20 hover:bg-white/10 transition-colors"
          >
            REGENERATE
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={loadingPdf}
            className="px-6 py-2 rounded-xl font-orbitron font-bold text-sm tracking-wider text-black bg-[#00d4ff] hover:bg-[#00e5ff] shadow-[0_0_15px_rgba(0,212,255,0.4)] transition-all disabled:opacity-50"
          >
            {loadingPdf ? 'DOWNLOADING...' : 'DOWNLOAD PDF'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="neo-card p-4 text-center">
          <div className="text-gray-400 font-inter text-xs font-bold tracking-wider mb-1">BMI</div>
          <div className="text-2xl font-orbitron font-bold text-white">{plan.bmi}</div>
        </div>
        <div className="neo-card p-4 text-center">
          <div className="text-gray-400 font-inter text-xs font-bold tracking-wider mb-1">CALORIES</div>
          <div className="text-2xl font-orbitron font-bold text-[#00ff88]">{plan.calories}</div>
        </div>
        <div className="neo-card p-4 text-center">
          <div className="text-gray-400 font-inter text-xs font-bold tracking-wider mb-1">PROTEIN</div>
          <div className="text-2xl font-orbitron font-bold text-[#00d4ff]">{plan.protein}g</div>
        </div>
        <div className="neo-card p-4 text-center">
          <div className="text-gray-400 font-inter text-xs font-bold tracking-wider mb-1">CARBS / FATS</div>
          <div className="text-2xl font-orbitron font-bold text-[#ff4d6d]">{plan.carbs}g / {plan.fats}g</div>
        </div>
      </div>

      {/* 7-Day Plan */}
      <div className="space-y-8">
        {[1, 2, 3, 4, 5, 6, 7].map(dayNum => {
          const dayKey = `Day ${dayNum}`;
          const diet = plan.weekly_diet[dayKey];
          const workout = plan.weekly_workout[dayKey];

          return (
            <div key={dayNum} className="neo-card p-0 overflow-hidden">
              <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 flex items-center justify-center border border-[#00d4ff]/50">
                  <span className="font-orbitron font-bold text-[#00d4ff]">{dayNum}</span>
                </div>
                <h2 className="font-orbitron text-xl text-white font-bold tracking-wider">
                  DAY {dayNum}
                </h2>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Diet Section */}
                <div className="space-y-4">
                  <h3 className="font-inter text-[#00ff88] font-bold tracking-widest text-sm flex items-center gap-2">
                    <span>&#127822;</span> MEAL PLAN
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <span className="text-xs text-gray-500 font-bold block mb-1">BREAKFAST</span>
                      <span className="text-sm text-gray-300">{diet.breakfast}</span>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <span className="text-xs text-gray-500 font-bold block mb-1">LUNCH</span>
                      <span className="text-sm text-gray-300">{diet.lunch}</span>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <span className="text-xs text-gray-500 font-bold block mb-1">DINNER</span>
                      <span className="text-sm text-gray-300">{diet.dinner}</span>
                    </div>
                  </div>
                </div>

                {/* Workout Section */}
                <div className="space-y-4">
                  <h3 className="font-inter text-[#ff4d6d] font-bold tracking-widest text-sm flex items-center gap-2">
                    <span>&#127947;</span> {workout.type.toUpperCase()}
                  </h3>
                  <p className="text-xs text-gray-400 italic mb-2">Focus: {workout.focus}</p>
                  
                  <div className="space-y-2">
                    {workout.exercises.map((ex: any, idx: number) => (
                      <div key={idx} className="flex flex-col bg-black/20 rounded-lg p-3 border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold text-gray-200">{ex.name}</span>
                          <span className="text-xs font-mono text-[#00d4ff] bg-[#00d4ff]/10 px-2 py-0.5 rounded">
                            {ex.sets === 1 ? ex.reps : `${ex.sets}x ${ex.reps}`}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{ex.notes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
