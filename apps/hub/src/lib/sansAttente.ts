/**
 * Lance un appel « au passage » : on n'attend pas sa fin et son échec ne
 * remonte jamais à l'appelant (simple avertissement console). Sert aux
 * rafraîchissements d'écrans déclenchés après une écriture réussie.
 */
export function lancerSansAttendre(appel: () => Promise<unknown>, etiquette: string): void {
  const avertir = (err: unknown) => {
    console.warn(`[${etiquette}] échec ignoré`, err);
  };
  try {
    appel().catch(avertir);
  } catch (err) {
    avertir(err);
  }
}
