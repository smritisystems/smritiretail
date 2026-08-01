export type PlatformMessageType = "KernelEvent" | "EventEnvelope" | "NotificationEnvelope" | "AuditRecord" | "TelemetryEvent";

export interface PlatformMessage {
  type: PlatformMessageType;
  timestamp: string;
  source?: string;
  serviceId?: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
}

export function createPlatformMessage(type: PlatformMessageType, overrides: Partial<PlatformMessage> = {}): PlatformMessage {
  return {
    type,
    timestamp: new Date().toISOString(),
    ...overrides
  };
}
