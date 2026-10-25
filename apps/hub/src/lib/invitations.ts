/** Logique pure autour des liens d'invitation dans un foyer. */

/**
 * Même alphabet et longueur que les codes générés par `createInvitation`
 * (functions/src/auth/displayToken.ts SHORT_ID_ALPHABET,
 * functions/src/household/invitations.ts CODE_LENGTH). Garder alignés.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGUEUR = 10;

export function lienInvitation(origin: string, code: string): string {
  return `${origin}/rejoindre/${code}`;
}

/** Code lu dans l'adresse, en majuscules ; `null` si le format ne colle pas. */
export function normaliserCodeInvitation(brut: string | undefined): string | null {
  const code = (brut ?? "").trim().toUpperCase();
  const valide = code.length === LONGUEUR && Array.from(code).every((c) => ALPHABET.includes(c));
  return valide ? code : null;
}

// Clés = RaisonRefusInvitation (packages/types/src/invitation.ts,
// functions/src/household/invitationRules.ts). Garder alignés.
const MESSAGES: Record<string, string> = {
  "expiree": "Cette invitation a expiré — demande un nouveau lien",
  "deja-utilisee": "Cette invitation a déjà servi",
  "deja-membre": "Tu fais déjà partie de ce foyer",
  "introuvable": "Invitation introuvable",
};

const MESSAGE_GENERIQUE = "L'invitation n'a pas pu être acceptée — rouvre le lien pour réessayer";

/** Raison du refus renvoyée par `acceptInvitation` (`details.raison`), sinon `null`. */
function raisonRefus(err: unknown): string | null {
  const raison = (err as { details?: { raison?: unknown } } | null)?.details?.raison;
  return typeof raison === "string" && raison.length > 0 ? raison : null;
}

/**
 * Refus définitif (le serveur a répondu avec une raison) : l'invitation gardée
 * peut être oubliée. Sans raison (réseau coupé, serveur injoignable…), on la
 * garde pour réessayer plus tard.
 */
export function estRefusDefinitif(err: unknown): boolean {
  return raisonRefus(err) !== null;
}

/** Échec sans réponse du serveur : l'invitation est gardée et sera réessayée. */
export const MESSAGE_INVITATION_EN_ATTENTE =
  "L'invitation n'a pas encore pu être acceptée — elle sera réessayée dès que la connexion revient";

/** Traduit l'erreur de `acceptInvitation` (`details.raison`) en phrase à afficher. */
export function messageErreurInvitation(err: unknown): string {
  const raison = raisonRefus(err);
  return (raison && MESSAGES[raison]) || MESSAGE_GENERIQUE;
}

export function messageBienvenue(nom: string): string {
  return nom ? `Bienvenue dans le foyer ${nom}` : "Bienvenue dans le foyer";
}
