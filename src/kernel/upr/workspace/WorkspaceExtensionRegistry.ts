/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Standard     : SCS-WSP-001 (Workspace Presentation Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 */

import React from "react";

export type WorkspaceExtensionPosition = "Inspector" | "Ribbon" | "StatusBar" | "Toolbar" | "Content";

export interface WorkspaceExtension {
  id: string;
  workspaceId: string;
  position: WorkspaceExtensionPosition;
  order?: number;
  component: React.ComponentType<any>;
}

class WorkspaceExtensionRegistryImpl {
  private extensions: Map<string, WorkspaceExtension[]> = new Map();

  register(ext: WorkspaceExtension): void {
    const list = this.extensions.get(ext.workspaceId) || [];
    list.push(ext);
    list.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
    this.extensions.set(ext.workspaceId, list);
  }

  getExtensions(workspaceId: string, position: WorkspaceExtensionPosition): WorkspaceExtension[] {
    const list = this.extensions.get(workspaceId) || [];
    return list.filter((ext) => ext.position === position);
  }
}

export const WorkspaceExtensionRegistry = new WorkspaceExtensionRegistryImpl();
