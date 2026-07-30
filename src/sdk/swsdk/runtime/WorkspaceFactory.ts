/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Workspace Factory Service (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

import { WorkspaceBundle } from "./WorkspaceRegistry.js";
import { IWorkspace } from "../contracts/IWorkspace.js";
import { IWorkspaceContext } from "../contracts/IWorkspaceContext.js";

export class WorkspaceFactory {
  public static async createAndInitialize(
    bundle: WorkspaceBundle,
    context: IWorkspaceContext,
    instanceConstructor: new (bundle: WorkspaceBundle) => IWorkspace
  ): Promise<IWorkspace> {
    const workspace = new instanceConstructor(bundle);
    await workspace.initialize(context);
    return workspace;
  }
}
