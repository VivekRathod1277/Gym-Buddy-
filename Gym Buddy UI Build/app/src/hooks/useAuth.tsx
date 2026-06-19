import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User } from '@/types';
import api from '@/lib/api';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading to check auth

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      setUser({
        id: response.data.user_id,
        email: response.data.email,
      });
    } catch (error) {
      console.error('Failed to fetch profile', error);
      setUser(null);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login-json', { email, password });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      await fetchProfile();
      return true;
    } catch (error) {
      console.error('Login error', error);
      setIsLoading(false);
      return false;
    }
  }, [fetchProfile]);

  const register = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await api.post('/auth/register', { email, password });
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Registration error', error);
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
