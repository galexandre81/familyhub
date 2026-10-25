import type { CouleurPersonne } from "@family-hub/types";
import { couleurDuProfil } from "../lib/personnes";

interface ProfilBadgeProps {
  initiale: string;
  /** Ancienne couleur hex (repli si `couleurPersonne` absent). */
  couleur?: string;
  /** Couleur de personne du design system. */
  couleurPersonne?: CouleurPersonne;
  /** Conservé pour compatibilité : l'emoji n'est plus affiché (un seul repère : la pastille). */
  emoji?: string;
  size?: "sm" | "md" | "lg";
  /** Conservé pour compatibilité, sans effet. */
  showEmojiBeside?: boolean;
}

const SIZES = {
  sm: { box: "w-8 h-8 text-sm" },
  md: { box: "w-12 h-12 text-lg" },
  lg: { box: "w-16 h-16 text-2xl" },
};

export default function ProfilBadge({
  initiale,
  couleur,
  couleurPersonne,
  size = "md",
}: ProfilBadgeProps) {
  const s = SIZES[size];
  const fond = couleurDuProfil({ couleurPersonne, couleur: couleur ?? "#888888" });
  const textColor = couleurPersonne || !isLightColor(fond) ? "#ffffff" : "#1a1a1a";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${s.box} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
        style={{ backgroundColor: fond, color: textColor }}
        aria-hidden="true"
      >
        {initiale.toUpperCase()}
      </span>
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
