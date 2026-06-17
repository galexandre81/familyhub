import { useEffect, useState } from "react";

export type ToastType = "error" | "success" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

type Listener = (toast: ToastItem) => void;

const listeners: Listener[] = [];
let nextId = 1;

/**
 * Imperative toast emitter. Safe to call from anywhere — including OUTSIDE
 * the React tree (e.g. React Query's MutationCache.onError). When no
 * <Toaster /> is mounted, the call is a harmless no-op.
 */
export function toast(
  message: string,
  opts?: { type?: ToastType; duration?: number },
): void {
  const item: ToastItem = {
    id: nextId++,
    message,
    type: opts?.type ?? "info",
    duration: opts?.duration ?? 4000,
  };
  for (const listener of listeners) listener(item);
}

const TYPE_STYLES: Record<ToastType, string> = {
  // copper (erreur), sage (succès), brass/cream (info)
  error: "bg-ebony-card border-copper text-cream",
  success: "bg-ebony-card border-sage text-cream",
  info: "bg-ebony-card border-brass text-cream",
};

const ACCENT_STYLES: Record<ToastType, string> = {
  error: "bg-copper",
  success: "bg-sage",
  info: "bg-brass",
};

export function Toaster(): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (item) => {
      setToasts((prev) => [...prev, item]);
      if (item.duration > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== item.id));
        }, item.duration);
      }
    };
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 max-w-[min(90vw,22rem)]"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          role="alert"
          aria-live="assertive"
          onClick={() => dismiss(t.id)}
          className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-tile border px-5 py-4 text-left text-sm shadow-elev transition motion-safe:animate-[toast-in_220ms_ease-out] ${TYPE_STYLES[t.type]}`}
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 left-0 w-1 ${ACCENT_STYLES[t.type]}`}
          />
          <span className="flex-1 pl-1 leading-snug">{t.message}</span>
          <span
            aria-hidden="true"
            className="mt-0.5 text-xs uppercase tracking-widest text-cream-mute transition group-hover:text-brass"
          >
            ✕
          </span>
        </button>
      ))}
    </div>
  );
}
