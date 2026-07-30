/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Capability Declarative Manifest (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

export type StandardCapability = 
  | "draft"
  | "resume"
  | "timeline"
  | "attachments"
  | "workflow"
  | "barcode"
  | "printing"
  | "approval"
  | "analytics"
  | "audit"
  | "notes"
  | "comments"
  | "aiAssistant";

export interface CapabilityManifest {
  schemaVersion: "1.0";
  workspaceId: string;
  capabilities: readonly StandardCapability[];
}
