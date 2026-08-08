export enum HealthStatus {
  Healthy = "healthy",
  Degraded = "degraded",
  Unavailable = "unavailable",
  Maintenance = "maintenance"
}

export interface ServiceHealth {
  status: HealthStatus;
  uptime: number;
  lastHeartbeat: string;
  dependencies: string[];
  version: string;
  metrics: Record<string, unknown>;
}

export function createServiceHealth(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    status: HealthStatus.Healthy,
    uptime: 0,
    lastHeartbeat: new Date().toISOString(),
    dependencies: [],
    version: "1.0.0",
    metrics: {},
    ...overrides
  };
}
