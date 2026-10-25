/**
 * Écrit une longue liste d'opérations Firestore en plusieurs lots
 * (`WriteBatch` limité à 500 écritures). Les lots partent l'un après
 * l'autre ; si l'un échoue, les suivants ne partent pas et l'erreur remonte.
 *
 * Sans dépendance Firebase : l'appelant fournit la fabrique de lots
 * (`() => writeBatch(db)`), ce qui rend la découpe testable.
 */
export async function ecrireParLots<B extends { commit(): Promise<unknown> }>(
  creerLot: () => B,
  operations: Array<(b: B) => void>,
  taille = 450,
): Promise<void> {
  for (let i = 0; i < operations.length; i += taille) {
    const lot = creerLot();
    for (const op of operations.slice(i, i + taille)) op(lot);
    await lot.commit();
  }
}
