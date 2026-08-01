export interface AuditRecord {
  id: string;
  type: "KernelEvent" | "EventEnvelope" | "NotificationReceipt" | "ValidationResult" | "HealthStatus";
  source: string;
  payload: Record<string, unknown>;
  timestamp: string;
  correlationId?: string;
}

export function createAuditRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: overrides.id ?? `audit-${Date.now()}`,
    type: overrides.type ?? "KernelEvent",
    source: overrides.source ?? "unknown",
    payload: overrides.payload ?? {},
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    correlationId: overrides.correlationId,
  };
}
