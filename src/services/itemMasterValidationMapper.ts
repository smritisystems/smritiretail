/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-04
 * Modified     : 2026-10-04
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Centralized Item Master 422 Validation Error Mapper
 *
 * Architecture (single pipeline, no per-form duplication):
 *
 *   API 422 Response
 *       ↓
 *   parseItemMaster422Response()          ← parse raw response body
 *       ↓
 *   NormalizedValidationResult            ← structured, typed
 *       ↓
 *   mapFieldsToFormRefs()                 ← map field keys → React ref IDs
 *       ↓
 *   Inline field errors + summary banner  ← rendered in form
 *       ↓
 *   focusFirstError()                     ← auto-focus first invalid field
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** One field-level validation error as returned by the backend. */
export interface FieldValidationError {
  /** Dot-notation field path: "code", "variant.size", "pricing.mrp" */
  field: string;
  /** Human-readable message already formatted by the backend mapper. */
  message: string;
  /** Optional: which form section this field belongs to. */
  section?: string;
}

/** The structured body of a 422 response from an Item Master endpoint. */
export interface ItemMaster422Body {
  error: {
    code: "ITEM_MASTER_VALIDATION_ERROR";
    message: string;   // e.g. "Please correct 3 fields before saving."
    status: 422;
    fields: FieldValidationError[];
  };
}

/** Result after parsing + normalizing a 422 response. */
export interface NormalizedValidationResult {
  /** Whether this is a recognized Item Master structured error. */
  isStructured: boolean;
  /** Top-level summary message (e.g. "Please correct 3 fields before saving.") */
  summary: string;
  /** Number of invalid fields. */
  fieldCount: number;
  /** Per-field errors keyed by field path. */
  fieldErrors: Record<string, string>;
  /** Ordered list of field paths in the order the backend reported them. */
  fieldOrder: string[];
}

/**
 * A typed error class thrown by apiFetchV1 for 422 Item Master responses.
 * Allows catch blocks to check `err instanceof ItemMasterValidationError`.
 */
export class ItemMasterValidationError extends Error {
  public readonly validation: NormalizedValidationResult;

  constructor(result: NormalizedValidationResult) {
    super(result.summary);
    this.name = "ItemMasterValidationError";
    this.validation = result;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Field → HTML element ID mapping
// ─────────────────────────────────────────────────────────────────────────────
//
// These IDs must match the `id` attribute on the corresponding <input>,
// <select>, or <textarea> elements in AddProductDrawer.tsx and any other
// Item Master form that consumes this mapper.
//
// Naming convention: `im-field-{field_key_with_underscores_not_dots}`
// ─────────────────────────────────────────────────────────────────────────────

export const FIELD_TO_ELEMENT_ID: Record<string, string> = {
  // ── Basic Information (Step 1) ───────────────────────────────────────────────
  // The SKU / Article Number / Style Code are all the same field in the form.
  "code":                    "im-field-code",
  "sku":                     "im-field-code",
  "item_code":               "im-field-code",
  "style_code":              "im-field-code",  // Article/Design/Style maps to SKU input
  "article":                 "im-field-code",
  "name":                    "im-field-name",
  "item_name":               "im-field-name",
  "style_name":              "im-field-name",
  "brand":                   "im-field-brand",
  "category":                "im-field-category",
  "gender":                  "im-field-gender",
  "product_type":            "im-field-product_type",
  "design_attribute":        "im-field-product_type",

  // ── Classification (Step 1) ─────────────────────────────────────────────────
  "hsn_code":                "im-field-hsn_code",

  // ── Pricing (Step 1) ────────────────────────────────────────────────────────
  "mrp":                     "im-field-mrp",
  "price":                   "im-field-mrp",
  "pricing.retail_price":    "im-field-mrp",
  "pricing.mrp":             "im-field-mrp",
  "selling_price":           "im-field-selling_price",
  "cost_price":              "im-field-selling_price",  // no dedicated cost input, nearest field
  "buying_price":            "im-field-selling_price",
  "pricing.cost_price":      "im-field-selling_price",
  "pricing.buying_price":    "im-field-selling_price",

  // ── Tax (Step 1) ─────────────────────────────────────────────────────────────
  // gst_percentage is hardcoded to 12 in the payload — no rendered input.
  // Focus the MRP field (nearest pricing field) as the best navigable fallback.
  "gst_percentage":          "im-field-mrp",
  "tax_rate":                "im-field-mrp",
  "is_tax_inclusive":        "im-field-mrp",

  // ── Variant / Step 2 — Chip Group Containers ─────────────────────────────────
  // Color and size are chip-button groups in Step 2.
  // im-field-color and im-field-size are real container divs with tabIndex="-1"
  // that can receive focus and display a red ring highlight.
  "color":                   "im-field-color",
  "colour":                  "im-field-color",
  "variant.color":           "im-field-color",
  "variant.colour":          "im-field-color",
  "size":                    "im-field-size",
  "variant.size":            "im-field-size",
  "size_system":             "im-field-size",    // size system — no separate control; size group is closest
  "variant.size_system":     "im-field-size",

  // ── System / Status ──────────────────────────────────────────────────────────
  "status":                  "im-field-code",   // no status input; fallback to first field
  "is_inventory_yn":         "im-field-code",
  "is_billable_yn":          "im-field-code",
  "is_service_yn":           "im-field-code",

  // ── Barcode (Step 2) ─────────────────────────────────────────────────────────
  "barcode":                 "im-field-barcode",
  "primary_barcode":         "im-field-barcode",

  // ── Units & UOM (Phase 2) ──────────────────────────────────────────────────
  "stock_uom":               "im-field-stock_uom",
  "stock_uom_id":            "im-field-stock_uom",
  "uom.stock_uom_id":        "im-field-stock_uom",
  "sales_uom":               "im-field-sales_uom",
  "sales_uom_id":            "im-field-sales_uom",
  "purchase_uom":            "im-field-purchase_uom",
  "purchase_uom_id":         "im-field-purchase_uom",
  "conversion_factor":       "im-field-conversion_factor",
  "uom.conversion_factor":   "im-field-conversion_factor",

  // ── Tax Profile (Phase 2) ──────────────────────────────────────────────────
  "hsn_sac_code":            "im-field-hsn_sac_code",
  "tax.hsn_sac_code":        "im-field-hsn_sac_code",
  "gst_rate":                "im-field-gst_rate",
  "tax.gst_rate":            "im-field-gst_rate",
  "tax_category":            "im-field-tax_category",
  "tax_inclusive":           "im-field-tax_inclusive",
  "sales_tax_rate":          "im-field-sales_tax_rate",
  "purchase_tax_rate":       "im-field-purchase_tax_rate",
  "tax_exempt":              "im-field-tax_exempt",

  // ── Pricing & Commercial (Phase 2) ─────────────────────────────────────────
  "dealer_price":            "im-field-dealer_price",
  "wholesale_price":         "im-field-wholesale_price",
  "minimum_selling_price":   "im-field-minimum_selling_price",
  "maximum_discount_percent":"im-field-maximum_discount_percent",
  "pricing.dealer_price":    "im-field-dealer_price",
  "pricing.wholesale_price": "im-field-wholesale_price",
  "pricing.minimum_selling_price": "im-field-minimum_selling_price",
  "pricing.maximum_discount_percent": "im-field-maximum_discount_percent",

  // ── Purchasing / Supplier (Phase 2) ────────────────────────────────────────
  "preferred_supplier_id":   "im-field-preferred_supplier_id",
  "supplier_item_code":      "im-field-supplier_item_code",
  "minimum_purchase_qty":    "im-field-minimum_purchase_qty",
  "purchase_cost":           "im-field-purchase_cost",
  "last_purchase_price":     "im-field-last_purchase_price",
  "purchase_lead_time":      "im-field-purchase_lead_time",
  "purchasing.preferred_supplier_id": "im-field-preferred_supplier_id",
  "purchasing.purchase_uom_id": "im-field-purchase_uom",
  "purchasing.minimum_purchase_qty": "im-field-minimum_purchase_qty",

  // ── Sales (Phase 2) ────────────────────────────────────────────────────────
  "allow_discount":          "im-field-allow_discount",
  "billable":                "im-field-billable",
  "sales.selling_price":     "im-field-selling_price",
  "sales.mrp":               "im-field-mrp",

  // ── Inventory Policy (Phase 2) ─────────────────────────────────────────────
  "minimum_stock":           "im-field-minimum_stock",
  "reorder_level":           "im-field-reorder_level",
  "reorder_quantity":        "im-field-reorder_quantity",
  "maximum_stock":           "im-field-maximum_stock",
  "safety_stock":            "im-field-safety_stock",
  "lead_time":               "im-field-lead_time",
  "inventory_policy.minimum_stock": "im-field-minimum_stock",
  "inventory_policy.reorder_level": "im-field-reorder_level",
  "inventory_policy.reorder_quantity": "im-field-reorder_quantity",
  "inventory_policy.maximum_stock": "im-field-maximum_stock",
  "inventory_policy.safety_stock": "im-field-safety_stock",
  "inventory_policy.lead_time": "im-field-lead_time",
};


// ─────────────────────────────────────────────────────────────────────────────
// Core Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an Item Master 422 response body into a normalized, typed result.
 *
 * Handles three input shapes:
 *   1. Canonical structured:  { error: { code: "ITEM_MASTER_VALIDATION_ERROR", fields: [...] } }
 *   2. Legacy HREP:           { error: { explanation: "..." }, detail: "..." }
 *   3. Completely unknown:    any raw error body
 *
 * In all cases, NO raw Pydantic / HTTP / internal text is returned to the caller.
 */
export function parseItemMaster422Response(
  responseBody: unknown
): NormalizedValidationResult {
  // Guard: must be an object
  if (!responseBody || typeof responseBody !== "object") {
    return _fallbackResult("Please correct the highlighted fields before saving.");
  }

  const body = responseBody as Record<string, unknown>;

  // ── Case 1: Canonical structured response ──────────────────────────────────
  if (
    body.error &&
    typeof body.error === "object" &&
    (body.error as Record<string, unknown>).code === "ITEM_MASTER_VALIDATION_ERROR"
  ) {
    const errObj = body.error as ItemMaster422Body["error"];
    const fields: FieldValidationError[] = Array.isArray(errObj.fields) ? errObj.fields : [];

    const fieldErrors: Record<string, string> = {};
    const fieldOrder: string[] = [];

    for (const f of fields) {
      if (f.field && f.message) {
        fieldErrors[f.field] = f.message;
        fieldOrder.push(f.field);
      }
    }

    const count = fieldOrder.length;
    const summary =
      errObj.message ||
      (count > 0
        ? `Please correct ${count} field${count !== 1 ? "s" : ""} before saving.`
        : "Please correct the highlighted fields before saving.");

    return {
      isStructured: true,
      summary,
      fieldCount: count,
      fieldErrors,
      fieldOrder,
    };
  }

  // ── Case 2: Legacy HREP with single explanation string ─────────────────────
  const legacyMsg = _extractLegacyMessage(body);
  if (legacyMsg) {
    // Sanitize: strip any raw Pydantic/stack/HTTP content before showing to user
    const safe = _sanitizeLegacyMessage(legacyMsg);
    return {
      isStructured: false,
      summary: safe,
      fieldCount: 0,
      fieldErrors: {},
      fieldOrder: [],
    };
  }

  // ── Case 3: Completely unknown ─────────────────────────────────────────────
  return _fallbackResult("Please correct the highlighted fields before saving.");
}

// ─────────────────────────────────────────────────────────────────────────────
// UX Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Focus the DOM element corresponding to the first field error.
 * Scrolls it into view if needed.
 *
 * @param fieldOrder  Ordered list of field keys from the validation result
 * @param fieldToId   Override mapping (defaults to FIELD_TO_ELEMENT_ID)
 */
export function focusFirstError(
  fieldOrder: string[],
  fieldToId: Record<string, string> = FIELD_TO_ELEMENT_ID
): void {
  for (const fieldKey of fieldOrder) {
    const elemId = fieldToId[fieldKey];
    if (!elemId) continue;

    const el = document.getElementById(elemId) as HTMLElement | null;
    if (!el) continue;

    // Scroll into view first (smooth if supported)
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      el.scrollIntoView();
    }

    // Then focus
    try {
      el.focus();
    } catch {
      // Not all elements can be focused
    }

    break; // Only first error
  }
}

/**
 * Build the validation summary banner text.
 * Example: "Please correct 3 fields before saving."
 */
export function buildValidationSummary(fieldCount: number): string {
  if (fieldCount === 0) return "Please correct the highlighted fields before saving.";
  return `Please correct ${fieldCount} field${fieldCount !== 1 ? "s" : ""} before saving.`;
}

/**
 * Get the HTML element ID for a given backend field key.
 * Returns undefined if no mapping is registered.
 */
export function getFieldElementId(fieldKey: string): string | undefined {
  return FIELD_TO_ELEMENT_ID[fieldKey];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

function _fallbackResult(summary: string): NormalizedValidationResult {
  return {
    isStructured: false,
    summary,
    fieldCount: 0,
    fieldErrors: {},
    fieldOrder: [],
  };
}

function _extractLegacyMessage(body: Record<string, unknown>): string | null {
  // Try various shapes the legacy HREP handler might produce
  const candidates: unknown[] = [
    (body.error as Record<string, unknown> | undefined)?.explanation,
    (body.error as Record<string, unknown> | undefined)?.message,
    body.detail,
    body.message,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

/** Strip known technical strings that must never appear in user-facing messages. */
const _FORBIDDEN_PATTERNS: RegExp[] = [
  /pydantic/gi,
  /traceback/gi,
  /sqlalchemy/gi,
  /fastapi/gi,
  /422 unprocessable entity/gi,
  /unprocessable entity/gi,
  /validation error/gi,
  /value_error\./gi,
  /type_error\./gi,
  /body\s*->/gi,
  /\bexception\b/gi,
  /\bstacktrace\b/gi,
];

function _sanitizeLegacyMessage(raw: string): string {
  let clean = raw;
  for (const pat of _FORBIDDEN_PATTERNS) {
    if (pat.test(clean)) {
      return "Please check the highlighted fields and correct any errors before saving.";
    }
  }
  return clean;
}
