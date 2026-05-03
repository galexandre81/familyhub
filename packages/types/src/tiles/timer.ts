import type { Timestamp } from "../common";

export interface TimerPreset {
  /** Identifiant stable du preset (utile pour mise à jour) */
  id: string;
  label: string;
  seconds: number;
}

export interface TimerConfig {
  presets: TimerPreset[];
}

export type TimerStatus = "running" | "paused" | "ended" | "acknowledged";

export interface TimerDoc {
  label: string;
  startedAt: Timestamp;
  durationSeconds: number;
  endsAt: Timestamp;
  status: TimerStatus;
  pausedAt?: Timestamp;
  /** Secondes restantes au moment de la pause (réutilisé pour reprendre). */
  remainingSeconds?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const defaultTimerPresets: TimerPreset[] = [
  { id: "p-pates", label: "Pâtes", seconds: 600 },
  { id: "p-the", label: "Thé", seconds: 240 },
  { id: "p-oeufs", label: "Œufs durs", seconds: 540 },
  { id: "p-meditation", label: "Méditation", seconds: 300 },
  { id: "p-15min", label: "15 minutes", seconds: 900 },
];
