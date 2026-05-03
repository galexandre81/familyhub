export interface ClockConfig {
  format: "24h" | "12h";
  showSeconds: boolean;
  showDate: boolean;
  dateFormat: "long" | "short";
}

export const defaultClockConfig: ClockConfig = {
  format: "24h",
  showSeconds: false,
  showDate: true,
  dateFormat: "long",
};
