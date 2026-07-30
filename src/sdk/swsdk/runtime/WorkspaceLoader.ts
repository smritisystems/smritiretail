/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Workspace Async Dynamic Loader (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

import { WorkspaceBundle, WorkspaceRegistry } from "./WorkspaceRegistry.js";
import { IWorkspace } from "../contracts/IWorkspace.js";

export class WorkspaceLoader {
  private static activeInstances: Map<string, IWorkspace> = new Map();

  public static async loadWorkspace(workspaceId: string): Promise<WorkspaceBundle> {
    const registry = WorkspaceRegistry.getInstance();
    const bundle = registry.getWorkspace(workspaceId);
    if (!bundle) {
      throw new Error(`[SWSDK] Workspace '${workspaceId}' is not registered in SWSDK Registry.`);
    }
    return bundle;
  }

  public static registerInstance(workspaceId: string, instance: IWorkspace): void {
    this.activeInstances.set(workspaceId, instance);
  }

  public static getInstance(workspaceId: string): IWorkspace | undefined {
    return this.activeInstances.get(workspaceId);
  }

  public static removeInstance(workspaceId: string): void {
    this.activeInstances.delete(workspaceId);
  }
}
