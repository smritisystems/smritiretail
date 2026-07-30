import { PermissionManifest } from "../../sdk/swsdk/manifests/permissions.js";

export const permissionManifest: PermissionManifest = {
  schemaVersion: "1.0",
  workspaceId: "sales.invoice",
  permissions: [
    { action: "view", code: "SALES.INVOICE.VIEW", description: "View SalesInvoice" },
    { action: "create", code: "SALES.INVOICE.CREATE", description: "Create SalesInvoice" },
    { action: "edit", code: "SALES.INVOICE.EDIT", description: "Edit SalesInvoice" },
    { action: "print", code: "SALES.INVOICE.PRINT", description: "Print SalesInvoice" }
  ]
};
