/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.26.0
 * Created      : 2026-09-16
 * Modified     : 2026-09-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Platform Kernel Contract — Stage 4
 */

/**
 * Standard SMRITI Stage 4 Platform Event Envelope.
 * Strict contract separation between semantic event version and payload schemaVersion,
 * with actorId tracing and distributed transaction IDs.
 */
export interface EventEnvelope<T = unknown> {
  id: string;
  eventType: string;
  version: string;
  source: string;
  tenantId: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  payload: T;
  metadata: Record<string, string>;
  schemaVersion: string;
  actorId?: string;
}

/**
 * Abstract event transport boundary interface.
 */
export interface IEventTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  publish(topic: string, envelopeBytes: Uint8Array): Promise<void>;
  subscribe(topicPattern: string, handler: (envelopeBytes: Uint8Array) => Promise<void>): Promise<void>;
}

/**
 * Contractual consumer idempotency guard interface.
 */
export interface IIdempotencyStore {
  isDuplicate(eventId: string, consumerId: string): Promise<boolean>;
  recordExecution(eventId: string, consumerId: string, resultPayload?: unknown): Promise<void>;
}

/**
 * Transactional Outbox boundary contract.
 * Deferred worker implementation for subsequent distributed phases.
 */
export interface IEventOutbox {
  stage(envelope: EventEnvelope, transactionContext?: unknown): Promise<string>;
  fetchPending(limit?: number): Promise<EventEnvelope[]>;
  markDispatched(outboxId: string): Promise<void>;
  markFailed(outboxId: string, errorMessage: string): Promise<void>;
}
