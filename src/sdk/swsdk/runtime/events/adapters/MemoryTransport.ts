import type { EventEnvelope } from "../EventEnvelope.js";
import type { IEventTransport } from "../interfaces/IEventTransport.js";

export class MemoryTransport implements IEventTransport {
  private subscribers = new Map<string, Array<(envelope: EventEnvelope) => Promise<void>>>();

  public async publish(envelope: EventEnvelope): Promise<void> {
    const handlers = this.subscribers.get(envelope.eventType) ?? [];
    for (const handler of handlers) {
      await handler(envelope);
    }
  }

  public async subscribe(eventType: string, handler: (envelope: EventEnvelope) => Promise<void>): Promise<void> {
    const handlers = this.subscribers.get(eventType) ?? [];
    handlers.push(handler);
    this.subscribers.set(eventType, handlers);
  }
}
