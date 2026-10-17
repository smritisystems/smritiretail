/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.71.0
 * Created      : 2026-10-12
 * Modified     : 2026-10-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Universal Item Master Export Presets & Audit Engine
 */

import { ExportColumnDefinition, ExportPreset } from "../export/types.ts";

export const CATALOG_EXPORT_COLUMNS = [
  { key: "code", label: "SKU", datatype: "text" },
  { key: "barcode", label: "Barcode", datatype: "text" },
  { key: "name", label: "Name", datatype: "text" },
  { key: "brand", label: "Brand", datatype: "text" },
  { key: "category", label: "Category", datatype: "text" },
  { key: "gender", label: "Gender", datatype: "text" },
  { key: "product_type", label: "Product Type", datatype: "text" },
  { key: "article", label: "Article", datatype: "text" },
  { key: "color", label: "Color", datatype: "text" },
  { key: "size", label: "Size", datatype: "text" },
  { key: "hsn_code", label: "HSN", datatype: "text" },
  { key: "mrp", label: "Retail Price", datatype: "currency" },
  { key: "buying_price", label: "Dealer Price", datatype: "currency" },
  { key: "cost_price", label: "Cost Price", datatype: "currency" },
  { key: "gst_percentage", label: "GST%", datatype: "percentage" },
  { key: "status", label: "Status", datatype: "text" },
];

/**
 * Standard audit and compliance column definitions for forensic reporting.
 */
export const ITEM_MASTER_AUDIT_COLUMNS: ExportColumnDefinition[] = [
  {
    key: "compliance_status",
    label: "Audit Status",
    datatype: "badge",
    width: 14,
    isVisible: true,
  },
  {
    key: "compliance_issues",
    label: "Compliance Exceptions",
    datatype: "text",
    width: 35,
    isVisible: true,
  },
  {
    key: "audit_margin_amount",
    label: "Gross Margin (₹)",
    datatype: "currency",
    width: 16,
    isSummary: true,
    isVisible: true,
  },
  {
    key: "audit_margin_percentage",
    label: "Margin %",
    datatype: "percentage",
    width: 12,
    isVisible: true,
  },
  {
    key: "audit_discount_amount",
    label: "MRP Discount (₹)",
    datatype: "currency",
    width: 16,
    isSummary: true,
    isVisible: true,
  },
  {
    key: "created_at",
    label: "Created Date",
    datatype: "datetime",
    width: 20,
    isVisible: true,
  },
  {
    key: "modified_at",
    label: "Modified Date",
    datatype: "datetime",
    width: 20,
    isVisible: true,
  },
  {
    key: "version",
    label: "Version",
    datatype: "number",
    width: 10,
    isVisible: true,
  },
];

/**
 * Enterprise retail column presets for the Item Master module.
 */
export const ITEM_MASTER_EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "all",
    label: "All Fields",
    badge: "Full Dump",
    description: "Complete catalog dump across identity, pricing, tax, hierarchy, inventory, and system metadata.",
    columnKeys: [], // Empty denotes select all columns
  },
  {
    id: "pos_price_list",
    label: "Store & POS Price List",
    badge: "Cashier",
    description: "Customer-facing price list for POS registers, barcode scanning, and price verification.",
    columnKeys: [
      "code",
      "barcode",
      "name",
      "brand",
      "category",
      "size",
      "colour",
      "mrp",
      "price",
      "gst_percentage",
    ],
  },
  {
    id: "stocktake",
    label: "Physical Stocktaking Sheet",
    badge: "Warehouse",
    description: "Inventory audit and cycle count sheet with SKU, barcode, location bin, and current stock on hand.",
    columnKeys: [
      "code",
      "barcode",
      "name",
      "category",
      "brand",
      "size",
      "colour",
      "stock",
      "uom",
    ],
  },
  {
    id: "procurement",
    label: "Vendor & PO Catalog",
    badge: "Purchasing",
    description: "Buyer catalog with supplier code, buying price, landed cost, minimum order quantities, and HSN codes.",
    columnKeys: [
      "code",
      "style_code",
      "name",
      "vendor_code",
      "brand",
      "category",
      "buying_price",
      "cost_price",
      "hsn_code",
      "uom",
    ],
  },
  {
    id: "ecom_catalog",
    label: "E-Commerce Digital Feed",
    badge: "Omnichannel",
    description: "Digital storefront and marketplace feed with titles, categories, online selling prices, and images.",
    columnKeys: [
      "code",
      "barcode",
      "name",
      "category",
      "brand",
      "mrp",
      "price",
      "weight_grams",
      "primary_image_url",
    ],
  },
  {
    id: "statutory_tax",
    label: "Statutory GST & HSN",
    badge: "GSTN",
    description: "Statutory tax audit sheet for GST returns, SAC services, and tax slab compliance.",
    columnKeys: [
      "code",
      "name",
      "hsn_code",
      "gst_percentage",
      "mrp",
      "price",
      "uom",
    ],
  },
  {
    id: "forensic_audit",
    label: "Forensic & Quality Audit",
    badge: "Audit Mode",
    description: "Auditor checklist reporting Legal Metrology price violations, negative margins, and missing statutory codes.",
    isAudit: true,
    columnKeys: [
      "code",
      "barcode",
      "name",
      "mrp",
      "price",
      "cost_price",
      "buying_price",
      "gst_percentage",
      "hsn_code",
      "compliance_status",
      "compliance_issues",
      "audit_margin_amount",
      "audit_margin_percentage",
      "audit_discount_amount",
      "created_at",
      "modified_at",
      "version",
    ],
  },
];

/**
 * Checks whether an item row is an exempt non-stock / service / free / sample item.
 */
function isExemptNonStockRow(row: any): boolean {
  if (!row) return false;
  const tm = String(row.tracking_mode || row.trackingMode || "").toLowerCase();
  const pm = String(row.pricing_mode || row.pricingMode || "").toLowerCase();
  const cat = String(row.category || "").toLowerCase();
  const itemType = String(row.item_type || row.itemType || "").toUpperCase();

  return (
    tm === "no-stock" ||
    tm === "nostock" ||
    tm === "service" ||
    tm === "non-stock" ||
    pm === "free" ||
    pm === "sample" ||
    pm === "promotional" ||
    cat === "service" ||
    cat === "services" ||
    cat === "sample" ||
    cat === "samples" ||
    cat === "promotion" ||
    cat === "promotional" ||
    cat === "free" ||
    itemType === "SERVICE" ||
    itemType === "PROMOTION" ||
    itemType === "SAMPLE" ||
    itemType === "NON_STOCK" ||
    itemType === "FREE" ||
    row.is_service_yn === true
  );
}

/**
 * Evaluates forensic data quality, statutory tax compliance, and Legal Metrology rules
 * on each item row, enriching the dataset with audit indicators and calculated margins.
 */
export function enrichItemRowsWithAuditMetadata(rows: any[]): any[] {
  if (!rows || !Array.isArray(rows)) return [];

  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;

    const issues: string[] = [];

    // 1. Mandatory Identity Check
    const code = String(row.code || row.item_code || "").trim();
    if (!code) {
      issues.push("Missing SKU / Item Code");
    }

    const barcode = String(row.barcode || "").trim();
    if (!barcode) {
      issues.push("Missing Barcode");
    }

    const name = String(row.name || row.item_name || "").trim();
    if (!name) {
      issues.push("Missing Product Name");
    }

    // 2. Statutory GST & HSN Check
    const hsn = String(row.hsn_code || row.hsnCode || "").trim();
    if (!hsn || hsn === "0000") {
      issues.push("Missing / Placeholder HSN Code");
    }

    const gstRaw = row.gst_percentage !== undefined ? row.gst_percentage : row.gstPercentage;
    const gstNum = typeof gstRaw === "number" ? gstRaw : parseFloat(String(gstRaw ?? "").replace(/[^0-9.]/g, "").trim());
    if (gstRaw === null || gstRaw === undefined || String(gstRaw).trim() === "" || isNaN(gstNum) || gstNum < 0) {
      issues.push("Missing GST Tax Rate");
    }

    // 3. Pricing Hierarchy & Legal Metrology Validation
    const isExempt = isExemptNonStockRow(row);
    const spRaw = row.price !== undefined ? row.price : row.sellingPrice;
    const sp = typeof spRaw === "number" ? spRaw : parseFloat(String(spRaw ?? "").trim());

    const mrpRaw = row.mrp;
    const mrp = typeof mrpRaw === "number" ? mrpRaw : parseFloat(String(mrpRaw ?? "").trim());

    const cpRaw = row.cost_price !== undefined ? row.cost_price : row.costPrice;
    const cp = typeof cpRaw === "number" ? cpRaw : parseFloat(String(cpRaw ?? "").trim());

    const bpRaw = row.buying_price !== undefined ? row.buying_price : row.buyingPrice;
    const bp = typeof bpRaw === "number" ? bpRaw : parseFloat(String(bpRaw ?? "").trim());

    if (!isExempt) {
      if (isNaN(bp) || bp <= 0) {
        issues.push("Missing Buying Price (> 0)");
      }
      if (isNaN(cp) || cp <= 0) {
        issues.push("Missing Cost Price (> 0)");
      }
      if (isNaN(sp) || sp < 0) {
        issues.push("Missing Selling Price (>= 0)");
      }
      if (isNaN(mrp) || mrp <= 0) {
        issues.push("Missing MRP (> 0)");
      } else if (!isNaN(sp) && mrp < sp) {
        issues.push(`Legal Metrology Violation: SP exceeds MRP (${sp} > ${mrp})`);
      }
      if (!isNaN(cp) && !isNaN(bp) && cp > bp) {
        issues.push(`Cost Price exceeds Buying Price (${cp} > ${bp})`);
      }
      if (!isNaN(sp) && !isNaN(cp) && cp > 0 && sp < cp) {
        issues.push(`Negative Margin: SP < Cost Price (${sp} < ${cp})`);
      }
    } else {
      if (!isNaN(sp) && !isNaN(mrp) && mrp > 0 && mrp < sp) {
        issues.push(`SP exceeds MRP (${sp} > ${mrp})`);
      }
    }

    // 4. Financial Metrics Calculation
    const validSp = !isNaN(sp) && sp >= 0 ? sp : 0;
    const validCp = !isNaN(cp) && cp >= 0 ? cp : 0;
    const validMrp = !isNaN(mrp) && mrp >= 0 ? mrp : 0;

    const marginAmt = validSp - validCp;
    const marginPct = validSp > 0 ? ((validSp - validCp) / validSp) * 100 : 0;
    const discountAmt = Math.max(0, validMrp - validSp);

    const isCompliant = issues.length === 0;

    return {
      ...row,
      compliance_status: isCompliant ? "COMPLIANT" : "FLAGGED",
      compliance_issues: isCompliant ? "None (Fully Compliant)" : issues.join(" | "),
      audit_margin_amount: marginAmt,
      audit_margin_percentage: marginPct,
      audit_discount_amount: discountAmt,
      // Normalize timestamp formats if present
      created_at: row.created_at ? String(row.created_at).replace("T", " ").substring(0, 19) : "",
      modified_at: row.modified_at ? String(row.modified_at).replace("T", " ").substring(0, 19) : "",
      version: row.version ?? 1,
    };
  });
}
