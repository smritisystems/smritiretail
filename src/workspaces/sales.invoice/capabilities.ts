import { CapabilityManifest } from "../../sdk/swsdk/manifests/capabilities.js";

export const capabilityManifest: CapabilityManifest = {
  schemaVersion: "1.0",
  workspaceId: "sales.invoice",
  capabilities: ["draft", "resume", "printing", "workflow", "timeline", "audit"]
};
