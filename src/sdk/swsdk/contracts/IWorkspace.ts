/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Combined Workspace Contract (Rule SWSDK-001)
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
import { IWorkspaceLifecycle } from "./IWorkspaceLifecycle.js";

export interface IWorkspace extends IWorkspaceLifecycle {
  metadata: WorkspaceManifest;
  actions?: ActionManifest;
  capabilities?: CapabilityManifest;
  permissions?: PermissionManifest;
  search?: SearchManifest;
  events?: EventManifest;
}
