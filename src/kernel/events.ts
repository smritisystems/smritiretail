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
 * Transactional Outbox status states.
 */
export type OutboxStatus = "PENDING" | "PROCESSING" | "DISPATCHED" | "FAILED" | "DEAD_LETTER";

/**
 * Transactional Outbox record representing an event staged within a PostgreSQL transaction.
 */
export interface OutboxRecord<T = unknown> {
  outboxId: string;
  sourceEventId: string;
  correlationId: string;
  causationId?: string;
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  companyId?: string;
  branchId?: string;
  eventSchemaVersion: string;
  targetChannel: string;
  payload: T;
  status: OutboxStatus;
  retryCount: number;
  errorMessage?: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  claimExpiresAt?: string;
  createdAt: string;
  dispatchedAt?: string;
}

/**
 * Outbox worker cycle execution statistics.
 */
export interface OutboxWorkerStats {
  claimedCount: number;
  dispatchedCount: number;
  failedCount: number;
  dispatchedIds: string[];
  failedIds: string[];
}

/**
 * Transactional Outbox boundary contract.
 * Stage 5 concrete implementation: PostgresEventOutbox & PlatformOutboxWorker.
 */
export interface IEventOutbox {
  stage(envelope: EventEnvelope, transactionContext?: unknown): Promise<string>;
  fetchPending(limit?: number): Promise<EventEnvelope[]>;
  fetchPendingAndClaim?(limit?: number, claimTimeoutSeconds?: number, targetChannel?: string): Promise<Array<[string, EventEnvelope]>>;
  markDispatched(outboxId: string): Promise<void>;
  markFailed(outboxId: string, errorMessage: string): Promise<void>;
}

