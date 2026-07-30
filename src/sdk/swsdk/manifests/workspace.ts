/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Workspace Declarative Manifest (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

export interface WorkspaceManifest {
  schemaVersion: "1.0";
  workspaceId: string;
  title: string;
  module: string;
  icon: string;
  route: string;
  category: "Transactions" | "Masters" | "Analytics" | "Setup" | "Operations";
  supports: {
    drafts: boolean;
    resume: boolean;
    tabs: boolean;
    attachments: boolean;
    workflow: boolean;
    timeline: boolean;
    print: boolean;
    export: boolean;
    analytics: boolean;
    barcode: boolean;
    notifications: boolean;
  };
}
