export interface ServiceMetrics {
  requests: number;
  success: number;
  failure: number;
  latency: number;
  throughput: number;
  memory: number;
  queueDepth: number;
}

export function createServiceMetrics(overrides: Partial<ServiceMetrics> = {}): ServiceMetrics {
  return {
    requests: 0,
    success: 0,
    failure: 0,
    latency: 0,
    throughput: 0,
    memory: 0,
    queueDepth: 0,
    ...overrides
  };
}
