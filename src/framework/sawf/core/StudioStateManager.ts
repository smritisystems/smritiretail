/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Studio State Manager
 */

import { SAWFExperienceMode } from "../types/sawf.ts";
import { SAWFEventBus } from "./EventBus.ts";

export interface StudioState {
  documentId: string | null;
  documentType: string;
  isDirty: boolean;
  mode: SAWFExperienceMode;
  sidebarOpen: boolean;
  expandedPanels: Record<string, boolean>;
  lastAutosavedAt: number | null;
}

export class StudioStateManager {
  private state: StudioState;

  constructor(documentType: string, initialMode: SAWFExperienceMode = "simple") {
    this.state = {
      documentId: null,
      documentType,
      isDirty: false,
      mode: initialMode,
      sidebarOpen: true,
      expandedPanels: {},
      lastAutosavedAt: null,
    };
  }

  getState(): StudioState {
    return { ...this.state };
  }

  setDirty(dirty: boolean): void {
    if (this.state.isDirty !== dirty) {
      this.state.isDirty = dirty;
      SAWFEventBus.publish("studio:dirty_changed", { dirty });
    }
  }

  setMode(mode: SAWFExperienceMode): void {
    this.state.mode = mode;
    SAWFEventBus.publish("studio:mode_changed", { mode });
  }

  toggleSidebar(): void {
    this.state.sidebarOpen = !this.state.sidebarOpen;
    SAWFEventBus.publish("studio:sidebar_toggled", { open: this.state.sidebarOpen });
  }

  togglePanel(panelId: string): void {
    const current = !!this.state.expandedPanels[panelId];
    this.state.expandedPanels[panelId] = !current;
    SAWFEventBus.publish("studio:panel_toggled", { panelId, expanded: !current });
  }

  markAutosaved(): void {
    this.state.lastAutosavedAt = Date.now();
    this.state.isDirty = false;
    SAWFEventBus.publish("studio:autosaved", { timestamp: this.state.lastAutosavedAt });
  }
}
