export interface PlatformClock {
  utcNow(): string;
  timestamp(): number;
}

export const SystemPlatformClock: PlatformClock = {
  utcNow: () => new Date().toISOString(),
  timestamp: () => Date.now()
};
