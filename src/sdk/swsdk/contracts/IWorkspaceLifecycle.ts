/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Workspace Lifecycle Interface (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

import { IWorkspaceContext } from "./IWorkspaceContext.js";

export interface IWorkspaceLifecycle {
  initialize(context: IWorkspaceContext): Promise<void>;
  mount(containerElement: HTMLElement | null): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  saveState(): Promise<Record<string, unknown>>;
  restoreState(state: Record<string, unknown>): Promise<void>;
  refresh(): Promise<void>;
  validate(): Promise<{ valid: boolean; errors?: string[] }>;
  beforeClose(): Promise<boolean>;
  canClose(): boolean;
  close(): Promise<void>;
  destroy(): Promise<void>;
}
