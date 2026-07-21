import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface NamePromptProps {
  onComplete: (name: string) => void;
}

export default function NamePrompt({ onComplete }: NamePromptProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { updateName } = useAuth();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await updateName(name.trim());
    setSaving(false);
    onComplete(name.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'rgba(10, 10, 15, 0.9)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="w-full max-w-[420px] mx-4 p-8"
        style={{
          background: 'rgba(18, 18, 36, 0.95)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          borderRadius: '16px',
          boxShadow: '0 12px 64px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 212, 255, 0.1)',
          animation: 'modalScaleIn 0.4s ease-out',
        }}
      >
        <div className="text-center mb-6">
          <span className="text-4xl block mb-3">👋</span>
          <h2 className="font-orbitron font-bold text-xl tracking-[2px] text-[#e0e0e0] uppercase">
            WHAT'S YOUR NAME?
          </h2>
          <p className="font-inter text-sm text-[#8888aa] mt-2">
            Your AI trainer needs to know who you are!
          </p>
        </div>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="e.g., John"
          className="input-field w-full mb-5 text-center text-lg"
          autoFocus
          maxLength={50}
        />

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          className="gradient-btn w-full py-4 flex items-center justify-center gap-2"
          style={{ opacity: !name.trim() || saving ? 0.5 : 1 }}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-[#0a0a0f] border-t-transparent rounded-full animate-spin-loader" />
              SAVING...
            </>
          ) : (
            <>
              <span className="text-lg">✓</span>
              LET'S GO
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes modalScaleIn {
          0% { transform: scale(0.9); opacity: 0; }
          80% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
