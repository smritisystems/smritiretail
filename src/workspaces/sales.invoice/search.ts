import { SearchManifest } from "../../sdk/swsdk/manifests/search.js";

export const searchManifest: SearchManifest = {
  schemaVersion: "1.0",
  workspaceId: "sales.invoice",
  providers: ["items", "customers", "invoices"],
  priority: { items: 100, customers: 80, invoices: 90 },
  commands: [
    { id: "new-sales.invoice", label: "New SalesInvoice", action: "/sales/invoice/new", icon: "plus" }
  ]
};
