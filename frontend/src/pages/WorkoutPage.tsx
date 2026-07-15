import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useSessions } from '@/hooks/useSessions';
import { useVoice } from '@/hooks/useVoice';
import { useToast } from '@/hooks/useToast';
import { EXERCISE_CONFIGS, EXERCISE_COLORS } from '@/types';
import api from '@/lib/api';
import type { AnalysisStatus, InputMode, ExerciseType } from '@/types';
import Sidebar from '@/components/Sidebar';
import SessionSummaryModal from '@/components/SessionSummaryModal';
import { WS_URL, API_BASE } from '@/lib/api';

export default function WorkoutPage() {
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [exerciseType] = useState<ExerciseType>('auto');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [reps, setReps] = useState(0);
  const [angle, setAngle] = useState(150);
  const [aiTip, setAiTip] = useState('');
  const [aiTipRevealed, setAiTipRevealed] = useState('');
  const [currentFault, setCurrentFault] = useState<string | null>(null);
  const [detectedFaults, setDetectedFaults] = useState<string[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [detectedExercise, setDetectedExercise] = useState<string | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [lowPoseConfidence, setLowPoseConfidence] = useState(false);
  const lowConfTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusStartTimeRef = useRef<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { addSession } = useSessions();
  const { speak } = useVoice();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (faultTimeoutRef.current) clearTimeout(faultTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Typewriter effect for AI tip
  useEffect(() => {
    if (!aiTip) {
      setAiTipRevealed('');
      return;
    }
    let index = 0;
    setAiTipRevealed('');
    const timer = setInterval(() => {
      index++;
      setAiTipRevealed(aiTip.slice(0, index));
      if (index >= aiTip.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [aiTip]);

  const triggerFault = useCallback((faultName: string) => {
    setCurrentFault(faultName);
    setDetectedFaults(prev => [...prev, faultName]);
    // Speak the AI tip instead of hardcoded fault, handled in WebSocket onmessage

    if (faultTimeoutRef.current) clearTimeout(faultTimeoutRef.current);
    faultTimeoutRef.current = setTimeout(() => {
      setCurrentFault(null);
    }, 3000);
  }, [speak]);

  const startAnalysis = useCallback(async () => {
    if (inputMode === 'upload' && !file) return;

    setIsInitializing(true);
    setStatus('scanning');
    setReps(0);
    setAngle(150);
    setAiTip('');
    setAiTipRevealed('');
    setCurrentFault(null);
    setDetectedFaults([]);
    setShowSummary(false);
    setElapsedTime(0);
    setProcessedVideoUrl(null);
    setLiveFrame(null);
    setDetectedExercise(null);

    speak('Initializing analysis...');

    try {
      const config = EXERCISE_CONFIGS[exerciseType];
      const exerciseName = config.name === 'Auto Detect' ? 'auto' : config.name;

      if (inputMode === 'upload') {
        const formData = new FormData();
        formData.append('file', file!);
        formData.append('exercise', exerciseName);
        
        const uploadResponse = await api.post('/workout/process-video', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        const taskId = uploadResponse.data.task_id;
        
        setIsInitializing(false);
        setStatus('active');
        statusStartTimeRef.current = Date.now();
        speak(`Processing video...`);
        
        const ws = new WebSocket(`${WS_URL}/api/workout/ws/stream-video/${taskId}`);
        wsRef.current = ws;
        
        intervalRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.status === 'processing') {
            if (data.frame) setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
            if (data.reps !== undefined) {
               setReps(prev => {
                  if (data.reps > prev) speak(`Rep ${data.reps}`);
                  return data.reps;
               });
            }
            if (data.angle !== undefined) {
               setAngle(data.angle);
            }
            if (data.exercise) {
               setDetectedExercise(data.exercise);
            }
            if (data.ai_tip) {
               setAiTip(prev => {
                   if (prev !== data.ai_tip) speak(data.ai_tip);
                   return data.ai_tip;
               });
            }
            if (data.fault) {
               setCurrentFault(prev => {
                   if (prev !== data.fault) triggerFault(data.fault);
                   return data.fault;
               });
            }
          } else if (data.status === 'completed') {
            ws.close();
            if (intervalRef.current) clearInterval(intervalRef.current);
            
            const result = data.result || {};
            setReps(result.total_reps || 0);
            setDetectedFaults(result.faults_recorded || []);
            setAiTip(result.ai_suggestion || 'Great job!');
            if (result.processed_video_url) {
              setProcessedVideoUrl(result.processed_video_url);
            }
            
            setStatus('done');
            speak('Session complete. Great work!');
            
            const sessionData = {
              exerciseName: result.exercise || exerciseName,
              totalReps: result.total_reps || 0,
              faults: result.faults_recorded || [],
              aiSuggestion: result.ai_suggestion || 'Great job!',
              timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
              duration: Math.floor((Date.now() - statusStartTimeRef.current) / 1000),
            };
            
            addSession(sessionData);
            addToast(`Session saved! Total Reps: ${result.total_reps || 0}`, 'success');
            setTimeout(() => setShowSummary(true), 1500);
          } else if (data.status === 'failed') {
            ws.close();
            if (intervalRef.current) clearInterval(intervalRef.current);
            setStatus('idle');
            addToast('Video processing failed: ' + data.error, 'error');
          }
        };
        
        ws.onerror = () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setStatus('idle');
          addToast('WebSocket connection error.', 'error');
        };
        
        ws.onclose = () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setStatus((prevStatus) => {
            if (prevStatus === 'active' || prevStatus === 'scanning') {
              return 'idle';
            }
            return prevStatus;
          });
        };
      } else {
        // Webcam Mode
        let stream;
        try {
          // Step 14: request explicit resolution + framerate so the backend
          // receives a usable frame even in dim conditions
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
            audio: false,
          });
        } catch (err) {
          throw new Error('Camera access denied or not available.');
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setWebcamActive(true);
        console.log('[Webcam] Camera stream acquired successfully');

        console.log('[WebSocket] Connecting to ' + WS_URL + '/api/workout/ws/live-stream?exercise=' + exerciseType);
        const ws = new WebSocket(`${WS_URL}/api/workout/ws/live-stream?exercise=${exerciseType}`);
        wsRef.current = ws;

        let isProcessingFrame = false;
        let wsConnected = false;

        // Timeout: if WebSocket doesn't open within 10 seconds, abort
        const connectTimeout = setTimeout(() => {
          if (!wsConnected) {
            console.error('[WebSocket] Connection timeout after 10s');
            ws.close();
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
            setWebcamActive(false);
            setIsInitializing(false);
            setStatus('idle');
            addToast('Backend connection timed out. Is the server running on port 8000?', 'error');
          }
        }, 10000);

        ws.onopen = () => {
          wsConnected = true;
          clearTimeout(connectTimeout);
          console.log('[WebSocket] Connection opened successfully');
          setIsInitializing(false);
          setStatus('active');
          statusStartTimeRef.current = Date.now();
          speak(`Webcam active. Get in position.`);
          intervalRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);

          const sendFrame = () => {
            if (ws.readyState !== WebSocket.OPEN) return;
            
            if (isProcessingFrame) {
              // Wait for backend to catch up before sending the next frame
              requestAnimationFrame(sendFrame);
              return;
            }

            if (videoRef.current && canvasRef.current) {
              const canvas = canvasRef.current;
              const video = videoRef.current;
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                const MAX_WIDTH = 320;
                let width = video.videoWidth;
                let height = video.videoHeight;
                
                if (width > MAX_WIDTH) {
                  height = Math.floor(height * (MAX_WIDTH / width));
                  width = MAX_WIDTH;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(video, 0, 0, width, height);
                  const b64 = canvas.toDataURL('image/jpeg', 0.4);
                  isProcessingFrame = true;
                  ws.send(JSON.stringify({ frame: b64, exercise: exerciseType }));
                }
              }
            }
            requestAnimationFrame(sendFrame);
          };
          requestAnimationFrame(sendFrame);
        };

        ws.onmessage = (event) => {
          isProcessingFrame = false; // Reset flag on response
          const data = JSON.parse(event.data);
          
          if (data.status === 'processing') {
            if (data.frame) setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
            if (data.reps !== undefined) {
               setReps(prev => {
                  if (data.reps > prev) speak(`Rep ${data.reps}`);
                  return data.reps;
               });
            }
            if (data.angle !== undefined) setAngle(data.angle);
            if (data.exercise) {
               setDetectedExercise(data.exercise);
            }
            if (data.ai_tip) {
               setAiTip(prev => {
                   if (prev !== data.ai_tip) speak(data.ai_tip);
                   return data.ai_tip;
               });
            }
            if (data.fault) {
               setCurrentFault(prev => {
                   if (prev !== data.fault) triggerFault(data.fault);
                   return data.fault;
               });
            }
            // Step 17: track pose confidence and show warning on sustained low signal
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
          } else if (data.status === 'completed') {
            ws.close();
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
            }
            
            const result = data.result || {};
            setReps(result.total_reps || 0);
            setDetectedFaults(result.faults_recorded || []);
            setAiTip(result.ai_suggestion || 'Great job!');
            
            setStatus('done');
            speak('Session complete. Great work!');
            
            const sessionData = {
              exerciseName: result.exercise || exerciseName,
              totalReps: result.total_reps || 0,
              faults: result.faults_recorded || [],
              aiSuggestion: result.ai_suggestion || 'Great job!',
              timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
              duration: Math.floor((Date.now() - statusStartTimeRef.current) / 1000),
            };
            
            addSession(sessionData);
            addToast(`Session saved! Total Reps: ${result.total_reps || 0}`, 'success');
            setTimeout(() => setShowSummary(true), 1500);
          } else if (data.status === 'failed') {
            ws.close();
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
            }
            setStatus('idle');
            addToast('Analysis failed: ' + data.error, 'error');
          }
        };

        ws.onerror = (e) => {
          console.error('[WebSocket] Connection error:', e);
          clearTimeout(connectTimeout);
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
          setWebcamActive(false);
          setIsInitializing(false);
          setStatus('idle');
          addToast('WebSocket connection error. Is the backend running on port 8000?', 'error');
        };

        ws.onclose = (e) => {
          console.log('[WebSocket] Connection closed. Code:', e.code, 'Reason:', e.reason);
          clearTimeout(connectTimeout);
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
          setWebcamActive(false);
          setIsInitializing(false);
          setStatus((prevStatus) => {
            if (prevStatus === 'active' || prevStatus === 'scanning') {
              return 'idle';
            }
            return prevStatus;
          });
        };
      }
    } catch (err: any) {
      console.error('Initialization failed', err);
      setIsInitializing(false);
      setStatus('idle');
      addToast(err.message || 'Failed to start analysis.', 'error');
    }
  }, [inputMode, file, exerciseType, speak, addSession, addToast]);
  const handleNewSession = useCallback(() => {
    setStatus('idle');
    setReps(0);
    setAngle(150);
    setAiTip('');
    setAiTipRevealed('');
    setCurrentFault(null);
    setDetectedFaults([]);
    setShowSummary(false);
    setFile(null);
    setIsInitializing(false);
    setElapsedTime(0);
    setProcessedVideoUrl(null);
    setLiveFrame(null);
    setDetectedExercise(null);
    setWebcamActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (faultTimeoutRef.current) clearTimeout(faultTimeoutRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  const stopAnalysis = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ status: 'stop' }));
      wsRef.current.close();
    }
    handleNewSession();
  }, [handleNewSession]);

  const statusConfig = {
    idle: { color: '#555580', text: 'IDLE', dot: false },
    scanning: { color: '#ffcc00', text: 'SCANNING', dot: true },
    active: { color: '#00ff88', text: 'ACTIVE', dot: true },
    done: { color: '#00d4ff', text: 'DONE', dot: false },
  };

  const currentStatus = statusConfig[status];
  const isActive = status === 'active';
  const effectiveExercise = detectedExercise || exerciseType;
  const exerciseConfig = EXERCISE_CONFIGS[effectiveExercise as ExerciseType] || EXERCISE_CONFIGS.auto;
  const exerciseName = exerciseConfig.name === 'Auto Detect' ? 'Auto Detect' : exerciseConfig.name;
  const exerciseColor = EXERCISE_COLORS[effectiveExercise as ExerciseType] || '#00d4ff';

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0f' }}>
      <Sidebar />

      <main className="flex-1 md:ml-[260px] pb-[70px] md:pb-0 flex flex-col min-h-screen">
        {/* Page Header */}
        <div
          className="px-4 md:px-8 py-4 md:py-6"
          style={{ borderBottom: '1px solid rgba(0, 212, 255, 0.15)' }}
        >
          <h1 className="font-orbitron font-bold text-lg md:text-[22px] tracking-[3px] uppercase text-[#e0e0e0]">
            WORKOUT ANALYSIS
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 md:p-8 flex flex-col gap-4 md:gap-6 overflow-y-auto md:overflow-hidden">
          {/* Two Column Grid */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 flex-none md:flex-1 min-h-0">
            {/* Configuration Panel */}
            <div className="neo-card p-5 md:p-7 flex flex-col w-full md:w-[40%] md:min-w-[320px]">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-lg">&#9881;</span>
                <h2 className="font-orbitron font-bold text-base tracking-[2px] uppercase text-[#e0e0e0]">
                  CONFIGURATION
                </h2>
              </div>

              {/* Input Mode */}
              <div className="mb-5">
                <label className="block font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mb-2">
                  INPUT MODE
                </label>
                <select
                  value={inputMode}
                  onChange={e => setInputMode(e.target.value as InputMode)}
                  className="input-field cursor-pointer appearance-none"
                  disabled={isActive || isInitializing}
                >
                  <option value="upload">Upload Video</option>
                  <option value="webcam">Live Webcam</option>
                </select>
              </div>


              {/* File Uploader */}
              {inputMode === 'upload' && (
                <div className="mb-6 relative">
                  <label className="block font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mb-2">
                    VIDEO FILE
                  </label>
                  <input
                    type="file"
                    accept=".mp4,.mov,.avi,.mkv"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                    }}
                    disabled={isActive || isInitializing}
                    title="Upload video"
                  />
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 relative ${
                      file
                        ? 'border-[#00ff88]/50 bg-[rgba(0,255,136,0.03)]'
                        : 'border-[rgba(0,212,255,0.3)] bg-[rgba(10,10,15,0.3)] hover:border-[rgba(0,212,255,0.6)] hover:bg-[rgba(0,212,255,0.03)]'
                    }`}
                    style={{ opacity: isActive || isInitializing ? 0.5 : 1 }}
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[#00ff88]">&#10003;</span>
                        <span className="font-inter text-sm text-[#e0e0e0]">{file.name}</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl mb-2 text-[#555580]">&#128206;</div>
                        <p className="font-inter text-sm text-[#8888aa]">
                          Drag & drop a video file here, or click to browse
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Start/Stop Button */}
              {isActive ? (
                <button
                  onClick={stopAnalysis}
                  className="gradient-btn w-full py-4 flex items-center justify-center gap-2 mt-auto"
                  style={{
                    background: 'linear-gradient(135deg, #ff4d6d, #d90429)',
                    boxShadow: '0 0 15px rgba(255, 77, 109, 0.4)'
                  }}
                >
                  <span className="text-lg">&#9724;</span>
                  STOP ANALYSIS
                </button>
              ) : (
                <button
                  onClick={startAnalysis}
                  disabled={isInitializing || (inputMode === 'upload' && !file)}
                  className="gradient-btn w-full py-4 flex items-center justify-center gap-2 mt-auto"
                  style={
                    isInitializing
                      ? {
                          background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 1.5s ease-in-out infinite',
                        }
                      : {}
                  }
                >
                  {isInitializing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#0a0a0f] border-t-transparent rounded-full animate-spin-loader" />
                      INITIALIZING...
                    </>
                  ) : (
                    <>
                      <span className="text-lg">&#9654;</span>
                      START ANALYSIS
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Hidden video and canvas for webcam capture */}
            <video ref={videoRef} className="hidden" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {/* Live Feed Panel */}
            <div className="neo-card flex flex-col overflow-hidden flex-1 min-h-[300px] md:min-h-0" style={{ padding: 0 }}>
              {/* Video Area */}
              <div
                className="relative flex-1 bg-black overflow-hidden"
                style={{ minHeight: '300px' }}
              >
                {/* Raw Webcam Feed - shown while webcam is active BUT no processed frame yet */}
                {webcamActive && status !== 'done' && !liveFrame && (
                  <video
                    ref={(el) => {
                      if (el && streamRef.current) {
                        el.srcObject = streamRef.current;
                        el.play().catch(() => {});
                      }
                    }}
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                    style={{ zIndex: 5, transform: 'scaleX(-1)' }}
                    playsInline
                    muted
                    autoPlay
                  />
                )}
                {/* Idle State */}
                {status === 'idle' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div
                      className="absolute inset-4 border-2 border-dashed rounded-lg"
                      style={{
                        borderColor: 'rgba(0, 212, 255, 0.1)',
                        animation: 'float-border 20s linear infinite',
                      }}
                    />
                    <span className="text-5xl mb-4 text-[#555580]">&#128249;</span>
                    <p className="font-inter text-sm text-[#8888aa] text-center px-8">
                      Select input mode and start analysis
                    </p>
                  </div>
                )}

                {/* Loading State */}
                {(isInitializing || status === 'scanning') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div
                      className="w-12 h-12 rounded-full border-[3px] mb-4"
                      style={{
                        borderColor: 'rgba(0, 212, 255, 0.2)',
                        borderTopColor: '#00d4ff',
                        animation: 'spin-loader 1s linear infinite',
                      }}
                    />
                    <p className="font-inter text-sm text-[#8888aa] mb-3">
                      Initializing AI analysis...
                    </p>
                    <div
                      className="w-[200px] h-[4px] rounded-full overflow-hidden relative"
                      style={{ 
                        background: 'rgba(0, 212, 255, 0.1)',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
                      }}
                    >
                      <div
                        className="h-full rounded-full absolute"
                        style={{
                          background: 'linear-gradient(90deg, transparent, #00d4ff, #7b2ff7, transparent)',
                          width: '100%',
                          animation: 'loadingBar 1.5s ease-in-out infinite',
                          boxShadow: '0 0 10px rgba(0, 212, 255, 0.8)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Active State */}
                {(isActive || status === 'done') && !processedVideoUrl && (
                  <div className="absolute inset-0" style={{ zIndex: 6 }}>

                    {/* Processing Spinner - shown only before first frame arrives */}
                    {inputMode === 'upload' && !liveFrame && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#242730', zIndex: 10 }}>
                        <div className="relative w-32 h-32 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full" style={{
                            background: '#242730',
                            boxShadow: '8px 8px 16px #1b1d24, -8px -8px 16px #2d313c'
                          }} />
                          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-[#00d4ff] border-r-[#7b2ff7]" style={{
                            animation: 'spin-loader 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
                          }} />
                          <div className="absolute inset-4 rounded-full" style={{
                            background: '#242730',
                            boxShadow: 'inset 4px 4px 8px #1b1d24, inset -4px -4px 8px #2d313c'
                          }} />
                          <span className="relative z-10 text-3xl animate-pulse text-[#00d4ff]">&#128187;</span>
                        </div>
                        <h3 className="mt-8 font-orbitron text-[#e0e0e0] tracking-[2px] animate-pulse">PROCESSING VIDEO</h3>
                        <p className="mt-2 text-[#8888aa] text-sm text-center max-w-[250px]">
                          Applying AI pose detection models to your workout...
                        </p>
                      </div>
                    )}

                    {/* Raw Video Feed Background (webcam only, hidden during upload) */}
                    <video 
                      ref={videoRef} 
                      className="absolute inset-0 w-full h-full object-contain rounded-xl z-0" 
                      style={{ transform: inputMode === 'webcam' ? 'scaleX(-1)' : 'none', opacity: inputMode === 'upload' ? 0 : 1 }}
                      muted 
                      playsInline 
                    />

                    {/* Live Processed Frame Overlay (both upload and webcam) */}
                    {liveFrame && status === 'active' && (
                      <img
                        src={liveFrame}
                        alt="Live Processed Frame"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        style={{ zIndex: 15 }}
                      />
                    )}

                    {/* Step 17: Low-light / low-confidence warning */}
                    {lowPoseConfidence && status === 'active' && (
                      <div
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(255, 190, 0, 0.18)', border: '1px solid rgba(255, 190, 0, 0.5)', color: '#ffe066', backdropFilter: 'blur(8px)' }}
                      >
                        <span>⚠️</span>
                        <span>Having trouble seeing you — try adjusting the light or stepping back</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Done State - Real Processed Video */}
                {status === 'done' && processedVideoUrl && (
                  <video
                    src={`${API_BASE}${processedVideoUrl}`}
                    className="absolute inset-0 w-full h-full object-contain bg-black z-30"
                    autoPlay
                    controls
                    loop
                  />
                )}

                {/* Fault Alert Overlay */}
                {currentFault && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 z-20"
                    style={{
                      top: '15%',
                      background: 'rgba(255, 77, 109, 0.85)',
                      border: '2px solid rgba(255, 77, 109, 0.9)',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 0 24px rgba(255, 77, 109, 0.6), 0 4px 16px rgba(0, 0, 0, 0.3)',
                      animation: 'faultSlideIn 0.3s ease-out, pulse-glow 1.5s infinite',
                    }}
                  >
                    <span className="font-orbitron font-bold text-lg tracking-[2px] uppercase text-white" style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)' }}>
                      &#9888; {currentFault.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}

                {/* Video label */}
                <div
                  className="absolute bottom-3 left-3 z-20 px-3 py-1 rounded font-inter text-[10px] tracking-[1.5px] uppercase"
                  style={{
                    background: 'rgba(0, 0, 0, 0.6)',
                    color: '#8888aa',
                  }}
                >
                  {exerciseName}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 mt-4 md:mt-0 flex-none">
            {/* Rep Counter */}
            <div className="neo-card flex-1 p-4 md:p-5 flex flex-col">
              <div className="flex items-end gap-2">
                <span
                  className="font-orbitron font-bold text-5xl text-[#e0e0e0] transition-all"
                  style={{
                    textShadow: isActive ? '0 0 20px rgba(0, 212, 255, 0.8)' : 'none',
                    transform: isActive ? 'scale(1)' : 'scale(1)',
                  }}
                  key={reps}
                >
                  {reps}
                </span>
              </div>
              <span className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mt-1">
                REPS
              </span>
            </div>

            {/* Joint Angle */}
            <div className="neo-card flex-1 p-4 md:p-5 flex flex-col">
              <div className="flex items-end gap-1">
                <span className="font-orbitron font-bold text-5xl text-[#00d4ff] transition-all duration-100">
                  {angle}
                </span>
                <span className="font-orbitron font-bold text-3xl text-[#00d4ff] mb-1">&deg;</span>
              </div>
              <span className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mt-1">
                JOINT ANGLE
              </span>
            </div>

            {/* Status */}
            <div className="neo-card flex-1 p-4 md:p-5 flex flex-col">
              <div className="flex items-center gap-2">
                {currentStatus.dot && (
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      background: currentStatus.color,
                      animation: status === 'scanning' ? 'pulse-dot 1s infinite' : 'pulse-dot 1.5s infinite',
                    }}
                  />
                )}
                <span
                  className="font-orbitron font-bold text-[28px] uppercase transition-all duration-300"
                  style={{
                    color: currentStatus.color,
                    textShadow: `0 0 12px ${currentStatus.color}80`,
                  }}
                >
                  {currentStatus.text}
                </span>
              </div>
              <span className="font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mt-1">
                STATUS
              </span>
            </div>
          </div>

          {/* AI Advisor Panel */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(123, 47, 247, 0.15), rgba(0, 212, 255, 0.08))',
              border: '1px solid rgba(123, 47, 247, 0.3)',
              borderLeft: '3px solid #7b2ff7',
              boxShadow: aiTip ? '0 0 20px rgba(123, 47, 247, 0.15)' : 'none',
              animation: aiTip ? 'aiGlow 3s infinite' : 'none',
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0" style={{ color: '#7b2ff7' }}>&#129504;</span>
              <p className={`font-inter text-sm ${aiTip ? 'italic text-[#e0e0e0]' : 'text-[#555580]'}`}>
                {aiTipRevealed || 'AI coaching will appear after your first rep...'}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Session Summary Modal */}
      {showSummary && (
        <SessionSummaryModal
          exerciseName={exerciseName}
          exerciseColor={exerciseColor}
          reps={reps}
          faults={detectedFaults}
          aiSuggestion={aiTip}
          duration={elapsedTime}
          onNewSession={handleNewSession}
          onViewHistory={() => navigate('/history')}
          onClose={() => setShowSummary(false)}
        />
      )}

      <style>{`
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes faultSlideIn {
          0% { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          70% { transform: translateX(-50%) translateY(3px); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes aiGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(123, 47, 247, 0.05); }
          50% { box-shadow: 0 0 20px rgba(123, 47, 247, 0.15); }
        }
      `}</style>
    </div>
  );
}
