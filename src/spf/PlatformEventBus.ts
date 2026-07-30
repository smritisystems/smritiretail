/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : PlatformEventBus (SPF v1.0 Decoupled Platform Event Bus)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 1.0.0
 */

export type PlatformEventType =
  | "WorkspaceOpened"
  | "WorkspaceClosed"
  | "WorkspaceActivated"
  | "WorkspaceSuspended"
  | "WorkspaceRestored"
  | "DraftSaved"
  | "DraftRestored"
  | "IdentityCreated"
  | "CompanyChanged"
  | "BranchChanged"
  | "UserLoggedIn"
  | "LicenseChanged"
  | "ThemeChanged";

export interface PlatformEventPayload {
  type: PlatformEventType;
  payload: any;
  timestamp: number;
}

type EventListenerCallback = (event: PlatformEventPayload) => void;

export class PlatformEventBus {
  private static listeners: Map<PlatformEventType, Set<EventListenerCallback>> = new Map();

  public static subscribe(type: PlatformEventType, callback: EventListenerCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  public static emit(type: PlatformEventType, payload: any = {}): void {
    const eventPayload: PlatformEventPayload = {
      type,
      payload,
      timestamp: Date.now()
    };

    // Notify subscribed callbacks
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((callback) => {
        try {
          callback(eventPayload);
        } catch (e) {
          console.error(`[SPF EventBus] Listener error for ${type}:`, e);
        }
      });
    }

    // Broadcast to DOM window for global listeners
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(`spf_${type.toLowerCase()}`, { detail: eventPayload }));
    }
  }
}
