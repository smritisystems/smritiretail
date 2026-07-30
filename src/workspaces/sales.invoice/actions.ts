import { ActionManifest } from "../../sdk/swsdk/manifests/actions.js";

export const actionManifest: ActionManifest = {
  schemaVersion: "1.0",
  workspaceId: "sales.invoice",
  actions: [
    { id: "save", label: "Save", priority: "primary", permissionRequired: "edit", shortcut: "Ctrl+S" },
    { id: "print", label: "Print", priority: "secondary", permissionRequired: "print", shortcut: "Ctrl+P" },
    { id: "export", label: "Export", priority: "overflow", permissionRequired: "export" }
  ]
};
