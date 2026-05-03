interface ProfilBadgeProps {
  initiale: string;
  couleur: string;
  emoji?: string;
  size?: "sm" | "md" | "lg";
  /** Si true, affiche l'emoji à droite de l'initiale plutôt que par-dessus. */
  showEmojiBeside?: boolean;
}

const SIZES = {
  sm: { box: "w-8 h-8 text-sm", emoji: "text-xs", emojiBeside: "text-base" },
  md: { box: "w-12 h-12 text-lg", emoji: "text-sm", emojiBeside: "text-xl" },
  lg: { box: "w-16 h-16 text-2xl", emoji: "text-base", emojiBeside: "text-3xl" },
};

export default function ProfilBadge({
  initiale,
  couleur,
  emoji,
  size = "md",
  showEmojiBeside = false,
}: ProfilBadgeProps) {
  const s = SIZES[size];
  const textColor = isLightColor(couleur) ? "#1a1a1a" : "#ffffff";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${s.box} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
        style={{ backgroundColor: couleur, color: textColor }}
        aria-hidden="true"
      >
        {initiale.toUpperCase()}
      </span>
      {emoji && showEmojiBeside && <span className={s.emojiBeside}>{emoji}</span>}
    </span>
  );
}

/** Détermine si une couleur hex est claire (pour choisir noir vs blanc en texte). */
function isLightColor(hex: string): boolean {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return false;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  // Luminance perçue (rec. 709)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 160;
}
