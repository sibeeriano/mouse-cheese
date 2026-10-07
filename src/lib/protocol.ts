export const INTERVALS = [5, 15, 30, 60] as const;

export type IntervalSeconds = (typeof INTERVALS)[number];

export type JigglePlatform = "windows" | "macos" | "linux" | "other";

export type JiggleStatus = {
  running: boolean;
  intervalSeconds: IntervalSeconds;
  nextNudgeAt: number | null;
  lastNudgeAt: number | null;
  lastError: string | null;
  platform: JigglePlatform;
  tool: string;
};

export function isInterval(value: number): value is IntervalSeconds {
  return (INTERVALS as readonly number[]).includes(value);
}
