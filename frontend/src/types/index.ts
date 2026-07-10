export interface User {
  id: string;
  email: string;
}

export interface ExerciseSession {
  id: string;
  userId: string;
  exerciseName: string;
  totalReps: number;
  faults: string[];
  aiSuggestion: string;
  timestamp: string;
  duration: number;
}

export type AnalysisStatus = 'idle' | 'scanning' | 'active' | 'done';

export type InputMode = 'upload' | 'webcam';

export type ExerciseType = 'auto' | 'pushup' | 'pullup' | 'squat' | 'bicep_curl';

export interface ExerciseConfig {
  name: string;
  faults: string[];
  aiTips: string[];
}

export const EXERCISE_CONFIGS: Record<ExerciseType, ExerciseConfig> = {
  auto: {
    name: 'Auto Detect',
    faults: ['Sagging_Back', 'Piked_Hips', 'Neck_Position'],
    aiTips: [
      'Keep your core tight and maintain a straight line from head to heels.',
      'Drive your knees outward during the descent to maintain proper tracking.',
      'Keep your elbows tucked close to your body to maximize tricep engagement.',
    ],
  },
  pushup: {
    name: 'Push-up',
    faults: ['Sagging_Back', 'Piked_Hips', 'Neck_Position'],
    aiTips: [
      'Keep your core tight and maintain a straight line from head to heels.',
      'Lower your chest all the way down for full range of motion.',
      'Keep your elbows at a 45-degree angle from your body.',
    ],
  },
  pullup: {
    name: 'Pull-up',
    faults: ['Elbow_Flare', 'Shoulder_Shrug'],
    aiTips: [
      'Pull your shoulder blades down and back before initiating the pull.',
      'Drive your elbows toward your hips, not out to the sides.',
      'Get your chin above the bar for full range of motion.',
    ],
  },
  squat: {
    name: 'Squat',
    faults: ['Knee_Cave', 'Forward_Lean', 'Shallow_Depth'],
    aiTips: [
      'Drive your knees outward during the descent to maintain proper tracking.',
      'Keep your chest up and core braced throughout the movement.',
      'Aim to break parallel — hip crease below the top of the knee.',
    ],
  },
  bicep_curl: {
    name: 'Bicep Curl',
    faults: ['Elbow_Drift', 'Shoulder_Swing'],
    aiTips: [
      'Keep your elbows pinned at your sides throughout the movement.',
      'Control the weight on the way down — resist the pull of gravity.',
      'Avoid swinging your body to lift the weight; use only your biceps.',
    ],
  },
};

export const EXERCISE_COLORS: Record<string, string> = {
  'Push-up': '#00d4ff',
  'Pull-up': '#7b2ff7',
  'Squat': '#ffcc00',
  'Bicep Curl': '#00ff88',
};
