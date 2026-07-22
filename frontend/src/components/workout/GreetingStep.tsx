import { useEffect, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import api from '@/lib/api';
import BiomechanicalLoader from '@/components/BiomechanicalLoader';

interface GreetingStepProps {
  onNext: () => void;
}

export default function GreetingStep({ onNext }: GreetingStepProps) {
  const { speak } = useVoice();
  const [greeting, setGreeting] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/coach/greeting');
        if (!cancelled) {
          setGreeting(res.data.greeting);
          setLoading(false);
        }
      } catch (err) {
        console.error('Greeting fetch failed:', err);
        if (!cancelled) {
          setGreeting("Hey! Ready for a great workout today? Let's go!");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Typewriter + voice
  useEffect(() => {
    if (!greeting) return;

    // Speak the greeting aloud
    speak(greeting);

    let idx = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      idx++;
      setDisplayedText(greeting.slice(0, idx));
      if (idx >= greeting.length) {
        clearInterval(timer);
        setTimeout(() => setReady(true), 800);
      }
    }, 35);

    return () => clearInterval(timer);
  }, [greeting, speak]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: '60vh' }}>
      {loading ? (
        <BiomechanicalLoader />
      ) : (
        <>
          {/* Pulsing trainer icon */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-8 mx-auto"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(123, 47, 247, 0.15))',
              border: '2px solid rgba(0, 212, 255, 0.3)',
              boxShadow: '0 0 40px rgba(0, 212, 255, 0.15)',
            }}
          >
            <span className="text-5xl">🏋️</span>
          </div>

          {/* Greeting text */}
          <div className="max-w-[500px] mb-10 mx-auto" style={{ minHeight: '80px' }}>
            <p
            className="font-inter text-lg text-[#e0e0e0] leading-relaxed"
            style={{ textShadow: '0 0 20px rgba(0, 212, 255, 0.2)' }}
          >
            {displayedText}
            <span
              className="inline-block w-[2px] h-[1.1em] ml-1 align-text-bottom"
              style={{
                background: '#00d4ff',
                animation: displayedText.length < greeting.length ? 'blink 0.7s infinite' : 'none',
                opacity: displayedText.length < greeting.length ? 1 : 0,
              }}
            />
            </p>
          </div>
        </>
      )}

      {/* Continue button */}
      <button
        onClick={onNext}
        disabled={!ready}
        className="gradient-btn px-12 py-4 flex items-center justify-center gap-3 transition-all duration-500"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(20px)',
        }}
      >
        <span className="text-lg">💪</span>
        LET'S TRAIN
      </button>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.15); }
          50% { box-shadow: 0 0 40px rgba(0, 212, 255, 0.3), 0 0 60px rgba(123, 47, 247, 0.15); }
        }
      `}</style>
    </div>
  );
}
