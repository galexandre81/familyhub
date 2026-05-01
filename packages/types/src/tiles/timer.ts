import type { Timestamp } from "../common";

export interface TimerPreset {
  label: string;
  seconds: number;
}

export interface TimerConfig {
  presets: TimerPreset[];
}

export type TimerStatus = "running" | "paused" | "ended";

export interface TimerDoc {
  label: string;
  startedAt: Timestamp;
  durationSeconds: number;
  endsAt: Timestamp;
  status: TimerStatus;
  pausedAt?: Timestamp;
  remainingSeconds?: number;
}
