/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Workspace Registry Service (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

import { WorkspaceManifest } from "../manifests/workspace.js";
import { ActionManifest } from "../manifests/actions.js";
import { CapabilityManifest } from "../manifests/capabilities.js";
import { PermissionManifest } from "../manifests/permissions.js";
import { SearchManifest } from "../manifests/search.js";
import { EventManifest } from "../manifests/events.js";
import { ManifestValidator, ValidationResult } from "./ManifestValidator.js";

export interface WorkspaceBundle {
  manifest: WorkspaceManifest;
  actions?: ActionManifest;
  capabilities?: CapabilityManifest;
  permissions?: PermissionManifest;
  search?: SearchManifest;
  events?: EventManifest;
}

export class WorkspaceRegistry {
  private static instance: WorkspaceRegistry;
  private registry: Map<string, WorkspaceBundle> = new Map();

  private constructor() {}

  public static getInstance(): WorkspaceRegistry {
    if (!WorkspaceRegistry.instance) {
      WorkspaceRegistry.instance = new WorkspaceRegistry();
    }
    return WorkspaceRegistry.instance;
  }

  public registerWorkspace(bundle: WorkspaceBundle): ValidationResult {
    const validation = ManifestValidator.validate(
      bundle.manifest,
      bundle.actions,
      bundle.capabilities,
      bundle.permissions,
      bundle.search,
      bundle.events
    );

    if (!validation.valid) {
      throw new Error(
        `[SWSDK] Failed to register workspace '${bundle.manifest.workspaceId}': ${validation.errors.join("; ")}`
      );
    }

    this.registry.set(bundle.manifest.workspaceId, bundle);
    return validation;
  }

  public getWorkspace(workspaceId: string): WorkspaceBundle | undefined {
    return this.registry.get(workspaceId);
  }

  public getAllWorkspaces(): WorkspaceBundle[] {
    return Array.from(this.registry.values());
  }

  public getWorkspacesByCategory(category: WorkspaceManifest["category"]): WorkspaceBundle[] {
    return this.getAllWorkspaces().filter((b) => b.manifest.category === category);
  }

  public clear(): void {
    this.registry.clear();
  }
}
