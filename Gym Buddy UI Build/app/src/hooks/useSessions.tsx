import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ExerciseSession } from '@/types';

interface SessionsContextType {
  sessions: ExerciseSession[];
  addSession: (session: Omit<ExerciseSession, 'id'>) => void;
  totalSessions: number;
  totalReps: number;
  totalXP: number;
}

const mockSessions: ExerciseSession[] = [
  {
    id: '1',
    userId: '1',
    exerciseName: 'Push-up',
    totalReps: 12,
    faults: ['Sagging_Back'],
    aiSuggestion: 'Keep your core tight and maintain a straight line from head to heels.',
    timestamp: '2026-06-17 14:32:00',
    duration: 45,
  },
  {
    id: '2',
    userId: '1',
    exerciseName: 'Squat',
    totalReps: 8,
    faults: ['Knee_Cave'],
    aiSuggestion: 'Drive your knees outward during the descent to maintain proper tracking.',
    timestamp: '2026-06-16 10:15:00',
    duration: 38,
  },
  {
    id: '3',
    userId: '1',
    exerciseName: 'Pull-up',
    totalReps: 5,
    faults: ['Elbow_Flare', 'Shoulder_Shrug'],
    aiSuggestion: 'Pull your shoulder blades down and back before initiating the pull.',
    timestamp: '2026-06-15 18:45:00',
    duration: 52,
  },
];

const SessionsContext = createContext<SessionsContextType | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ExerciseSession[]>(mockSessions);

  const addSession = useCallback((session: Omit<ExerciseSession, 'id'>) => {
    const newSession: ExerciseSession = {
      ...session,
      id: Date.now().toString(),
    };
    setSessions(prev => [newSession, ...prev]);
  }, []);

  const totalSessions = sessions.length;
  const totalReps = sessions.reduce((sum, s) => sum + s.totalReps, 0);
  const totalXP = totalSessions * 5;

  return (
    <SessionsContext.Provider value={{ sessions, addSession, totalSessions, totalReps, totalXP }}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  const context = useContext(SessionsContext);
  if (!context) {
    throw new Error('useSessions must be used within a SessionsProvider');
  }
  return context;
}
