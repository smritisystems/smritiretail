/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.2
 * Created      : 2026-10-13
 * Modified     : 2026-10-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Price Revision Studio Business Logic & Routing Invariant Tests
 */

import { describe, it, expect } from "vitest";
import { mapModuleId } from "../components/shell/TabRenderer";

// Business calculation helpers representing PriceRevisionStudio pure functions
export function computePriceDeltas(curMrp: number, curSp: number, newMrp: number, newSp: number, newCp?: number) {
  const mrpDelta = curMrp > 0 ? ((newMrp - curMrp) / curMrp) * 100 : 0;
  const spDelta = curSp > 0 ? ((newSp - curSp) / curSp) * 100 : 0;
  const marginPct = newSp > 0 && newCp !== undefined ? ((newSp - newCp) / newSp) * 100 : 0;
  const isCeilingViolation = newSp > newMrp;

  return { mrpDelta, spDelta, marginPct, isCeilingViolation };
}

export function parseBulkPriceCsv(csvText: string) {
  const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows: any[] = [];
  const errors: string[] = [];

  lines.forEach((line, idx) => {
    if (idx === 0 && (line.toLowerCase().includes("sku") || line.toLowerCase().includes("barcode"))) return;

    const parts = line.includes("\t")
      ? line.split("\t").map((p) => p.trim())
      : line.split(",").map((p) => p.trim());

    if (parts.length < 3) {
      errors.push(`Row ${idx + 1}: Insufficient columns. Minimum required: sku_or_barcode, revised_mrp, revised_sp`);
      return;
    }

    const [sku, mrpStr, spStr, cpStr, effStr, reason] = parts;
    const mrp = parseFloat(mrpStr);
    const sp = parseFloat(spStr);
    const cp = cpStr ? parseFloat(cpStr) : undefined;

    if (isNaN(mrp) || isNaN(sp)) {
      errors.push(`Row ${idx + 1} (${sku}): Invalid numeric price.`);
      return;
    }

    if (sp > mrp) {
      errors.push(`Row ${idx + 1} (${sku}): Statutory Violation! Selling Price (₹${sp}) cannot exceed MRP (₹${mrp}).`);
    }

    rows.push({
      sku_or_barcode: sku,
      revised_mrp: mrp,
      revised_selling_price: sp,
      revised_cost_price: cp,
      effective_from: effStr || undefined,
      reason_code: reason || "BULK_IMPORT",
      is_valid: sp <= mrp,
    });
  });

  return { rows, errors };
}

describe("SMRITI — Price Revision Studio Routing & Business Invariant Tests", () => {
  it("should resolve menu-price-revision and alias routes to price-revision workspace tab", () => {
    expect(mapModuleId("menu-price-revision")).toBe("price-revision");
    expect(mapModuleId("price-revision")).toBe("price-revision");
    expect(mapModuleId("price_revision")).toBe("price-revision");
    expect(mapModuleId("price-revisions")).toBe("price-revision");
    expect(mapModuleId("pricing-revisions")).toBe("price-revision");
  });

  it("should calculate price deltas and margin percentage accurately", () => {
    const res = computePriceDeltas(1000, 800, 1200, 1000, 600);
    // MRP: 1000 -> 1200 (+20%)
    expect(res.mrpDelta).toBeCloseTo(20.0, 1);
    // SP: 800 -> 1000 (+25%)
    expect(res.spDelta).toBeCloseTo(25.0, 1);
    // Margin: (1000 - 600) / 1000 * 100 = 40%
    expect(res.marginPct).toBeCloseTo(40.0, 1);
    // Statutory ceiling: 1000 <= 1200 -> Valid
    expect(res.isCeilingViolation).toBe(false);
  });

  it("should flag statutory ceiling violation when selling price exceeds MRP", () => {
    // Violation case: SP 1300 > MRP 1200
    const res = computePriceDeltas(1000, 900, 1200, 1300, 700);
    expect(res.isCeilingViolation).toBe(true);
  });

  it("should validate and parse comma-separated bulk price revision rows", () => {
    const csvData = [
      "sku_or_barcode, revised_mrp, revised_selling_price, revised_cost_price, effective_from, reason_code",
      "SKU-1001, 1000.00, 950.00, 600.00, 2026-11-01T00:00:00Z, MANUAL_REVISION",
      "SKU-1002, 500.00, 450.00, 300.00, , SEASONAL_PROMO",
    ].join("\n");

    const result = parseBulkPriceCsv(csvData);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].sku_or_barcode).toBe("SKU-1001");
    expect(result.rows[0].revised_mrp).toBe(1000.0);
    expect(result.rows[0].revised_selling_price).toBe(950.0);
    expect(result.rows[0].is_valid).toBe(true);
  });

  it("should validate and parse tab-separated (TSV) clipboard paste data", () => {
    const tsvData = [
      "SKU\trevised_mrp\trevised_sp\trevised_cp",
      "SKU-TSV-01\t2500.00\t2200.00\t1500.00",
      "SKU-TSV-02\t1800.00\t1650.00\t1100.00",
    ].join("\n");

    const result = parseBulkPriceCsv(tsvData);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].sku_or_barcode).toBe("SKU-TSV-01");
    expect(result.rows[0].revised_mrp).toBe(2500.0);
    expect(result.rows[0].revised_selling_price).toBe(2200.0);
  });

  it("should detect statutory ceiling violations in bulk import and report row-level errors", () => {
    const invalidCsv = [
      "sku_or_barcode, revised_mrp, revised_selling_price, revised_cost_price",
      "SKU-GOOD, 1000.00, 900.00, 600.00",
      "SKU-BAD, 500.00, 650.00, 350.00", // VIOLATION: SP 650 > MRP 500
    ].join("\n");

    const result = parseBulkPriceCsv(invalidCsv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Statutory Violation! Selling Price (₹650) cannot exceed MRP (₹500)");
    expect(result.rows[0].is_valid).toBe(true);
    expect(result.rows[1].is_valid).toBe(false);
  });
});
