/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Platform Event Bus Integration
 * Feature      : src/features/auth/events/authEvents.ts
 */

import { AuthEventPayload, AuthEventType } from "../types/auth.types";

type AuthEventListener = (event: AuthEventPayload) => void;

class AuthEventPublisher {
  private listeners: Set<AuthEventListener> = new Set();

  public subscribe(listener: AuthEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public publish(eventType: AuthEventType, userId?: string, organizationId?: string, details?: Record<string, unknown>): void {
    const payload: AuthEventPayload = {
      eventType,
      timestamp: new Date().toISOString(),
      userId,
      organizationId,
      details,
    };

    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[AuthEventPublisher] Error notifying listener for ${eventType}:`, err);
      }
    });
  }
}

export const authEvents = new AuthEventPublisher();
