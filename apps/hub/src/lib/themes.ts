/**
 * Définition des thèmes UI disponibles. La valeur stockée dans
 * `households/{hid}.parametres.theme` est l'`id` du thème ; le hook
 * useThemeApply (Layout) ajoute la classe correspondante sur <html>.
 */

export interface ThemeDef {
  id: string;
  /** className posée sur <html> (vide pour le thème défaut). */
  htmlClass: string;
  nom: string;
  description: string;
  /** Aperçu visuel : 4 swatches. */
  preview: {
    bg: string;
    card: string;
    accent: string;
    text: string;
  };
}

export const THEMES: ThemeDef[] = [
  {
    id: "caractere",
    htmlClass: "",
    nom: "Caractère",
    description: "Noir mat warm + accents laiton et châtaignier.",
    preview: {
      bg: "#0F0D0A",
      card: "#1C1815",
      accent: "#D9A05B",
      text: "#F2E8D5",
    },
  },
  {
    id: "foret",
    htmlClass: "theme-foret",
    nom: "Forêt",
    description: "Vert profond + or chaud + ivoire.",
    preview: {
      bg: "#0E1A16",
      card: "#162621",
      accent: "#D4AF5F",
      text: "#F0EAD7",
    },
  },
  {
    id: "marine",
    htmlClass: "theme-marine",
    nom: "Marine",
    description: "Bleu nuit + cuivre + sable.",
    preview: {
      bg: "#0B1220",
      card: "#131E32",
      accent: "#E09160",
      text: "#EAE0C7",
    },
  },
  {
    id: "bordeaux",
    htmlClass: "theme-bordeaux",
    nom: "Bordeaux",
    description: "Rouge sombre + or rose + crème.",
    preview: {
      bg: "#1A0C0E",
      card: "#2C161A",
      accent: "#D6A07C",
      text: "#F4E8DB",
    },
  },
  {
    id: "glacier",
    htmlClass: "theme-glacier",
    nom: "Glacier",
    description: "Gris-bleu très foncé + argent froid + blanc.",
    preview: {
      bg: "#101620",
      card: "#1E2836",
      accent: "#AEBCD2",
      text: "#E8F0F8",
    },
  },
  {
    id: "lin",
    htmlClass: "theme-lin",
    nom: "Lin",
    description: "Thème clair : ivoire + caramel + brun.",
    preview: {
      bg: "#F8F0DE",
      card: "#FFFAF0",
      accent: "#B26E38",
      text: "#3C2A1A",
    },
  },
];

export const DEFAULT_THEME_ID = "caractere";

export function getThemeById(id: string | undefined | null): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/**
 * Applique le thème sur <html>. Retire d'abord toutes les classes theme-*
 * pour éviter les superpositions.
 */
export function applyTheme(themeId: string | undefined | null) {
  const theme = getThemeById(themeId);
  const html = document.documentElement;
  // Retire les anciennes classes theme-*
  const toRemove: string[] = [];
  html.classList.forEach((c) => {
    if (c.startsWith("theme-")) toRemove.push(c);
  });
  toRemove.forEach((c) => html.classList.remove(c));
  if (theme.htmlClass) html.classList.add(theme.htmlClass);
}
