/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.47
 * Created      : 2026-10-09
 * Modified     : 2026-10-09 (v6.70.47 — Smart Import Studio frontend unit tests: 7-metrics, filter tabs, inline editing, and auto-fix)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Unit Test Suite — SMRITI Smart Import & Correction Studio
 */

import { describe, expect, it } from "vitest";

describe("Smart Import & Correction Studio Metrics & Filters", () => {
  interface MetricRow {
    rowNumber: number;
    status: "VALID" | "INVALID";
    action: "CREATE_ITEM_AND_VARIANT" | "ATTACH_VARIANT_TO_STYLE" | "BLOCK" | "SKIP";
    reconciliation_state: string;
    errors?: string[];
    warnings?: string[];
  }

  const compute7Metrics = (
    totalRows: number,
    report: MetricRow[],
    skippedByUser: Set<number>,
    correctedRowsCount: number
  ) => {
    let valid = 0;
    let blocking = 0;
    let warnings = 0;

    const rowMap = new Map<number, MetricRow>();
    report.forEach(r => rowMap.set(r.rowNumber, r));

    for (let i = 1; i <= totalRows; i++) {
      if (skippedByUser.has(i)) continue;
      const r = rowMap.get(i);
      if (!r) continue;
      if (r.status === "VALID" && r.action !== "BLOCK") {
        valid++;
      } else {
        blocking++;
      }
      if (Array.isArray(r.warnings) && r.warnings.length > 0) {
        warnings++;
      }
    }

    return {
      total: totalRows,
      valid,
      blocking,
      warnings,
      corrected: correctedRowsCount,
      skipped: skippedByUser.size,
      ready: valid,
    };
  };

  it("computes 7-metric dashboard stats accurately", () => {
    const report: MetricRow[] = [
      { rowNumber: 1, status: "VALID", action: "CREATE_ITEM_AND_VARIANT", reconciliation_state: "NEW" },
      { rowNumber: 2, status: "INVALID", action: "BLOCK", reconciliation_state: "INVALID", errors: ["Missing style"] },
      { rowNumber: 3, status: "VALID", action: "ATTACH_VARIANT_TO_STYLE", reconciliation_state: "NEW", warnings: ["GST Slab Flag"] },
      { rowNumber: 4, status: "INVALID", action: "BLOCK", reconciliation_state: "DUPLICATE_IN_FILE", errors: ["Duplicate barcode"] },
      { rowNumber: 5, status: "VALID", action: "SKIP", reconciliation_state: "EXISTING_MATCH" },
    ];

    const metrics = compute7Metrics(5, report, new Set([4]), 2);

    expect(metrics.total).toBe(5);
    expect(metrics.valid).toBe(3); // rows 1, 3, 5
    expect(metrics.blocking).toBe(1); // row 2 (row 4 skipped)
    expect(metrics.warnings).toBe(1); // row 3
    expect(metrics.corrected).toBe(2);
    expect(metrics.skipped).toBe(1); // row 4
    expect(metrics.ready).toBe(3);
  });

  it("filters rows by active filter tab", () => {
    const rows = [
      { rowNumber: 1, isValid: true, hasErrors: false, hasWarnings: false, isCorrected: false, isSkipped: false },
      { rowNumber: 2, isValid: false, hasErrors: true, hasWarnings: false, isCorrected: false, isSkipped: false },
      { rowNumber: 3, isValid: true, hasErrors: false, hasWarnings: true, isCorrected: true, isSkipped: false },
      { rowNumber: 4, isValid: false, hasErrors: true, hasWarnings: false, isCorrected: false, isSkipped: true },
    ];

    const filterRows = (tab: string) => {
      return rows.filter(r => {
        if (tab === "VALID") return r.isValid && !r.isSkipped;
        if (tab === "ERRORS") return r.hasErrors && !r.isSkipped;
        if (tab === "WARNINGS") return r.hasWarnings && !r.isSkipped;
        if (tab === "CORRECTED") return r.isCorrected;
        if (tab === "SKIPPED") return r.isSkipped;
        return true;
      });
    };

    expect(filterRows("ALL")).toHaveLength(4);
    expect(filterRows("VALID")).toHaveLength(2); // rows 1, 3
    expect(filterRows("ERRORS")).toHaveLength(1); // row 2 (row 4 skipped)
    expect(filterRows("WARNINGS")).toHaveLength(1); // row 3
    expect(filterRows("CORRECTED")).toHaveLength(1); // row 3
    expect(filterRows("SKIPPED")).toHaveLength(1); // row 4
  });

  it("merges inline cell edits and allows per-cell undo", () => {
    const originalTokens = ["ART-101", "Old Name", "Blk", "40", "1500", "2000"];
    const fieldMapping = new Map([
      [0, "style_code"],
      [1, "item_name"],
      [2, "color"],
      [3, "size"],
      [4, "mrp"],
      [5, "selling_price"],
    ]);

    const edits: Record<string, string> = {
      color: "Black",
      selling_price: "1500",
    };

    // Apply edits
    const effectiveTokens = originalTokens.map((t, idx) => {
      const k = fieldMapping.get(idx);
      return (k && edits[k] !== undefined) ? edits[k] : t;
    });

    expect(effectiveTokens[2]).toBe("Black");
    expect(effectiveTokens[5]).toBe("1500");

    // Revert selling_price
    delete edits.selling_price;
    const revertedTokens = originalTokens.map((t, idx) => {
      const k = fieldMapping.get(idx);
      return (k && edits[k] !== undefined) ? edits[k] : t;
    });

    expect(revertedTokens[5]).toBe("2000");
  });

  it("applies auto-fix suggestions for near-matches and pricing conflicts", () => {
    const row = {
      row_number: 1,
      mrp: 1200,
      selling_price: 1500,
      field_failures: [
        { field: "color", value: "Blk", near_match: "Black" },
        { field: "gender", value: "Mens", near_match: "Men" },
      ],
    };

    const nextEdits: Record<string, string> = {};

    // 1. Apply near matches
    row.field_failures.forEach(ff => {
      if (ff.near_match) nextEdits[ff.field] = ff.near_match;
    });

    // 2. Clamp selling price to MRP
    if (row.selling_price > row.mrp) {
      nextEdits.selling_price = String(row.mrp);
    }

    expect(nextEdits.color).toBe("Black");
    expect(nextEdits.gender).toBe("Men");
    expect(nextEdits.selling_price).toBe("1200");
  });
});
