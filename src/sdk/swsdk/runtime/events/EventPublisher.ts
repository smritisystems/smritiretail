import { createEventEnvelope, type EventEnvelope } from "./EventEnvelope.js";
import { EventValidator } from "./EventValidator.js";
import { EventRegistry } from "./EventRegistry.js";

export interface PublishInput<T = Record<string, unknown>> {
  eventType: string;
  payload: T;
  source: string;
  tenantId: string;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, string>;
  version?: string;
  idempotencyKey?: string;
  priority?: "low" | "normal" | "high" | "critical";
  partitionKey?: string;
  schemaVersion?: string;
}

export class EventPublisher {
  public publish(input: PublishInput): EventEnvelope {
    const envelope = createEventEnvelope({
      eventType: input.eventType,
      payload: input.payload,
      source: input.source,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      causationId: input.causationId,
      metadata: input.metadata,
      version: input.version,
      idempotencyKey: input.idempotencyKey,
      priority: input.priority,
      partitionKey: input.partitionKey,
      schemaVersion: input.schemaVersion
    });

    const registry = EventRegistry.getInstance();
    if (!registry.validate(envelope)) {
      throw new Error(`Event '${input.eventType}' is not registered in the platform event registry.`);
    }

    const validation = EventValidator.validate(envelope);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    return envelope;
  }
}
