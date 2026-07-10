import { useToast } from '@/hooks/useToast';

const borderColors = {
  success: '#00ff88',
  error: '#ff4d6d',
  info: '#00d4ff',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[1000] flex flex-col gap-3">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className="animate-slide-in-right cursor-pointer"
          style={{
            background: 'rgba(18, 18, 36, 0.95)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${borderColors[toast.type]}40`,
            borderLeft: `3px solid ${borderColors[toast.type]}`,
            borderRadius: '8px',
            padding: '16px 20px',
            maxWidth: '360px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          <p className="font-inter text-sm text-[#e0e0e0]">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
