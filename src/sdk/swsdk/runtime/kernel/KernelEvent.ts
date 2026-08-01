export type KernelEventType =
  | "ServiceRegistered"
  | "ServiceStarted"
  | "ServiceStopped"
  | "ServiceFailed"
  | "HealthChanged"
  | "DependencyMissing";

export interface KernelEvent {
  type: KernelEventType;
  timestamp: string;
  serviceId?: string;
  payload?: Record<string, unknown>;
}

export function createKernelEvent(type: KernelEventType, overrides: Partial<KernelEvent> = {}): KernelEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    ...overrides
  };
}
