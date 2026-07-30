import { WorkspaceManifest } from "../../sdk/swsdk/manifests/workspace.js";

export const workspaceManifest: WorkspaceManifest = {
  schemaVersion: "1.0",
  workspaceId: "sales.invoice",
  title: "Sales Invoice",
  module: "Sales",
  icon: "receipt",
  route: "/sales/invoice",
  category: "Transactions",
  supports: {
    drafts: true,
    resume: true,
    tabs: true,
    attachments: true,
    workflow: true,
    timeline: true,
    print: true,
    export: true,
    analytics: true,
    barcode: true,
    notifications: true
  }
};
