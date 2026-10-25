import { AMBIANCES, PERSONNES, hexToRgbTriplet, type Ambiance } from "./tokens.js";

function bloc(selecteur: string, a: Ambiance): string {
  const j = AMBIANCES[a];
  const t = hexToRgbTriplet;
  const lignes: [string, string][] = [
    ["--c-ebony", t(j.fond)],
    ["--c-ebony-panel", t(j.carte)],
    ["--c-ebony-card", t(j.carte)],
    ["--c-ebony-ridge", t(j.ligne)],
    ["--c-brass", t(j.action)],
    ["--c-cream", t(j.texte)],
    ["--c-cream-mute", t(j.texteDoux)],
    ["--c-wood-dark", t(j.ligne)],
    ["--c-maintenant", t(j.maintenant)],
    ["--c-bordure", t(j.bordure)],
  ];
  lignes.push(["--c-p-texte", a === "jour" ? "255 255 255" : t("#0F1B2D")]);
  for (const [nom, couleurs] of Object.entries(PERSONNES)) {
    lignes.push([`--c-p-${nom}`, t(couleurs[a])]);
  }
  return `${selecteur} {\n${lignes.map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n`;
}

/** CSS du hub (variables en triplets RGB), généré depuis les jetons. */
export function renderHubCss(): string {
  return [
    "/* GÉNÉRÉ par packages/design/scripts/gen-hub-css.mjs — ne pas modifier à la main. */",
    bloc(":root", "jour"),
    bloc("html.amb-jour", "jour"),
    bloc("html.amb-nuit", "nuit"),
  ].join("\n");
}
