export interface EventEnvelope {
  eventType: string;
  payload: Record<string, unknown>;
  source: string;
  timestamp?: string;
}

export type EventSubscriber = (event: EventEnvelope) => void;

export interface EventPublishResult {
  delivered: number;
  failed: number;
}

export interface DeadLetterEntry {
  eventType: string;
  payload: Record<string, unknown>;
  source: string;
  reason: string;
}

export class EventBusService {
  private subscribers = new Map<string, Set<EventSubscriber>>();
  private deadLetters: DeadLetterEntry[] = [];

  public subscribe(eventType: string, subscriber: EventSubscriber): void {
    const subscribers = this.subscribers.get(eventType) ?? new Set<EventSubscriber>();
    subscribers.add(subscriber);
    this.subscribers.set(eventType, subscribers);
  }

  public publish(event: EventEnvelope): EventPublishResult {
    const subscribers = this.subscribers.get(event.eventType) ?? new Set<EventSubscriber>();
    let delivered = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      try {
        subscriber({ ...event, timestamp: event.timestamp ?? new Date().toISOString() });
        delivered += 1;
      } catch (error) {
        failed += 1;
        this.deadLetters.push({
          eventType: event.eventType,
          payload: event.payload,
          source: event.source,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { delivered, failed };
  }

  public getDeadLetterEvents(): DeadLetterEntry[] {
    return [...this.deadLetters];
  }

  public clear(): void {
    this.subscribers.clear();
    this.deadLetters = [];
  }
}
