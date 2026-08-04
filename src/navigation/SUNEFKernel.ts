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
import { WorkspaceLifecycleManager } from "./WorkspaceLifecycleManager.ts";

export type NavigationMode = "Preview" | "Workspace" | "Modal" | "SplitView" | "Background" | "ReadOnly";

export interface SUNEFOpenParams {
  type: string;
  id?: string;
  lookup?: string;
  mode?: NavigationMode;
}

export interface NavigationHistory {
  id: string;
  module: string;
  workspace: string;
  recordId?: string;
  title: string;
  route: string;
  breadcrumb: string[];
  state: {
    filters?: any;
    search?: string;
    selectedTab?: string;
    scrollPosition?: number;
    draftId?: string;
    selectedRow?: any;
  };
  timestamp: number;
}

export class SUNEFKernel {
  private static activeTabSetter: ((tabId: string) => void) | null = null;
  private static notificationHandler: ((title: string, message: string, type?: "success" | "error") => void) | null | undefined = null;
  private static historyStack: NavigationHistory[] = [];
  private static historyIndex: number = -1;
  private static isNavigatingInternal: boolean = false;
  private static pinnedModules: string[] = ["pos", "sales", "purchase", "inventory"];

  public static initialize(
    setTab: (tabId: string) => void,
    notify?: (title: string, message: string, type?: "success" | "error") => void
  ) {
    this.activeTabSetter = setTab;
    this.notificationHandler = notify;

    // Seed Home state
    if (this.historyStack.length === 0) {
      this.historyStack.push({
        id: "nav-home",
        module: "Launchpad",
        workspace: "dashboard",
        title: "Home Dashboard",
        route: "/dashboard",
        breadcrumb: ["Home", "Dashboard"],
        state: {},
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

    // Integrate SUNEF v3.5 Workspace Lifecycle Manager
    WorkspaceLifecycleManager.openWorkspace(targetTab, params.title || manifest.entity || params.type, manifest.icon);

    // Push into in-app History Stack if not an internal back/forward traversal
    if (!this.isNavigatingInternal) {
      if (this.historyIndex < this.historyStack.length - 1) {
        this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
      }
      const recordId = params.id || params.lookup;
      const breadcrumb = [manifest.workspace, manifest.entity];
      if (recordId) breadcrumb.push(recordId);

      const newState: NavigationHistory = {
        id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        module: manifest.workspace,
        workspace: targetTab,
        recordId,
        title: params.title || manifest.entity || params.type,
        route: manifest.deepLink || `/${targetTab}`,
        breadcrumb,
        state: {
          selectedTab: getPreservedTab(targetTab)
        },
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
          canGoForward: this.canGoForward(),
          breadcrumb: this.getCurrentBreadcrumb()
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

  public static getHistoryStack(): { items: NavigationHistory[]; currentIndex: number } {
    return {
      items: [...this.historyStack],
      currentIndex: this.historyIndex
    };
  }

  public static getCurrentBreadcrumb(): string[] {
    const curr = this.historyStack[this.historyIndex];
    return curr?.breadcrumb || ["Home", "Dashboard"];
  }

  public static isReady(): boolean {
    return this.activeTabSetter !== null;
  }

  public static async navigateWorkspace(workspace: string, title?: string): Promise<void> {
    if (!workspace) return;

    const targetTab = workspace;
    if (this.activeTabSetter) {
      this.activeTabSetter(targetTab);
    }

    WorkspaceLifecycleManager.openWorkspace(targetTab, title || targetTab);

    if (!this.isNavigatingInternal) {
      if (this.historyIndex < this.historyStack.length - 1) {
        this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
      }

      const newState: NavigationHistory = {
        id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        module: targetTab,
        workspace: targetTab,
        title: title || targetTab,
        route: `/${targetTab}`,
        breadcrumb: [targetTab, title || targetTab],
        state: {
          selectedTab: getPreservedTab(targetTab)
        },
        timestamp: Date.now()
      };
      this.historyStack.push(newState);
      this.historyIndex = this.historyStack.length - 1;
    }

    window.dispatchEvent(
      new CustomEvent("sunef_entity_opened", {
        detail: {
          entity: title || targetTab,
          id: undefined,
          preservedTab: getPreservedTab(targetTab),
          canGoBack: this.canGoBack(),
          canGoForward: this.canGoForward(),
          breadcrumb: this.getCurrentBreadcrumb()
        }
      })
    );
  }

  public static getPinnedModules(): string[] {
    return [...this.pinnedModules];
  }

  public static async jumpToHistory(index: number): Promise<void> {
    if (index < 0 || index >= this.historyStack.length) return;
    this.isNavigatingInternal = true;
    this.historyIndex = index;
    const targetState = this.historyStack[this.historyIndex];
    if (this.activeTabSetter) {
      this.activeTabSetter(targetState.workspace);
    }
    WorkspaceLifecycleManager.openWorkspace(targetState.workspace, targetState.title, targetState.module);
    if (targetState.state?.selectedTab) {
      setPreservedTab(targetState.workspace, targetState.state.selectedTab);
    }
    window.dispatchEvent(
      new CustomEvent("sunef_entity_opened", {
        detail: {
          entity: targetState.title || targetState.workspace,
          id: targetState.recordId,
          preservedTab: getPreservedTab(targetState.workspace),
          canGoBack: this.canGoBack(),
          canGoForward: this.canGoForward(),
          breadcrumb: this.getCurrentBreadcrumb()
        }
      })
    );
    this.notificationHandler?.("SUNE Jump", `Jumped to ${targetState.title || targetState.workspace}`, "success");
    this.isNavigatingInternal = false;
  }

  public static async goBack(): Promise<void> {
    if (!this.canGoBack()) return;
    this.isNavigatingInternal = true;
    this.historyIndex--;
    const targetState = this.historyStack[this.historyIndex];
    if (this.activeTabSetter) {
      this.activeTabSetter(targetState.workspace);
    }
    WorkspaceLifecycleManager.openWorkspace(targetState.workspace, targetState.title, targetState.module);
    if (targetState.state?.selectedTab) {
      setPreservedTab(targetState.workspace, targetState.state.selectedTab);
    }
    window.dispatchEvent(
      new CustomEvent("sunef_entity_opened", {
        detail: {
          entity: targetState.title || targetState.workspace,
          id: targetState.recordId,
          preservedTab: getPreservedTab(targetState.workspace),
          canGoBack: this.canGoBack(),
          canGoForward: this.canGoForward(),
          breadcrumb: this.getCurrentBreadcrumb()
        }
      })
    );
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
    WorkspaceLifecycleManager.openWorkspace(targetState.workspace, targetState.title, targetState.module);
    if (targetState.state?.selectedTab) {
      setPreservedTab(targetState.workspace, targetState.state.selectedTab);
    }
    window.dispatchEvent(
      new CustomEvent("sunef_entity_opened", {
        detail: {
          entity: targetState.title || targetState.workspace,
          id: targetState.recordId,
          preservedTab: getPreservedTab(targetState.workspace),
          canGoBack: this.canGoBack(),
          canGoForward: this.canGoForward(),
          breadcrumb: this.getCurrentBreadcrumb()
        }
      })
    );
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
    WorkspaceLifecycleManager.openWorkspace("dashboard", "Home Dashboard");
    this.historyStack.push({
      id: `nav-home-${Date.now()}`,
      module: "Launchpad",
      workspace: "dashboard",
      title: "Home Dashboard",
      route: "/dashboard",
      breadcrumb: ["Home", "Dashboard"],
      state: {},
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
