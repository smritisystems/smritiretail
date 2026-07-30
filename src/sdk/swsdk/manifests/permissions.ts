/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Permission Declarative Manifest (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

export type StandardPermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "cancel"
  | "close"
  | "reopen"
  | "print"
  | "printLabels"
  | "export"
  | "import"
  | "share";

export interface PermissionDeclaration {
  action: StandardPermissionAction;
  code: string;
  description: string;
}

export interface PermissionManifest {
  schemaVersion: "1.0";
  workspaceId: string;
  permissions: PermissionDeclaration[];
}
