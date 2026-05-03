import type { TileType, Timestamp } from "./common";

/**
 * Une instance configurée d'une tuile dans un foyer.
 * Plusieurs instances possibles d'un même type (ex : 2 tuiles météo pour 2 villes).
 *
 * Le paramètre générique `TConfig` permet aux consommateurs de typer la config selon
 * `tile.type`. Sans paramètre, `config` est `Record<string, unknown>` (lecture brute Firestore).
 */
export interface Tile<TConfig = Record<string, unknown>> {
  type: TileType;
  nom: string;
  config: TConfig;
  refreshIntervalSeconds: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
