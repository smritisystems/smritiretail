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

export class SUNEFKernel {
  private static activeTabSetter: ((tabId: string) => void) | null = null;
  private static notificationHandler: ((title: string, message: string, type?: "success" | "error") => void) | null | undefined = null;

  public static initialize(
    setTab: (tabId: string) => void,
    notify?: (title: string, message: string, type?: "success" | "error") => void
  ) {
    this.activeTabSetter = setTab;
    this.notificationHandler = notify;
  }

  /* ── Core Navigation Transaction ── */
  public static async open(params: SUNEFOpenParams): Promise<void> {
    const manifest = this.resolveManifest(params.type);
    if (!manifest) {
      this.notificationHandler?.("Navigation Error", `Unregistered entity type [${params.type}]`, "error");
      return;
    }

    const targetTab = manifest.workspace;
    if (this.activeTabSetter) {
      this.activeTabSetter(targetTab);
    }

    /* Broadcast entity focus event */
    window.dispatchEvent(
      new CustomEvent("sunef_entity_opened", {
        detail: {
          entity: manifest.entity,
          id: params.id || params.lookup,
          preservedTab: getPreservedTab(targetTab)
        }
      })
    );
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
