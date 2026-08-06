/**
 * Project      : SMRITI Retail OS
 * Module       : UDCP — Event Bus (SPK.udcp.events)
 * Standard     : UDCP-001, UDCP-006 (FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * Pub/Sub Event Bus for UDCP lifecycle events (Refinement #1).
 *
 * Events:
 *   SearchStarted, SearchCompleted, ResultExecuted,
 *   ResultInspected, ProviderRegistered, ProviderFailed
 */

import type { UDCPEventType, UDCPEventPayload, UDCPEventSubscriber } from "./UDCPSchema.js";

class UDCPEventBusService {
  private static instance: UDCPEventBusService | null = null;
  private subscribers: Map<string, Set<UDCPEventSubscriber>> = new Map();

  private constructor() {}

  public static getInstance(): UDCPEventBusService {
    if (!UDCPEventBusService.instance) {
      UDCPEventBusService.instance = new UDCPEventBusService();
    }
    return UDCPEventBusService.instance;
  }

  public on(event: UDCPEventType | "*", subscriber: UDCPEventSubscriber): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(subscriber);

    return () => {
      this.subscribers.get(event)?.delete(subscriber);
    };
  }

  public emit(event: UDCPEventType, payload: Omit<UDCPEventPayload, "event" | "timestamp">): void {
    const fullPayload: UDCPEventPayload = {
      ...payload,
      event,
      timestamp: new Date().toISOString(),
    };

    // Specific event subscribers
    this.subscribers.get(event)?.forEach((sub) => {
      try {
        sub(fullPayload);
      } catch (err) {
        console.error(`[UDCP EventBus] Error in subscriber for ${event}:`, err);
      }
    });

    // Wildcard subscribers
    this.subscribers.get("*")?.forEach((sub) => {
      try {
        sub(fullPayload);
      } catch (err) {
        console.error(`[UDCP EventBus] Error in wildcard subscriber:`, err);
      }
    });
  }

  public clear(event?: UDCPEventType | "*"): void {
    if (event) {
      this.subscribers.delete(event);
    } else {
      this.subscribers.clear();
    }
  }
}

export const UDCPEventBus = UDCPEventBusService.getInstance();
export { UDCPEventBusService };
