/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : Event Declarative Manifest (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

export interface EventDeclaration {
  eventType: string;
  payloadType: string;
  description: string;
}

export interface EventManifest {
  schemaVersion: "1.0";
  workspaceId: string;
  eventsEmitted: EventDeclaration[];
  eventsSubscribed: string[];
}
