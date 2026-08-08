/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : WorkspaceLifecycleManager (SUNEF v3.5 Lifecycle & State Splitting)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.5.0
 */

import logger from "../core/logging/logger.js";
import { PlatformEventBus } from "../spf/PlatformEventBus.ts";

export type WorkspaceLifecycleStatus = "Created" | "Activated" | "Suspended" | "Restored" | "Closed" | "Archived";
export type WorkspaceCachePolicy = "Pinned" | "LRU" | "AutoClose" | "ReadOnly";

export interface WorkspaceUIState {
  tabs?: string[];
  selectedTab?: string;
  scrollPosition?: number;
  splitters?: Record<string, number>;
  gridLayout?: string;
  theme?: string;
}

export interface WorkspaceBusinessState {
  recordId?: string;
  filters?: Record<string, any>;
  searchQuery?: string;
  draftId?: string;
  selectedCompanyId?: string;
  selectedBranchId?: string;
}

export interface WorkspaceRuntimeState {
  activeRequests?: number;
  isLoading?: boolean;
  errors?: string[];
  isDirty?: boolean;
}

export interface ManagedWorkspace {
  workspaceId: string;
  title: string;
  icon: string;
  status: WorkspaceLifecycleStatus;
  cachePolicy: WorkspaceCachePolicy;
  uiState: WorkspaceUIState;
  businessState: WorkspaceBusinessState;
  runtimeState: WorkspaceRuntimeState;
  createdAt: number;
  lastActiveAt: number;
}

export class WorkspaceLifecycleManager {
  private static workspaces: Map<string, ManagedWorkspace> = new Map();
  private static activeWorkspaceId: string = "dashboard";
  private static STORAGE_KEY = "smriti_sunef_workspaces_v35";

  public static initialize(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.entries(parsed).forEach(([id, item]: [string, any]) => {
          this.workspaces.set(id, item);
        });
      }
    } catch (e) {
      logger.warn("[SUNEF LifecycleManager] Failed to restore saved workspaces:", e as unknown);
    }
  }

  public static openWorkspace(workspaceId: string, title?: string, icon?: string): ManagedWorkspace {
    let ws = this.workspaces.get(workspaceId);
    if (!ws) {
      ws = {
        workspaceId,
        title: title || workspaceId,
        icon: icon || "layout",
        status: "Created",
        cachePolicy: workspaceId === "dashboard" ? "Pinned" : "LRU",
        uiState: { selectedTab: "overview", scrollPosition: 0 },
        businessState: {},
        runtimeState: { isDirty: false, isLoading: false },
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };
      this.workspaces.set(workspaceId, ws);
      PlatformEventBus.emit("WorkspaceOpened", ws);
    }

    this.activateWorkspace(workspaceId);
    return ws;
  }

  public static activateWorkspace(workspaceId: string): void {
    if (this.activeWorkspaceId && this.activeWorkspaceId !== workspaceId) {
      const prev = this.workspaces.get(this.activeWorkspaceId);
      if (prev && prev.status === "Activated") {
        prev.status = "Suspended";
        PlatformEventBus.emit("WorkspaceSuspended", prev);
      }
    }

    const current = this.workspaces.get(workspaceId);
    if (current) {
      current.status = "Activated";
      current.lastActiveAt = Date.now();
      this.activeWorkspaceId = workspaceId;
      PlatformEventBus.emit("WorkspaceActivated", current);
      this.saveToStorage();
    }
  }

  public static closeWorkspace(workspaceId: string): void {
    const ws = this.workspaces.get(workspaceId);
    if (ws && ws.cachePolicy !== "Pinned") {
      ws.status = "Closed";
      this.workspaces.delete(workspaceId);
      PlatformEventBus.emit("WorkspaceClosed", ws);
      if (this.activeWorkspaceId === workspaceId) {
        const remaining = Array.from(this.workspaces.keys());
        const fallback = remaining[remaining.length - 1] || "dashboard";
        this.activateWorkspace(fallback);
      }
      this.saveToStorage();
    }
  }

  public static getActiveWorkspace(): ManagedWorkspace | null {
    return this.workspaces.get(this.activeWorkspaceId) || null;
  }

  public static getOpenWorkspaces(): ManagedWorkspace[] {
    return Array.from(this.workspaces.values());
  }

  public static updateWorkspaceState(
    workspaceId: string,
    uiDelta?: Partial<WorkspaceUIState>,
    businessDelta?: Partial<WorkspaceBusinessState>
  ): void {
    const ws = this.workspaces.get(workspaceId);
    if (ws) {
      if (uiDelta) ws.uiState = { ...ws.uiState, ...uiDelta };
      if (businessDelta) ws.businessState = { ...ws.businessState, ...businessDelta };
      this.saveToStorage();
    }
  }

  private static saveToStorage(): void {
    if (typeof window === "undefined") return;
    try {
      const obj: Record<string, ManagedWorkspace> = {};
      this.workspaces.forEach((ws, id) => {
        obj[id] = ws;
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      logger.warn("[SUNEF LifecycleManager] Failed to persist workspaces:", e as unknown);
    }
  }
}
