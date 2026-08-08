export interface EventEnvelope<T = Record<string, unknown>> {
  id: string;
  eventType: string;
  version: string;
  schemaVersion: string;
  source: string;
  tenantId: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  traceId?: string;
  idempotencyKey?: string;
  priority?: "low" | "normal" | "high" | "critical";
  partitionKey?: string;
  payload: T;
  metadata: Record<string, string>;
}

export function createEventEnvelope<T = Record<string, unknown>>(input: {
  eventType: string;
  payload: T;
  source: string;
  tenantId: string;
  version?: string;
  schemaVersion?: string;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  idempotencyKey?: string;
  priority?: "low" | "normal" | "high" | "critical";
  partitionKey?: string;
  metadata?: Record<string, string>;
}): EventEnvelope<T> {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 10)}`,
    eventType: input.eventType,
    version: input.version ?? "1.0",
    schemaVersion: input.schemaVersion ?? "1.0",
    source: input.source,
    tenantId: input.tenantId,
    timestamp: new Date().toISOString(),
    correlationId: input.correlationId ?? `corr-${Math.random().toString(36).slice(2, 10)}`,
    causationId: input.causationId,
    traceId: input.traceId,
    idempotencyKey: input.idempotencyKey,
    priority: input.priority,
    partitionKey: input.partitionKey,
    payload: input.payload,
    metadata: input.metadata ?? {}
  };
}
