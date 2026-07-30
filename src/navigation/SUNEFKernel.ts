/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUNEFKernel API (Level 1 Immutable Core Navigation Contract)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

import { ENTITY_REGISTRY_V3, EntityManifestV3 } from "./NavigationRegistry.ts";
import { getPreservedTab, setPreservedTab } from "./WorkspaceRegistry.ts";

export type NavigationMode = "Preview" | "Workspace" | "Modal" | "SplitView" | "Background" | "ReadOnly";

export interface SUNEFOpenParams {
  type: string;
  id?: string;
  lookup?: string;
  mode?: NavigationMode;
}

export interface SUNEFNavigationState {
  type: string;
  id?: string;
  lookup?: string;
  mode?: NavigationMode;
  workspace: string;
  title?: string;
  preservedState?: any;
  timestamp: number;
}

export class SUNEFKernel {
  private static activeTabSetter: ((tabId: string) => void) | null = null;
  private static notificationHandler: ((title: string, message: string, type?: "success" | "error") => void) | null | undefined = null;
  private static historyStack: SUNEFNavigationState[] = [];
  private static historyIndex: number = -1;
  private static isNavigatingInternal: boolean = false;

  public static initialize(
    setTab: (tabId: string) => void,
    notify?: (title: string, message: string, type?: "success" | "error") => void
  ) {
    this.activeTabSetter = setTab;
    this.notificationHandler = notify;

    // Seed Home state
    if (this.historyStack.length === 0) {
      this.historyStack.push({
        type: "Dashboard",
        workspace: "dashboard",
        title: "Home Dashboard",
        timestamp: Date.now()
      });
      this.historyIndex = 0;
    }

    // Attach Keyboard Shortcuts (Alt+Left, Alt+Right, Ctrl+R, Ctrl+H)
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.handleKeyboardShortcuts);
      window.addEventListener("keydown", this.handleKeyboardShortcuts);
    }
  }

  private static handleKeyboardShortcuts = (e: KeyboardEvent) => {
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      SUNEFKernel.goBack();
    } else if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      SUNEFKernel.goForward();
    } else if (e.ctrlKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      SUNEFKernel.smartRefresh();
    } else if (e.ctrlKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      SUNEFKernel.goHome();
    }
  };

  /* ── Core Navigation Transaction ── */
  public static async open(params: SUNEFOpenParams & { title?: string }): Promise<void> {
    const manifest = this.resolveManifest(params.type);
    if (!manifest) {
      this.notificationHandler?.("Navigation Error", `Unregistered entity type [${params.type}]`, "error");
      return;
    }

    const targetTab = manifest.workspace;
    if (this.activeTabSetter) {
      this.activeTabSetter(targetTab);
    }

    // Push into in-app History Stack if not an internal back/forward traversal
    if (!this.isNavigatingInternal) {
      // Truncate forward history if navigating to new page
      if (this.historyIndex < this.historyStack.length - 1) {
        this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
      }
      const newState: SUNEFNavigationState = {
        type: params.type,
        id: params.id || params.lookup,
        lookup: params.lookup,
        mode: params.mode,
        workspace: targetTab,
        title: params.title || manifest.entity || params.type,
        preservedState: getPreservedTab(targetTab),
        timestamp: Date.now()
      };
      this.historyStack.push(newState);
      this.historyIndex = this.historyStack.length - 1;
    }

    /* Broadcast entity focus event */
    window.dispatchEvent(
      new CustomEvent("sunef_entity_opened", {
        detail: {
          entity: manifest.entity,
          id: params.id || params.lookup,
          preservedTab: getPreservedTab(targetTab),
          canGoBack: this.canGoBack(),
          canGoForward: this.canGoForward()
        }
      })
    );
  }

  /* ── History Control Stack Methods ── */
  public static canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  public static canGoForward(): boolean {
    return this.historyIndex < this.historyStack.length - 1;
  }

  public static async goBack(): Promise<void> {
    if (!this.canGoBack()) return;
    this.isNavigatingInternal = true;
    this.historyIndex--;
    const targetState = this.historyStack[this.historyIndex];
    if (this.activeTabSetter) {
      this.activeTabSetter(targetState.workspace);
    }
    if (targetState.preservedState) {
      setPreservedTab(targetState.workspace, targetState.preservedState);
    }
    this.notificationHandler?.("SUNE Navigation", `Navigated back to ${targetState.title || targetState.workspace}`, "success");
    this.isNavigatingInternal = false;
  }

  public static async goForward(): Promise<void> {
    if (!this.canGoForward()) return;
    this.isNavigatingInternal = true;
    this.historyIndex++;
    const targetState = this.historyStack[this.historyIndex];
    if (this.activeTabSetter) {
      this.activeTabSetter(targetState.workspace);
    }
    if (targetState.preservedState) {
      setPreservedTab(targetState.workspace, targetState.preservedState);
    }
    this.notificationHandler?.("SUNE Navigation", `Navigated forward to ${targetState.title || targetState.workspace}`, "success");
    this.isNavigatingInternal = false;
  }

  public static async smartRefresh(): Promise<void> {
    const currentState = this.historyStack[this.historyIndex];
    const currentWorkspace = currentState?.workspace || "dashboard";
    
    // Broadcast smart refresh event to reload server data while preserving uncommitted local form state
    window.dispatchEvent(
      new CustomEvent("sune_smart_refresh", {
        detail: {
          workspace: currentWorkspace,
          preservedState: getPreservedTab(currentWorkspace)
        }
      })
    );
    this.notificationHandler?.("Smart Refresh", `Refreshed server data for ${currentWorkspace} while preserving unsaved drafts`, "success");
  }

  public static async goHome(): Promise<void> {
    if (this.activeTabSetter) {
      this.activeTabSetter("dashboard");
    }
    this.historyStack.push({
      type: "Dashboard",
      workspace: "dashboard",
      title: "Home Dashboard",
      timestamp: Date.now()
    });
    this.historyIndex = this.historyStack.length - 1;
    this.notificationHandler?.("Home Navigation", "Returned to Home Dashboard", "success");
  }

  /* ── Quick Preview Drawer Trigger ── */
  public static async preview(params: SUNEFOpenParams): Promise<void> {
    const manifest = this.resolveManifest(params.type);
    if (!manifest) return;

    window.dispatchEvent(
      new CustomEvent("sunef_entity_preview", {
        detail: {
          entity: manifest.entity,
          id: params.id || params.lookup,
          manifest
        }
      })
    );
  }

  /* ── AI Intent Resolver ── */
  public static async resolve(params: { intent: string; entity?: string; lookup?: string }): Promise<any> {
    const manifest = params.entity ? this.resolveManifest(params.entity) : null;
    return {
      resolved: true,
      entity: manifest?.entity || "General",
      targetWorkspace: manifest?.workspace || "dashboard",
      lookup: params.lookup
    };
  }

  /* ── Register Plugin Manifest ── */
  public static register(manifest: EntityManifestV3): void {
    ENTITY_REGISTRY_V3[manifest.entity] = manifest;
  }

  /* ── Alias & Route Resolver ── */
  public static resolveManifest(entityOrAlias: string): EntityManifestV3 | null {
    if (ENTITY_REGISTRY_V3[entityOrAlias]) return ENTITY_REGISTRY_V3[entityOrAlias];

    for (const key in ENTITY_REGISTRY_V3) {
      const m = ENTITY_REGISTRY_V3[key];
      if (m.aliases.some((a) => a.toLowerCase() === entityOrAlias.toLowerCase())) {
        return m;
      }
    }
    return null;
  }
}
