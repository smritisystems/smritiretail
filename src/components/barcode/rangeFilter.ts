/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.51.0
 * Created      : 2026-10-10
 * Modified     : 2026-10-10
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { LabelPrintRow, ItemMasterSelectionCriteria, GridRangeField } from "./types.ts";

/**
 * Natural comparison supporting alphanumeric tokens, leading zeros, and pure numeric sequences.
 * Example: "CH-10-A" < "CH-20-C" < "CH-30-K", and "000006" < "000010".
 */
export function compareNatural(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  // Pure numeric check for fast BigInt / Number comparison (e.g. EAN-13 barcodes, SKU codes)
  const isDigitsA = /^\d+$/.test(a);
  const isDigitsB = /^\d+$/.test(b);

  if (isDigitsA && isDigitsB) {
    try {
      const bigA = BigInt(a);
      const bigB = BigInt(b);
      if (bigA < bigB) return -1;
      if (bigA > bigB) return 1;
      return 0;
    } catch {
      // Fallback if BigInt parsing fails
    }
  }

  // Alphanumeric natural collation (case-insensitive, numeric-aware)
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Validates whether a given value falls inclusively within the range [fromVal, toVal].
 * If either boundary is omitted or empty, that boundary is treated as unbounded.
 */
export function isWithinRange(
  val: string | number,
  fromVal?: string | number,
  toVal?: string | number,
  mode: "numeric" | "text" | "barcode" | "style" = "text"
): boolean {
  const fromStr = fromVal !== undefined && fromVal !== null ? String(fromVal).trim() : "";
  const toStr = toVal !== undefined && toVal !== null ? String(toVal).trim() : "";

  // If both bounds are blank, everything matches
  if (!fromStr && !toStr) {
    return true;
  }

  if (mode === "numeric") {
    const numVal = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
    if (isNaN(numVal)) return false;

    if (fromStr) {
      const fromNum = parseFloat(fromStr.replace(/[^0-9.-]/g, ""));
      if (!isNaN(fromNum) && numVal < fromNum) return false;
    }

    if (toStr) {
      const toNum = parseFloat(toStr.replace(/[^0-9.-]/g, ""));
      if (!isNaN(toNum) && numVal > toNum) return false;
    }

    return true;
  }

  const strVal = String(val ?? "").trim();
  if (!strVal) return false;

  if (mode === "barcode") {
    // If all provided values are strictly digits, use BigInt/numeric range matching
    const isValDigits = /^\d+$/.test(strVal);
    const isFromDigits = !fromStr || /^\d+$/.test(fromStr);
    const isToDigits = !toStr || /^\d+$/.test(toStr);

    if (isValDigits && isFromDigits && isToDigits) {
      const bigVal = BigInt(strVal);
      if (fromStr) {
        const bigFrom = BigInt(fromStr);
        if (bigVal < bigFrom) return false;
      }
      if (toStr) {
        const bigTo = BigInt(toStr);
        if (bigVal > bigTo) return false;
      }
      return true;
    }
  }

  // Standard alphanumeric / natural string range
  if (fromStr && compareNatural(strVal, fromStr) < 0) {
    return false;
  }
  if (toStr && compareNatural(strVal, toStr) > 0) {
    return false;
  }

  return true;
}

/**
 * Filter rows against the complete Item Master Selection Criteria (Step 1),
 * enforcing AND logic across Barcode (exact and range), Style, SKU, MRP, and multi-select criteria.
 */
export function filterRowsByItemMasterCriteria(
  rows: LabelPrintRow[],
  criteria: Partial<ItemMasterSelectionCriteria>
): LabelPrintRow[] {
  return rows.filter(row => {
    // 1. Stock No / SKU Range (Natural Alphanumeric / Numeric)
    if (criteria.stockNoFrom || criteria.stockNoTo) {
      if (!isWithinRange(row.stockNo, criteria.stockNoFrom, criteria.stockNoTo, "text")) {
        return false;
      }
    }

    // 2. Barcode Exact Match (dedicated scan field)
    if (criteria.barcode && criteria.barcode.trim()) {
      const b = criteria.barcode.trim().toLowerCase();
      if (row.barcode.toLowerCase() !== b && row.stockNo.toLowerCase() !== b) {
        return false;
      }
    }

    // 3. Barcode Range (From -> To)
    if (criteria.barcodeFrom || criteria.barcodeTo) {
      if (!isWithinRange(row.barcode, criteria.barcodeFrom, criteria.barcodeTo, "barcode")) {
        return false;
      }
    }

    // 4. Style Range (From -> To)
    if (criteria.styleFrom || criteria.styleTo) {
      if (!isWithinRange(row.style, criteria.styleFrom, criteria.styleTo, "style")) {
        return false;
      }
    }

    // 5. MRP Range (Min -> Max)
    if (criteria.mrpFrom || criteria.mrpTo) {
      if (!isWithinRange(row.mrp, criteria.mrpFrom, criteria.mrpTo, "numeric")) {
        return false;
      }
    }

    // 6. Product Names (Multi-select)
    if (criteria.productNames && criteria.productNames.length > 0 && !criteria.productNames.includes(row.product)) {
      return false;
    }

    // 7. Brands (Multi-select)
    if (criteria.brands && criteria.brands.length > 0 && !criteria.brands.includes(row.brand)) {
      return false;
    }

    // 8. Categories (Multi-select)
    if (criteria.categories && criteria.categories.length > 0 && (!row.category || !criteria.categories.includes(row.category))) {
      return false;
    }

    // 9. Style Codes (Multi-select)
    if (criteria.styleCodes && criteria.styleCodes.length > 0 && !criteria.styleCodes.includes(row.style)) {
      return false;
    }

    // 10. Colours / Shades (Multi-select)
    if (criteria.colours && criteria.colours.length > 0 && !criteria.colours.includes(row.colour)) {
      return false;
    }

    // 11. Sizes (Multi-select)
    if (criteria.sizes && criteria.sizes.length > 0 && !criteria.sizes.includes(row.size)) {
      return false;
    }

    return true;
  });
}

/**
 * Evaluates which rows in a loaded grid match a given Range criterion on a specified column.
 * Used by the Step 3 Grid Range Selection toolbar.
 */
export function filterRowsByGridRange(
  rows: LabelPrintRow[],
  targetField: GridRangeField,
  fromVal: string,
  toVal: string
): LabelPrintRow[] {
  if (!fromVal.trim() && !toVal.trim()) {
    return rows;
  }

  return rows.filter(row => {
    switch (targetField) {
      case "barcode":
        return isWithinRange(row.barcode, fromVal, toVal, "barcode");
      case "style":
        return isWithinRange(row.style, fromVal, toVal, "style");
      case "stockNo":
        return isWithinRange(row.stockNo, fromVal, toVal, "text");
      case "sNo":
        return isWithinRange(row.sNo, fromVal, toVal, "numeric");
      case "mrp":
        return isWithinRange(row.mrp, fromVal, toVal, "numeric");
      default:
        return true;
    }
  });
}
