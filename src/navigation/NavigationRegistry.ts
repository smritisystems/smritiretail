/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUNEF NavigationRegistry (Versioned Entity Manifests v3.1)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

export interface EntityManifestV3 {
  version: "3.1";
  entity: string;
  workspace: string;
  primaryKey: string;
  displayField: string;
  icon: string;
  color: string;
  permission: string;
  quickPreview: boolean;
  searchable: boolean;
  deepLink: string;
  aliases: string[];
  capabilities: {
    preview: boolean;
    workspace: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    analytics: boolean;
    timeline: boolean;
    documents: boolean;
    print: boolean;
    export: boolean;
  };
  relationships: {
    entity: string;
    type: "OneToMany" | "ManyToOne" | "OneToOne";
  }[];
  actions: {
    id: string;
    label: string;
    icon: string;
    targetTab?: string;
  }[];
}

export const ENTITY_REGISTRY_V3: Record<string, EntityManifestV3> = {
  Customer: {
    version: "3.1",
    entity: "Customer",
    workspace: "customers",
    primaryKey: "customerId",
    displayField: "customerName",
    icon: "users",
    color: "blue",
    permission: "VIEW_CUSTOMERS",
    quickPreview: true,
    searchable: true,
    deepLink: "smriti://customer/{id}",
    aliases: ["customer", "customers", "customer-master", "crm-customer", "customer360", "party", "client", "buyer"],
    capabilities: {
      preview: true, workspace: true, create: true, edit: true, delete: false,
      analytics: true, timeline: true, documents: true, print: true, export: true
    },
    relationships: [
      { entity: "SalesOrder", type: "OneToMany" },
      { entity: "SalesInvoice", type: "OneToMany" },
      { entity: "Ledger", type: "OneToMany" },
      { entity: "Loyalty", type: "OneToOne" }
    ],
    actions: [
      { id: "new-order", label: "Create Order", icon: "shopping-bag", targetTab: "pos" },
      { id: "new-invoice", label: "Create Invoice", icon: "file-text", targetTab: "sales" },
      { id: "receive-payment", label: "Receive Payment", icon: "dollar-sign", targetTab: "psv" },
      { id: "send-whatsapp", label: "Send WhatsApp", icon: "message-square" }
    ]
  },

  Supplier: {
    version: "3.1",
    entity: "Supplier",
    workspace: "supplier-mgmt",
    primaryKey: "supplierId",
    displayField: "supplierName",
    icon: "building",
    color: "purple",
    permission: "VIEW_SUPPLIERS",
    quickPreview: true,
    searchable: true,
    deepLink: "smriti://supplier/{id}",
    aliases: ["supplier", "suppliers", "supplier-mgmt", "vendor", "creditor"],
    capabilities: {
      preview: true, workspace: true, create: true, edit: true, delete: false,
      analytics: true, timeline: true, documents: true, print: true, export: true
    },
    relationships: [
      { entity: "PurchaseOrder", type: "OneToMany" },
      { entity: "Item", type: "OneToMany" },
      { entity: "Ledger", type: "OneToMany" }
    ],
    actions: [
      { id: "new-po", label: "Create PO", icon: "briefcase", targetTab: "purchase" },
      { id: "make-payment", label: "Make Payment", icon: "dollar-sign", targetTab: "psv" }
    ]
  },

  Item: {
    version: "3.1",
    entity: "Item",
    workspace: "items",
    primaryKey: "itemId",
    displayField: "itemName",
    icon: "package",
    color: "emerald",
    permission: "VIEW_ITEMS",
    quickPreview: true,
    searchable: true,
    deepLink: "smriti://item/{id}",
    aliases: ["item", "items", "item-master", "sku", "product", "barcode"],
    capabilities: {
      preview: true, workspace: true, create: true, edit: true, delete: true,
      analytics: true, timeline: true, documents: true, print: true, export: true
    },
    relationships: [
      { entity: "Supplier", type: "ManyToOne" },
      { entity: "Warehouse", type: "ManyToOne" },
      { entity: "Batch", type: "OneToMany" }
    ],
    actions: [
      { id: "print-barcode", label: "Print Barcode Labels", icon: "printer" },
      { id: "adjust-stock", label: "Adjust Stock", icon: "layers" }
    ]
  },

  Warehouse: {
    version: "3.1",
    entity: "Warehouse",
    workspace: "stock-ledger",
    primaryKey: "warehouseId",
    displayField: "warehouseName",
    icon: "warehouse",
    color: "amber",
    permission: "VIEW_STOCK",
    quickPreview: true,
    searchable: true,
    deepLink: "smriti://warehouse/{id}",
    aliases: ["warehouse", "stock-ledger", "storage", "bin"],
    capabilities: {
      preview: true, workspace: true, create: false, edit: false, delete: false,
      analytics: true, timeline: true, documents: false, print: true, export: true
    },
    relationships: [
      { entity: "Item", type: "OneToMany" }
    ],
    actions: [
      { id: "stock-transfer", label: "Stock Transfer", icon: "truck" }
    ]
  }
};
