import { useEffect, useState, useRef, useCallback } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { EXERCISE_DISPLAY_NAMES, EXERCISE_COLORS } from '@/types';
import api from '@/lib/api';
import { Ruler, FlipHorizontal, Rocket } from 'lucide-react';

interface PositioningStepProps {
  exercise: string;
  onReady: () => void;
}

export default function PositioningStep({ exercise, onReady }: PositioningStepProps) {
  const { speak } = useVoice();
  const [tips, setTips] = useState<string[]>([]);
  const [currentTip, setCurrentTip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [poseDetected, setPoseDetected] = useState(false);
  const [readyCountdown, setReadyCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    (localStorage.getItem('cameraFacingMode') as 'user' | 'environment') || 'environment'
  );

  const toggleCamera = useCallback(async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    localStorage.setItem('cameraFacingMode', newMode);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: newMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error('Failed to flip camera:', err);
      }
    }
  }, [facingMode]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const exerciseColor = EXERCISE_COLORS[exercise] || '#00d4ff';
  const exerciseName = EXERCISE_DISPLAY_NAMES[exercise] || exercise;

  // Fetch positioning tips
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/coach/positioning-tips?exercise=${exercise}`);
        if (!cancelled) {
          setTips(res.data.tips);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setTips([
            'Get into position for the exercise.',
            'Make sure your body is visible in the camera.',
            'Keep proper form and alignment.',
            'Take a deep breath before starting.',
          ]);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [exercise]);

  // Speak tips one by one
  useEffect(() => {
    if (tips.length === 0 || loading) return;

    // Speak the intro
    speak(`Alright, get set for ${exerciseName}. Let me walk you through the setup.`);

    let tipIdx = 0;
    const speakNext = () => {
      if (tipIdx < tips.length) {
        setTimeout(() => {
          speak(tips[tipIdx]);
          setCurrentTip(tipIdx);
          tipIdx++;
          speakNext();
        }, 4000); // 4s between tips
      } else {
        setTimeout(() => {
          speak("Looking good! Hit the ready button whenever you're set.");
          setPoseDetected(true);
        }, 3000);
      }
    };
    speakNext();
  }, [tips, loading, speak, exerciseName]);

  // Start camera
  useEffect(() => {
    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: localStorage.getItem('cameraFacingMode') || 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error('Camera access failed:', err);
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Countdown before starting exercise
  const handleReady = () => {
    speak("3, 2, 1, Go!");
    setReadyCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setReadyCountdown(count);
      } else {
        clearInterval(interval);
        setReadyCountdown(null);
        // Stop camera — ExercisingStep will start its own
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        onReady();
      }
    }, 1000);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 md:p-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-orbitron font-bold text-lg tracking-[2px] uppercase mb-1"
          style={{ color: exerciseColor }}
        >
          {exerciseName}
        </h2>
        <p className="font-inter text-sm text-[#8888aa]">
          Get into position — your trainer is watching
        </p>
      </div>

      {/* Camera + Tips layout */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {/* Camera feed */}
        <div
          className="relative flex-1 rounded-xl overflow-hidden"
          style={{
            background: '#000',
            border: `1px solid ${exerciseColor}30`,
            minHeight: '250px',
          }}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            muted
            autoPlay
          />

          {/* Countdown overlay */}
          {readyCountdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
              <span
                className="font-orbitron font-black text-8xl"
                style={{
                  color: exerciseColor,
                  textShadow: `0 0 40px ${exerciseColor}80`,
                  animation: 'countPulse 1s ease-out',
                }}
              >
                {readyCountdown}
              </span>
            </div>
          )}

          {/* Positioning label */}
          <div
            className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg font-inter text-xs font-semibold tracking-wider uppercase"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              color: exerciseColor,
              border: `1px solid ${exerciseColor}40`,
            }}
          >
            <Ruler className="w-4 h-4" /> POSITIONING
          </div>

          {/* Flip Camera Button */}
          <button
            onClick={toggleCamera}
            className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg font-inter text-xs font-semibold tracking-wider uppercase flex items-center gap-1 transition-all hover:bg-white/10"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <FlipHorizontal className="w-4 h-4" /> FLIP
          </button>
        </div>

        {/* Tips checklist */}
        <div
          className="w-full md:w-[280px] p-4 rounded-xl flex flex-col gap-3"
          style={{
            background: 'rgba(18, 18, 36, 0.6)',
            border: '1px solid rgba(0, 212, 255, 0.1)',
          }}
        >
          <h3 className="font-orbitron font-bold text-xs tracking-[2px] text-[#8888aa] uppercase mb-1">
            SETUP CHECKLIST
          </h3>

          {loading ? (
            <div className="flex items-center gap-2 text-[#8888aa] text-sm animate-pulse">
              Loading tips...
            </div>
          ) : (
            tips.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-2 rounded-lg transition-all duration-500"
                style={{
                  background: i <= currentTip ? 'rgba(0, 212, 255, 0.06)' : 'transparent',
                  opacity: i <= currentTip ? 1 : 0.4,
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-500"
                  style={{
                    background: i < currentTip
                      ? 'rgba(0, 255, 136, 0.2)'
                      : i === currentTip
                        ? `${exerciseColor}30`
                        : 'rgba(85, 85, 128, 0.2)',
                    border: `1.5px solid ${
                      i < currentTip ? '#00ff88' : i === currentTip ? exerciseColor : '#555580'
                    }`,
                  }}
                >
                  {i < currentTip ? (
                    <span className="text-[10px] text-[#00ff88]">✓</span>
                  ) : i === currentTip ? (
                    <div className="w-2 h-2 rounded-full" style={{ background: exerciseColor, animation: 'pulse-dot 1.5s infinite' }} />
                  ) : null}
                </div>
                <p className="font-inter text-sm text-[#e0e0e0] leading-snug">{tip}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Ready button */}
      <button
        onClick={handleReady}
        disabled={!poseDetected || readyCountdown !== null}
        className="gradient-btn w-full py-4 flex items-center justify-center gap-2 transition-all duration-500"
        style={{
          opacity: poseDetected && readyCountdown === null ? 1 : 0.4,
          background: poseDetected
            ? `linear-gradient(135deg, ${exerciseColor}, #7b2ff7)`
            : undefined,
        }}
      >
        <Rocket className="w-5 h-5" />
        {readyCountdown !== null ? 'STARTING...' : "I'M READY — START COUNTING"}
      </button>

      <style>{`
        @keyframes countPulse {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
