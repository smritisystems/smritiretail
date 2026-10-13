/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.3
 * Created      : 2026-10-13
 * Modified     : 2026-10-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Price Revision Studio Business Logic & Bulk Workflow Invariant Tests
 */

import { describe, it, expect } from "vitest";
import { mapModuleId } from "../components/shell/TabRenderer";
import {
  calculateProposedPrice,
  computeItemPreviewPrices,
  parseBulkPriceCsv,
  BulkItemCandidate,
  RevisionConfig,
} from "../components/pricing/BulkPriceRevisionWorkflow";

// Legacy deltas helper for backward compatibility
export function computePriceDeltas(curMrp: number, curSp: number, newMrp: number, newSp: number, newCp?: number) {
  const mrpDelta = curMrp > 0 ? ((newMrp - curMrp) / curMrp) * 100 : 0;
  const spDelta = curSp > 0 ? ((newSp - curSp) / curSp) * 100 : 0;
  const marginPct = newSp > 0 && newCp !== undefined ? ((newSp - newCp) / newSp) * 100 : 0;
  const isCeilingViolation = newSp > newMrp;

  return { mrpDelta, spDelta, marginPct, isCeilingViolation };
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
});

describe("SMRITI — Bulk Price Revision Arithmetic Engine", () => {
  it("should calculate 5% default increase accurately", () => {
    const sp = calculateProposedPrice(1000, "PERCENTAGE", "INCREASE", 5);
    expect(sp).toBe(1050.0);

    const mrp = calculateProposedPrice(1299.99, "PERCENTAGE", "INCREASE", 5);
    // 1299.99 * 1.05 = 1364.9895 -> 1364.99
    expect(mrp).toBe(1364.99);
  });

  it("should calculate percentage decrease accurately", () => {
    const sp = calculateProposedPrice(500, "PERCENTAGE", "DECREASE", 10);
    expect(sp).toBe(450.0);
  });

  it("should calculate amount adjustments accurately", () => {
    const inc = calculateProposedPrice(250, "AMOUNT", "INCREASE", 25);
    expect(inc).toBe(275.0);

    const dec = calculateProposedPrice(250, "AMOUNT", "DECREASE", 30);
    expect(dec).toBe(220.0);
  });

  it("should apply fixed price replacement accurately", () => {
    const fixed = calculateProposedPrice(750, "FIXED", "INCREASE", 699);
    expect(fixed).toBe(699.0);
  });

  it("should clamp prices to non-negative zero and handle invalid inputs gracefully", () => {
    const clamped = calculateProposedPrice(50, "AMOUNT", "DECREASE", 100);
    expect(clamped).toBe(0);

    const nanFallback = calculateProposedPrice(500, "PERCENTAGE", "INCREASE", NaN);
    expect(nanFallback).toBe(500);
  });
});

describe("SMRITI — Bulk Item Preview Invariant Validation", () => {
  const baseItem: BulkItemCandidate = {
    item_id: "itm_001",
    variant_id: "var_001",
    style_code: "STYLE-A",
    article_no: "ART-100",
    item_name: "Premium Cotton Shirt",
    variant_sku: "SHIRT-M-BLU",
    barcode: "8901234567890",
    brand: "Raymond",
    category: "Apparel",
    color: "Blue",
    size: "M",
    current_mrp: 1000.0,
    current_selling_price: 800.0,
    current_distributor_price: 720.0,
    current_cost_price: 500.0,
    status: "ACTIVE",
  };

  it("should mark valid revision row with accurate deltas when rules are satisfied", () => {
    const config: RevisionConfig = {
      reviseSp: true,
      reviseMrp: true,
      reviseDp: true,
      method: "PERCENTAGE",
      value: 5,
      direction: "INCREASE",
      effectiveDate: "2026-11-01",
      reasonCode: "ANNUAL_INDEXATION",
    };

    const preview = computeItemPreviewPrices(baseItem, config);
    expect(preview.status_badge).toBe("VALID");
    expect(preview.proposed_mrp).toBe(1050.0);
    expect(preview.proposed_selling_price).toBe(840.0);
    expect(preview.proposed_distributor_price).toBe(756.0);
    expect(preview.mrp_delta).toBe(50.0);
    expect(preview.mrp_delta_pct).toBe(5.0);
    expect(preview.sp_delta).toBe(40.0);
    expect(preview.sp_delta_pct).toBe(5.0);
    expect(preview.dp_delta).toBe(36.0);
    expect(preview.dp_delta_pct).toBe(5.0);
    // Cost price remains intact and unmutated
    expect(preview.current_cost_price).toBe(500.0);
  });

  it("should detect statutory ceiling violation when proposed SP exceeds proposed MRP", () => {
    // Only revise SP by +50% without revising MRP -> SP becomes 1200 > MRP 1000
    const config: RevisionConfig = {
      reviseSp: true,
      reviseMrp: false,
      reviseDp: false,
      method: "PERCENTAGE",
      value: 50,
      direction: "INCREASE",
      effectiveDate: "2026-11-01",
      reasonCode: "PROMO",
    };

    const preview = computeItemPreviewPrices(baseItem, config);
    expect(preview.status_badge).toBe("ERROR");
    expect(preview.errorMessage).toContain("SMRITI-PRICE-001");
    expect(preview.errorMessage).toContain("cannot exceed statutory MRP");
    expect(preview.proposed_selling_price).toBe(1200.0);
    expect(preview.proposed_mrp).toBe(1000.0);
  });

  it("should detect distributor price violation when DP exceeds Selling Price", () => {
    const config: RevisionConfig = {
      reviseSp: false,
      reviseMrp: false,
      reviseDp: true,
      method: "AMOUNT",
      value: 150, // DP becomes 720 + 150 = 870 > SP 800
      direction: "INCREASE",
      effectiveDate: "2026-11-01",
      reasonCode: "DISTRIBUTOR_ADJUST",
    };

    const preview = computeItemPreviewPrices(baseItem, config);
    expect(preview.status_badge).toBe("ERROR");
    expect(preview.errorMessage).toContain("SMRITI-PRICE-002");
    expect(preview.errorMessage).toContain("cannot exceed retail selling price");
  });

  it("should flag commercial warning when proposed SP falls below Cost Price", () => {
    const config: RevisionConfig = {
      reviseSp: true,
      reviseMrp: false,
      reviseDp: false,
      method: "FIXED",
      value: 450, // SP 450 < CP 500
      direction: "INCREASE",
      effectiveDate: "2026-11-01",
      reasonCode: "CLEARANCE_SALE",
    };

    const preview = computeItemPreviewPrices(baseItem, config);
    expect(preview.status_badge).toBe("WARNING");
    expect(preview.warningMessage).toContain("Commercial Warning");
    expect(preview.warningMessage).toContain("below inward cost price");
  });
});

describe("SMRITI — Bulk Price CSV/TSV Parser & Cost Price Protection", () => {
  it("should parse CSV with header aliases and ignore Cost Price with advisory warning", () => {
    const csvContent = [
      "SKU,revised_mrp,revised_sp,dp,cost_price",
      "TSHIRT-001,1200.00,999.00,850.00,600.00",
      "TSHIRT-002,1500.00,1299.00,1100.00,750.00",
    ].join("\n");

    const result = parseBulkPriceCsv(csvContent);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Cost Price is permanently read-only and has been ignored");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].variant_sku).toBe("TSHIRT-001");
    expect(result.rows[0].current_mrp).toBe(1200.0);
    expect(result.rows[0].current_selling_price).toBe(999.0);
    expect(result.rows[0].current_distributor_price).toBe(850.0);
    expect(result.rows[0].current_cost_price).toBe(0); // Cost price not imported from CSV
  });

  it("should strip UTF-8 BOM cleanly from CSV data", () => {
    const bomCsv = "\uFEFFsku_or_barcode,mrp,selling_price\nJEANS-001,2499.00,1999.00";
    const result = parseBulkPriceCsv(bomCsv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].variant_sku).toBe("JEANS-001");
    expect(result.rows[0].current_mrp).toBe(2499.0);
    expect(result.rows[0].current_selling_price).toBe(1999.0);
  });

  it("should parse Tab-Separated (TSV) clipboard paste data", () => {
    const tsvContent = [
      "sku\tmrp\tsp\tdp",
      "SUIT-001\t8999.00\t7499.00\t6500.00",
      "SUIT-002\t9999.00\t8499.00\t7200.00",
    ].join("\n");

    const result = parseBulkPriceCsv(tsvContent);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].variant_sku).toBe("SUIT-001");
    expect(result.rows[0].current_mrp).toBe(8999.0);
    expect(result.rows[0].current_selling_price).toBe(7499.0);
    expect(result.rows[0].current_distributor_price).toBe(6500.0);
  });

  it("should flag statutory ceiling violations during CSV import", () => {
    const badCsv = [
      "sku,mrp,sp",
      "VALID-01,1000.00,900.00",
      "INVALID-01,1000.00,1100.00", // VIOLATION: SP > MRP
    ].join("\n");

    const result = parseBulkPriceCsv(badCsv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Statutory Violation! Selling Price (₹1100) exceeds MRP (₹1000)");
  });
});

