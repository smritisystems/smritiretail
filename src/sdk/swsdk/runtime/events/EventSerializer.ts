import type { EventEnvelope } from "./EventEnvelope.js";

export class EventSerializer {
  public static serialize<T = Record<string, unknown>>(envelope: EventEnvelope<T>): string {
    return JSON.stringify(envelope);
  }

  public static deserialize<T = Record<string, unknown>>(serialized: string): EventEnvelope<T> {
    return JSON.parse(serialized) as EventEnvelope<T>;
  }
}
