/**
 * Identifiant de cet appareil (navigateur), gardé dans le stockage local :
 * sert à savoir quel appareil a lancé un minuteur (lui seul sonne). Stockage
 * indisponible (navigation privée…) : un identifiant valable pour la session.
 */
const CLE = "fh-appareil";
let enMemoire: string | null = null;

function nouveau(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function identifiantAppareil(): string {
  try {
    const lu = window.localStorage.getItem(CLE);
    if (lu) return lu;
    const id = nouveau();
    window.localStorage.setItem(CLE, id);
    return id;
  } catch {
    enMemoire ??= nouveau();
    return enMemoire;
  }
}
