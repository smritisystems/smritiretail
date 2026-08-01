export interface NotificationDefinition {
  id: string;
  code: string;
  category: string;
  priority: "low" | "normal" | "high";
  channels: string[];
  requiredCapabilities: string[];
  templateVersion: string;
  schemaVersion: string;
}
