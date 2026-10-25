import { AMBIANCES, PERSONNES, POLICES, type Ambiance } from "./tokens.js";

const REPLI = "-apple-system, Helvetica, Arial, sans-serif";
const TEXTE_NUIT_SUR_CLAIR = "#0F1B2D";

function regles(a: Ambiance): string {
  const j = AMBIANCES[a];
  const p = `html.amb-${a}`;
  // Texte lisible sur les aplats « action » / « maintenant » / personnes.
  const surAction = a === "jour" ? "#FFFFFF" : TEXTE_NUIT_SUR_CLAIR;
  const surMaintenant = a === "jour" ? j.texte : TEXTE_NUIT_SUR_CLAIR;
  const surPersonne = a === "jour" ? "#FFFFFF" : TEXTE_NUIT_SUR_CLAIR;
  const l: string[] = [
    `/* ${a} */`,
    `${p} .fh-fond { background: ${j.fond}; color: ${j.texte}; }`,
    `${p} .fh-carte { background: ${j.carte}; color: ${j.texte}; }`,
    `${p} .fh-texte { color: ${j.texte}; }`,
    `${p} .fh-texte-doux { color: ${j.texteDoux}; }`,
    `${p} .fh-action { background: ${j.action}; color: ${surAction}; }`,
    `${p} .fh-maintenant { background: ${j.maintenant}; color: ${surMaintenant}; }`,
    `${p} .fh-bordure { border-color: ${j.bordure}; }`,
  ];
  for (const [nom, c] of Object.entries(PERSONNES)) {
    l.push(`${p} .fh-p-${nom} { background: ${c[a]}; }`);
  }
  l.push(`${p} .fh-p-texte { color: ${surPersonne}; }`);
  // Anciennes tuiles encore affichées en overlay : look jour/nuit minimal.
  l.push(
    `${p}, ${p} body { background: ${j.fond}; color: ${j.texte}; }`,
    `${p} .grid-cell { background: ${j.carte}; border-color: ${j.ligne}; }`,
    `${p} .tile-title { color: ${j.texteDoux}; }`,
    `${p} .tile-overlay { background: ${j.fond}; }`,
    `${p} .tile-overlay-bar { background: ${j.carte}; border-bottom-color: ${j.ligne}; }`,
    `${p} .tile-overlay-back { color: ${j.texte}; }`,
    `${p} .boot-title, ${p} .error-title { color: ${j.texte}; }`,
    `${p} .error-link { background: ${j.action}; color: ${surAction}; }`,
  );
  return l.join("\n") + "\n";
}

/** CSS de l'iPad (sans variables CSS : Safari 9), généré depuis les jetons. */
export function renderDisplayCss(): string {
  return [
    "/* GÉNÉRÉ par packages/design/scripts/gen-display-css.mjs — ne pas modifier à la main. */",
    `.fh-titre { font-family: "${POLICES.titre}", ${REPLI}; }`,
    `.fh-corps { font-family: "${POLICES.texte}", ${REPLI}; }`,
    regles("jour"),
    regles("nuit"),
  ].join("\n");
}
