import type { EventEnvelope } from "./EventEnvelope.js";
import { EventRegistry } from "./EventRegistry.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  envelopeErrors: string[];
  schemaErrors: string[];
  registryErrors: string[];
  transportErrors: string[];
}

export class EventValidator {
  public static validate<T = Record<string, unknown>>(envelope: EventEnvelope<T>): ValidationResult {
    const envelopeErrors: string[] = [];
    const schemaErrors: string[] = [];
    const registryErrors: string[] = [];
    const transportErrors: string[] = [];

    if (!envelope.id) {
      envelopeErrors.push("Envelope validation failed: id is required.");
    }
    if (!envelope.eventType) {
      envelopeErrors.push("Envelope validation failed: eventType is required.");
    }
    if (!envelope.version) {
      envelopeErrors.push("Envelope validation failed: version is required.");
    }
    if (!envelope.schemaVersion) {
      schemaErrors.push("Schema validation failed: schemaVersion is required.");
    }
    if (!envelope.source) {
      envelopeErrors.push("Envelope validation failed: source is required.");
    }
    if (!envelope.tenantId) {
      envelopeErrors.push("Envelope validation failed: tenantId is required.");
    }
    if (!envelope.timestamp) {
      envelopeErrors.push("Envelope validation failed: timestamp is required.");
    }
    if (!envelope.correlationId) {
      envelopeErrors.push("Envelope validation failed: correlationId is required.");
    }

    const registry = EventRegistry.getInstance();
    if (!registry.validate(envelope)) {
      registryErrors.push("Registry validation failed: event is not publishable.");
    }

    const errors = [
      ...envelopeErrors,
      ...schemaErrors,
      ...registryErrors,
      ...transportErrors
    ];

    return {
      valid: errors.length === 0,
      errors,
      envelopeErrors,
      schemaErrors,
      registryErrors,
      transportErrors
    };
  }
}
