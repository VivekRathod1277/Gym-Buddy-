import { useEffect, useState, useRef } from 'react';
import { useVoice } from '@/hooks/useVoice';
import api from '@/lib/api';
import BiomechanicalLoader from '@/components/BiomechanicalLoader';
import { Dumbbell, Activity } from 'lucide-react';

interface GreetingStepProps {
  onNext: () => void;
}

export default function GreetingStep({ onNext }: GreetingStepProps) {
  const { speak } = useVoice();
  const [greeting, setGreeting] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      if (idx >= greeting.length) {
        clearInterval(timer);
        setTimeout(() => setReady(true), 800);
      }
    }, 35);

    return () => clearInterval(timer);
  }, [greeting, speak]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative" style={{ minHeight: '60vh' }}>
      
      {/* Background glow effects for extra depth */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#00d4ff] opacity-[0.03] blur-[100px] pointer-events-none rounded-full"></div>
      <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-[#7b2ff7] opacity-[0.03] blur-[80px] pointer-events-none rounded-full"></div>

      {loading ? (
        <BiomechanicalLoader />
      ) : (
        <div className="z-10 w-full flex flex-col items-center">
          {/* Pulsing trainer icon */}
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center mb-10 relative group"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(123, 47, 247, 0.15))',
              border: '2px solid rgba(0, 212, 255, 0.4)',
              animation: 'pulse-glow 2.5s infinite alternate ease-in-out'
            }}
          >
            <div className="absolute inset-0 rounded-full border-[1px] border-[#7b2ff7] opacity-40 blur-[2px] scale-[1.15]"></div>
            <Dumbbell className="w-12 h-12 text-[#00d4ff] drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] z-10 relative animate-[bounce_3s_infinite]" />
          </div>

          {/* Greeting text card */}
          <div 
            className="w-full max-w-[650px] mb-12 p-8 md:p-10 rounded-2xl relative overflow-hidden transition-all duration-700" 
            style={{ 
              minHeight: '140px',
              background: 'rgba(30, 33, 42, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              opacity: displayedText.length > 0 ? 1 : 0,
              transform: displayedText.length > 0 ? 'translateY(0)' : 'translateY(10px)'
            }}
          >
            {/* Top decorative gradient line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00d4ff] to-transparent opacity-60"></div>
            {/* Bottom decorative gradient line */}
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#7b2ff7] to-transparent opacity-30"></div>
            
            <p
              className="font-inter text-xl md:text-2xl text-[#f0f0f0] leading-[1.6] font-light tracking-wide"
              style={{ textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)' }}
            >
              {displayedText}
              <span
                className="inline-block w-[3px] h-[1.1em] ml-[6px] align-text-bottom rounded-sm"
                style={{
                  background: 'linear-gradient(to bottom, #00d4ff, #7b2ff7)',
                  animation: displayedText.length < greeting.length ? 'blink 0.6s infinite' : 'pulse-opacity 2s infinite',
                  boxShadow: '0 0 12px rgba(0, 212, 255, 0.6)'
                }}
              />
            </p>
          </div>
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={onNext}
        disabled={!ready}
        className="px-14 py-4 flex items-center justify-center gap-4 transition-all duration-700 rounded-xl relative overflow-hidden group z-10"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(20px)',
          background: 'rgba(20, 22, 28, 0.8)',
          border: '1px solid rgba(0, 212, 255, 0.4)',
          boxShadow: '0 0 20px rgba(0, 212, 255, 0.15), inset 0 0 20px rgba(0, 212, 255, 0.05)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#00d4ff] to-[#7b2ff7] opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent -skew-x-[45deg] group-hover:animate-shine"></div>
        
        <Activity className="w-6 h-6 text-[#00d4ff] relative z-10 group-hover:scale-110 group-hover:text-white transition-all duration-300" />
        <span className="font-inter font-bold text-[#00d4ff] tracking-[3px] text-sm md:text-base relative z-10 drop-shadow-[0_0_8px_rgba(0,212,255,0.5)] group-hover:text-white transition-colors duration-300">
          LET'S TRAIN
        </span>
      </button>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }
        @keyframes pulse-glow {
          0% { 
            box-shadow: 0 0 20px rgba(0, 212, 255, 0.15), inset 0 0 10px rgba(0, 212, 255, 0.1); 
            border-color: rgba(0, 212, 255, 0.3);
          }
          100% { 
            box-shadow: 0 0 50px rgba(0, 212, 255, 0.4), inset 0 0 20px rgba(123, 47, 247, 0.3); 
            border-color: rgba(123, 47, 247, 0.6); 
          }
        }
        @keyframes shine {
          0% { transform: translateX(-100%) skewX(-45deg); }
          100% { transform: translateX(200%) skewX(-45deg); }
        }
      `}</style>
      <div ref={bottomRef} className="h-10 w-full shrink-0" />
    </div>
  );
}
