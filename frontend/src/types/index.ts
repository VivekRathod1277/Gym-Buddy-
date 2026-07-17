export interface User {
  id: string;
  email: string;
  name?: string;
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

export type ExerciseType = 'auto' | 'pushup' | 'pullup' | 'squat' | 'bicep_curl' | 'chest_press';

// ── AI Trainer Flow ─────────────────────────────────────────────────────────

export type WorkoutFlowStep =
  | 'greeting'
  | 'workout-select'
  | 'positioning'
  | 'exercising'
  | 'set-summary'
  | 'session-end';

export const MUSCLE_GROUPS: Record<string, string> = {
  pushup: 'Chest',
  chest_press: 'Chest',
  pullup: 'Back',
  squat: 'Legs',
  bicep_curl: 'Arms',
};

export const EXERCISE_DISPLAY_NAMES: Record<string, string> = {
  pushup: 'Push-ups',
  pullup: 'Pull-ups',
  squat: 'Squats',
  bicep_curl: 'Bicep Curls',
  chest_press: 'Chest Press',
};

// ── Exercise Configs ────────────────────────────────────────────────────────

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
    faults: ['Shoulder_Swing', 'Incomplete_ROM'],
    aiTips: [
      'Keep your elbows pinned to your sides throughout the movement.',
      'Squeeze your biceps at the top of the curl.',
      'Control the weight on the way down - do not just drop it.',
    ],
  },
  chest_press: {
    name: 'Chest Press',
    faults: ['Elbow_Flare'],
    aiTips: [
      'Keep your elbows tucked at a 45-degree angle.',
      'Squeeze your chest at the top of the movement.',
      'Lower the weight with control.'
    ]
  }
};

export const EXERCISE_COLORS: Record<string, string> = {
  auto: '#00d4ff',
  pushup: '#ff4d6d',
  pullup: '#7b2ff7',
  squat: '#00ff88',
  bicep_curl: '#ffaa00',
  chest_press: '#ff00aa',
  'Pushup': '#ff4d6d',
  'Pullup': '#7b2ff7',
  'Squat': '#00ff88',
  'Bicep Curl': '#ffaa00',
  'Chest Press': '#ff00aa',
};
