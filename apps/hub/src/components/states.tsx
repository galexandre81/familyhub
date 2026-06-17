import type React from "react";

export function LoadingState({ label }: { label?: string }): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 rounded-full border-2 border-wood-dark border-t-brass motion-safe:animate-spin"
      />
      <p className="font-serif italic text-lg text-cream-mute">
        {label ?? "Chargement…"}
      </p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-5 py-16 text-center"
    >
      <div className="rule w-full max-w-xs">
        <span className="rule-mark" />
        <span className="eyebrow" style={{ color: "#C9712E" }}>
          Erreur
        </span>
        <span className="rule-mark" />
      </div>
      <p className="font-serif italic text-xl text-cream">
        {message ?? "Une erreur est survenue."}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary">
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="tile-card mx-auto max-w-xl py-12 text-center">
      <div className="rule mb-6">
        <span className="rule-mark" />
      </div>
      <p className="mb-2 font-serif italic text-2xl text-cream">{title}</p>
      {hint && <p className="mb-8 text-sm text-cream-mute">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
