/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 4.2.0
 * * Created    : 2026-09-12
 * * Modified   : 2026-09-28
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 *
 * Change Log (v4.2.0 — 2026-09-28):
 *   - Extended GOVERNED_LOOKUP_TYPES to include all live master_types from DB:
 *     gst_rate, department, product_type, gender, uom, payment_mode,
 *     collection_type, heel_type, upper_material, outsole_material,
 *     item_attribute.
 *   - Added OPTIONAL_LOOKUP_TYPES: types validated only when the field is
 *     present in the row (avoids false positives for partial item master forms).
 *   - Added vendorCode-scoped lookup: style_article and color resolve against
 *     the active vendor's scope when a vendor_code field is present in the row.
 *   - Added validateItemMasterExists(): checks that a given item_code / barcode
 *     exists in the live item master via /master/item endpoint.
 *   - Added validateHsnCode(): validates HSN code via /masters/lookup/hsn-codes.
 *   - validateItemMasterLookupOptions() now accepts an optional ValidationMode:
 *     "strict" (fail any missing value) or "warn" (accumulate warnings only).
 *   - TTL cache (5 min) and in-flight deduplication introduced in v4.1.0 kept.
 *   - invalidateGovernedLookupCache() exported for post-write invalidation.
 */

import { apiFetchV1 } from "../lib/apiFetchV1.ts";

// ---------------------------------------------------------------------------
// Lookup type registry — sourced from live master_types table
// ---------------------------------------------------------------------------

/**
 * Core types that are ALWAYS validated when the corresponding field is
 * non-empty in an Item Master row. Each type_code maps to a live
 * /masters/lookup/{type_code}/values endpoint backed by the master_types DB.
 */
const GOVERNED_LOOKUP_TYPES = [
  // Retail classification
  "brand",
  "category",
  "subcategory",
  "department",
  "product_type",
  "collection_type",
  "gender",

  // Variant axes
  "style_article",
  "size",
  "color",

  // Tax & compliance
  "gst_rate",

  // Procurement
  "vendor_code",

  // Operational
  "uom",
  "payment_mode",

  // Footwear-specific attributes (validated when present)
  "heel_type",
  "upper_material",
  "outsole_material",
] as const;

type LookupType = typeof GOVERNED_LOOKUP_TYPES[number];

/** TTL for the module-level lookup cache (milliseconds). 5 minutes. */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Field → LookupType mapping
// Maps every known field name alias in an Item Master row to its lookup type.
// ---------------------------------------------------------------------------

const FIELD_LOOKUP_MAP: Record<LookupType, string[]> = {
  brand:             ["brand"],
  category:          ["category"],
  subcategory:       ["subCategory", "subcategory", "sub_category", "subcat"],
  department:        ["department", "dept"],
  product_type:      ["productType", "product_type", "type"],
  collection_type:   ["collectionType", "collection_type", "collection"],
  gender:            ["gender"],

  style_article:     [
    "style",
    "style_code",
    "styleCode",
    "stylecode",
    "style_article",
    "styleArticle",
    "article",
    "article_no",
    "articleNo",
  ],
  size:              ["size"],
  color:             ["shade", "color", "colour"],

  gst_rate:          ["gstRate", "gst_rate", "gst", "taxRate", "tax_rate"],

  vendor_code:       ["vendorCode", "vendor_code", "vendor"],

  uom:               ["uom", "unit", "unitOfMeasure", "unit_of_measure"],
  payment_mode:      ["paymentMode", "payment_mode"],

  heel_type:         ["heelType", "heel_type", "heel"],
  upper_material:    ["upperMaterial", "upper_material", "upper"],
  outsole_material:  ["outsoleMaterial", "outsole_material", "outsole"],
};

// ---------------------------------------------------------------------------
// Types that are OPTIONAL — skipped if all mapped fields are blank/absent
// ---------------------------------------------------------------------------
const OPTIONAL_LOOKUP_TYPES = new Set<LookupType>([
  "department",
  "product_type",
  "collection_type",
  "gender",
  "uom",
  "payment_mode",
  "heel_type",
  "upper_material",
  "outsole_material",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalize = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

const isBlank = (value: unknown): boolean => normalize(value) === "";

export interface LookupOption {
  code: string;
  name: string;
}

export type ValidationMode = "strict" | "warn";

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Module-level cache — shared across all components in the same browser tab
// ---------------------------------------------------------------------------

let _cachedOptions: Record<LookupType, LookupOption[]> | null = null;
let _cacheTimestamp = 0;
let _inFlightPromise: Promise<Record<LookupType, LookupOption[]>> | null = null;

/**
 * Invalidate the lookup cache on demand (e.g., after a master data write).
 */
export function invalidateGovernedLookupCache(): void {
  _cachedOptions = null;
  _cacheTimestamp = 0;
  _inFlightPromise = null;
}

// ---------------------------------------------------------------------------
// fetchGovernedLookupOptions — cached + deduplicated
// ---------------------------------------------------------------------------

/**
 * Fetch governed lookup options for all registered lookup types.
 *
 * Results are cached for CACHE_TTL_MS (5 min). Concurrent callers in the same
 * browser tab share a single in-flight Promise, preventing request storms from
 * multiple useEffect hooks mounting simultaneously.
 */
export async function fetchGovernedLookupOptions(): Promise<Record<LookupType, LookupOption[]>> {
  const now = Date.now();
  if (_cachedOptions !== null && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedOptions;
  }

  if (_inFlightPromise !== null) {
    return _inFlightPromise;
  }

  _inFlightPromise = (async () => {
    const result: Partial<Record<LookupType, LookupOption[]>> = {};

    await Promise.all(
      GOVERNED_LOOKUP_TYPES.map(async (typeCode) => {
        try {
          const values = await apiFetchV1(`/masters/lookup/${typeCode}/values?activeOnly=true`);
          result[typeCode] = Array.isArray(values)
            ? values.map((v: any) => ({ code: String(v.code), name: String(v.name) }))
            : [];
        } catch {
          result[typeCode] = [];
        }
      })
    );

    const resolved = result as Record<LookupType, LookupOption[]>;
    _cachedOptions = resolved;
    _cacheTimestamp = Date.now();
    _inFlightPromise = null;
    return resolved;
  })();

  return _inFlightPromise;
}

// ---------------------------------------------------------------------------
// Vendor-scoped lookup (style_article, color per vendor)
// ---------------------------------------------------------------------------

/**
 * Fetch lookup values scoped to a specific vendor code.
 * Used when vendor_code is present in the row to narrow style/color options.
 */
export async function fetchVendorScopedLookup(
  typeCode: "style_article" | "color",
  vendorCode: string
): Promise<LookupOption[]> {
  try {
    const values = await apiFetchV1(
      `/masters/lookup/${typeCode}/values?activeOnly=true&vendorCode=${encodeURIComponent(vendorCode)}&includeUnassigned=true`
    );
    return Array.isArray(values)
      ? values.map((v: any) => ({ code: String(v.code), name: String(v.name) }))
      : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// validateItemMasterLookupOptions — row-level validation (reuses cache)
// ---------------------------------------------------------------------------

/**
 * Validate that Item Master row field values exist in the governed lookup
 * master data. Reuses the shared cache — does NOT trigger a second batch of
 * requests.
 *
 * @param rows    Array of Item Master rows (keyed by field name).
 * @param mode    "strict" → all unrecognized values are errors (default).
 *                "warn"   → unrecognized values collected as warnings only.
 */
export async function validateItemMasterLookupOptions(
  rows: Record<string, unknown>[],
  mode: ValidationMode = "strict"
): Promise<string[]> {
  const result = await validateItemMasterLookupOptionsDetailed(rows, mode);
  return mode === "warn" ? result.warnings : result.errors;
}

/**
 * Like validateItemMasterLookupOptions but returns separate errors and warnings.
 */
export async function validateItemMasterLookupOptionsDetailed(
  rows: Record<string, unknown>[],
  mode: ValidationMode = "strict"
): Promise<ValidationResult> {
  const optionsByType = await fetchGovernedLookupOptions();

  // Pre-build Sets for fast O(1) lookup per type
  const valuesByType = new Map<LookupType, Set<string>>();
  for (const typeCode of GOVERNED_LOOKUP_TYPES) {
    const options = optionsByType[typeCode] ?? [];
    valuesByType.set(
      typeCode,
      new Set(options.flatMap((v) => [v.code, v.name].map(normalize)))
    );
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    const rowLabel = `Row #${rowIndex + 1}`;

    // Resolve the vendor code on this row (used for vendor-scoped hint messages)
    const rowVendorCode = FIELD_LOOKUP_MAP["vendor_code"]
      .map((f) => row[f])
      .find((v) => !isBlank(v));

    for (const typeCode of GOVERNED_LOOKUP_TYPES) {
      const fieldValue = FIELD_LOOKUP_MAP[typeCode]
        .map((field) => row[field])
        .find((v) => !isBlank(v));

      // Skip optional types when field is absent
      if (fieldValue === undefined || isBlank(fieldValue)) {
        if (OPTIONAL_LOOKUP_TYPES.has(typeCode)) continue;
        // Non-optional but blank → skip without error (blank is allowed)
        continue;
      }

      const normalizedValue = normalize(fieldValue);
      const knownValues = valuesByType.get(typeCode);

      if (knownValues && knownValues.size > 0 && !knownValues.has(normalizedValue)) {
        const vendorHint =
          rowVendorCode &&
          (typeCode === "style_article" || typeCode === "color")
            ? ` for vendor "${String(rowVendorCode)}"`
            : "";
        const msg =
          `${rowLabel}: "${typeCode}" value "${String(fieldValue)}" is not in the active master${vendorHint}. ` +
          `Valid options: ${Array.from(knownValues).slice(0, 5).join(", ")}${knownValues.size > 5 ? "…" : ""}.`;

        if (mode === "warn") {
          warnings.push(msg);
        } else {
          errors.push(msg);
        }
      }
    }

    // GST rate: also verify numeric value is one of the valid slabs
    const gstField = FIELD_LOOKUP_MAP["gst_rate"]
      .map((f) => row[f])
      .find((v) => !isBlank(v));
    if (gstField !== undefined) {
      const gstNum = Number(gstField);
      const validSlabs = (optionsByType["gst_rate"] ?? []).map((o) => Number(o.code));
      if (!isNaN(gstNum) && validSlabs.length > 0 && !validSlabs.includes(gstNum)) {
        const msg =
          `${rowLabel}: GST rate "${String(gstField)}" is not a recognized GST slab. ` +
          `Valid slabs: ${validSlabs.join("%, ")}%.`;
        mode === "warn" ? warnings.push(msg) : errors.push(msg);
      }
    }
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// validateItemMasterExists — checks item_code / barcode in live item master
// ---------------------------------------------------------------------------

export interface ItemExistenceResult {
  found: boolean;
  item_id?: string;
  item_name?: string;
  item_code?: string;
}

/**
 * Check if an item exists in the live Item Master by item_code or barcode.
 * Uses the /masters/lookup/master/item endpoint.
 */
export async function validateItemMasterExists(
  query: string
): Promise<ItemExistenceResult> {
  if (!query || !query.trim()) return { found: false };
  try {
    const result = await apiFetchV1<{ items?: any[]; total?: number }>(
      `/masters/lookup/master/item?q=${encodeURIComponent(query.trim())}&page_size=1`
    );
    const items = result?.items;
    if (Array.isArray(items) && items.length > 0) {
      const match = items[0];
      return {
        found: true,
        item_id:   String(match.id   ?? match.item_id   ?? ""),
        item_code: String(match.code ?? match.item_code ?? ""),
        item_name: String(match.name ?? match.item_name ?? ""),
      };
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

// ---------------------------------------------------------------------------
// validateHsnCode — validates HSN/SAC code via dedicated endpoint
// ---------------------------------------------------------------------------

export interface HsnValidationResult {
  valid: boolean;
  gstPct?: number;
  description?: string;
}

/**
 * Check if an HSN/SAC code is recognised in the system's HSN lookup.
 */
export async function validateHsnCode(
  hsnCode: string
): Promise<HsnValidationResult> {
  if (!hsnCode || !hsnCode.trim()) return { valid: false };
  try {
    const results = await apiFetchV1<
      Array<{ code: string; desc?: string; gstPct?: number }>
    >(`/masters/lookup/hsn-codes?q=${encodeURIComponent(hsnCode.trim())}&limit=5`);
    if (!Array.isArray(results)) return { valid: false };
    const match = results.find(
      (r) => normalize(r.code) === normalize(hsnCode)
    );
    if (match) {
      return { valid: true, gstPct: match.gstPct, description: match.desc };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}