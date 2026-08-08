import type { EventEnvelope } from "../EventEnvelope.js";

export interface IEventTransport {
  publish(envelope: EventEnvelope): Promise<void>;
  subscribe(eventType: string, handler: (envelope: EventEnvelope) => Promise<void>): Promise<void>;
}
