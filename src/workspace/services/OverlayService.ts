/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Overlay Manager Service (ADR-UX-003 Compliant)
 * Standard     : ADR-UX-003 — SMRITI Workspace Shell Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { OverlayType } from "../types/workspace.types";
import { IOverlayManager } from "../interfaces/ISWSContracts";
import { workspaceEventBus } from "../events/workspaceEvents";

class OverlayServiceImpl implements IOverlayManager {
  private activeOverlay: OverlayType = "none";
  private listeners: Set<(overlay: OverlayType) => void> = new Set();

  public openOverlay(overlay: OverlayType): void {
    this.activeOverlay = overlay;
    this.notify();
    workspaceEventBus.publish("OverlayChanged", { overlay });
  }

  public closeOverlay(): void {
    this.activeOverlay = "none";
    this.notify();
    workspaceEventBus.publish("OverlayChanged", { overlay: "none" });
  }

  public getActiveOverlay(): OverlayType {
    return this.activeOverlay;
  }

  public subscribe(listener: (overlay: OverlayType) => void): () => void {
    this.listeners.add(listener);
    listener(this.activeOverlay);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.activeOverlay));
  }
}

export const overlayService = new OverlayServiceImpl();
