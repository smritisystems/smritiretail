/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Search Declarative Manifest (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

export interface SearchCommand {
  id: string;
  label: string;
  action: string;
  icon?: string;
}

export interface SearchManifest {
  schemaVersion: "1.0";
  workspaceId: string;
  providers: string[];
  priority: Record<string, number>;
  commands: SearchCommand[];
}
