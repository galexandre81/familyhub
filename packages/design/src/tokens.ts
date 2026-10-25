export type Ambiance = "jour" | "nuit";

export interface JetonsAmbiance {
  fond: string;
  carte: string;
  texte: string;
  texteDoux: string;
  action: string;
  maintenant: string;
  bordure: string;
  ligne: string;
}

export const AMBIANCES: Record<Ambiance, JetonsAmbiance> = {
  jour: {
    fond: "#EEF4EA",
    carte: "#FFFFFF",
    texte: "#1E2B22",
    texteDoux: "#55665A",
    action: "#2D56C8",
    maintenant: "#F5C242",
    bordure: "#1E2B22",
    ligne: "#C9D6C6",
  },
  nuit: {
    fond: "#0F1B2D",
    carte: "#182841",
    texte: "#F2F5F8",
    texteDoux: "#A8B6C8",
    action: "#FFB547",
    maintenant: "#FFB547",
    bordure: "#2C3F5C",
    ligne: "#2C3F5C",
  },
};

export const PERSONNES: Record<
  "sapin" | "toleRouge" | "lilas" | "miel" | "ardoise",
  { jour: string; nuit: string }
> = {
  sapin: { jour: "#2B7A4B", nuit: "#5BC08A" },
  toleRouge: { jour: "#C8462B", nuit: "#F2836A" },
  lilas: { jour: "#8A55D0", nuit: "#B994F2" },
  miel: { jour: "#B7791F", nuit: "#F0B95A" },
  ardoise: { jour: "#3E6A8A", nuit: "#8DB8D8" },
};

export const POLICES = {
  titre: "Bricolage Grotesque",
  texte: "Atkinson Hyperlegible",
} as const;

/** "#EEF4EA" -> "238 244 234" */
export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
