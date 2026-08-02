import { useState, useRef, useEffect, useCallback } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { useToast } from '@/hooks/useToast';
import { EXERCISE_DISPLAY_NAMES, EXERCISE_COLORS } from '@/types';
import { WS_URL } from '@/lib/api';
import { FlipHorizontal } from 'lucide-react';

interface ExercisingStepProps {
  exercise: string;
  setNumber: number;
  onSetComplete: (reps: number, faults: string[], aiTip: string) => void;
}

export default function ExercisingStep({ exercise, setNumber, onSetComplete }: ExercisingStepProps) {
  const { speak } = useVoice();
  const { addToast } = useToast();

  const [reps, setReps] = useState(0);
  const [angle, setAngle] = useState(0);
  const [aiTip, setAiTip] = useState('');
  const [currentFault, setCurrentFault] = useState<string | null>(null);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lowPoseConfidence, setLowPoseConfidence] = useState(false);
  const [connected, setConnected] = useState(false);
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
            frameRate: { ideal: 30 },
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lowConfTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collectedFaultsRef = useRef<string[]>([]);
  const lastAiTipRef = useRef('');
  // Breathing reminders
  const breathingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const exerciseColor = EXERCISE_COLORS[exercise] || '#00d4ff';
  const exerciseName = EXERCISE_DISPLAY_NAMES[exercise] || exercise;

  const triggerFault = useCallback((faultName: string) => {
    setCurrentFault(faultName);
    if (!collectedFaultsRef.current.includes(faultName)) {
      collectedFaultsRef.current.push(faultName);
    }
    if (faultTimeoutRef.current) clearTimeout(faultTimeoutRef.current);
    faultTimeoutRef.current = setTimeout(() => setCurrentFault(null), 3000);
  }, []);

  const handleStopSet = useCallback(() => {
    // Close WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ status: 'stop' }));
      wsRef.current.close();
    }
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    // Clear timers
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (breathingTimerRef.current) clearInterval(breathingTimerRef.current);
    if (faultTimeoutRef.current) clearTimeout(faultTimeoutRef.current);
    if (lowConfTimerRef.current) clearTimeout(lowConfTimerRef.current);

    speak(`Set ${setNumber} complete! ${reps} reps. Nice work!`);
    onSetComplete(reps, collectedFaultsRef.current, lastAiTipRef.current || aiTip);
  }, [reps, aiTip, setNumber, speak, onSetComplete]);

  // Listen for voice command to stop set
  useEffect(() => {
    const handleVoiceStop = () => {
      handleStopSet();
    };
    window.addEventListener('voice-complete-set', handleVoiceStop);
    return () => {
      window.removeEventListener('voice-complete-set', handleVoiceStop);
    };
  }, [handleStopSet]);

  // Start webcam + WebSocket
  useEffect(() => {
    let cancelled = false;

    const startExercising = async () => {
      try {
        // Camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: localStorage.getItem('cameraFacingMode') || 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Wake up the backend (Render free tier sleeps after inactivity)
        const API_BASE_URL = WS_URL.replace('wss://', 'https://').replace('ws://', 'http://');
        try {
          await fetch(API_BASE_URL, { mode: 'cors' }).catch(() => {});
        } catch { /* ignore wake-up errors */ }

        // WebSocket with retry logic for cold-start scenarios
        const MAX_RETRIES = 3;
        let retryCount = 0;

        const connectWs = (): Promise<WebSocket> => {
          return new Promise((resolve, reject) => {
            if (cancelled) { reject(new Error('cancelled')); return; }
            const ws = new WebSocket(`${WS_URL}/api/workout/ws/live-stream?exercise=${exercise}`);
            const timeout = setTimeout(() => {
              ws.close();
              reject(new Error('timeout'));
            }, 20000); // 20s timeout per attempt

            ws.onopen = () => {
              clearTimeout(timeout);
              resolve(ws);
            };
            ws.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('ws_error'));
            };
            ws.onclose = () => {
              clearTimeout(timeout);
              reject(new Error('ws_closed'));
            };
          });
        };

        let ws: WebSocket | null = null;
        while (retryCount < MAX_RETRIES && !cancelled) {
          try {
            ws = await connectWs();
            break; // Connected!
          } catch (e: any) {
            retryCount++;
            if (e.message === 'cancelled' || cancelled) break;
            console.warn(`[WS] Connection attempt ${retryCount} failed, ${retryCount < MAX_RETRIES ? 'retrying...' : 'giving up'}`);
            if (retryCount < MAX_RETRIES) {
              // Wait before retry, and ping backend to ensure it's awake
              await new Promise(r => setTimeout(r, 2000));
              await fetch(API_BASE_URL, { mode: 'cors' }).catch(() => {});
            }
          }
        }

        if (!ws || cancelled) {
          if (!cancelled) addToast('Could not connect to the AI backend. Please try again.', 'error');
          return;
        }

        wsRef.current = ws;

        let isProcessingFrame = false;

        ws.onopen = null; // Already handled above
        setConnected(true);
        speak(`Set ${setNumber}. Let's go!`);
        intervalRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);

        // Breathing reminders every 30s
        breathingTimerRef.current = setInterval(() => {
          speak("Remember to breathe. Exhale on the effort.");
        }, 30000);

        const sendFrame = () => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          if (isProcessingFrame) {
            requestAnimationFrame(sendFrame);
            return;
          }
          if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              const MAX_WIDTH = 480;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                let w = video.videoWidth;
                let h = video.videoHeight;
                const maxDim = Math.max(w, h);
                if (maxDim > MAX_WIDTH) {
                  const scale = MAX_WIDTH / maxDim;
                  w = Math.floor(w * scale);
                  h = Math.floor(h * scale);
                }
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                const b64 = canvas.toDataURL('image/jpeg', 0.6);
                isProcessingFrame = true;
                ws.send(JSON.stringify({ frame: b64, exercise }));
              }
            }
          }
          requestAnimationFrame(sendFrame);
        };
        requestAnimationFrame(sendFrame);

        ws.onmessage = (event) => {
          isProcessingFrame = false;
          const data = JSON.parse(event.data);

          if (data.status === 'processing') {
            if (data.frame) setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
            if (data.reps !== undefined) {
              setReps(prev => {
                if (data.reps > prev) {
                  speak(`${data.reps}`);
                  // Motivational pushes at certain rep counts
                  if (data.reps === 5) speak("Five reps! Keep it up!");
                  else if (data.reps === 10) speak("Ten! You're on fire!");
                  else if (data.reps % 5 === 0 && data.reps > 10) speak("Great pace! Don't stop now!");
                }
                return data.reps;
              });
            }
            if (data.angle !== undefined) setAngle(data.angle);
            if (data.ai_tip) {
              setAiTip(prev => {
                if (prev !== data.ai_tip) {
                  speak(data.ai_tip);
                  lastAiTipRef.current = data.ai_tip;
                }
                return data.ai_tip;
              });
            }
            if (data.fault) {
              setCurrentFault(prev => {
                if (prev !== data.fault) triggerFault(data.fault);
                return data.fault;
              });
            }
            // Pose confidence
            if (data.pose_confidence !== undefined) {
              const isLow = data.pose_confidence < 0.4;
              if (isLow) {
                if (lowConfTimerRef.current === null) {
                  lowConfTimerRef.current = setTimeout(() => setLowPoseConfidence(true), 1200);
                }
              } else {
                if (lowConfTimerRef.current) {
                  clearTimeout(lowConfTimerRef.current);
                  lowConfTimerRef.current = null;
                }
                setLowPoseConfidence(false);
              }
            }
          }
        };

        ws.onerror = () => {
          setConnected(false);
          addToast('Connection error with the backend.', 'error');
        };

        ws.onclose = () => {
          setConnected(false);
        };

      } catch (err: any) {
        console.error('ExercisingStep init error:', err);
        addToast(err.message || 'Failed to start exercise.', 'error');
      }
    };

    startExercising();

    return () => {
      cancelled = true;
      if (wsRef.current) wsRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (breathingTimerRef.current) clearInterval(breathingTimerRef.current);
      if (faultTimeoutRef.current) clearTimeout(faultTimeoutRef.current);
      if (lowConfTimerRef.current) clearTimeout(lowConfTimerRef.current);
    };
  }, [exercise, setNumber, speak, addToast, triggerFault]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col gap-3 p-3 md:p-6">
      {/* Hidden elements for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar: set info + timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="px-3 py-1.5 rounded-lg font-orbitron font-bold text-xs tracking-wider"
            style={{ background: `${exerciseColor}20`, color: exerciseColor, border: `1px solid ${exerciseColor}40` }}
          >
            SET {setNumber}
          </div>
          <div className="font-orbitron text-sm text-[#e0e0e0] tracking-wider">
            {exerciseName}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: connected ? '#00ff88' : '#ff4d6d',
              boxShadow: `0 0 8px ${connected ? 'rgba(0, 255, 136, 0.6)' : 'rgba(255, 77, 109, 0.6)'}`,
              animation: connected ? 'pulse-dot 2s infinite' : 'none',
            }}
          />
          <span className="font-mono text-sm text-[#8888aa]">{formatTime(elapsedTime)}</span>
        </div>
      </div>

      {/* Main view: video feed */}
      <div
        className="relative flex-1 rounded-xl overflow-hidden"
        style={{ background: '#000', border: `1px solid ${exerciseColor}20`, minHeight: '250px' }}
      >
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-contain"
          style={{ zIndex: 1 }}
        />

        {/* Live processed frame */}
        {liveFrame && (
          <img
            src={liveFrame}
            alt="Live Analysis"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ zIndex: 5 }}
          />
        )}
        
        {!connected && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center justify-center" style={{ zIndex: 3 }}>
            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
              <div
                className="w-4 h-4 rounded-full border-2"
                style={{
                  borderColor: 'rgba(0, 212, 255, 0.2)',
                  borderTopColor: '#00d4ff',
                  animation: 'spin-loader 1s linear infinite',
                }}
              />
              <p className="text-white text-xs font-semibold tracking-wider font-inter">Connecting to AI Engine...</p>
            </div>
          </div>
        )}

        {/* Fault overlay */}
        {currentFault && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-20"
            style={{
              top: '10%',
              background: 'rgba(255, 77, 109, 0.85)',
              border: '2px solid rgba(255, 77, 109, 0.9)',
              borderRadius: '8px',
              padding: '10px 20px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 0 24px rgba(255, 77, 109, 0.6)',
              animation: 'faultSlideIn 0.3s ease-out',
            }}
          >
            <span className="font-orbitron font-bold text-sm tracking-[2px] uppercase text-white">
              ⚠ {currentFault.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {/* Low confidence warning */}
        {lowPoseConfidence && (
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{
              background: 'rgba(255, 190, 0, 0.18)',
              border: '1px solid rgba(255, 190, 0, 0.5)',
              color: '#ffe066',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span>⚠️</span>
            <span>Having trouble seeing you — adjust light or step back</span>
          </div>
        )}

      </div>

      {/* Bottom stats bar */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Reps */}
        <div className="flex-1 p-2 md:p-3 rounded-xl text-center" style={{ background: 'rgba(0, 212, 255, 0.06)' }}>
          <div className="font-orbitron font-black text-2xl md:text-3xl text-[#e0e0e0]">{reps}</div>
          <div className="font-inter text-[9px] md:text-[10px] font-semibold text-[#8888aa] tracking-wider uppercase">REPS</div>
        </div>

        {/* Angle */}
        <div className="flex-1 p-2 md:p-3 rounded-xl text-center" style={{ background: 'rgba(123, 47, 247, 0.06)' }}>
          <div className="font-orbitron font-bold text-xl md:text-2xl text-[#e0e0e0]">{Math.round(angle)}°</div>
          <div className="font-inter text-[9px] md:text-[10px] font-semibold text-[#8888aa] tracking-wider uppercase">ANGLE</div>
        </div>

        {/* Flip Camera */}
        <button
          onClick={toggleCamera}
          className="flex-1 p-2 md:p-3 rounded-xl flex flex-col items-center justify-center transition-all hover:bg-white/10"
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <FlipHorizontal className="w-5 h-5 mb-0.5" />
          <span className="font-inter text-[9px] md:text-[10px] font-semibold text-[#8888aa] tracking-wider uppercase">FLIP</span>
        </button>

        {/* Stop button */}
        <button
          onClick={handleStopSet}
          className="flex-[1.5] py-2 md:py-3 rounded-xl font-orbitron font-bold text-xs md:text-sm tracking-wider uppercase flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition-all duration-200 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #ff4d6d, #d90429)',
            boxShadow: '0 0 15px rgba(255, 77, 109, 0.3)',
            color: '#fff',
          }}
        >
          <span>⏹</span>
          <span className="text-[10px] md:text-sm">END SET</span>
        </button>
      </div>

      <style>{`
        @keyframes spin-loader {
          to { transform: rotate(360deg); }
        }
        @keyframes faultSlideIn {
          from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
