export interface PlatformConfiguration {
  runtime?: Record<string, unknown>;
  featureFlags?: Record<string, boolean>;
  limits?: Record<string, number>;
  policies?: Record<string, unknown>;
}

export function createPlatformConfiguration(overrides: PlatformConfiguration = {}): PlatformConfiguration {
  return {
    runtime: {},
    featureFlags: {},
    limits: {},
    policies: {},
    ...overrides
  };
}
