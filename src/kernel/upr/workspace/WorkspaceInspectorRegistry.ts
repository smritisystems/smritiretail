/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Standard     : SCS-WIN-001 (Workspace Inspector Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 */

import React from "react";

export interface WorkspaceInspectorTab {
  id: string;
  workspaceId: string;
  title: string;
  iconName?: string;
  order?: number;
  isPrimary?: boolean; // Primary tabs remain expanded, secondary tabs collapsed in progressive disclosure
  component: React.ComponentType<any>;
}

class WorkspaceInspectorRegistryImpl {
  private tabs: Map<string, WorkspaceInspectorTab[]> = new Map();

  registerTab(tab: WorkspaceInspectorTab): void {
    const list = this.tabs.get(tab.workspaceId) || [];
    // Replace if exists
    const idx = list.findIndex((t) => t.id === tab.id);
    if (idx >= 0) {
      list[idx] = tab;
    } else {
      list.push(tab);
    }
    list.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
    this.tabs.set(tab.workspaceId, list);
  }

  getTabs(workspaceId: string): WorkspaceInspectorTab[] {
    return this.tabs.get(workspaceId) || [];
  }
}

export const WorkspaceInspectorRegistry = new WorkspaceInspectorRegistryImpl();
