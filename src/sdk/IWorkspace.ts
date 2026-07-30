/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SMRITI Workspace SDK (Rule SDK-CONTRACT-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 1.0.0
 */

export interface WorkspaceAction {
  id: string;
  label: string;
  icon?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  permission?: string;
  shortcut?: string;
  onClick: () => void | Promise<void>;
}

export interface WorkspaceCapabilities {
  supportsResume: boolean;
  supportsDraft: boolean;
  supportsTabs: boolean;
  supportsSearch: boolean;
  supportsPrint: boolean;
  supportsExport: boolean;
  supportsAudit: boolean;
  supportsWorkflow: boolean;
}

export interface WorkspaceManifest {
  workspaceId: string;
  title: string;
  module: string;
  icon: string;
  description?: string;
  permissions: string[];
  route: string;
  capabilities: WorkspaceCapabilities;
}

export interface IWorkspace {
  id: string;
  title: string;
  icon: string;
  manifest: WorkspaceManifest;
  canSave(): boolean;
  save(): Promise<void>;
  close(): void;
  refresh(): Promise<void>;
  suspend(): void;
  restore(): void;
  getState(): any;
  setState(state: any): void;
  getActions(): WorkspaceAction[];
}
