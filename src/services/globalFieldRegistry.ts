export type GlobalFieldEntity = "item" | "customer" | "supplier" | "staff" | "invoice" | "warehouse" | "general";
/**
 * LookupGroup — aligned with the canonical F2 LOOKUP_REGISTRY entity domain (22 entities).
 * "product" is a deprecated legacy alias; canonical mapping is "variant" (/api/v1/variants).
 * "product" MUST NOT be used for new field definitions; use "variant" instead.
 */
export type LookupGroup =
  // Canonical product-domain entities (Gate 11E)
  | "variant"        // /api/v1/variants  — canonical physical SKU (replaces deprecated "product")
  | "item"           // /api/v1/items     — parent catalog/style
  | "item_barcode"   // /api/v1/item-barcodes
  // Master data
  | "customer"
  | "supplier"
  | "staff"
  | "hsn"
  | "uom"
  | "brand"
  | "color"
  | "size"
  | "article"
  | "department"
  | "section"
  | "fabric"
  | "fit"
  | "category"
  | "season"
  | "scheme"
  | "terms"
  | "store"
  | "classification"
  | "invoice"
  | "warehouse"
  // Non-resolvable
  | "general"
  // Deprecated legacy alias — do NOT use for new field definitions
  | "product";
export type FieldDataType = "text" | "number" | "currency" | "date" | "select";

export interface GlobalFieldDef {
  id: string;
  entity: GlobalFieldEntity;
  fieldKey: string;
  label: string;
  dataType: FieldDataType;
  required: boolean;
  aliases: string[];
  lookupGroup?: LookupGroup;
  sourceTable?: string;
  displayWidthPct?: number;
  active: boolean;
  description?: string;
}

export interface GlobalFieldLookupRule {
  lookupGroup: LookupGroup;
  /**
   * FastAPI endpoint path relative to /api/v1.
   * MANDATORY: Must reference canonical Gate-11E endpoints only.
   * /api/v1/products MUST NOT appear here; use /variants, /items, or /item-barcodes.
   */
  endpoint: string;
  searchFields: string[];
  insertValueKeys: string[];
  suggestOnF2: boolean;
  matchPriority: number;
  defaultLimit?: number;
}

export interface ScreenFieldConfig {
  screenId: string;
  entity: GlobalFieldEntity;
  fieldKey: string;
  visible: boolean;
  displayOrder: number;
  widthPct?: number;
  requiredInScreen?: boolean;
  overrideLabel?: string;
}

export interface BrowseColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  align?: "left" | "right" | "center";
  width?: string;
}

export const GLOBAL_FIELD_CATALOG: GlobalFieldDef[] = [
  {
    id: "item_code",
    entity: "item",
    fieldKey: "item_code",
    label: "Stock No / SKU",
    dataType: "text",
    required: true,
    aliases: ["sku", "stock no", "item code", "item no", "product code", "style code", "article no"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 12,
    active: true,
    description: "Unique product code used across sales, stock, and purchase flows."
  },
  {
    id: "barcode",
    entity: "item",
    fieldKey: "barcode",
    label: "Barcode",
    dataType: "text",
    required: true,
    aliases: ["barcode", "ean", "upc", "scan code", "scanner code"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 14,
    active: true,
    description: "Primary barcode used for item scans and lookups."
  },
  {
    id: "product_name",
    entity: "item",
    fieldKey: "product_name",
    label: "Product Name",
    dataType: "text",
    required: true,
    aliases: ["item name", "product", "description", "name"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 20,
    active: true,
    description: "Display label for the item in sales, stock, and master records."
  },
  {
    id: "brand",
    entity: "item",
    fieldKey: "brand",
    label: "Brand",
    dataType: "text",
    required: false,
    aliases: ["brand", "manufacturer", "label"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 10,
    active: true,
    description: "Brand or manufacturer associated with the item."
  },
  {
    id: "category",
    entity: "item",
    fieldKey: "category",
    label: "Category",
    dataType: "text",
    required: false,
    aliases: ["category", "department", "group"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 10,
    active: true,
    description: "Primary category classification for the item."
  },
  {
    id: "sub_category",
    entity: "item",
    fieldKey: "sub_category",
    label: "Sub Category",
    dataType: "text",
    required: false,
    aliases: ["sub category", "subcategory", "segment"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 10,
    active: true,
    description: "Secondary product classification."
  },
  {
    id: "color",
    entity: "item",
    fieldKey: "color",
    label: "Color",
    dataType: "text",
    required: false,
    aliases: ["color", "colour", "shade", "colorway"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 9,
    active: true,
    description: "Item color or shade."
  },
  {
    id: "size",
    entity: "item",
    fieldKey: "size",
    label: "Size",
    dataType: "text",
    required: false,
    aliases: ["size", "waist", "fit"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 8,
    active: true,
    description: "Size variant for the item."
  },
  {
    id: "mrp",
    entity: "item",
    fieldKey: "mrp",
    label: "MRP",
    dataType: "currency",
    required: false,
    aliases: ["mrp", "list price", "max retail price"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 10,
    active: true,
    description: "Maximum retail price."
  },
  {
    id: "selling_price",
    entity: "item",
    fieldKey: "selling_price",
    label: "Selling Price",
    dataType: "currency",
    required: true,
    aliases: ["selling price", "sale price", "rate", "sp"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 10,
    active: true,
    description: "Active selling price for invoice and POS operations."
  },
  {
    id: "cost_price",
    entity: "item",
    fieldKey: "cost_price",
    label: "Cost Price",
    dataType: "currency",
    required: false,
    aliases: ["cost price", "purchase price", "cp"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 10,
    active: true,
    description: "Purchase or acquisition cost."
  },
  {
    id: "hsn_code",
    entity: "item",
    fieldKey: "hsn_code",
    label: "HSN Code",
    dataType: "text",
    required: false,
    aliases: ["hsn", "hsn code", "gst code", "sac"],
    lookupGroup: "hsn",
    sourceTable: "items",
    displayWidthPct: 10,
    active: true,
    description: "Tax classification code for the item."
  },
  {
    id: "uom",
    entity: "item",
    fieldKey: "uom",
    label: "UOM",
    dataType: "text",
    required: false,
    aliases: ["uom", "unit", "unit of measure"],
    lookupGroup: "product",
    sourceTable: "items",
    displayWidthPct: 8,
    active: true,
    description: "Unit of measure for stock and sales."
  },
  {
    id: "quantity",
    entity: "general",
    fieldKey: "quantity",
    label: "Quantity",
    dataType: "number",
    required: false,
    aliases: ["qty", "quantity", "units", "pcs"],
    lookupGroup: "general",
    displayWidthPct: 10,
    active: true,
    description: "Quantity or unit count for line items and entries."
  },
  {
    id: "discount_percent",
    entity: "general",
    fieldKey: "discount_percent",
    label: "Discount %",
    dataType: "number",
    required: false,
    aliases: ["disc %", "discount percent", "discount pct", "disc_pct"],
    lookupGroup: "general",
    displayWidthPct: 10,
    active: true,
    description: "Percentage discount for a row or document."
  },
  {
    id: "discount_amount",
    entity: "general",
    fieldKey: "discount_amount",
    label: "Discount Amount",
    dataType: "currency",
    required: false,
    aliases: ["disc amt", "discount amount", "disc_amount"],
    lookupGroup: "general",
    displayWidthPct: 10,
    active: true,
    description: "Monetary discount value applied to a row or document."
  },
  {
    id: "reference_no",
    entity: "general",
    fieldKey: "reference_no",
    label: "Reference No",
    dataType: "text",
    required: false,
    aliases: ["reference no", "po reference", "ref no", "po ref", "reference"],
    lookupGroup: "general",
    displayWidthPct: 12,
    active: true,
    description: "External reference document or PO number."
  },
  {
    id: "order_status",
    entity: "general",
    fieldKey: "order_status",
    label: "Order Status",
    dataType: "select",
    required: false,
    aliases: ["status", "order status", "document status"],
    lookupGroup: "general",
    displayWidthPct: 12,
    active: true,
    description: "Status or workflow state of the document."
  },
  {
    id: "delivery_terms",
    entity: "general",
    fieldKey: "delivery_terms",
    label: "Delivery Terms",
    dataType: "text",
    required: false,
    aliases: ["delivery terms", "shipping terms", "dispatch terms"],
    lookupGroup: "general",
    displayWidthPct: 12,
    active: true,
    description: "Delivery or dispatch conditions."
  },
  {
    id: "payment_terms",
    entity: "general",
    fieldKey: "payment_terms",
    label: "Payment Terms",
    dataType: "text",
    required: false,
    aliases: ["payment terms", "credit terms", "settlement terms"],
    lookupGroup: "general",
    displayWidthPct: 12,
    active: true,
    description: "Terms used for payment settlement."
  },
  {
    id: "remarks",
    entity: "general",
    fieldKey: "remarks",
    label: "Remarks",
    dataType: "text",
    required: false,
    aliases: ["remarks", "notes", "special instructions", "comment"],
    lookupGroup: "general",
    displayWidthPct: 18,
    active: true,
    description: "Free-form notes or instructions."
  },
  {
    id: "vehicle_no",
    entity: "general",
    fieldKey: "vehicle_no",
    label: "Vehicle Number",
    dataType: "text",
    required: false,
    aliases: ["vehicle number", "vehicle no", "truck number", "registration number"],
    lookupGroup: "general",
    displayWidthPct: 12,
    active: true,
    description: "Vehicle registration number for dispatch compliance."
  },
  {
    id: "transporter_id",
    entity: "general",
    fieldKey: "transporter_id",
    label: "Transporter ID",
    dataType: "text",
    required: false,
    aliases: ["transporter id", "transport id", "transporter gstin", "transporter code"],
    lookupGroup: "general",
    displayWidthPct: 12,
    active: true,
    description: "Transporter or e-way bill party identifier."
  },
  {
    id: "distance_km",
    entity: "general",
    fieldKey: "distance_km",
    label: "Distance (KM)",
    dataType: "number",
    required: false,
    aliases: ["distance", "distance km", "transit distance", "kms"],
    lookupGroup: "general",
    displayWidthPct: 10,
    active: true,
    description: "Transit distance for dispatch compliance entries."
  },
  {
    id: "customer_code",
    entity: "customer",
    fieldKey: "customer_code",
    label: "Customer Code",
    dataType: "text",
    required: false,
    aliases: ["customer code", "cust code", "client code"],
    lookupGroup: "customer",
    sourceTable: "customers",
    displayWidthPct: 12,
    active: true,
    description: "Customer code or master identifier."
  },
  {
    id: "customer_name",
    entity: "customer",
    fieldKey: "customer_name",
    label: "Customer Name",
    dataType: "text",
    required: true,
    aliases: ["customer", "customer name", "client name", "buyer"],
    lookupGroup: "customer",
    sourceTable: "customers",
    displayWidthPct: 20,
    active: true,
    description: "Customer display name."
  },
  {
    id: "customer_mobile",
    entity: "customer",
    fieldKey: "customer_mobile",
    label: "Mobile",
    dataType: "text",
    required: false,
    aliases: ["mobile", "phone", "contact number"],
    lookupGroup: "customer",
    sourceTable: "customers",
    displayWidthPct: 12,
    active: true,
    description: "Primary mobile number for customer lookup."
  },
  {
    id: "customer_gstin",
    entity: "customer",
    fieldKey: "customer_gstin",
    label: "GSTIN",
    dataType: "text",
    required: false,
    aliases: ["gstin", "gst number", "tax id"],
    lookupGroup: "customer",
    sourceTable: "customers",
    displayWidthPct: 14,
    active: true,
    description: "GST registration number for the customer."
  },
  {
    id: "supplier_name",
    entity: "supplier",
    fieldKey: "supplier_name",
    label: "Supplier Name",
    dataType: "text",
    required: true,
    aliases: ["supplier", "vendor", "party name"],
    lookupGroup: "supplier",
    sourceTable: "suppliers",
    displayWidthPct: 18,
    active: true,
    description: "Supplier or vendor display name."
  },
  {
    id: "supplier_mobile",
    entity: "supplier",
    fieldKey: "supplier_mobile",
    label: "Supplier Mobile",
    dataType: "text",
    required: false,
    aliases: ["supplier mobile", "vendor phone", "party mobile"],
    lookupGroup: "supplier",
    sourceTable: "suppliers",
    displayWidthPct: 12,
    active: true,
    description: "Supplier contact phone number."
  },
  {
    id: "staff_name",
    entity: "staff",
    fieldKey: "staff_name",
    label: "Staff Name",
    dataType: "text",
    required: false,
    aliases: ["staff", "employee", "salesperson", "cashier"],
    lookupGroup: "staff",
    sourceTable: "staff",
    displayWidthPct: 16,
    active: true,
    description: "Sales or support staff record."
  },
  {
    id: "invoice_number",
    entity: "invoice",
    fieldKey: "invoice_number",
    label: "Invoice Number",
    dataType: "text",
    required: true,
    aliases: ["invoice no", "bill no", "voucher no"],
    lookupGroup: "invoice",
    sourceTable: "invoices",
    displayWidthPct: 14,
    active: true,
    description: "Primary document number."
  }
];

export const GLOBAL_FIELD_LOOKUP_RULES: GlobalFieldLookupRule[] = [
  {
    lookupGroup: "product",
    endpoint: "/universal/items",
    searchFields: ["item_code", "barcode", "product_name", "brand", "category", "color", "size"],
    insertValueKeys: ["item_code", "barcode", "product_name", "id"],
    suggestOnF2: true,
    matchPriority: 1,
    defaultLimit: 200
  },
  {
    lookupGroup: "customer",
    endpoint: "/customers",
    searchFields: ["customer_name", "customer_mobile", "customer_code", "customer_gstin"],
    insertValueKeys: ["customer_name", "customer_mobile", "customer_code", "id"],
    suggestOnF2: true,
    matchPriority: 2,
    defaultLimit: 200
  },
  {
    lookupGroup: "supplier",
    endpoint: "/suppliers",
    searchFields: ["supplier_name", "supplier_mobile", "gstin"],
    insertValueKeys: ["supplier_name", "supplier_mobile", "id"],
    suggestOnF2: true,
    matchPriority: 3,
    defaultLimit: 200
  },
  {
    lookupGroup: "staff",
    endpoint: "/staff",
    searchFields: ["staff_name", "employee_code", "role"],
    insertValueKeys: ["staff_name", "employee_code", "id"],
    suggestOnF2: true,
    matchPriority: 4,
    defaultLimit: 200
  },
  {
    lookupGroup: "hsn",
    endpoint: "/hsn-codes",
    searchFields: ["hsn_code", "description", "gst_rate"],
    insertValueKeys: ["hsn_code", "description", "id"],
    suggestOnF2: true,
    matchPriority: 5,
    defaultLimit: 100
  },
  {
    lookupGroup: "invoice",
    endpoint: "/sales/invoices",
    searchFields: ["invoice_number", "customer_name", "date"],
    insertValueKeys: ["invoice_number", "id"],
    suggestOnF2: true,
    matchPriority: 6,
    defaultLimit: 100
  }
];

export const GLOBAL_SCREEN_FIELD_CONFIG: ScreenFieldConfig[] = [
  { screenId: "sales_order_form", entity: "item", fieldKey: "item_code", visible: true, displayOrder: 1, widthPct: 12 },
  { screenId: "sales_order_form", entity: "item", fieldKey: "barcode", visible: true, displayOrder: 2, widthPct: 14 },
  { screenId: "sales_order_form", entity: "item", fieldKey: "product_name", visible: true, displayOrder: 3, widthPct: 20 },
  { screenId: "sales_order_form", entity: "item", fieldKey: "brand", visible: true, displayOrder: 4, widthPct: 10 },
  { screenId: "sales_order_form", entity: "item", fieldKey: "color", visible: true, displayOrder: 5, widthPct: 9 },
  { screenId: "sales_order_form", entity: "item", fieldKey: "size", visible: true, displayOrder: 6, widthPct: 8 },
  { screenId: "sales_order_form", entity: "item", fieldKey: "selling_price", visible: true, displayOrder: 7, widthPct: 10 },
  { screenId: "sales_order_form", entity: "customer", fieldKey: "customer_name", visible: true, displayOrder: 1, widthPct: 22 },
  { screenId: "sales_order_form", entity: "customer", fieldKey: "customer_mobile", visible: true, displayOrder: 2, widthPct: 12 },

  { screenId: "item_master_grid", entity: "item", fieldKey: "item_code", visible: true, displayOrder: 1, widthPct: 12 },
  { screenId: "item_master_grid", entity: "item", fieldKey: "barcode", visible: true, displayOrder: 2, widthPct: 14 },
  { screenId: "item_master_grid", entity: "item", fieldKey: "product_name", visible: true, displayOrder: 3, widthPct: 22 },
  { screenId: "item_master_grid", entity: "item", fieldKey: "brand", visible: true, displayOrder: 4, widthPct: 10 },
  { screenId: "item_master_grid", entity: "item", fieldKey: "color", visible: true, displayOrder: 5, widthPct: 9 },
  { screenId: "item_master_grid", entity: "item", fieldKey: "size", visible: true, displayOrder: 6, widthPct: 8 },
  { screenId: "item_master_grid", entity: "item", fieldKey: "mrp", visible: true, displayOrder: 7, widthPct: 10 },
  { screenId: "item_master_grid", entity: "item", fieldKey: "selling_price", visible: true, displayOrder: 8, widthPct: 10 },
  { screenId: "item_master_grid", entity: "item", fieldKey: "hsn_code", visible: true, displayOrder: 9, widthPct: 10 },
  { screenId: "item_master_grid", entity: "item", fieldKey: "uom", visible: true, displayOrder: 10, widthPct: 8 }
];

export const GLOBAL_BROWSE_COLUMN_CONFIG: Record<string, BrowseColumnConfig[]> = {
  product: [
    { key: "item_code", label: "Stock No", visible: true, align: "left", width: "w-36" },
    { key: "barcode", label: "Barcode", visible: true, align: "left", width: "w-36" },
    { key: "product_name", label: "Item Description", visible: true, align: "left" },
    { key: "category", label: "Category", visible: true, align: "left", width: "w-28" },
    { key: "size", label: "Size", visible: true, align: "center", width: "w-16" },
    { key: "color", label: "Color", visible: true, align: "center", width: "w-20" },
    { key: "brand", label: "Brand", visible: true, align: "left", width: "w-28" },
    { key: "selling_price", label: "Rate (₹)", visible: true, align: "right", width: "w-24" },
    { key: "mrp", label: "MRP (₹)", visible: true, align: "right", width: "w-24" },
    { key: "uom", label: "UOM", visible: true, align: "right", width: "w-20" }
  ],
  customer: [
    { key: "customer_code", label: "Cust Code", visible: true, align: "left", width: "w-28" },
    { key: "customer_name", label: "Customer Name", visible: true, align: "left" },
    { key: "customer_mobile", label: "Mobile No", visible: true, align: "left", width: "w-32" },
    { key: "customer_gstin", label: "GSTIN", visible: true, align: "left", width: "w-36" }
  ],
  supplier: [
    { key: "supplier_name", label: "Supplier / Party Name", visible: true, align: "left" },
    { key: "supplier_mobile", label: "Contact Mobile", visible: true, align: "left", width: "w-32" },
    { key: "gstin", label: "GSTIN", visible: true, align: "left", width: "w-36" }
  ],
  staff: [
    { key: "staff_name", label: "Staff Name", visible: true, align: "left" },
    { key: "employee_code", label: "Staff Code", visible: true, align: "left", width: "w-24" },
    { key: "role", label: "Role / Designation", visible: true, align: "left", width: "w-36" }
  ],
  hsn: [
    { key: "hsn_code", label: "HSN / SAC Code", visible: true, align: "left", width: "w-36" },
    { key: "description", label: "Commodity Description", visible: true, align: "left" },
    { key: "gst_rate", label: "GST Rate %", visible: true, align: "right", width: "w-24" }
  ],
  invoice: [
    { key: "invoice_number", label: "Invoice Number", visible: true, align: "left", width: "w-32" },
    { key: "customer_name", label: "Customer Name", visible: true, align: "left" },
    { key: "date", label: "Invoice Date", visible: true, align: "left", width: "w-28" },
    { key: "amount", label: "Amount", visible: true, align: "right", width: "w-28" }
  ]
};

export function getBrowseColumnDefaults(): Record<string, BrowseColumnConfig[]> {
  return JSON.parse(JSON.stringify(GLOBAL_BROWSE_COLUMN_CONFIG));
}

export function getFieldMetadata(fieldKey: string): GlobalFieldDef | undefined {
  return GLOBAL_FIELD_CATALOG.find((field) => field.fieldKey === fieldKey || field.id === fieldKey);
}

export function getGlobalFieldCatalog(entity?: GlobalFieldEntity): GlobalFieldDef[] {
  if (!entity) return [...GLOBAL_FIELD_CATALOG];
  return GLOBAL_FIELD_CATALOG.filter((field) => field.entity === entity);
}

export function getLookupMetadata(lookupGroup: LookupGroup): GlobalFieldLookupRule | undefined {
  return GLOBAL_FIELD_LOOKUP_RULES.find((rule) => rule.lookupGroup === lookupGroup);
}

export function getVisibleFieldIds(screenId: string, entity?: GlobalFieldEntity): string[] {
  return GLOBAL_SCREEN_FIELD_CONFIG
    .filter((config) => config.screenId === screenId && (!entity || config.entity === entity) && config.visible)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((config) => config.fieldKey);
}

export function getFieldByAlias(alias: string): GlobalFieldDef | undefined {
  const normalized = alias.trim().toLowerCase();
  return GLOBAL_FIELD_CATALOG.find((field) =>
    field.aliases.some((item) => item.toLowerCase() === normalized) ||
    field.fieldKey.toLowerCase() === normalized ||
    field.label.toLowerCase() === normalized
  );
}

export function resolveFieldForInput(inputName: string, fallbackLabel?: string): GlobalFieldDef | undefined {
  const candidates = [inputName, fallbackLabel || ""]
    .filter(Boolean)
    .map((value) => value.trim().toLowerCase());

  for (const candidate of candidates) {
    const match = getFieldByAlias(candidate);
    if (match) return match;
  }

  return undefined;
}
