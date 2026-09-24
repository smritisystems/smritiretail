/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-25
 * Modified     : 2026-09-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import {
  calculateSizewiseSummaryTotals,
  buildBlankLine,
  addDaysToDate,
  SizewisePOLine,
} from "../components/purchase/PoSizewiseTab.tsx";

describe("SMRITI 9 Sizewise Purchase Order Matrix & Calculation Suite", () => {
  const sizes = ["S", "M", "L", "XL", "XXL"];

  // Reference test data exactly matching the reference specification screenshot:
  const referenceLines: SizewisePOLine[] = [
    {
      id: "sw-1",
      sNo: 1,
      itemCode: "1001MUG",
      product: "MUG - Ceramic",
      brand: "HomePro",
      style: "Classic",
      shade: "White",
      unit: "Pcs",
      sizeQuantities: { S: 20, M: 30, L: 30, XL: 20, XXL: 0 },
      totalQty: 100,
      rate: 115.00,
      stockOnHand: 350,
      taxPercent: 18.00,
      netValue: 100 * 115.00, // 11,500.00
      deliveryDate: "2018-01-02",
    },
    {
      id: "sw-2",
      sNo: 2,
      itemCode: "1002CUP",
      product: "Tea Cup - Ceramic",
      brand: "HomePro",
      style: "Classic",
      shade: "White",
      unit: "Pcs",
      sizeQuantities: { S: 10, M: 10, L: 15, XL: 10, XXL: 5 },
      totalQty: 50,
      rate: 102.00,
      stockOnHand: 200,
      taxPercent: 18.00,
      netValue: 50 * 102.00, // 5,100.00
      deliveryDate: "2018-01-02",
    },
    {
      id: "sw-3",
      sNo: 3,
      itemCode: "1003PLT",
      product: "Plate - Ceramic",
      brand: "HomePro",
      style: "Classic",
      shade: "White",
      unit: "Pcs",
      sizeQuantities: { S: 25, M: 30, L: 25, XL: 15, XXL: 5 },
      totalQty: 100,
      rate: 85.00,
      stockOnHand: 150,
      taxPercent: 18.00,
      netValue: 100 * 85.00, // 8,500.00
      deliveryDate: "2018-01-05",
    },
    {
      id: "sw-4",
      sNo: 4,
      itemCode: "1004BWL",
      product: "Bowl - Ceramic",
      brand: "HomePro",
      style: "Classic",
      shade: "White",
      unit: "Pcs",
      sizeQuantities: { S: 20, M: 20, L: 20, XL: 15, XXL: 5 },
      totalQty: 80,
      rate: 78.00,
      stockOnHand: 120,
      taxPercent: 18.00,
      netValue: 80 * 78.00, // 6,240.00
      deliveryDate: "2018-01-05",
    },
    {
      id: "sw-5",
      sNo: 5,
      itemCode: "1005JAR",
      product: "Storage Jar",
      brand: "HomePro",
      style: "Glass",
      shade: "Clear",
      unit: "Pcs",
      sizeQuantities: { S: 10, M: 10, L: 10, XL: 5, XXL: 5 },
      totalQty: 40,
      rate: 145.00,
      stockOnHand: 60,
      taxPercent: 18.00,
      netValue: 40 * 145.00, // 5,800.00
      deliveryDate: "2018-01-08",
    },
  ];

  it("1. should calculate per-size totals matching reference screenshot exactly", () => {
    const summary = calculateSizewiseSummaryTotals(referenceLines, sizes);

    expect(summary.perSizeTotals["S"]).toBe(85);
    expect(summary.perSizeTotals["M"]).toBe(100);
    expect(summary.perSizeTotals["L"]).toBe(100);
    expect(summary.perSizeTotals["XL"]).toBe(65);
    expect(summary.perSizeTotals["XXL"]).toBe(20);
    expect(summary.grandTotalQty).toBe(370);
  });

  it("2. should calculate size percentage distribution with two decimals parity", () => {
    const summary = calculateSizewiseSummaryTotals(referenceLines, sizes);

    // 85 / 370 * 100 = 22.97%
    expect(summary.sizePercents["S"]).toBe("22.97%");
    // 100 / 370 * 100 = 27.03%
    expect(summary.sizePercents["M"]).toBe("27.03%");
    // 100 / 370 * 100 = 27.03%
    expect(summary.sizePercents["L"]).toBe("27.03%");
    // 65 / 370 * 100 = 17.57%
    expect(summary.sizePercents["XL"]).toBe("17.57%");
    // 20 / 370 * 100 = 5.41%
    expect(summary.sizePercents["XXL"]).toBe("5.41%");
  });

  it("3. should calculate Item Summary financials with exact statutory precision", () => {
    const summary = calculateSizewiseSummaryTotals(referenceLines, sizes);

    expect(summary.totalItems).toBe(5);
    expect(summary.grandTotalQty).toBe(370);
    expect(summary.grossValue).toBe(37140.00);
    expect(summary.totalTax).toBeCloseTo(6685.20, 2);
    expect(summary.netOrderValue).toBeCloseTo(43825.20, 2);
  });

  it("4. should correctly add freight and other charges to netOrderValue", () => {
    const summary = calculateSizewiseSummaryTotals(referenceLines, sizes, 500, 250);

    expect(summary.grossValue).toBe(37140.00);
    expect(summary.totalTax).toBeCloseTo(6685.20, 2);
    // 43,825.20 + 500 + 250 = 44,575.20
    expect(summary.netOrderValue).toBeCloseTo(44575.20, 2);
  });

  it("5. should build initialized blank line with all zero size quantities", () => {
    const blank = buildBlankLine(0, sizes, "2026-09-25", 18);

    expect(blank.id).toBe("sw-line-1");
    expect(blank.sNo).toBe(1);
    expect(blank.totalQty).toBe(0);
    expect(blank.netValue).toBe(0);
    expect(blank.taxPercent).toBe(18);
    expect(blank.deliveryDate).toBe("2026-09-25");
    sizes.forEach(sz => {
      expect(blank.sizeQuantities[sz]).toBe(0);
    });
  });

  it("6. should compute date offsets accurately for lead time calculations", () => {
    const baseDate = "2026-09-25";
    const leadTimeDays = 7;
    const deliveryDate = addDaysToDate(baseDate, leadTimeDays);

    expect(deliveryDate).toBe("2026-10-02");
  });

  it("7. should ignore empty lines in calculation totals", () => {
    const mixedLines = [
      ...referenceLines,
      buildBlankLine(5, sizes, "2026-09-25", 18),
      buildBlankLine(6, sizes, "2026-09-25", 18),
    ];

    const summary = calculateSizewiseSummaryTotals(mixedLines, sizes);

    expect(summary.totalItems).toBe(5);
    expect(summary.grandTotalQty).toBe(370);
    expect(summary.grossValue).toBe(37140.00);
    expect(summary.netOrderValue).toBeCloseTo(43825.20, 2);
  });
});
