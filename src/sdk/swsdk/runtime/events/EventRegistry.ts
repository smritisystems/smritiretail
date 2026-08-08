import type { EventEnvelope } from "./EventEnvelope.js";
import type { EventDefinition } from "./EventDefinition.js";

export type EventLifecycleState = "Register" | "Validate" | "Publishable" | "Deprecated" | "Retired";

export interface RegisteredEvent extends EventDefinition {
  eventType: string;
  lifecycle: EventLifecycleState;
}

export class EventRegistry {
  private static instance: EventRegistry;
  private events = new Map<string, RegisteredEvent>();

  public static getInstance(): EventRegistry {
    if (!EventRegistry.instance) {
      EventRegistry.instance = new EventRegistry();
    }
    return EventRegistry.instance;
  }

  public register(eventType: string, version: string, definition?: Partial<EventDefinition>): RegisteredEvent {
    const baseDefinition: EventDefinition = {
      name: eventType,
      version,
      schemaVersion: definition?.schemaVersion ?? "1.0",
      deprecated: definition?.deprecated ?? false,
      replacement: definition?.replacement,
      compatibility: definition?.compatibility ?? "backward"
    };
    const registered: RegisteredEvent = { ...baseDefinition, eventType, lifecycle: "Register" as EventLifecycleState };
    this.events.set(`${eventType}:${version}`, registered);
    return registered;
  }

  public validate(eventEnvelope: EventEnvelope): boolean {
    const definition = this.resolve(eventEnvelope.eventType, eventEnvelope.version);
    if (!definition) {
      return false;
    }
    return definition.lifecycle === "Publishable" || definition.lifecycle === "Deprecated";
  }

  public resolve(eventType: string, version: string): RegisteredEvent | undefined {
    return this.events.get(`${eventType}:${version}`);
  }

  public markPublishable(eventType: string, version: string): RegisteredEvent | undefined {
    const definition = this.resolve(eventType, version);
    if (definition) {
      definition.lifecycle = "Publishable";
    }
    return definition;
  }

  public markDeprecated(eventType: string, version: string): RegisteredEvent | undefined {
    const definition = this.resolve(eventType, version);
    if (definition) {
      definition.lifecycle = "Deprecated";
    }
    return definition;
  }

  public markRetired(eventType: string, version: string): RegisteredEvent | undefined {
    const definition = this.resolve(eventType, version);
    if (definition) {
      definition.lifecycle = "Retired";
    }
    return definition;
  }

  public clear(): void {
    this.events.clear();
  }
}
