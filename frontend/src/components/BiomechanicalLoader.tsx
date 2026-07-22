import { useEffect, useState } from 'react';

const LOADING_PHASES = [
  'Initializing pose estimation...',
  'Calibrating neural models...',
  'Connecting to biomechanics engine...',
  'Preparing session variables...',
];

export default function BiomechanicalLoader() {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    // Cycle through phrases every 1.5 seconds
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % LOADING_PHASES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-32 h-32 flex items-center justify-center mb-8">
        {/* Outer glowing ring */}
        <div 
          className="absolute inset-0 rounded-full border-2 border-transparent"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(123, 47, 247, 0.2)) border-box',
            WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            boxShadow: '0 0 30px rgba(0, 212, 255, 0.2)'
          }}
        />

        {/* Dashed rotating scan ring */}
        <div className="absolute inset-2 border-2 border-dashed border-[#00d4ff]/40 rounded-full animate-[spin_8s_linear_infinite]" />
        
        {/* Inner fast rotating ring */}
        <div className="absolute inset-4 border border-t-[#7b2ff7] border-r-transparent border-b-[#7b2ff7] border-l-transparent rounded-full animate-[spin_2s_linear_infinite]" />
        
        {/* Pulsing core */}
        <div 
          className="w-14 h-14 rounded-full flex items-center justify-center relative z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(123, 47, 247, 0.15))',
            border: '1px solid rgba(0, 212, 255, 0.4)',
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
            animation: 'pulse-glow 1.5s infinite'
          }}
        >
          <span className="text-[#00d4ff] font-orbitron font-bold text-sm tracking-widest" style={{ textShadow: '0 0 10px rgba(0,212,255,0.8)' }}>
            AI
          </span>
        </div>

        {/* Scanning line */}
        <div className="absolute inset-0 overflow-hidden rounded-full z-20 pointer-events-none">
          <div className="w-full h-[2px] absolute top-0 left-0 animate-[scan_2s_ease-in-out_infinite]"
               style={{ 
                 background: 'linear-gradient(90deg, transparent, #00ff88, transparent)',
                 boxShadow: '0 0 8px #00ff88'
               }} 
          />
        </div>
      </div>

      <div className="h-6 overflow-hidden">
        <p className="font-orbitron text-xs text-[#00d4ff] tracking-[2px] uppercase animate-pulse">
          {LOADING_PHASES[phaseIndex]}
        </p>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(140px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
