import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

interface VoiceContextType {
  isMuted: boolean;
  toggleMute: () => void;
  speak: (text: string) => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);
  const isSpeakingRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const lastSpokenRef = useRef<Map<string, number>>(new Map());

  const processQueue = useCallback(() => {
    if (isSpeakingRef.current) return;
    if (queueRef.current.length === 0) return;
    if (!window.speechSynthesis) return;

    const text = queueRef.current.shift()!;
    isSpeakingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      utterance.voice = voices[0];
    }

    utterance.onend = () => {
      isSpeakingRef.current = false;
      processQueue();
    };
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      processQueue();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (!prev) {
        // Muting — cancel all speech
        window.speechSynthesis?.cancel();
        queueRef.current = [];
        isSpeakingRef.current = false;
      }
      return !prev;
    });
  }, []);

  const speak = useCallback((text: string) => {
    if (isMuted) return;
    if (typeof window === 'undefined') return;
    if (!window.speechSynthesis) return;
    if (!text || text.trim().length === 0) return;

    // Deduplicate: don't repeat the same text within 5 seconds
    const now = Date.now();
    const lastTime = lastSpokenRef.current.get(text);
    if (lastTime && now - lastTime < 5000) return;
    lastSpokenRef.current.set(text, now);

    // Keep queue short to avoid lag — max 3 queued items
    if (queueRef.current.length >= 3) {
      queueRef.current.shift();
    }

    queueRef.current.push(text);
    processQueue();
  }, [isMuted, processQueue]);

  return (
    <VoiceContext.Provider value={{ isMuted, toggleMute, speak }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}
