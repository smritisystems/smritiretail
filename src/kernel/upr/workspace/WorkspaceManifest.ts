/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Standard     : SCS-WSP-001 (Workspace Presentation Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 */

import React from "react";
import { WorkspaceSchema } from "./WorkspaceSchema.js";

export type WorkspaceMode = "simple" | "standard" | "advanced";

export interface WorkspaceLifecycleHooks {
  onOpen?: () => void;
  onClose?: () => void;
  onBeforeSave?: () => Promise<boolean | void>;
  onAfterSave?: () => Promise<void>;
  onSelectionChanged?: (selectedIds: string[]) => void;
  onModeChanged?: (mode: WorkspaceMode) => void;
  onRefresh?: () => Promise<void>;
  onImportCompleted?: (count: number) => void;
}

export interface WorkspaceManifest {
  id: string;
  title: string;
  domainId: string;
  packageId?: string;
  version?: string;
  schema: WorkspaceSchema;
  
  // Pluggable JSX Region Components
  toolbar?: React.ComponentType<any>;
  ribbon?: React.ComponentType<any>;
  content?: React.ComponentType<any>;
  inspector?: React.ComponentType<any>;
  console?: React.ComponentType<any>;
  emptyState?: React.ComponentType<any>;
  statusBar?: React.ComponentType<any>;
  
  // Lifecycle Hooks
  hooks?: WorkspaceLifecycleHooks;
  
  // Permission Scopes
  permissions?: string[];
}

export interface WorkspacePolicy {
  workspaceId: string;
  allowInspectorResize: boolean;
  allowSplitView: boolean;
  allowBulkEdit: boolean;
  allowCopilot: boolean;
  defaultDensity: "compact" | "comfortable" | "spacious";
  defaultMode: WorkspaceMode;
}

class WorkspaceRegistryImpl {
  private manifests: Map<string, WorkspaceManifest> = new Map();
  private policies: Map<string, WorkspacePolicy> = new Map();

  register(manifest: WorkspaceManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  get(id: string): WorkspaceManifest | undefined {
    return this.manifests.get(id);
  }

  getAll(): WorkspaceManifest[] {
    return Array.from(this.manifests.values());
  }

  registerPolicy(policy: WorkspacePolicy): void {
    this.policies.set(policy.workspaceId, policy);
  }

  getPolicy(workspaceId: string): WorkspacePolicy {
    return this.policies.get(workspaceId) || {
      workspaceId,
      allowInspectorResize: true,
      allowSplitView: true,
      allowBulkEdit: true,
      allowCopilot: true,
      defaultDensity: "comfortable",
      defaultMode: "standard",
    };
  }
}

export const WorkspaceRegistry = new WorkspaceRegistryImpl();
export const WorkspacePolicyRegistry = WorkspaceRegistry;
