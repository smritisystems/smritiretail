/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Inspector Lifecycle Manager
 * Standard     : UCIF-001 through UCIF-005 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * KND-001: Pure service — no React, no DOM, no browser APIs.
 *
 * 8 Lifecycle Events:
 *   BeforeResolve → Resolved → BeforeLoad → Loaded
 *   → BeforeRender → Rendered → Pinned/Favorited → Closed
 *
 * Plugin use cases:
 *   Audit plugin    → on("Rendered") → log to AuditRegistry
 *   AI plugin       → on("BeforeRender") → inject AI section
 *   Telemetry       → on("Rendered") → start timer
 *                     on("Closed") → record duration
 */

import type {
  InspectorLifecycleEvent,
  InspectorLifecyclePayload,
  LifecycleSubscriber,
} from "./InspectorSchema.js";

class InspectorLifecycleManagerService {
  private static instance: InspectorLifecycleManagerService | null = null;

  /** Per-event subscriber sets */
  private subscribers: Map<string, Set<LifecycleSubscriber>> = new Map();

  private constructor() {}

  public static getInstance(): InspectorLifecycleManagerService {
    if (!InspectorLifecycleManagerService.instance) {
      InspectorLifecycleManagerService.instance = new InspectorLifecycleManagerService();
    }
    return InspectorLifecycleManagerService.instance;
  }

  /**
   * Subscribe to a specific lifecycle event or "*" for all events.
   * Returns an unsubscribe function.
   */
  public on(
    event: InspectorLifecycleEvent | "*",
    subscriber: LifecycleSubscriber
  ): () => void {
    const key = event;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(subscriber);

    return () => {
      this.subscribers.get(key)?.delete(subscriber);
    };
  }

  /**
   * Emit a lifecycle event.
   * Called by UCIFKernel at each stage of the inspection pipeline.
   */
  public emit(
    event: InspectorLifecycleEvent,
    payload: Omit<InspectorLifecyclePayload, "event" | "timestamp">
  ): void {
    const fullPayload: InspectorLifecyclePayload = {
      ...payload,
      event,
      timestamp: new Date().toISOString(),
    };

    // Notify specific event subscribers
    this.subscribers.get(event)?.forEach((sub) => {
      try {
        sub(fullPayload);
      } catch (err) {
        console.error(`[UCIF Lifecycle] Subscriber error on event "${event}":`, err);
      }
    });

    // Notify wildcard "*" subscribers
    this.subscribers.get("*")?.forEach((sub) => {
      try {
        sub(fullPayload);
      } catch (err) {
        console.error(`[UCIF Lifecycle] Wildcard subscriber error on event "${event}":`, err);
      }
    });
  }

  /**
   * Remove all subscribers for a given event.
   * Used in tests and teardown.
   */
  public clear(event?: InspectorLifecycleEvent | "*"): void {
    if (event) {
      this.subscribers.delete(event);
    } else {
      this.subscribers.clear();
    }
  }

  /** Returns subscriber count for a given event — useful for tests. */
  public subscriberCount(event: InspectorLifecycleEvent | "*"): number {
    return this.subscribers.get(event)?.size ?? 0;
  }
}

export const InspectorLifecycleManager = InspectorLifecycleManagerService.getInstance();
export { InspectorLifecycleManagerService };
