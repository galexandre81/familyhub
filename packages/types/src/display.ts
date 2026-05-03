import type { DisplayDeviceType, Theme, Timestamp } from "./common";

export interface TilePosition {
  col: number;
  row: number;
  w: number;
  h: number;
}

export interface DisplayLayoutEntry {
  tileId: string;
  position: TilePosition;
}

export interface GridConfig {
  cols: number;
  rows: number;
  gap: number;
}

export interface Resolution {
  w: number;
  h: number;
}

export interface Display {
  nom: string;
  type: DisplayDeviceType;
  resolution: Resolution;
  theme: Theme;
  gridConfig: GridConfig;
  layout: DisplayLayoutEntry[];
  authToken: string;
  authTokenExpiresAt: Timestamp;
  setupToken?: string;
  setupTokenExpiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
