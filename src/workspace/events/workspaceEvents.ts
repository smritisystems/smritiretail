/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Workspace Shell (SWS) Platform Event Bus
 * Standard     : ADR-UX-003 (FROZEN v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export type WorkspaceEventType =
  | "WorkspaceOpening"
  | "WorkspaceActivated"
  | "WorkspaceSuspended"
  | "WorkspaceRestored"
  | "WorkspaceClosed"
  | "OverlayChanged"
  | "NotificationReceived"
  | "ThemeChanged";

export interface WorkspaceEventPayload {
  type: WorkspaceEventType;
  timestamp: string;
  data?: any;
}

type WorkspaceEventListener = (event: WorkspaceEventPayload) => void;

class WorkspaceEventBus {
  private listeners: Set<WorkspaceEventListener> = new Set();

  public subscribe(listener: WorkspaceEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public publish(type: WorkspaceEventType, data?: any): void {
    const payload: WorkspaceEventPayload = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error(`Error handling workspace event ${type}:`, err);
      }
    });
  }
}

export const workspaceEventBus = new WorkspaceEventBus();
