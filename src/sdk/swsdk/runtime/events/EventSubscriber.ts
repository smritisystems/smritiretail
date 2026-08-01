import type { EventEnvelope } from "./EventEnvelope.js";

export type EventSubscriberHandler<T = Record<string, unknown>> = (event: EventEnvelope<T>) => void;

export class EventSubscriber {
  public static create<T = Record<string, unknown>>(handler: EventSubscriberHandler<T>): EventSubscriberHandler<T> {
    return handler;
  }
}
