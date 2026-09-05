/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-02
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * F2 Universal Lookup Architecture v2 — Authoritative LOOKUP_REGISTRY
 *
 * CANONICAL API ROUTING (MANDATORY):
 *   variant      → /api/v1/variants        (Gate 11E canonical — NOT /api/v1/products)
 *   item         → /api/v1/items           (Gate 11E canonical — NOT /api/v1/products)
 *   item_barcode → /api/v1/item-barcodes   (Gate 11E canonical — NOT /api/v1/products)
 *
 * /api/v1/products MUST NOT appear in this registry. It is a compatibility-only
 * endpoint preserved for legacy clients only.
 *
 * SCOPING:
 *   tenantScoped: true  → API call includes company_id param (enforced by backend)
 *   branchScoped: true  → API call includes branch_id param (enforced by backend)
 *   Note: The UI registry provides hints; the BACKEND remains the actual security boundary.
 *
 * VERSIONING:
 *   contractVersion — bump when the LookupResult return shape for this entity changes.
 *   Callers should check contractVersion if they depend on specific fields.
 */

import type { LookupEntity } from "../context/F2DispatcherContext.tsx";

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

export interface LookupColumnDef {
  /** API response field key */
  key: string;
  /** Human-readable column header */
  label: string;
  visible: boolean;
  align?: "left" | "right" | "center";
  /** Tailwind width class e.g. "w-28" */
  width?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY ENTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface LookupRegistryEntry {
  /** Return contract version — bump on breaking shape changes */
  contractVersion: "2.0.0";
  entity: LookupEntity;
  /** Canonical FastAPI endpoint path (relative to /api/v1) */
  endpoint: string;
  /** Fields the search query is applied against (server-side) */
  searchFields: string[];
  /** Default field key whose value goes back to the originating input */
  defaultReturnField: string;
  /** Default field key for a companion display field */
  defaultDisplayField: string;
  /** Roles that may trigger this lookup — UI hint; backend enforces real permission */
  permissions: string[];
  /** Whether calls must include company_id scoping */
  tenantScoped: boolean;
  /** Whether calls must include branch_id scoping */
  branchScoped: boolean;
  /** Max rows to fetch per lookup session */
  defaultLimit: number;
  /** Column definitions for the browse grid */
  displayColumns: LookupColumnDef[];
  /** Whether this entity is available for F2 lookup */
  enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE LOOKUP REGISTRY — 22 entities + general (non-resolvable)
// ─────────────────────────────────────────────────────────────────────────────

export const LOOKUP_REGISTRY: Partial<Record<LookupEntity, LookupRegistryEntry>> = {

  // ── CANONICAL PRODUCT DOMAIN ──────────────────────────────────────────────
  // These three entries use ONLY canonical Gate-11E APIs.
  // /api/v1/products MUST NOT appear here.

  variant: {
    contractVersion: "2.0.0",
    entity: "variant",
    endpoint: "/variants",                      // /api/v1/variants
    searchFields: ["sku", "barcode", "name", "color", "size", "brand", "category"],
    defaultReturnField: "sku",
    defaultDisplayField: "name",
    permissions: ["Cashier", "Sales Executive", "Store Manager", "Admin", "Shop Owner", "Franchise Owner"],
    tenantScoped: true,
    branchScoped: true,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "sku",           label: "Stock No",       visible: true,  align: "left",  width: "w-36" },
      { key: "barcode",       label: "Barcode",        visible: true,  align: "left",  width: "w-36" },
      { key: "name",          label: "Item Description",visible: true, align: "left" },
      { key: "category",      label: "Category",       visible: true,  align: "left",  width: "w-28" },
      { key: "size",          label: "Size",           visible: true,  align: "center",width: "w-16" },
      { key: "color",         label: "Color",          visible: true,  align: "center",width: "w-20" },
      { key: "brand",         label: "Brand",          visible: true,  align: "left",  width: "w-28" },
      { key: "selling_price", label: "Rate (₹)",       visible: true,  align: "right", width: "w-24" },
      { key: "mrp",           label: "MRP (₹)",        visible: true,  align: "right", width: "w-24" },
      { key: "stock",         label: "Avail Qty",      visible: true,  align: "right", width: "w-20" },
    ],
  },

  item: {
    contractVersion: "2.0.0",
    entity: "item",
    endpoint: "/items",                          // /api/v1/items
    searchFields: ["code", "name", "brand", "category", "season"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Branch Manager", "Purchase Executive"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",     label: "Item / Style Code",  visible: true,  align: "left",  width: "w-36" },
      { key: "name",     label: "Style Description",   visible: true,  align: "left" },
      { key: "category", label: "Category",            visible: true,  align: "left",  width: "w-28" },
      { key: "brand",    label: "Brand",               visible: true,  align: "left",  width: "w-28" },
      { key: "season",   label: "Season",              visible: true,  align: "center",width: "w-24" },
      { key: "mrp",      label: "Base MRP (₹)",        visible: true,  align: "right", width: "w-24" },
    ],
  },

  item_barcode: {
    contractVersion: "2.0.0",
    entity: "item_barcode",
    endpoint: "/item-barcodes",                  // /api/v1/item-barcodes
    searchFields: ["barcode", "sku", "name"],
    defaultReturnField: "barcode",
    defaultDisplayField: "name",
    permissions: ["Cashier", "Warehouse Staff", "Admin", "Shop Owner"],
    tenantScoped: true,
    branchScoped: true,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "barcode", label: "Barcode",          visible: true, align: "left",  width: "w-40" },
      { key: "sku",     label: "Stock No",          visible: true, align: "left",  width: "w-36" },
      { key: "name",    label: "Item Description",  visible: true, align: "left" },
    ],
  },

  // ── MASTER DATA ────────────────────────────────────────────────────────────

  customer: {
    contractVersion: "2.0.0",
    entity: "customer",
    endpoint: "/crm/customers",
    searchFields: ["code", "name", "phone", "mobile", "gstin", "membership_no"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Cashier", "Sales Executive", "Store Manager", "Admin", "Shop Owner", "Franchise Owner"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",           label: "Cust Code",      visible: true,  align: "left",  width: "w-28" },
      { key: "name",           label: "Customer Name",  visible: true,  align: "left" },
      { key: "phone",          label: "Mobile No",      visible: true,  align: "left",  width: "w-32" },
      { key: "loyaltyTier",    label: "Tier",           visible: true,  align: "center",width: "w-24" },
      { key: "loyaltyPoints",  label: "Points",         visible: true,  align: "right", width: "w-20" },
      { key: "currentBalance", label: "Credit Balance", visible: true,  align: "right", width: "w-28" },
      { key: "gstin",          label: "GSTIN",          visible: true,  align: "left",  width: "w-36" },
    ],
  },

  supplier: {
    contractVersion: "2.0.0",
    entity: "supplier",
    endpoint: "/suppliers",
    searchFields: ["code", "name", "gstin", "phone", "mobile"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Purchase Executive", "Admin", "Shop Owner", "Branch Manager"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",    label: "Party / Vendor Code",    visible: true,  align: "left",  width: "w-32" },
      { key: "name",    label: "Supplier / Party Name",  visible: true,  align: "left" },
      { key: "gstin",   label: "GSTIN",                  visible: true,  align: "left",  width: "w-36" },
      { key: "state",   label: "State",                  visible: true,  align: "left",  width: "w-28" },
      { key: "phone",   label: "Contact Mobile",         visible: true,  align: "left",  width: "w-32" },
      { key: "balance", label: "Ledger Balance",         visible: true,  align: "right", width: "w-28" },
    ],
  },

  staff: {
    contractVersion: "2.0.0",
    entity: "staff",
    endpoint: "/staff",
    searchFields: ["code", "name", "role", "employee_code"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Branch Manager", "Shop Owner"],
    tenantScoped: true,
    branchScoped: true,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",    label: "Staff Code",         visible: true, align: "left",  width: "w-24" },
      { key: "name",    label: "Salesperson Name",   visible: true, align: "left" },
      { key: "role",    label: "Role / Designation", visible: true, align: "left",  width: "w-36" },
      { key: "counter", label: "Assigned Counter",   visible: true, align: "left",  width: "w-36" },
    ],
  },

  hsn: {
    contractVersion: "2.0.0",
    entity: "hsn",
    endpoint: "/hsn-codes",
    searchFields: ["code", "description", "gst_rate"],
    defaultReturnField: "code",
    defaultDisplayField: "description",
    permissions: ["Admin", "Store Manager", "Purchase Executive", "Accountant (Operational)"],
    tenantScoped: false,
    branchScoped: false,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "code",    label: "HSN / SAC Code",       visible: true, align: "left",  width: "w-36" },
      { key: "desc",    label: "Commodity Description", visible: true, align: "left" },
      { key: "gstPct",  label: "GST Rate %",            visible: true, align: "right", width: "w-24" },
    ],
  },

  uom: {
    contractVersion: "2.0.0",
    entity: "uom",
    endpoint: "/uom",
    searchFields: ["code", "name", "type"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Purchase Executive"],
    tenantScoped: false,
    branchScoped: false,
    defaultLimit: 50,
    enabled: true,
    displayColumns: [
      { key: "code",          label: "UOM Code",          visible: true, align: "center", width: "w-24" },
      { key: "name",          label: "Unit Description",  visible: true, align: "left" },
      { key: "type",          label: "Unit Type",         visible: true, align: "left",   width: "w-28" },
      { key: "decimalPlaces", label: "Decimals Allowed",  visible: true, align: "center", width: "w-28" },
    ],
  },

  // ── ITEM MASTER ATTRIBUTE ENTITIES ────────────────────────────────────────

  brand: {
    contractVersion: "2.0.0",
    entity: "brand",
    endpoint: "/master/brands",
    searchFields: ["code", "name", "origin", "tier"],
    defaultReturnField: "name",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Purchase Executive"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",   label: "Brand Code",      visible: true, align: "left",   width: "w-28" },
      { key: "name",   label: "Brand Name",       visible: true, align: "left" },
      { key: "origin", label: "Brand Origin",     visible: true, align: "left",   width: "w-32" },
      { key: "tier",   label: "Segment / Tier",   visible: true, align: "center", width: "w-28" },
      { key: "status", label: "Status",           visible: true, align: "center", width: "w-24" },
    ],
  },

  color: {
    contractVersion: "2.0.0",
    entity: "color",
    endpoint: "/master/colors",
    searchFields: ["code", "name", "shade", "group"],
    defaultReturnField: "name",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Purchase Executive"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",  label: "Color Code",   visible: true, align: "left",   width: "w-28" },
      { key: "name",  label: "Color Name",   visible: true, align: "left" },
      { key: "shade", label: "Shade Family", visible: true, align: "left",   width: "w-32" },
      { key: "hex",   label: "Hex Swatch",   visible: true, align: "center", width: "w-24" },
      { key: "group", label: "Color Group",  visible: true, align: "left",   width: "w-28" },
    ],
  },

  size: {
    contractVersion: "2.0.0",
    entity: "size",
    endpoint: "/master/sizes",
    searchFields: ["code", "name", "scale", "standard"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Purchase Executive"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",      label: "Size Code",          visible: true, align: "center", width: "w-24" },
      { key: "name",      label: "Size Label",         visible: true, align: "left" },
      { key: "scale",     label: "Size Scale / Group", visible: true, align: "left",   width: "w-36" },
      { key: "standard",  label: "Standard (UK/US/EU)",visible: true, align: "center", width: "w-32" },
      { key: "sortOrder", label: "Display Sort",       visible: true, align: "right",  width: "w-20" },
    ],
  },

  article: {
    contractVersion: "2.0.0",
    entity: "article",
    endpoint: "/master/articles",
    searchFields: ["code", "name", "category", "brand", "season"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Purchase Executive"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",     label: "Article / Style Code", visible: true, align: "left",  width: "w-36" },
      { key: "name",     label: "Style Description",    visible: true, align: "left" },
      { key: "category", label: "Category",             visible: true, align: "left",  width: "w-28" },
      { key: "brand",    label: "Brand",                visible: true, align: "left",  width: "w-28" },
      { key: "season",   label: "Season",               visible: true, align: "center",width: "w-24" },
      { key: "mrp",      label: "Base MRP (₹)",         visible: true, align: "right", width: "w-24" },
    ],
  },

  department: {
    contractVersion: "2.0.0",
    entity: "department",
    endpoint: "/master/departments",
    searchFields: ["code", "name", "division"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "code",        label: "Dept Code",        visible: true, align: "left",  width: "w-28" },
      { key: "name",        label: "Department Name",  visible: true, align: "left" },
      { key: "division",    label: "Division",         visible: true, align: "left",  width: "w-32" },
      { key: "description", label: "Description",      visible: true, align: "left" },
    ],
  },

  section: {
    contractVersion: "2.0.0",
    entity: "section",
    endpoint: "/master/sections",
    searchFields: ["code", "name", "targetAudience", "deptCode"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "code",           label: "Section Code",      visible: true, align: "left",  width: "w-28" },
      { key: "name",           label: "Section Name",      visible: true, align: "left" },
      { key: "targetAudience", label: "Target Audience",   visible: true, align: "left",  width: "w-36" },
      { key: "deptCode",       label: "Parent Dept",       visible: true, align: "left",  width: "w-28" },
    ],
  },

  fabric: {
    contractVersion: "2.0.0",
    entity: "fabric",
    endpoint: "/master/fabrics",
    searchFields: ["code", "name", "composition", "weave"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Purchase Executive"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",        label: "Fabric Code",    visible: true, align: "left",  width: "w-28" },
      { key: "name",        label: "Fabric Name",    visible: true, align: "left" },
      { key: "composition", label: "Composition",    visible: true, align: "left",  width: "w-40" },
      { key: "weave",       label: "Weave Type",     visible: true, align: "left",  width: "w-28" },
      { key: "gsm",         label: "GSM Weight",     visible: true, align: "right", width: "w-20" },
    ],
  },

  fit: {
    contractVersion: "2.0.0",
    entity: "fit",
    endpoint: "/master/fits",
    searchFields: ["code", "name", "cutType"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "code",        label: "Fit Code",              visible: true, align: "left",  width: "w-24" },
      { key: "name",        label: "Fit Silhouette",        visible: true, align: "left" },
      { key: "cutType",     label: "Cut Contour",           visible: true, align: "left",  width: "w-36" },
      { key: "description", label: "Fitting Characteristics",visible: true,align: "left" },
    ],
  },

  category: {
    contractVersion: "2.0.0",
    entity: "category",
    endpoint: "/master/categories",
    searchFields: ["code", "name", "parent_code"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Purchase Executive"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 200,
    enabled: true,
    displayColumns: [
      { key: "code",        label: "Category Code", visible: true, align: "left",  width: "w-28" },
      { key: "name",        label: "Category Name", visible: true, align: "left" },
      { key: "parent_code", label: "Parent",        visible: true, align: "left",  width: "w-28" },
      { key: "description", label: "Description",   visible: true, align: "left" },
    ],
  },

  season: {
    contractVersion: "2.0.0",
    entity: "season",
    endpoint: "/master/seasons",
    searchFields: ["code", "name", "year"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "code",   label: "Season Code",  visible: true, align: "left",   width: "w-28" },
      { key: "name",   label: "Season Name",  visible: true, align: "left" },
      { key: "year",   label: "Year",         visible: true, align: "center", width: "w-20" },
      { key: "status", label: "Season State", visible: true, align: "center", width: "w-24" },
    ],
  },

  // ── TRANSACTIONAL / COMPLIANCE ─────────────────────────────────────────────

  scheme: {
    contractVersion: "2.0.0",
    entity: "scheme",
    endpoint: "/schemes",
    searchFields: ["code", "name", "type"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager", "Shop Owner"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "code",     label: "Scheme Code",         visible: true, align: "left",  width: "w-28" },
      { key: "name",     label: "Scheme / Offer Name", visible: true, align: "left" },
      { key: "type",     label: "Discount Type",       visible: true, align: "left",  width: "w-32" },
      { key: "value",    label: "Offer Benefit",       visible: true, align: "right", width: "w-28" },
      { key: "validity", label: "Validity",            visible: true, align: "center",width: "w-28" },
    ],
  },

  terms: {
    contractVersion: "2.0.0",
    entity: "terms",
    endpoint: "/terms",
    searchFields: ["code", "name"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Purchase Executive", "Accountant (Operational)"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "code",        label: "Terms Code",                visible: true, align: "left",  width: "w-28" },
      { key: "name",        label: "Payment & Commercial Terms", visible: true, align: "left" },
      { key: "creditDays",  label: "Credit Days",              visible: true, align: "right", width: "w-24" },
      { key: "interestPct", label: "Overdue Int %",            visible: true, align: "right", width: "w-24" },
    ],
  },

  store: {
    contractVersion: "2.0.0",
    entity: "store",
    endpoint: "/stores",
    searchFields: ["code", "name", "city", "state"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Branch Manager", "Store Manager"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "code",     label: "Store Code",            visible: true, align: "left",   width: "w-28" },
      { key: "name",     label: "Chain Store / Branch",  visible: true, align: "left" },
      { key: "city",     label: "City",                  visible: true, align: "left",   width: "w-28" },
      { key: "state",    label: "State",                 visible: true, align: "left",   width: "w-28" },
      { key: "posCount", label: "POS Counters",          visible: true, align: "center", width: "w-24" },
      { key: "status",   label: "Status",                visible: true, align: "center", width: "w-24" },
    ],
  },

  classification: {
    contractVersion: "2.0.0",
    entity: "classification",
    endpoint: "/master/classifications",
    searchFields: ["code", "name", "type"],
    defaultReturnField: "code",
    defaultDisplayField: "name",
    permissions: ["Admin", "Store Manager"],
    tenantScoped: true,
    branchScoped: false,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "code",        label: "Class Code",            visible: true, align: "left",  width: "w-28" },
      { key: "name",        label: "Classification Name",   visible: true, align: "left" },
      { key: "type",        label: "Hierarchy Level",       visible: true, align: "left",  width: "w-32" },
      { key: "description", label: "Specification",         visible: true, align: "left" },
    ],
  },

  invoice: {
    contractVersion: "2.0.0",
    entity: "invoice",
    endpoint: "/sales/invoices",
    searchFields: ["invoice_number", "customer_name", "date"],
    defaultReturnField: "invoice_number",
    defaultDisplayField: "customer_name",
    permissions: ["Admin", "Store Manager", "Accountant (Operational)", "Sales Executive"],
    tenantScoped: true,
    branchScoped: true,
    defaultLimit: 100,
    enabled: true,
    displayColumns: [
      { key: "invoice_number",  label: "Invoice No",      visible: true, align: "left",  width: "w-36" },
      { key: "customer_name",   label: "Customer",        visible: true, align: "left" },
      { key: "date",            label: "Date",            visible: true, align: "center",width: "w-28" },
      { key: "total",           label: "Amount (₹)",      visible: true, align: "right", width: "w-28" },
      { key: "status",          label: "Status",          visible: true, align: "center",width: "w-24" },
    ],
  },

  // ── NON-RESOLVABLE ─────────────────────────────────────────────────────────
  // "general" is deliberately omitted from the registry.
  // The dispatcher checks for "general" and produces a no-op.

};

/**
 * Resolve a lookup registry entry by entity.
 * Returns null for "general" or any unregistered entity.
 */
export function resolveLookupEntry(entity: LookupEntity): LookupRegistryEntry | null {
  if (entity === "general") return null;
  return LOOKUP_REGISTRY[entity] ?? null;
}

/**
 * Check whether a user role has permission to use a given lookup entity.
 * Returns true when no permission list is defined (open access).
 * Note: backend remains the actual security boundary.
 */
export function hasLookupPermission(entity: LookupEntity, userRole: string): boolean {
  const entry = resolveLookupEntry(entity);
  if (!entry) return false;
  if (entry.permissions.length === 0) return true;
  return entry.permissions.includes(userRole);
}
