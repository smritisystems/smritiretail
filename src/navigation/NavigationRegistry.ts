/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUNEF NavigationRegistry (Versioned Entity Manifests v3.2 SUNEF-GOV-015)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.2.0
 */

export interface EntityManifestV3 {
  version: "3.1" | "3.2";
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
    version: "3.2",
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
    version: "3.2",
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
    version: "3.2",
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
    version: "3.2",
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
  },

  SalesOrder: {
    version: "3.2",
    entity: "SalesOrder",
    workspace: "sales",
    primaryKey: "orderId",
    displayField: "orderNo",
    icon: "shopping-bag",
    color: "blue",
    permission: "VIEW_SALES",
    quickPreview: true,
    searchable: true,
    deepLink: "smriti://order/{id}",
    aliases: ["salesorder", "order", "so"],
    capabilities: {
      preview: true, workspace: true, create: true, edit: true, delete: false,
      analytics: true, timeline: true, documents: true, print: true, export: true
    },
    relationships: [
      { entity: "Customer", type: "ManyToOne" },
      { entity: "SalesInvoice", type: "OneToMany" }
    ],
    actions: [
      { id: "convert-invoice", label: "Convert to Invoice", icon: "file-text", targetTab: "sales" }
    ]
  },

  SalesInvoice: {
    version: "3.2",
    entity: "SalesInvoice",
    workspace: "sales",
    primaryKey: "invoiceId",
    displayField: "invoiceNo",
    icon: "file-text",
    color: "emerald",
    permission: "VIEW_SALES",
    quickPreview: true,
    searchable: true,
    deepLink: "smriti://invoice/{id}",
    aliases: ["salesinvoice", "invoice", "si", "bill"],
    capabilities: {
      preview: true, workspace: true, create: true, edit: false, delete: false,
      analytics: true, timeline: true, documents: true, print: true, export: true
    },
    relationships: [
      { entity: "Customer", type: "ManyToOne" },
      { entity: "Ledger", type: "OneToMany" }
    ],
    actions: [
      { id: "print-invoice", label: "Print Invoice", icon: "printer" }
    ]
  },

  PurchaseOrder: {
    version: "3.2",
    entity: "PurchaseOrder",
    workspace: "purchase",
    primaryKey: "poId",
    displayField: "poNo",
    icon: "briefcase",
    color: "purple",
    permission: "VIEW_PURCHASE",
    quickPreview: true,
    searchable: true,
    deepLink: "smriti://po/{id}",
    aliases: ["purchaseorder", "po"],
    capabilities: {
      preview: true, workspace: true, create: true, edit: true, delete: false,
      analytics: true, timeline: true, documents: true, print: true, export: true
    },
    relationships: [
      { entity: "Supplier", type: "ManyToOne" },
      { entity: "GRN", type: "OneToMany" }
    ],
    actions: [
      { id: "create-grn", label: "Create GRN", icon: "truck", targetTab: "purchase" }
    ]
  },

  Ledger: {
    version: "3.2",
    entity: "Ledger",
    workspace: "psv",
    primaryKey: "ledgerId",
    displayField: "voucherNo",
    icon: "book-open",
    color: "cyan",
    permission: "VIEW_ACCOUNTS",
    quickPreview: true,
    searchable: true,
    deepLink: "smriti://ledger/{id}",
    aliases: ["ledger", "financial-ledger", "journal", "voucher"],
    capabilities: {
      preview: true, workspace: true, create: false, edit: false, delete: false,
      analytics: true, timeline: true, documents: true, print: true, export: true
    },
    relationships: [
      { entity: "Customer", type: "ManyToOne" },
      { entity: "Supplier", type: "ManyToOne" }
    ],
    actions: [
      { id: "print-voucher", label: "Print Voucher", icon: "printer" }
    ]
  },

  Identity: {
    version: "3.2",
    entity: "Identity",
    workspace: "staff-management",
    primaryKey: "id",
    displayField: "fullName",
    icon: "user",
    color: "emerald",
    permission: "VIEW_USERS",
    quickPreview: true,
    searchable: true,
    deepLink: "smriti://identity/{id}",
    aliases: ["identity", "staff", "users", "user-rbac", "rbac", "staff-management", "person"],
    capabilities: {
      preview: true, workspace: true, create: true, edit: true, delete: false,
      analytics: true, timeline: true, documents: true, print: true, export: true
    },
    relationships: [],
    actions: []
  }
};
