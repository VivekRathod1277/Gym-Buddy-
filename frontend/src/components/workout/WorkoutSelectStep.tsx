import { useEffect, useState, useRef } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { EXERCISE_DISPLAY_NAMES, EXERCISE_COLORS, MUSCLE_GROUPS } from '@/types';
import api from '@/lib/api';

interface WorkoutSelectStepProps {
  onSelect: (exercise: string) => void;
}

interface ChatMessage {
  role: 'ai' | 'user';
  text: string;
}

export default function WorkoutSelectStep({ onSelect }: WorkoutSelectStepProps) {
  const { speak } = useVoice();
  const [suggestion, setSuggestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [negotiating, setNegotiating] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch AI suggestion
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/coach/suggest-workout');
        if (!cancelled) {
          setSuggestion(res.data);
          const reasoning = res.data.reasoning;
          setMessages([{ role: 'ai', text: reasoning }]);
          speak(reasoning);
          setSelectedExercise(res.data.suggested_exercise);
          setLoading(false);
        }
      } catch (err) {
        console.error('Suggest workout failed:', err);
        if (!cancelled) {
          const fallbackMsg = "Let's start with push-ups today. A great all-around exercise!";
          setMessages([{ role: 'ai', text: fallbackMsg }]);
          speak(fallbackMsg);
          setSelectedExercise('pushup');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [speak]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNegotiate = async () => {
    if (!userInput.trim() || negotiating) return;
    const userMsg = userInput.trim();
    setUserInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setNegotiating(true);

    try {
      const res = await api.post('/coach/negotiate', {
        user_preference: userMsg,
        ai_suggestion: suggestion?.suggested_exercise || 'pushup',
      });
      const aiReply = res.data.response;
      setMessages(prev => [...prev, { role: 'ai', text: aiReply }]);
      speak(aiReply);
      setSelectedExercise(res.data.final_exercise);
    } catch (err) {
      const fallback = "Sure, we can do that! Let's get started.";
      setMessages(prev => [...prev, { role: 'ai', text: fallback }]);
      speak(fallback);
    }
    setNegotiating(false);
  };

  const handleConfirm = () => {
    if (selectedExercise) {
      const name = EXERCISE_DISPLAY_NAMES[selectedExercise] || selectedExercise;
      speak(`Alright, let's do ${name}. Get ready!`);
      onSelect(selectedExercise);
    }
  };

  const exercises = ['pushup', 'pullup', 'squat', 'bicep_curl', 'chest_press'];

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 gap-6" style={{ maxHeight: '100%' }}>
      {/* Header */}
      <div className="text-center">
        <h2 className="font-orbitron font-bold text-lg tracking-[2px] text-[#e0e0e0] uppercase mb-1">
          TODAY'S WORKOUT
        </h2>
        <p className="font-inter text-sm text-[#8888aa]">
          Your AI trainer has a suggestion
        </p>
      </div>

      {/* Weekly summary pills */}
      {suggestion?.weekly_summary && (
        <div className="flex flex-wrap justify-center gap-2">
          {Object.entries(suggestion.weekly_summary as Record<string, number>).map(([group, count]) => (
            <div
              key={group}
              className="px-3 py-1.5 rounded-full font-inter text-xs font-semibold tracking-wider uppercase"
              style={{
                background: count === 0
                  ? 'rgba(0, 255, 136, 0.1)'
                  : count >= 2
                    ? 'rgba(255, 77, 109, 0.1)'
                    : 'rgba(0, 212, 255, 0.1)',
                color: count === 0 ? '#00ff88' : count >= 2 ? '#ff4d6d' : '#00d4ff',
                border: `1px solid ${count === 0 ? 'rgba(0, 255, 136, 0.3)' : count >= 2 ? 'rgba(255, 77, 109, 0.3)' : 'rgba(0, 212, 255, 0.3)'}`,
              }}
            >
              {group}: {count}x
            </div>
          ))}
        </div>
      )}

      {/* Chat conversation */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3 neo-inset scrollbar-custom"
        style={{
          minHeight: '200px',
          maxHeight: '300px',
        }}
      >
        {loading && (
          <div className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-full bg-[rgba(0,212,255,0.15)] flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: msg.role === 'ai'
                  ? 'rgba(0, 212, 255, 0.15)'
                  : 'rgba(123, 47, 247, 0.15)',
              }}
            >
              <span className="text-sm">{msg.role === 'ai' ? '🤖' : '🏃'}</span>
            </div>
            <div
              className={`px-4 py-2.5 rounded-xl max-w-[80%] font-inter text-sm ${msg.role === 'ai' ? 'neo-card' : 'neo-inset'}`}
              style={{
                color: '#e0e0e0',
                borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '16px',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                border: `1px solid ${msg.role === 'ai' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(123, 47, 247, 0.15)'}`,
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {negotiating && (
          <div className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-full bg-[rgba(0,212,255,0.15)] flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* User input for negotiation */}
      <div className="flex gap-2">
        <input
          type="text"
          value={userInput}
          onChange={e => setUserInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNegotiate()}
          placeholder="e.g., I want to train back instead..."
          className="input-field flex-1"
          disabled={negotiating || loading}
        />
        <button
          onClick={handleNegotiate}
          disabled={!userInput.trim() || negotiating || loading}
          className="px-4 py-2 rounded-lg font-orbitron font-semibold text-xs tracking-wider"
          style={{
            background: 'rgba(0, 212, 255, 0.15)',
            color: '#00d4ff',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            opacity: !userInput.trim() || negotiating ? 0.5 : 1,
          }}
        >
          SEND
        </button>
      </div>

      {/* Exercise quick-pick grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {exercises.map(ex => (
          <button
            key={ex}
            onClick={() => {
              setSelectedExercise(ex);
              const displayName = EXERCISE_DISPLAY_NAMES[ex];
              const msg = `I'd like to do ${displayName} instead.`;
              setUserInput('');
              setMessages(prev => [...prev, { role: 'user', text: msg }]);
              // Auto-negotiate
              setNegotiating(true);
              api.post('/coach/negotiate', {
                user_preference: displayName,
                ai_suggestion: suggestion?.suggested_exercise || 'pushup',
              }).then(res => {
                setMessages(prev => [...prev, { role: 'ai', text: res.data.response }]);
                speak(res.data.response);
                setSelectedExercise(res.data.final_exercise);
              }).catch(() => {
                setMessages(prev => [...prev, { role: 'ai', text: `Sure, let's do ${displayName}!` }]);
                speak(`Sure, let's do ${displayName}!`);
              }).finally(() => setNegotiating(false));
            }}
            className={`p-3 rounded-xl text-center transition-all duration-200 ${selectedExercise === ex ? 'neo-inset' : 'neo-card hover:scale-105'}`}
            style={{
              border: selectedExercise === ex
                ? `1px solid ${EXERCISE_COLORS[ex]}80`
                : '1px solid rgba(255, 255, 255, 0.02)',
            }}
          >
            <div className="font-inter text-[10px] font-semibold tracking-wider uppercase"
              style={{ color: selectedExercise === ex ? EXERCISE_COLORS[ex] : '#8888aa' }}
            >
              {EXERCISE_DISPLAY_NAMES[ex]}
            </div>
            <div className="font-inter text-[9px] text-[#555580] mt-0.5">
              {MUSCLE_GROUPS[ex]}
            </div>
          </button>
        ))}
      </div>

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={!selectedExercise || loading}
        className="gradient-btn w-full py-4 flex items-center justify-center gap-2"
        style={{ opacity: !selectedExercise || loading ? 0.5 : 1 }}
      >
        <span className="text-lg">🎯</span>
        START {selectedExercise ? EXERCISE_DISPLAY_NAMES[selectedExercise]?.toUpperCase() : 'WORKOUT'}
      </button>
    </div>
  );
}
