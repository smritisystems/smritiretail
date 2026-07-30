/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Action Declarative Manifest (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

export interface ActionMetadata {
  id: string;
  label?: string;
  icon?: string;
  priority: "primary" | "secondary" | "overflow";
  permissionRequired?: string;
  shortcut?: string;
  destructive?: boolean;
}

export interface ActionManifest {
  schemaVersion: "1.0";
  workspaceId: string;
  actions: ActionMetadata[];
}
