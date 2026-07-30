/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Manifest Validation Pipeline Engine (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

import { WorkspaceManifest } from "../manifests/workspace.js";
import { ActionManifest } from "../manifests/actions.js";
import { CapabilityManifest, StandardCapability } from "../manifests/capabilities.js";
import { PermissionManifest } from "../manifests/permissions.js";
import { SearchManifest } from "../manifests/search.js";
import { EventManifest } from "../manifests/events.js";

export interface ValidationResult {
  valid: boolean;
  stage: "Schema" | "Dependency" | "Permission" | "Capability" | "Route" | "Registration";
  errors: string[];
}

export class ManifestValidator {
  /**
   * Capability Dependency Graph Mapping
   */
  private static CAPABILITY_DEPENDENCIES: Record<StandardCapability, StandardCapability[]> = {
    workflow: ["timeline"],
    timeline: ["audit"],
    approval: ["workflow"],
    audit: [],
    draft: [],
    resume: ["draft"],
    attachments: [],
    barcode: [],
    printing: [],
    analytics: [],
    notes: [],
    comments: [],
    aiAssistant: []
  };

  public static validate(
    workspace: WorkspaceManifest,
    actions?: ActionManifest,
    capabilities?: CapabilityManifest,
    permissions?: PermissionManifest,
    search?: SearchManifest,
    events?: EventManifest
  ): ValidationResult {
    const errors: string[] = [];

    // Stage 1: Schema Validation
    if (!workspace.schemaVersion || workspace.schemaVersion !== "1.0") {
      errors.push("Schema Validation Failed: Invalid or missing schemaVersion. Must be '1.0'.");
    }
    if (!workspace.workspaceId || !workspace.title || !workspace.route) {
      errors.push("Schema Validation Failed: Workspace must specify workspaceId, title, and route.");
    }
    if (errors.length > 0) {
      return { valid: false, stage: "Schema", errors };
    }

    // Stage 2: Dependency Validation (Capability Dependencies)
    if (capabilities?.capabilities) {
      const capsSet = new Set(capabilities.capabilities);
      for (const cap of capabilities.capabilities) {
        const requiredDeps = this.CAPABILITY_DEPENDENCIES[cap] || [];
        for (const dep of requiredDeps) {
          if (!capsSet.has(dep)) {
            errors.push(`Dependency Validation Failed: Capability '${cap}' requires capability '${dep}'.`);
          }
        }
      }
    }
    if (errors.length > 0) {
      return { valid: false, stage: "Dependency", errors };
    }

    // Stage 3: Permission Validation
    if (permissions?.permissions) {
      for (const perm of permissions.permissions) {
        if (!perm.code || !perm.action) {
          errors.push(`Permission Validation Failed: Invalid permission declaration ${JSON.stringify(perm)}.`);
        }
      }
    }
    if (errors.length > 0) {
      return { valid: false, stage: "Permission", errors };
    }

    // Stage 4: Capability Validation
    if (capabilities?.capabilities) {
      for (const cap of capabilities.capabilities) {
        if (!this.CAPABILITY_DEPENDENCIES[cap]) {
          errors.push(`Capability Validation Failed: Unknown capability '${cap}'.`);
        }
      }
    }
    if (errors.length > 0) {
      return { valid: false, stage: "Capability", errors };
    }

    // Stage 5: Route Validation
    if (!workspace.route.startsWith("/")) {
      errors.push(`Route Validation Failed: Route '${workspace.route}' must start with '/'.`);
    }
    if (errors.length > 0) {
      return { valid: false, stage: "Route", errors };
    }

    // Stage 6: Registration Ready
    return { valid: true, stage: "Registration", errors: [] };
  }
}
