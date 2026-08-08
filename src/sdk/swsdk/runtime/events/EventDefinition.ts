export interface EventDefinition {
  name: string;
  version: string;
  schemaVersion: string;
  deprecated: boolean;
  replacement?: string;
  compatibility: "forward" | "backward" | "none";
}
