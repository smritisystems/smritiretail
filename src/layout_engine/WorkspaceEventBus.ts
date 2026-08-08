/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Workspace Event Bus (WEB)
 * Standard     : SXP Constitution v1.0 / SWEF v1.0 — P-011
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * SEPARATION OF CONCERNS (MANDATORY):
 *   DomainEventBus  → business events  (SaleCompleted.v1, StockUpdated.v1)
 *   WorkspaceEventBus → UI coordination (FilterChanged, WidgetLoaded, ThemeChanged)
 *   Widgets and components MUST use this bus — never call each other directly.
 */

export type WorkspaceEventType =
  | "WorkspaceOpened"
  | "WorkspaceClosed"
  | "FilterChanged"
  | "SelectionChanged"
  | "ActionExecuted"
  | "WidgetLoaded"
  | "WidgetRefreshed"
  | "ThemeChanged"
  | "ModeChanged"
  | "SyncCompleted"
  | "OfflineStateChanged"
  | "CommandPaletteOpened"
  | "HealthReport"
  | "HeaderUpdate"
  | "CardOpened"
  | "CardStateChanged"
  | "LayoutSaved";

export interface WorkspaceEvent<T = unknown> {
  readonly eventId: string;
  readonly eventType: WorkspaceEventType;
  readonly sourceWorkspaceId: string;
  readonly payload: T;
  readonly timestamp: string;
}

type WorkspaceEventListener<T = unknown> = (event: WorkspaceEvent<T>) => void;

class WorkspaceEventBusService {
  private readonly listeners: Map<string, Set<WorkspaceEventListener>> = new Map();

  /**
   * Subscribe to a specific workspace event type.
   * Returns an unsubscribe function — always call it on component unmount.
   */
  public subscribe<T = unknown>(
    eventType: WorkspaceEventType,
    listener: WorkspaceEventListener<T>
  ): () => void {
    const key = eventType;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as WorkspaceEventListener);
    return () => {
      const set = this.listeners.get(key);
      if (set) set.delete(listener as WorkspaceEventListener);
    };
  }

  /**
   * Publish a workspace UI coordination event.
   * sourceWorkspaceId: the workspace emitting the event (e.g. 'inventory.dashboard')
   */
  public publish<T = unknown>(
    eventType: WorkspaceEventType,
    payload: T,
    sourceWorkspaceId: string = "platform"
  ): WorkspaceEvent<T> {
    const event: WorkspaceEvent<T> = Object.freeze({
      eventId: `wev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventType,
      sourceWorkspaceId,
      payload,
      timestamp: new Date().toISOString(),
    });

    const set = this.listeners.get(eventType);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(event as WorkspaceEvent<unknown>);
        } catch (err) {
          console.error(`[WorkspaceEventBus] Listener error on "${eventType}":`, err);
        }
      });
    }

    return event;
  }

  /** Clear all listeners — for testing only */
  public clearAll(): void {
    this.listeners.clear();
  }
}

export const WorkspaceEventBus = new WorkspaceEventBusService();
