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

export default function WorkoutPage() {
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('auto');
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
  const [skeletonJoints] = useState(() => generateSkeletonJoints());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusStartTimeRef = useRef<number>(0);

  const { addSession } = useSessions();
  const { speak } = useVoice();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (faultTimeoutRef.current) clearTimeout(faultTimeoutRef.current);
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
    speak(faultName.replace(/_/g, ' ') + ' detected. Please correct your form.');

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

    speak('Initializing analysis. Uploading video...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const config = EXERCISE_CONFIGS[exerciseType];
      const exerciseName = config.name === 'Auto Detect' ? 'Push-up' : config.name;
      // We also send the exercise name if needed, though backend currently auto-detects or we can add it if supported.
      
      const uploadResponse = await api.post('/workout/process-video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const taskId = uploadResponse.data.task_id;
      
      setIsInitializing(false);
      setStatus('active');
      statusStartTimeRef.current = Date.now();
      speak(`Processing video...`);
      
      // Open WebSocket connection to stream live processed frames
      const ws = new WebSocket(`ws://127.0.0.1:8000/api/workout/ws/stream-video/${taskId}`);
      
      // Timer for elapsed time
      intervalRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.status === 'processing') {
          if (data.frame) {
            setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
          }
          if (data.reps !== undefined) {
             setReps(prev => {
                if (data.reps > prev) speak(`Rep ${data.reps}`);
                return data.reps;
             });
          }
          if (data.angle !== undefined) setAngle(data.angle);
          if (data.ai_tip) setAiTip(data.ai_tip);
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

    } catch (err) {
      console.error('Upload failed', err);
      setIsInitializing(false);
      setStatus('idle');
      addToast('Failed to upload video.', 'error');
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
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (faultTimeoutRef.current) clearTimeout(faultTimeoutRef.current);
  }, []);

  const statusConfig = {
    idle: { color: '#555580', text: 'IDLE', dot: false },
    scanning: { color: '#ffcc00', text: 'SCANNING', dot: true },
    active: { color: '#00ff88', text: 'ACTIVE', dot: true },
    done: { color: '#00d4ff', text: 'DONE', dot: false },
  };

  const currentStatus = statusConfig[status];
  const isActive = status === 'active';
  const exerciseConfig = EXERCISE_CONFIGS[exerciseType];
  const exerciseName = exerciseConfig.name === 'Auto Detect' ? 'Push-up' : exerciseConfig.name;
  const exerciseColor = EXERCISE_COLORS[exerciseName] || '#00d4ff';

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0f' }}>
      <Sidebar />

      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Page Header */}
        <div
          className="px-8 py-6"
          style={{ borderBottom: '1px solid rgba(0, 212, 255, 0.15)' }}
        >
          <h1 className="font-orbitron font-bold text-[22px] tracking-[3px] uppercase text-[#e0e0e0]">
            WORKOUT ANALYSIS
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 flex flex-col gap-6 overflow-hidden">
          {/* Two Column Grid */}
          <div className="flex gap-6 flex-1 min-h-0">
            {/* Configuration Panel */}
            <div className="glass-card p-7 flex flex-col" style={{ width: '40%', minWidth: '320px' }}>
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

              {/* Exercise Override */}
              <div className="mb-5">
                <label className="block font-inter text-[11px] font-semibold text-[#8888aa] tracking-[1.5px] uppercase mb-2">
                  EXERCISE OVERRIDE
                </label>
                <select
                  value={exerciseType}
                  onChange={e => setExerciseType(e.target.value as ExerciseType)}
                  className="input-field cursor-pointer appearance-none"
                  disabled={isActive || isInitializing}
                >
                  <option value="auto">auto (detect)</option>
                  <option value="pushup">Push-up</option>
                  <option value="pullup">Pull-up</option>
                  <option value="squat">Squat</option>
                  <option value="bicep_curl">Bicep Curl</option>
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

              {/* Start Button */}
              <button
                onClick={startAnalysis}
                disabled={isInitializing || isActive || (inputMode === 'upload' && !file)}
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
            </div>

            {/* Live Feed Panel */}
            <div className="glass-card flex flex-col overflow-hidden flex-1" style={{ padding: 0 }}>
              {/* Video Area */}
              <div
                className="relative flex-1 bg-black overflow-hidden"
                style={{ minHeight: '300px' }}
              >
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
                      className="w-[120px] h-[3px] rounded-full overflow-hidden"
                      style={{ background: 'rgba(0, 212, 255, 0.15)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: '#00d4ff',
                          width: '40%',
                          animation: 'loadingBar 1.5s ease-in-out infinite',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Active State - Video Feed with Skeleton */}
                {(isActive || status === 'done') && !processedVideoUrl && (
                  <div className="absolute inset-0">
                    {/* Mock video background - person silhouette */}
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)',
                      }}
                    >
                      {/* Person silhouette representation */}
                      <svg
                        viewBox="0 0 200 300"
                        className="h-full opacity-40"
                        style={{ maxWidth: '80%' }}
                      >
                        {/* Body outline */}
                        <ellipse cx="100" cy="40" rx="25" ry="30" fill="#8888aa" opacity="0.3" />
                        <rect x="75" y="70" width="50" height="100" rx="15" fill="#8888aa" opacity="0.2" />
                        <rect x="85" y="170" width="15" height="80" rx="5" fill="#8888aa" opacity="0.2" />
                        <rect x="100" y="170" width="15" height="80" rx="5" fill="#8888aa" opacity="0.2" />
                        <rect x="55" y="80" width="20" height="70" rx="5" fill="#8888aa" opacity="0.2" />
                        <rect x="125" y="80" width="20" height="70" rx="5" fill="#8888aa" opacity="0.2" />
                      </svg>
                    </div>

                    {/* Pose Skeleton Overlay */}
                    <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 10 }}>
                      {/* Connections */}
                      {skeletonJoints.connections.map((conn, i) => (
                        <line
                          key={i}
                          x1={`${conn.from.x}%`}
                          y1={`${conn.from.y}%`}
                          x2={`${conn.to.x}%`}
                          y2={`${conn.to.y}%`}
                          stroke="rgba(255, 255, 255, 0.5)"
                          strokeWidth="2"
                        />
                      ))}
                      {/* Joints */}
                      {skeletonJoints.joints.map((joint, i) => (
                        <circle
                          key={i}
                          cx={`${joint.x}%`}
                          cy={`${joint.y}%`}
                          r="5"
                          fill="#00d4ff"
                          style={{
                            filter: 'drop-shadow(0 0 4px rgba(0, 212, 255, 0.6))',
                            animation: 'pulse-joint 2s infinite ease-in-out',
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </svg>

                    {/* Done overlay */}
                    {status === 'done' && (
                      <div
                        className="absolute inset-0 transition-opacity duration-400"
                        style={{
                          background: 'rgba(10, 10, 15, 0.3)',
                          zIndex: 15,
                        }}
                      />
                    )}

                    {/* Live Frame Overlay (Websocket MJPEG) */}
                    {liveFrame && status === 'active' && (
                      <img
                        src={liveFrame}
                        alt="Live Processed Frame"
                        className="absolute inset-0 w-full h-full object-contain bg-black z-10"
                      />
                    )}
                  </div>
                )}

                {/* Done State - Real Processed Video */}
                {status === 'done' && processedVideoUrl && (
                  <video
                    src={`http://127.0.0.1:8000${processedVideoUrl}`}
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
          <div className="flex gap-6">
            {/* Rep Counter */}
            <div className="glass-card flex-1 p-5 flex flex-col">
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
            <div className="glass-card flex-1 p-5 flex flex-col">
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
            <div className="glass-card flex-1 p-5 flex flex-col">
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

// Helper to generate mock skeleton joints
function generateSkeletonJoints() {
  const joints = [
    { x: 50, y: 12 },   // head
    { x: 50, y: 28 },   // neck
    { x: 35, y: 32 },   // left shoulder
    { x: 65, y: 32 },   // right shoulder
    { x: 30, y: 50 },   // left elbow
    { x: 70, y: 50 },   // right elbow
    { x: 25, y: 68 },   // left wrist
    { x: 75, y: 68 },   // right wrist
    { x: 50, y: 55 },   // hip center
    { x: 42, y: 75 },   // left knee
    { x: 58, y: 75 },   // right knee
    { x: 40, y: 92 },   // left ankle
    { x: 60, y: 92 },   // right ankle
  ];

  const connections = [
    { from: joints[0], to: joints[1] },
    { from: joints[1], to: joints[2] },
    { from: joints[1], to: joints[3] },
    { from: joints[2], to: joints[4] },
    { from: joints[3], to: joints[5] },
    { from: joints[4], to: joints[6] },
    { from: joints[5], to: joints[7] },
    { from: joints[1], to: joints[8] },
    { from: joints[8], to: joints[9] },
    { from: joints[8], to: joints[10] },
    { from: joints[9], to: joints[11] },
    { from: joints[10], to: joints[12] },
  ];

  return { joints, connections };
}