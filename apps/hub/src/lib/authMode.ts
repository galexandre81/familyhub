/**
 * Choix du mode de connexion Google.
 *
 * La fenêtre surgissante (popup) ne marche pas dans une application installée
 * sur l'écran d'accueil, ni de façon fiable sur iPhone/iPad (Safari bloque ou
 * perd la fenêtre). Dans ces cas, on passe par une redirection pleine page.
 *
 * @param estStandalone vrai si l'app tourne installée (display-mode: standalone)
 * @param userAgent navigator.userAgent
 */
export function doitUtiliserRedirection(estStandalone: boolean, userAgent: string): boolean {
  if (estStandalone) return true;
  return /iPhone|iPad|iPod/i.test(userAgent);
}
