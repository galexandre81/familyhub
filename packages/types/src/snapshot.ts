import type { Timestamp } from "./common";

export interface SnapshotTileEntry<TData = Record<string, unknown>> {
  data: TData;
  generatedAt: Timestamp;
}

export interface Snapshot {
  generatedAt: Timestamp;
  ttlSeconds: number;
  tiles: Record<string, SnapshotTileEntry>;
}
