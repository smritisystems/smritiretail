/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Decoupled Event Bus
 */

import logger from "../../../core/logging/logger.js";
import { SAWFEvent, SAWFEventHandler } from "../types/sawf.ts";

class SAWFEventBusImpl {
  private listeners: Map<string, Set<SAWFEventHandler>> = new Map();

  subscribe<T = any>(eventType: string, handler: SAWFEventHandler<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    return () => {
      const set = this.listeners.get(eventType);
      if (set) {
        set.delete(handler);
      }
    };
  }

  publish<T = any>(eventType: string, payload: T): void {
    const event: SAWFEvent<T> = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    };

    const set = this.listeners.get(eventType);
    if (set) {
      set.forEach((handler) => {
        try {
          handler(event);
        } catch (err) {
          logger.error(`[SAWFEventBus] Error handling event ${eventType}:`, err as unknown);
        }
      });
    }
  }
}

export const SAWFEventBus = new SAWFEventBusImpl();
