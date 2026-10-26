import { toast } from "../../components/Toast";

/**
 * Une décision sur le PC part tout de suite : Firestore l'applique au cache
 * local sans attendre le serveur (hors ligne compris), le PC la recevra à sa
 * prochaine connexion. On confirme donc sans attendre ; un refus éventuel
 * s'affiche quand il arrive (même règle que les minuteurs).
 */
export function envoyer(ecriture: Promise<unknown>, confirmation: string): void {
  toast(confirmation, { type: "success" });
  ecriture.catch((e: unknown) => {
    console.error(e);
    toast("Ça n'a pas marché. Réessaie dans un instant.", { type: "error", duration: 6000 });
  });
}

/** Une action refusée avant même d'écrire (échéance passée, adresse illisible…). */
export function refuser(message: string): void {
  toast(message, { type: "error" });
}
