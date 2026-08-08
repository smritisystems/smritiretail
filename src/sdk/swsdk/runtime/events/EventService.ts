import { createEventEnvelope, type EventEnvelope } from "./EventEnvelope.js";
import { EventRegistry } from "./EventRegistry.js";
import { DeadLetterPolicy, type DeadLetterRecord } from "./DeadLetterPolicy.js";
import { DefaultRetryPolicy, RetryStrategy, type RetryPolicy } from "./RetryPolicy.js";
import { MemoryTransport } from "./adapters/MemoryTransport.js";
import { JsonSerializer } from "./adapters/JsonSerializer.js";
import type { IEventTransport } from "./interfaces/IEventTransport.js";
import type { IEventSerializer } from "./interfaces/IEventSerializer.js";
import { EventPublisher, type PublishInput } from "./EventPublisher.js";
import { EventValidator } from "./EventValidator.js";
import type { TransportMetrics } from "./TransportMetrics.js";
import type { TransportHealth } from "./TransportHealth.js";
import { OrderingPolicy } from "./OrderingPolicy.js";

export interface EventPublishResult {
  delivered: number;
  failed: number;
}

export type EventSubscriber = (event: EventEnvelope) => void;

export class EventService {
  private readonly transport: IEventTransport;
  private readonly subscribers = new Map<string, Set<EventSubscriber>>();
  private readonly deadLetters: DeadLetterRecord[] = [];
  private readonly retryPolicy: RetryPolicy;
  private readonly publisher = new EventPublisher();
  private readonly serializer: IEventSerializer;
  private readonly idempotencyWindow = new Set<string>();
  private readonly orderingPolicy: OrderingPolicy;
  private readonly metrics: TransportMetrics = {
    published: 0,
    delivered: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
    latency: 0
  };

  constructor(transport: IEventTransport = new MemoryTransport(), retryPolicy: RetryPolicy = DefaultRetryPolicy, serializer: IEventSerializer = new JsonSerializer(), orderingPolicy: OrderingPolicy = OrderingPolicy.None) {
    this.transport = transport;
    this.retryPolicy = retryPolicy;
    this.serializer = serializer;
    this.orderingPolicy = orderingPolicy;
  }

  public subscribe(eventType: string, subscriber: EventSubscriber): void {
    const subscribers = this.subscribers.get(eventType) ?? new Set<EventSubscriber>();
    subscribers.add(subscriber);
    this.subscribers.set(eventType, subscribers);
  }

  public publish(input: PublishInput): EventPublishResult {
    const envelope = this.publisher.publish(input);
    const validation = EventValidator.validate(envelope);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    const idempotencyKey = envelope.idempotencyKey ?? envelope.id;
    if (this.idempotencyWindow.has(idempotencyKey)) {
      throw new Error(`Duplicate event idempotency key '${idempotencyKey}' rejected.`);
    }
    this.idempotencyWindow.add(idempotencyKey);

    this.metrics.published += 1;

    const subscribers = this.subscribers.get(envelope.eventType) ?? new Set<EventSubscriber>();
    if (this.orderingPolicy !== OrderingPolicy.None) {
      // preserve the current order for the in-process memory transport
    }
    let delivered = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      let attempts = 0;
      let success = false;
      while (attempts < this.retryPolicy.maxAttempts && !success) {
        attempts += 1;
        try {
          subscriber(envelope);
          success = true;
          delivered += 1;
          this.metrics.delivered += 1;
        } catch (error) {
          if (this.retryPolicy.strategy === RetryStrategy.None || attempts >= this.retryPolicy.maxAttempts) {
            failed += 1;
            this.metrics.failed += 1;
            this.metrics.deadLettered += 1;
            this.deadLetters.push(DeadLetterPolicy.createRecord(envelope, error instanceof Error ? error.message : String(error), attempts, "memory"));
            break;
          }
        }
      }
    }

    this.transport.publish(envelope).catch(() => undefined);

    return { delivered, failed };
  }

  public serialize(envelope: EventEnvelope): string {
    return this.serializer.serialize(envelope);
  }

  public deserialize(serialized: string): EventEnvelope {
    return this.serializer.deserialize(serialized);
  }

  public getDeadLetters(): DeadLetterRecord[] {
    return [...this.deadLetters];
  }

  public getMetrics(): TransportMetrics {
    return { ...this.metrics };
  }

  public getHealth(): TransportHealth {
    return {
      status: this.metrics.failed > 0 ? "degraded" : "healthy",
      published: this.metrics.published,
      delivered: this.metrics.delivered,
      failed: this.metrics.failed,
      queueDepth: this.deadLetters.length,
      latency: this.metrics.latency,
      lastError: this.deadLetters[0]?.reason,
      lastSuccessfulPublish: this.metrics.published > 0 ? new Date().toISOString() : undefined
    };
  }
}
