import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { ExerciseSession } from '@/types';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface SessionsContextType {
  sessions: ExerciseSession[];
  addSession: (session: Omit<ExerciseSession, 'id'>) => Promise<void>;
  totalSessions: number;
  totalReps: number;
  totalXP: number;
  isLoading: boolean;
}

const SessionsContext = createContext<SessionsContextType | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const fetchSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await api.get('/sessions/history');
      const mappedSessions: ExerciseSession[] = response.data.map((s: any, index: number) => ({
        id: `session_${index}_${s.timestamp}`,
        userId: user.id,
        exerciseName: s.exercise_name,
        totalReps: s.total_reps,
        faults: s.faults ? s.faults.split(',').map((f: string) => f.trim()).filter(Boolean) : [],
        aiSuggestion: s.ai_suggestion,
        timestamp: s.timestamp,
        duration: 0, // Backend doesn't store duration currently
      }));
      setSessions(mappedSessions.reverse()); // Show newest first
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const addSession = useCallback(async (session: Omit<ExerciseSession, 'id'>) => {
    try {
      await api.post('/sessions', {
        exercise_name: session.exerciseName,
        total_reps: session.totalReps,
        faults: session.faults,
        ai_suggestion: session.aiSuggestion,
      });
      // Refresh list after saving
      await fetchSessions();
    } catch (error) {
      console.error('Failed to save session', error);
      // Optimistic update fallback
      const newSession: ExerciseSession = {
        ...session,
        id: Date.now().toString(),
      };
      setSessions(prev => [newSession, ...prev]);
    }
  }, [fetchSessions]);

  const totalSessions = sessions.length;
  const totalReps = sessions.reduce((sum, s) => sum + s.totalReps, 0);
  const totalXP = totalSessions * 5;

  return (
    <SessionsContext.Provider value={{ sessions, addSession, totalSessions, totalReps, totalXP, isLoading }}>
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
