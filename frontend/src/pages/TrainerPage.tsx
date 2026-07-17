import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import type { WorkoutFlowStep } from '@/types';

import NamePrompt from '@/components/workout/NamePrompt';
import GreetingStep from '@/components/workout/GreetingStep';
import WorkoutSelectStep from '@/components/workout/WorkoutSelectStep';
import PositioningStep from '@/components/workout/PositioningStep';
import ExercisingStep from '@/components/workout/ExercisingStep';
import SetSummaryStep from '@/components/workout/SetSummaryStep';
import SessionEndStep from '@/components/workout/SessionEndStep';

interface SetData {
  reps: number;
  faults: string[];
  aiTip: string;
}

export default function TrainerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<WorkoutFlowStep>('greeting');
  const [selectedExercise, setSelectedExercise] = useState<string>('pushup');
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [sets, setSets] = useState<SetData[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // For transition animations
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleStepTransition = (nextStep: WorkoutFlowStep) => {
    setIsFading(true);
    setTimeout(() => {
      setStep(nextStep);
      setIsFading(false);
    }, 400); // match CSS transition duration
  };

  const handleGreetingNext = () => {
    handleStepTransition('workout-select');
  };

  const handleWorkoutSelect = (exercise: string) => {
    setSelectedExercise(exercise);
    handleStepTransition('positioning');
  };

  const handlePositioningReady = () => {
    if (!sessionStartTime) {
      setSessionStartTime(Date.now());
    }
    handleStepTransition('exercising');
  };

  const handleSetComplete = (reps: number, faults: string[], aiTip: string) => {
    const newSet = { reps, faults, aiTip };
    setSets(prev => [...prev, newSet]);
    handleStepTransition('set-summary');
  };

  const handleNextSet = () => {
    setCurrentSetNumber(prev => prev + 1);
    handleStepTransition('positioning');
  };

  const handleEndWorkout = () => {
    handleStepTransition('session-end');
  };

  const handleNewWorkout = () => {
    setSets([]);
    setCurrentSetNumber(1);
    setSessionStartTime(null);
    handleStepTransition('greeting');
  };

  if (!user) return null;

  const totalDuration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] relative overflow-hidden">
      {/* Dynamic background effects */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#00d4ff] to-transparent opacity-5 pointer-events-none" />
      <div className="absolute top-[-150px] right-[-150px] w-[400px] h-[400px] bg-[#7b2ff7] rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-150px] left-[-150px] w-[400px] h-[400px] bg-[#00ff88] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      {/* Name Prompt Modal (Only shows if user has no name) */}
      {!user.name && (
        <NamePrompt onComplete={() => {}} />
      )}

      {/* Main Flow Area */}
      <div
        className={`flex-1 flex flex-col transition-opacity duration-400 ease-in-out z-10 ${
          isFading ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
        }`}
      >
        {step === 'greeting' && (
          <GreetingStep onNext={handleGreetingNext} />
        )}

        {step === 'workout-select' && (
          <WorkoutSelectStep onSelect={handleWorkoutSelect} />
        )}

        {step === 'positioning' && (
          <PositioningStep exercise={selectedExercise} onReady={handlePositioningReady} />
        )}

        {step === 'exercising' && (
          <ExercisingStep
            exercise={selectedExercise}
            setNumber={currentSetNumber}
            onSetComplete={handleSetComplete}
          />
        )}

        {step === 'set-summary' && (
          <SetSummaryStep
            exercise={selectedExercise}
            reps={sets[sets.length - 1]?.reps || 0}
            faults={sets[sets.length - 1]?.faults || []}
            aiTip={sets[sets.length - 1]?.aiTip || ''}
            setNumber={currentSetNumber}
            onNextSet={handleNextSet}
            onEndWorkout={handleEndWorkout}
          />
        )}

        {step === 'session-end' && (
          <SessionEndStep
            exercise={selectedExercise}
            sets={sets}
            totalDuration={totalDuration}
            onNewWorkout={handleNewWorkout}
          />
        )}
      </div>

      {/* Quit Button (visible on all steps except session end) */}
      {step !== 'session-end' && (
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-[rgba(255,255,255,0.1)]"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span className="text-xl text-[#8888aa] hover:text-[#fff]">✕</span>
        </button>
      )}
    </div>
  );
}
