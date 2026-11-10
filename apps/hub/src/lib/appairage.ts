/**
 * Phrases de la fenêtre d'appairage d'un écran, selon l'appareil visé :
 * l'iPad de cuisine (Safari, QR code possible) ou l'ordinateur des enfants
 * (Chrome, pas d'appareil photo donc pas de QR code).
 */
export type CibleAppairage = "ipad" | "ordinateur";

export interface PhrasesAppairage {
  /** Nom de l'appareil, avec son article : « l'iPad », « l'ordinateur des enfants ». */
  appareil: string;
  navigateur: string;
  /** Sous-titre de la fenêtre. */
  intro: string;
  /** Encadré : où ouvrir le lien, et nulle part ailleurs. */
  avertissement: string;
  /** Explication de l'option « code ». */
  code: string;
  /** Explication de l'option « lien court ». */
  lien: string;
  /** Proposer le QR code (appareil avec appareil photo). */
  qr: boolean;
}

const NULLE_PART_AILLEURS =
  "Le code ne sert qu'une fois : l'appareil qui ouvre le lien devient l'écran. N'ouvre jamais ce lien sur ton téléphone ni sur un autre ordinateur.";

export function phrasesAppairage(cible: CibleAppairage): PhrasesAppairage {
  if (cible === "ordinateur") {
    return {
      appareil: "l'ordinateur des enfants",
      navigateur: "Chrome",
      intro: "Deux façons de relier l'ordinateur des enfants. Le code est valide 30 minutes.",
      avertissement: `À ouvrir uniquement sur l'ordinateur des enfants. ${NULLE_PART_AILLEURS}`,
      code: "Sur l'ordinateur des enfants, tape dans Chrome :",
      lien: "À taper ou coller dans Chrome sur l'ordinateur des enfants, et nulle part ailleurs.",
      qr: false,
    };
  }
  return {
    appareil: "l'iPad",
    navigateur: "Safari",
    intro: "Trois façons de transférer la config sur ton iPad. Le code est valide 30 minutes.",
    avertissement: `À ouvrir uniquement sur l'iPad. ${NULLE_PART_AILLEURS}`,
    code: "Tape sur l'iPad dans Safari :",
    lien: "À taper ou coller dans Safari sur l'iPad. Tu peux l'envoyer à l'iPad par AirDrop / iMessage, mais ne l'ouvre nulle part ailleurs.",
    qr: true,
  };
}
