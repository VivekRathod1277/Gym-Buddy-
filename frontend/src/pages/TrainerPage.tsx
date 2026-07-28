import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useVoice } from '@/hooks/useVoice';
import { EXERCISE_DISPLAY_NAMES } from '@/types';
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
  const { speak } = useVoice();

  const [step, setStep] = useState<WorkoutFlowStep>('greeting');
  const [selectedExercise, setSelectedExercise] = useState<string>('pushup');
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [sets, setSets] = useState<SetData[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // For transition animations
  const [isFading, setIsFading] = useState(false);

  // Voice command control states
  const [voiceControlEnabled, setVoiceControlEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const recognitionRef = useRef<any>(null);

  const stepRef = useRef(step);
  const selectedExerciseRef = useRef(selectedExercise);
  const currentSetNumberRef = useRef(currentSetNumber);
  const setsRef = useRef(sets);

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { selectedExerciseRef.current = selectedExercise; }, [selectedExercise]);
  useEffect(() => { currentSetNumberRef.current = currentSetNumber; }, [currentSetNumber]);
  useEffect(() => { setsRef.current = sets; }, [sets]);

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

  const handleVoiceCommand = (transcript: string) => {
    const currentStep = stepRef.current;
    console.log(`Voice Command on Step ${currentStep}:`, transcript);

    const matches = (...phrases: string[]) => {
      return phrases.some(phrase => transcript.includes(phrase));
    };

    if (currentStep === 'greeting') {
      if (matches('start', 'next', 'go', 'begin', "let's start", "lets start")) {
        handleGreetingNext();
      }
    } 
    else if (currentStep === 'workout-select') {
      let detectedEx = '';
      if (matches('push up', 'pushup', 'pushups')) {
        detectedEx = 'pushup';
      } else if (matches('pull up', 'pullup', 'pullups')) {
        detectedEx = 'pullup';
      } else if (matches('squat', 'squats')) {
        detectedEx = 'squat';
      } else if (matches('bicep curl', 'bicep curls', 'curl', 'curls')) {
        detectedEx = 'bicep_curl';
      } else if (matches('chest press', 'bench press', 'press')) {
        detectedEx = 'chest_press';
      }

      if (detectedEx) {
        const displayName = EXERCISE_DISPLAY_NAMES[detectedEx];
        speak(`Selected ${displayName}. Say confirm or start to proceed.`);
        setSelectedExercise(detectedEx);
        return;
      }

      if (matches('confirm', 'yes', 'ready', 'proceed', 'start')) {
        speak(`Confirmed. Let's do this!`);
        handleWorkoutSelect(selectedExerciseRef.current);
      }
      else if (transcript.length > 3) {
        speak("Let me talk to the AI trainer about that.");
        const event = new CustomEvent('voice-negotiate', { detail: transcript });
        window.dispatchEvent(event);
      }
    } 
    else if (currentStep === 'positioning') {
      if (matches('ready', 'start', 'begin', 'go', "let's go", "lets go")) {
        handlePositioningReady();
      }
    } 
    else if (currentStep === 'exercising') {
      if (matches('done', 'stop', 'finish', 'complete', 'end set', 'end')) {
        const event = new CustomEvent('voice-complete-set');
        window.dispatchEvent(event);
      }
    } 
    else if (currentStep === 'set-summary') {
      if (matches('next set', 'next', 'continue', 'more')) {
        handleNextSet();
      } else if (matches('end workout', 'finish', 'stop', 'complete', 'done', 'end')) {
        handleEndWorkout();
      }
    } 
    else if (currentStep === 'session-end') {
      if (matches('new workout', 'restart', 'start over', 'again')) {
        handleNewWorkout();
      } else if (matches('dashboard', 'home', 'exit')) {
        navigate('/');
      }
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API is not supported in this browser.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
      console.log("Speech recognition started");
    };

    rec.onresult = (event: any) => {
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript.trim().toLowerCase();
      console.log("Speech recognition result:", transcript);
      setVoiceTranscript(transcript);
      handleVoiceCommand(transcript);
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        setVoiceControlEnabled(false);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      console.log("Speech recognition ended");
      if (voiceControlEnabled) {
        try {
          rec.start();
        } catch (e) {
          console.error("Error restarting speech recognition:", e);
        }
      }
    };

    recognitionRef.current = rec;

    if (voiceControlEnabled) {
      try {
        rec.start();
      } catch (e) {
        console.error("Error starting speech recognition:", e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [voiceControlEnabled]);

  if (!user) return null;

  const totalDuration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0a0f] relative overflow-hidden">
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
        className={`flex-1 flex flex-col transition-opacity duration-400 ease-in-out z-10 overflow-y-auto overflow-x-hidden pb-48 md:pb-10 ${
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

      {/* Floating Voice Command HUD */}
      {!isVoicePanelOpen && (
        <button
          onClick={() => setIsVoicePanelOpen(true)}
          className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_20px_rgba(0,212,255,0.3)] hover:scale-110 ${
            voiceControlEnabled && isListening ? 'bg-[rgba(0,212,255,0.15)] shadow-[0_0_30px_rgba(0,212,255,0.4)]' : 'bg-[rgba(10,10,20,0.85)]'
          }`}
          style={{
            border: '1px solid rgba(0, 212, 255, 0.25)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span className={`text-2xl ${voiceControlEnabled && isListening ? 'text-[#00d4ff] animate-pulse' : 'text-gray-500'}`}>🎤</span>
        </button>
      )}

      {isVoicePanelOpen && (
        <div 
          className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl flex flex-col gap-3 transition-all duration-300 shadow-[0_0_25px_rgba(0,212,255,0.15)] md:w-80 w-[calc(100%-3rem)]"
          style={{
            background: 'rgba(10, 10, 20, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isListening ? 'bg-[#00ff88] animate-ping' : 'bg-gray-500'}`} />
              <span className="font-orbitron text-xs font-bold tracking-[1.5px] text-[#e0e0e0]">
                BUDDY VOICE CONTROL
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVoiceControlEnabled(!voiceControlEnabled)}
                className="text-[10px] font-orbitron font-semibold tracking-wider px-2.5 py-1 rounded-lg transition-all"
                style={{
                  background: voiceControlEnabled ? 'rgba(255, 77, 109, 0.15)' : 'rgba(0, 212, 255, 0.15)',
                  color: voiceControlEnabled ? '#ff4d6d' : '#00d4ff',
                  border: `1px solid ${voiceControlEnabled ? 'rgba(255, 77, 109, 0.3)' : 'rgba(0, 212, 255, 0.3)'}`,
                }}
              >
                {voiceControlEnabled ? 'MUTE MIC' : 'ACTIVATE'}
              </button>
              <button
                onClick={() => setIsVoicePanelOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-lg transition-all bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.15)] text-gray-300"
              >
                ✕
              </button>
            </div>
          </div>

          {voiceControlEnabled ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isListening ? 'bg-[#00d4ff]/20 border border-[#00d4ff] shadow-[0_0_15px_rgba(0,212,255,0.4)]' : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <span className={`text-lg ${isListening ? 'animate-pulse text-[#00d4ff]' : 'text-gray-500'}`}>🎤</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-inter font-bold text-gray-500 tracking-wider">LAST HEARD:</div>
                  <div className="text-xs font-inter text-gray-200 italic truncate">
                    {voiceTranscript ? `"${voiceTranscript}"` : 'Listening for your command...'}
                  </div>
                </div>
              </div>

              <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] font-inter font-bold text-gray-400 tracking-wider mb-1.5 uppercase">
                  Try saying on this step:
                </div>
                <ul className="space-y-1 text-[11px] font-inter text-[#8888aa]">
                  {step === 'greeting' && (
                    <li>• <span className="text-[#00ff88]">"start"</span> / <span className="text-[#00ff88]">"next"</span> to select workout</li>
                  )}
                  {step === 'workout-select' && (
                    <>
                      <li>• <span className="text-[#00ff88]">"push up"</span> / <span className="text-[#00ff88]">"squat"</span> to choose</li>
                      <li>• <span className="text-[#00ff88]">"confirm"</span> / <span className="text-[#00ff88]">"start"</span> to begin</li>
                      <li>• <span className="text-[#00ff88]">"I want to do squats"</span> to update routine</li>
                    </>
                  )}
                  {step === 'positioning' && (
                    <li>• <span className="text-[#00ff88]">"ready"</span> / <span className="text-[#00ff88]">"start"</span> to begin set</li>
                  )}
                  {step === 'exercising' && (
                    <li>• <span className="text-[#ff4d6d]">"done"</span> / <span className="text-[#ff4d6d]">"stop"</span> to end the set</li>
                  )}
                  {step === 'set-summary' && (
                    <>
                      <li>• <span className="text-[#00ff88]">"next set"</span> to continue</li>
                      <li>• <span className="text-[#ff4d6d]">"end workout"</span> / <span className="text-[#ff4d6d]">"finish"</span> to end</li>
                    </>
                  )}
                  {step === 'session-end' && (
                    <>
                      <li>• <span className="text-[#00ff88]">"new workout"</span> to restart</li>
                      <li>• <span className="text-[#8888aa]">"dashboard"</span> / <span className="text-[#8888aa]">"home"</span> to exit</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-xs font-inter text-gray-500">
              Voice control is offline. Click Activate to enable hands-free commands.
            </div>
          )}
        </div>
      )}

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
