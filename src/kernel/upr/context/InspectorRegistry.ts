/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Inspector Registry
 * Standard     : UCIF-002 (Schema Rule — FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * KND-001: Pure service — no React, no DOM.
 *
 * UCIF-002: No component hardcodes inspector fields.
 *           All inspector structure comes from this registry.
 *
 * Backs DrillDownSDK.register360Inspector() and registerInspectorSection().
 *
 * Supports:
 *   - Multiple InspectorConfig per entity (one per variant)
 *   - Custom React component overrides per entity
 *   - VS Code-style plugin section injection
 *   - Semver version compatibility checks
 *
 * Seeded defaults:
 *   customer  → preview, compact, full
 *   product   → preview, compact, stock, pricing, full
 *   supplier  → preview, compact, full
 *   invoice   → preview, compact, full
 *   warehouse → preview, compact
 *   batch     → preview, compact
 *   serial    → preview, compact
 */

import type {
  InspectorConfig,
  InspectorSectionDef,
  InspectorVariant,
  InspectorCapabilities,
} from "./InspectorSchema.js";

// ── Default Capability Sets ───────────────────────────────────────────────────

const NO_CAPS: InspectorCapabilities = {
  ai: false, timeline: false, attachments: false, audit: false,
  stock: false, pricing: false, workflow: false, relations: false,
};

const CUSTOMER_CAPS: InspectorCapabilities = {
  ai: true, timeline: true, attachments: false, audit: true,
  stock: false, pricing: false, workflow: true, relations: true,
};

const PRODUCT_CAPS: InspectorCapabilities = {
  ai: true, timeline: true, attachments: true, audit: true,
  stock: true, pricing: true, workflow: false, relations: true,
};

const SUPPLIER_CAPS: InspectorCapabilities = {
  ai: true, timeline: true, attachments: false, audit: true,
  stock: false, pricing: false, workflow: true, relations: true,
};

const INVOICE_CAPS: InspectorCapabilities = {
  ai: false, timeline: true, attachments: true, audit: true,
  stock: false, pricing: false, workflow: true, relations: true,
};

const WAREHOUSE_CAPS: InspectorCapabilities = {
  ai: false, timeline: false, attachments: false, audit: false,
  stock: true, pricing: false, workflow: false, relations: true,
};

const BATCH_CAPS: InspectorCapabilities = {
  ai: false, timeline: false, attachments: false, audit: false,
  stock: true, pricing: false, workflow: false, relations: false,
};

// ── Default Inspector Configs ─────────────────────────────────────────────────

const DEFAULT_CONFIGS: InspectorConfig[] = [

  // ── CUSTOMER ──────────────────────────────────────────────────────────────

  {
    entityType: "customer", variant: "preview", version: "1.0.0",
    capabilities: { ...NO_CAPS, relations: true },
    titleField: "name", subtitleField: "code", badgeField: "loyalty_tier",
    sections: [
      { id: "preview_core", title: "Customer", fields: [
        { key: "mobile", label: "Mobile", format: "phone", icon: "phone" },
        { key: "outstanding", label: "Outstanding", format: "currency", highlight: true },
        { key: "credit_limit", label: "Credit Limit", format: "currency" },
      ]},
    ],
    actions: [{ id: "open_inspector", label: "Full Inspector", icon: "expand", workspaceActionId: "inspect_context" }],
  },

  {
    entityType: "customer", variant: "compact", version: "1.0.0",
    capabilities: CUSTOMER_CAPS,
    titleField: "name", subtitleField: "code", badgeField: "loyalty_tier",
    sections: [
      { id: "contact", title: "Contact & Identity", icon: "user", fields: [
        { key: "mobile", label: "Mobile", format: "phone", icon: "phone" },
        { key: "email", label: "Email", format: "link", icon: "mail" },
        { key: "gst", label: "GSTIN", format: "text", icon: "file-text" },
        { key: "address", label: "Address", format: "text", icon: "map-pin" },
      ]},
      { id: "financials", title: "Financials", icon: "indian-rupee", fields: [
        { key: "outstanding", label: "Outstanding", format: "currency", highlight: true },
        { key: "credit_limit", label: "Credit Limit", format: "currency" },
        { key: "last_invoice_date", label: "Last Invoice", format: "date",
          drillable: true, drillEntityType: "invoice", drillEntityIdField: "last_invoice_id" },
        { key: "loyalty_points", label: "Loyalty Points", format: "text", icon: "star" },
      ]},
      { id: "assignment", title: "Assignment", icon: "users", fields: [
        { key: "salesman_name", label: "Salesman",
          drillable: true, drillEntityType: "salesperson", drillEntityIdField: "salesman_id" },
        { key: "route", label: "Route", format: "text" },
      ]},
    ],
    actions: [
      { id: "open_full", label: "360° View", icon: "expand", workspaceActionId: "inspect_context_full" },
      { id: "whatsapp", label: "WhatsApp", icon: "message-circle", workspaceActionId: "contact_whatsapp" },
    ],
    aiSkillId: "ai.customer_insights",
  },

  {
    entityType: "customer", variant: "full", version: "1.0.0",
    capabilities: CUSTOMER_CAPS,
    titleField: "name", subtitleField: "code", badgeField: "loyalty_tier",
    sections: [
      { id: "contact", title: "Contact & Identity", icon: "user", fields: [
        { key: "mobile", label: "Mobile", format: "phone", icon: "phone" },
        { key: "email", label: "Email", format: "link" },
        { key: "gst", label: "GSTIN", format: "text" },
        { key: "address", label: "Address", format: "text" },
      ]},
      { id: "financials", title: "Financials", icon: "indian-rupee", fields: [
        { key: "outstanding", label: "Outstanding", format: "currency", highlight: true },
        { key: "credit_limit", label: "Credit Limit", format: "currency" },
        { key: "last_invoice_date", label: "Last Invoice", format: "date",
          drillable: true, drillEntityType: "invoice", drillEntityIdField: "last_invoice_id" },
        { key: "last_payment_date", label: "Last Payment", format: "date" },
        { key: "loyalty_points", label: "Loyalty Points", format: "text" },
      ]},
      { id: "assignment", title: "Assignment", icon: "users", fields: [
        { key: "salesman_name", label: "Salesman", drillable: true, drillEntityType: "salesperson", drillEntityIdField: "salesman_id" },
        { key: "route", label: "Route", format: "text" },
        { key: "customer_group", label: "Group", format: "text" },
      ]},
      { id: "timeline", title: "Recent Activity", icon: "clock", requiresCapability: "timeline",
        dataKey: "timeline", collapsible: true, fields: [] },
    ],
    actions: [
      { id: "open_workspace", label: "Open Workspace", icon: "external-link", workspaceActionId: "open_entity_workspace" },
    ],
    aiSkillId: "ai.customer_insights",
  },

  // ── PRODUCT / ITEM ─────────────────────────────────────────────────────────

  {
    entityType: "product", variant: "preview", version: "1.0.0",
    capabilities: { ...NO_CAPS, stock: true },
    showImage: true, imageField: "image_url",
    titleField: "name", subtitleField: "code", badgeField: "category",
    sections: [
      { id: "preview_core", title: "Item", fields: [
        { key: "brand", label: "Brand", format: "text" },
        { key: "rsp", label: "Price", format: "currency", highlight: true },
        { key: "available_stock", label: "Stock", format: "text", icon: "package" },
      ]},
    ],
    actions: [{ id: "open_inspector", label: "Inspect", icon: "expand", workspaceActionId: "inspect_context" }],
  },

  {
    entityType: "product", variant: "compact", version: "1.0.0",
    capabilities: PRODUCT_CAPS,
    showImage: true, imageField: "image_url",
    titleField: "name", subtitleField: "code", badgeField: "category",
    sections: [
      { id: "identity", title: "Identity", icon: "tag", fields: [
        { key: "barcode", label: "Barcode", format: "text", icon: "scan-barcode" },
        { key: "brand", label: "Brand", format: "text" },
        { key: "category", label: "Category", format: "text" },
        { key: "color", label: "Color", format: "badge" },
        { key: "size", label: "Size", format: "badge" },
      ]},
      { id: "stock", title: "Stock", icon: "package", requiresCapability: "stock",
        dataKey: "stock", fields: [
        { key: "available_stock", label: "Available", format: "text", highlight: true },
        { key: "reserved_stock", label: "Reserved", format: "text" },
        { key: "warehouse_name", label: "Warehouse",
          drillable: true, drillEntityType: "warehouse", drillEntityIdField: "warehouse_id" },
      ]},
      { id: "pricing", title: "Pricing", icon: "indian-rupee", requiresCapability: "pricing", fields: [
        { key: "mrp", label: "MRP", format: "currency" },
        { key: "rsp", label: "Sale Price", format: "currency", highlight: true },
        { key: "cost_price", label: "Cost", format: "currency" },
      ]},
    ],
    actions: [
      { id: "open_full", label: "360° View", icon: "expand", workspaceActionId: "inspect_context_full" },
      { id: "print_label", label: "Print Label", icon: "printer", workspaceActionId: "print_barcode_label" },
    ],
    aiSkillId: "ai.reorder_recommendation",
  },

  {
    entityType: "product", variant: "stock", version: "1.0.0",
    capabilities: { ...NO_CAPS, stock: true, relations: true },
    titleField: "name", subtitleField: "code",
    sections: [
      { id: "stock_detail", title: "Stock Details", icon: "package", dataKey: "stock", fields: [
        { key: "available_stock", label: "Available", format: "text", highlight: true },
        { key: "reserved_stock", label: "Reserved", format: "text" },
        { key: "reorder_level", label: "Reorder Level", format: "text" },
        { key: "warehouse_name", label: "Warehouse", drillable: true, drillEntityType: "warehouse", drillEntityIdField: "warehouse_id" },
        { key: "last_purchase_date", label: "Last Purchase", format: "date" },
        { key: "last_sale_date", label: "Last Sale", format: "date" },
      ]},
    ],
    actions: [],
  },

  {
    entityType: "product", variant: "pricing", version: "1.0.0",
    capabilities: { ...NO_CAPS, pricing: true },
    titleField: "name", subtitleField: "code",
    sections: [
      { id: "pricing_detail", title: "Pricing & Margins", icon: "indian-rupee", fields: [
        { key: "mrp", label: "MRP", format: "currency" },
        { key: "rsp", label: "Sale Price", format: "currency", highlight: true },
        { key: "cost_price", label: "Cost Price", format: "currency" },
        { key: "hsn", label: "HSN Code", format: "text" },
        { key: "gst_rate", label: "GST %", format: "text" },
      ]},
    ],
    actions: [],
  },

  {
    entityType: "product", variant: "full", version: "1.0.0",
    capabilities: PRODUCT_CAPS,
    showImage: true, imageField: "image_url",
    titleField: "name", subtitleField: "code", badgeField: "category",
    sections: [
      { id: "identity", title: "Identity", icon: "tag", fields: [
        { key: "barcode", label: "Barcode", format: "text" },
        { key: "brand", label: "Brand" }, { key: "category", label: "Category" },
        { key: "color", label: "Color", format: "badge" }, { key: "size", label: "Size", format: "badge" },
      ]},
      { id: "stock", title: "Stock", icon: "package", requiresCapability: "stock", dataKey: "stock", fields: [
        { key: "available_stock", label: "Available", highlight: true }, { key: "reserved_stock", label: "Reserved" },
        { key: "warehouse_name", label: "Warehouse", drillable: true, drillEntityType: "warehouse", drillEntityIdField: "warehouse_id" },
        { key: "last_purchase_date", label: "Last Purchase", format: "date" }, { key: "last_sale_date", label: "Last Sale", format: "date" },
      ]},
      { id: "pricing", title: "Pricing", icon: "indian-rupee", requiresCapability: "pricing", fields: [
        { key: "mrp", label: "MRP", format: "currency" }, { key: "rsp", label: "Sale Price", format: "currency", highlight: true },
        { key: "cost_price", label: "Cost", format: "currency" }, { key: "hsn", label: "HSN" },
      ]},
      { id: "supplier", title: "Supplier", icon: "truck", fields: [
        { key: "supplier_name", label: "Primary Supplier", drillable: true, drillEntityType: "supplier", drillEntityIdField: "supplier_id" },
      ]},
    ],
    actions: [
      { id: "open_workspace", label: "Open Workspace", icon: "external-link", workspaceActionId: "open_entity_workspace" },
      { id: "print_label", label: "Print Label", icon: "printer", workspaceActionId: "print_barcode_label" },
    ],
    aiSkillId: "ai.reorder_recommendation",
  },

  // ── SUPPLIER ──────────────────────────────────────────────────────────────

  {
    entityType: "supplier", variant: "preview", version: "1.0.0",
    capabilities: NO_CAPS,
    titleField: "name", subtitleField: "gst",
    sections: [
      { id: "preview_core", title: "Supplier", fields: [
        { key: "outstanding", label: "Outstanding", format: "currency", highlight: true },
        { key: "payment_terms", label: "Terms", format: "text" },
      ]},
    ],
    actions: [{ id: "open_inspector", label: "Inspect", icon: "expand", workspaceActionId: "inspect_context" }],
  },

  {
    entityType: "supplier", variant: "compact", version: "1.0.0",
    capabilities: SUPPLIER_CAPS,
    titleField: "name", subtitleField: "gst",
    sections: [
      { id: "identity", title: "Identity", icon: "building-2", fields: [
        { key: "gst", label: "GSTIN", format: "text" },
        { key: "contact", label: "Contact", format: "phone" },
        { key: "payment_terms", label: "Payment Terms", format: "text" },
      ]},
      { id: "financials", title: "Financials", icon: "indian-rupee", fields: [
        { key: "outstanding", label: "Outstanding", format: "currency", highlight: true },
        { key: "last_purchase_date", label: "Last Purchase", format: "date" },
        { key: "pending_po", label: "Pending PO", format: "text" },
        { key: "pending_grn", label: "Pending GRN", format: "text" },
      ]},
    ],
    actions: [{ id: "open_full", label: "360° View", icon: "expand", workspaceActionId: "inspect_context_full" }],
    aiSkillId: "ai.supplier_insights",
  },

  {
    entityType: "supplier", variant: "full", version: "1.0.0",
    capabilities: SUPPLIER_CAPS,
    titleField: "name", subtitleField: "gst",
    sections: [
      { id: "identity", title: "Identity", icon: "building-2", fields: [
        { key: "gst", label: "GSTIN" }, { key: "contact", label: "Contact", format: "phone" },
        { key: "payment_terms", label: "Terms" }, { key: "address", label: "Address" },
      ]},
      { id: "financials", title: "Financials", icon: "indian-rupee", fields: [
        { key: "outstanding", label: "Outstanding", format: "currency", highlight: true },
        { key: "last_purchase_date", label: "Last Purchase", format: "date" },
        { key: "pending_po", label: "Pending PO" }, { key: "pending_grn", label: "Pending GRN" },
      ]},
    ],
    actions: [{ id: "open_workspace", label: "Open Workspace", icon: "external-link", workspaceActionId: "open_entity_workspace" }],
  },

  // ── INVOICE ──────────────────────────────────────────────────────────────

  {
    entityType: "invoice", variant: "preview", version: "1.0.0",
    capabilities: NO_CAPS,
    titleField: "invoice_no", subtitleField: "customer_name", badgeField: "payment_status",
    sections: [
      { id: "preview_core", title: "Invoice", fields: [
        { key: "grand_total", label: "Amount", format: "currency", highlight: true },
        { key: "date", label: "Date", format: "date" },
      ]},
    ],
    actions: [{ id: "open_inspector", label: "Inspect", icon: "expand", workspaceActionId: "inspect_context" }],
  },

  {
    entityType: "invoice", variant: "compact", version: "1.0.0",
    capabilities: INVOICE_CAPS,
    titleField: "invoice_no", subtitleField: "customer_name", badgeField: "payment_status",
    sections: [
      { id: "details", title: "Invoice Details", icon: "receipt", fields: [
        { key: "customer_name", label: "Customer", drillable: true, drillEntityType: "customer", drillEntityIdField: "customer_id" },
        { key: "date", label: "Date", format: "date" },
        { key: "grand_total", label: "Amount", format: "currency", highlight: true },
        { key: "payment_status", label: "Payment", format: "badge" },
        { key: "print_status", label: "Print", format: "badge" },
        { key: "returns", label: "Returns", format: "text" },
      ]},
    ],
    actions: [
      { id: "open_full", label: "360° View", icon: "expand", workspaceActionId: "inspect_context_full" },
      { id: "print_invoice", label: "Print", icon: "printer", workspaceActionId: "print_invoice" },
    ],
  },

  {
    entityType: "invoice", variant: "full", version: "1.0.0",
    capabilities: INVOICE_CAPS,
    titleField: "invoice_no", subtitleField: "customer_name", badgeField: "payment_status",
    sections: [
      { id: "details", title: "Invoice Details", icon: "receipt", fields: [
        { key: "customer_name", label: "Customer", drillable: true, drillEntityType: "customer", drillEntityIdField: "customer_id" },
        { key: "date", label: "Date", format: "date" },
        { key: "grand_total", label: "Amount", format: "currency", highlight: true },
        { key: "payment_status", label: "Payment", format: "badge" },
        { key: "returns", label: "Returns" },
      ]},
      { id: "timeline", title: "Timeline", icon: "clock", requiresCapability: "timeline", dataKey: "timeline", collapsible: true, fields: [] },
    ],
    actions: [{ id: "open_workspace", label: "Open Workspace", icon: "external-link", workspaceActionId: "open_entity_workspace" }],
  },

  // ── WAREHOUSE ────────────────────────────────────────────────────────────

  {
    entityType: "warehouse", variant: "preview", version: "1.0.0",
    capabilities: NO_CAPS,
    titleField: "name", subtitleField: "location",
    sections: [
      { id: "preview_core", title: "Warehouse", fields: [
        { key: "used_capacity", label: "Used", format: "text" },
        { key: "capacity", label: "Capacity", format: "text" },
      ]},
    ],
    actions: [],
  },

  {
    entityType: "warehouse", variant: "compact", version: "1.0.0",
    capabilities: WAREHOUSE_CAPS,
    titleField: "name", subtitleField: "location",
    sections: [
      { id: "details", title: "Warehouse Details", icon: "warehouse", fields: [
        { key: "location", label: "Location", format: "text" },
        { key: "capacity", label: "Total Capacity", format: "text" },
        { key: "used_capacity", label: "Used Capacity", format: "text", highlight: true },
      ]},
    ],
    actions: [],
  },

  // ── BATCH ─────────────────────────────────────────────────────────────────

  {
    entityType: "batch", variant: "preview", version: "1.0.0",
    capabilities: NO_CAPS,
    titleField: "batch_no", subtitleField: "expiry_date",
    sections: [
      { id: "preview_core", title: "Batch", fields: [
        { key: "quantity", label: "Qty", format: "text", highlight: true },
        { key: "expiry_date", label: "Expiry", format: "date" },
      ]},
    ],
    actions: [],
  },

  {
    entityType: "batch", variant: "compact", version: "1.0.0",
    capabilities: BATCH_CAPS,
    titleField: "batch_no", subtitleField: "expiry_date",
    sections: [
      { id: "details", title: "Batch Details", icon: "layers", fields: [
        { key: "batch_no", label: "Batch No.", format: "text" },
        { key: "mfg_date", label: "Mfg. Date", format: "date" },
        { key: "expiry_date", label: "Expiry", format: "date", highlight: true },
        { key: "quantity", label: "Quantity", format: "text" },
        { key: "warehouse", label: "Warehouse", drillable: true, drillEntityType: "warehouse", drillEntityIdField: "warehouse_id" },
      ]},
    ],
    actions: [],
  },

  // ── SERIAL ────────────────────────────────────────────────────────────────

  {
    entityType: "serial", variant: "preview", version: "1.0.0",
    capabilities: NO_CAPS,
    titleField: "serial_no", subtitleField: "status",
    sections: [
      { id: "preview_core", title: "Serial", fields: [
        { key: "warranty_expiry", label: "Warranty", format: "date" },
        { key: "status", label: "Status", format: "badge" },
      ]},
    ],
    actions: [],
  },

  {
    entityType: "serial", variant: "compact", version: "1.0.0",
    capabilities: { ...NO_CAPS, relations: true },
    titleField: "serial_no", subtitleField: "status",
    sections: [
      { id: "details", title: "Serial Details", icon: "hash", fields: [
        { key: "warranty_expiry", label: "Warranty Expiry", format: "date", highlight: true },
        { key: "customer_name", label: "Customer", drillable: true, drillEntityType: "customer", drillEntityIdField: "customer_id" },
        { key: "invoice_no", label: "Invoice", drillable: true, drillEntityType: "invoice", drillEntityIdField: "invoice_id" },
        { key: "status", label: "Status", format: "badge" },
      ]},
    ],
    actions: [],
  },
];

// ── Registry Service ──────────────────────────────────────────────────────────

class InspectorRegistryService {
  private static instance: InspectorRegistryService | null = null;

  /** entityType → variant → InspectorConfig */
  private configs: Map<string, Map<string, InspectorConfig>> = new Map();

  /** entityType → custom React component (from register360Inspector) */
  private componentOverrides: Map<string, any> = new Map();

  /** entityType → injected plugin sections */
  private pluginSections: Map<string, InspectorSectionDef[]> = new Map();

  private constructor() {
    DEFAULT_CONFIGS.forEach((c) => this.registerConfig(c));
  }

  public static getInstance(): InspectorRegistryService {
    if (!InspectorRegistryService.instance) {
      InspectorRegistryService.instance = new InspectorRegistryService();
    }
    return InspectorRegistryService.instance;
  }

  // ── Registration ───────────────────────────────────────────────────────────

  public registerConfig(config: InspectorConfig): void {
    const et = config.entityType.toLowerCase();
    if (!this.configs.has(et)) this.configs.set(et, new Map());
    this.configs.get(et)!.set(config.variant, Object.freeze({ ...config }));
  }

  /** Backs DrillDownSDK.register360Inspector() */
  public registerComponent(entityType: string, component: any): void {
    this.componentOverrides.set(entityType.toLowerCase(), component);
  }

  /** Backs DrillDownSDK.registerInspectorSection() — VS Code-style plugin injection */
  public registerSection(entityType: string, section: InspectorSectionDef): void {
    const et = entityType.toLowerCase();
    const existing = this.pluginSections.get(et) || [];
    // Prevent duplicate section IDs
    const deduped = existing.filter((s) => s.id !== section.id);
    this.pluginSections.set(et, [...deduped, section]);
  }

  // ── Resolution ─────────────────────────────────────────────────────────────

  /**
   * Resolve InspectorConfig for an entity+variant.
   * Falls back: requested variant → "compact" → first available.
   * Optional semver requiredVersion for plugin compatibility.
   */
  public resolveConfig(
    entityType: string,
    variant?: InspectorVariant,
    _requiredVersion?: string
  ): InspectorConfig | undefined {
    const et = entityType.toLowerCase();
    const entityConfigs = this.configs.get(et);
    if (!entityConfigs) return undefined;

    const target = variant || "compact";
    return (
      entityConfigs.get(target) ||
      entityConfigs.get("compact") ||
      Array.from(entityConfigs.values())[0]
    );
  }

  /** Returns a registered custom component override, if any */
  public resolveComponent(entityType: string): any | undefined {
    return this.componentOverrides.get(entityType.toLowerCase());
  }

  /** Returns all plugin-injected sections for an entity */
  public getPluginSections(entityType: string): InspectorSectionDef[] {
    return this.pluginSections.get(entityType.toLowerCase()) || [];
  }

  /** Returns all available variants for an entity */
  public getVariants(entityType: string): InspectorVariant[] {
    return Array.from(this.configs.get(entityType.toLowerCase())?.keys() || []);
  }

  /** Returns all registered entity types */
  public getRegisteredEntityTypes(): string[] {
    return Array.from(this.configs.keys());
  }

  /** For tests: check if entity has at least one config */
  public hasEntity(entityType: string): boolean {
    return this.configs.has(entityType.toLowerCase());
  }
}

export const InspectorRegistry = InspectorRegistryService.getInstance();
export { InspectorRegistryService };
