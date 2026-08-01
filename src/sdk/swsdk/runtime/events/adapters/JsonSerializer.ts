import type { IEventSerializer } from "../interfaces/IEventSerializer.js";
import type { EventEnvelope } from "../EventEnvelope.js";

export class JsonSerializer implements IEventSerializer {
  public serialize<T = Record<string, unknown>>(envelope: EventEnvelope<T>): string {
    return JSON.stringify(envelope);
  }

  public deserialize<T = Record<string, unknown>>(payload: string): EventEnvelope<T> {
    return JSON.parse(payload) as EventEnvelope<T>;
  }
}
