import type { EventEnvelope } from "./EventEnvelope.js";

export interface DeadLetterRecord {
  id: string;
  reason: string;
  attempts: number;
  eventEnvelope: EventEnvelope;
  timestamp: string;
  stackTrace?: string;
  transport: string;
}

export class DeadLetterPolicy {
  public static createRecord(eventEnvelope: EventEnvelope, reason: string, attempts: number, transport: string, stackTrace?: string): DeadLetterRecord {
    return {
      id: `dl-${Math.random().toString(36).slice(2, 10)}`,
      reason,
      attempts,
      eventEnvelope,
      timestamp: new Date().toISOString(),
      stackTrace,
      transport
    };
  }
}
