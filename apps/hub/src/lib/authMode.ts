/**
 * Choix du mode de connexion Google.
 *
 * Par défaut : fenêtre surgissante (popup), y compris dans Safari sur iPhone.
 * Redirection pleine page seulement quand les deux conditions sont réunies :
 *  - l'app tourne installée sur l'écran d'accueil (la popup n'y marche pas) ;
 *  - l'authentification passe par le domaine du site lui-même
 *    (VITE_FIREBASE_AUTH_DOMAIN = domaine du site). Sinon, avec
 *    `…firebaseapp.com`, Safari cloisonne le stockage et le retour de
 *    redirection échoue. Voir docs/DESIGN.md, section « Téléphone ».
 *
 * @param estStandalone vrai si display-mode: standalone
 * @param authDomain domaine d'authentification configuré (auth.config.authDomain)
 * @param hote location.hostname
 */
export function doitUtiliserRedirection(
  estStandalone: boolean,
  authDomain: string,
  hote: string,
): boolean {
  if (!estStandalone || !authDomain) return false;
  return authDomain.toLowerCase() === hote.toLowerCase();
}
