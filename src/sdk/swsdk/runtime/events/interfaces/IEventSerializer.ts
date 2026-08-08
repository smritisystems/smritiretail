import type { EventEnvelope } from "../EventEnvelope.js";

export interface IEventSerializer {
  serialize<T = Record<string, unknown>>(envelope: EventEnvelope<T>): string;
  deserialize<T = Record<string, unknown>>(payload: string): EventEnvelope<T>;
}
