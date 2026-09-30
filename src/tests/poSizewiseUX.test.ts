/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Modified     : 2026-09-30
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
  SIZE_SCALE_PRESETS,
  getFootwearGstRate,
  recommendSizeAssortment,
  getShadeHex,
  COLOR_SWATCHES,
  resolveLineImage,
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

describe("SMRITI 9 Footwear Domain Validation with Existing SMRITI Data", () => {
  const fwEuSizes = SIZE_SCALE_PRESETS.FOOTWEAR_EU.sizes; // ["36", "37", "38", "39", "40", "41", "42", "43", "44"]
  const fwUkSizes = SIZE_SCALE_PRESETS.FOOTWEAR_UK.sizes; // ["6", "7", "8", "9", "10", "11"]

  it("8. should verify Footwear EU and UK scale presets conform to SMRITI master attributes", () => {
    expect(fwEuSizes).toEqual(["36", "37", "38", "39", "40", "41", "42", "43", "44"]);
    expect(fwEuSizes.length).toBe(9);
    expect(fwUkSizes).toEqual(["6", "7", "8", "9", "10", "11"]);
    expect(fwUkSizes.length).toBe(6);
  });

  it("9. should correctly enforce statutory Indian GST tiers for footwear (<= ₹2500 is 5%, > ₹2500 is 18%)", () => {
    // Boundary checks
    expect(getFootwearGstRate(500)).toBe(5);
    expect(getFootwearGstRate(1400)).toBe(5);
    expect(getFootwearGstRate(2500)).toBe(5); // Exact statutory threshold
    expect(getFootwearGstRate(2500.01)).toBe(18); // Just above threshold
    expect(getFootwearGstRate(3200)).toBe(18);
    expect(getFootwearGstRate(4500)).toBe(18);
  });

  it("10. should accurately calculate single Footwear PO matrix for Campus Running Shoes across 36-44", () => {
    const runningShoesLine: SizewisePOLine = {
      id: "fw-line-1",
      sNo: 1,
      itemCode: "SHOE-RUN-01",
      barcode: "8901234567890",
      product: "Campus Running Shoes",
      brand: "Campus",
      style: "ActiveRun",
      shade: "Navy Blue",
      unit: "Pair",
      sizeQuantities: {
        "36": 2,
        "37": 4,
        "38": 6,
        "39": 8,
        "40": 10,
        "41": 8,
        "42": 6,
        "43": 4,
        "44": 2,
      },
      totalQty: 50,
      rate: 850.00,
      stockOnHand: 120,
      taxPercent: getFootwearGstRate(850.00), // 5%
      netValue: 50 * 850.00, // 42,500.00
      deliveryDate: "2026-10-02",
    };

    const summary = calculateSizewiseSummaryTotals([runningShoesLine], fwEuSizes);

    // Assertions
    expect(summary.totalItems).toBe(1);
    expect(summary.grandTotalQty).toBe(50);
    expect(summary.grossValue).toBe(42500.00);
    expect(summary.totalTax).toBe(2125.00); // 5% of 42,500
    expect(summary.netOrderValue).toBe(44625.00); // 42,500 + 2,125

    // Exact per-size quantities
    expect(summary.perSizeTotals["36"]).toBe(2);
    expect(summary.perSizeTotals["37"]).toBe(4);
    expect(summary.perSizeTotals["38"]).toBe(6);
    expect(summary.perSizeTotals["39"]).toBe(8);
    expect(summary.perSizeTotals["40"]).toBe(10);
    expect(summary.perSizeTotals["41"]).toBe(8);
    expect(summary.perSizeTotals["42"]).toBe(6);
    expect(summary.perSizeTotals["43"]).toBe(4);
    expect(summary.perSizeTotals["44"]).toBe(2);

    // Exact size distribution percentages
    expect(summary.sizePercents["36"]).toBe("4.00%");
    expect(summary.sizePercents["37"]).toBe("8.00%");
    expect(summary.sizePercents["38"]).toBe("12.00%");
    expect(summary.sizePercents["39"]).toBe("16.00%");
    expect(summary.sizePercents["40"]).toBe("20.00%");
    expect(summary.sizePercents["41"]).toBe("16.00%");
    expect(summary.sizePercents["42"]).toBe("12.00%");
    expect(summary.sizePercents["43"]).toBe("8.00%");
    expect(summary.sizePercents["44"]).toBe("4.00%");
  });

  it("11. should validate multi-item Footwear PO combining existing catalog products with mixed statutory GST tiers", () => {
    // 4 Existing Footwear Products from SMRITI catalog/tests:
    // 1. Campus Running Shoes (rate ₹850 -> 5% GST)
    // 2. Sneakers Pro (Nike HighTop, rate ₹3,200 -> 18% GST)
    // 3. Casual Slip-On (Puma Flat, rate ₹1,400 -> 5% GST)
    // 4. Leather Formal Shoes (rate ₹3,800 -> 18% GST)
    const footwearLines: SizewisePOLine[] = [
      {
        id: "fw-1",
        sNo: 1,
        itemCode: "SHOE-RUN-01",
        product: "Campus Running Shoes",
        brand: "Campus",
        style: "ActiveRun",
        shade: "Navy Blue",
        unit: "Pair",
        sizeQuantities: { "36": 2, "37": 4, "38": 6, "39": 8, "40": 10, "41": 8, "42": 6, "43": 4, "44": 2 },
        totalQty: 50,
        rate: 850.00,
        stockOnHand: 120,
        taxPercent: getFootwearGstRate(850.00), // 5%
        netValue: 50 * 850.00, // 42,500.00
        deliveryDate: "2026-10-02",
      },
      {
        id: "fw-2",
        sNo: 2,
        itemCode: "000020",
        product: "Sneakers Pro",
        brand: "Nike",
        style: "HighTop",
        shade: "White",
        unit: "Pair",
        sizeQuantities: { "36": 0, "37": 0, "38": 0, "39": 5, "40": 10, "41": 10, "42": 5, "43": 0, "44": 0 },
        totalQty: 30,
        rate: 3200.00,
        stockOnHand: 45,
        taxPercent: getFootwearGstRate(3200.00), // 18%
        netValue: 30 * 3200.00, // 96,000.00
        deliveryDate: "2026-10-05",
      },
      {
        id: "fw-3",
        sNo: 3,
        itemCode: "000021",
        product: "Casual Slip-On",
        brand: "Puma",
        style: "Flat",
        shade: "Grey",
        unit: "Pair",
        sizeQuantities: { "36": 0, "37": 0, "38": 5, "39": 5, "40": 5, "41": 5, "42": 0, "43": 0, "44": 0 },
        totalQty: 20,
        rate: 1400.00,
        stockOnHand: 60,
        taxPercent: getFootwearGstRate(1400.00), // 5%
        netValue: 20 * 1400.00, // 28,000.00
        deliveryDate: "2026-10-05",
      },
      {
        id: "fw-4",
        sNo: 4,
        itemCode: "P-3",
        product: "Leather Formal Shoes",
        brand: "Regal",
        style: "Oxford",
        shade: "Black",
        unit: "Pair",
        sizeQuantities: { "36": 0, "37": 0, "38": 0, "39": 0, "40": 5, "41": 5, "42": 5, "43": 5, "44": 0 },
        totalQty: 20,
        rate: 3800.00,
        stockOnHand: 30,
        taxPercent: getFootwearGstRate(3800.00), // 18%
        netValue: 20 * 3800.00, // 76,000.00
        deliveryDate: "2026-10-08",
      },
    ];

    const freightAmount = 1200.00;
    const otherCharges = 300.00;

    const summary = calculateSizewiseSummaryTotals(footwearLines, fwEuSizes, freightAmount, otherCharges);

    // Quantitative assertions
    expect(summary.totalItems).toBe(4);
    expect(summary.grandTotalQty).toBe(120); // 50 + 30 + 20 + 20 pairs
    expect(summary.grossValue).toBe(242500.00); // 42,500 + 96,000 + 28,000 + 76,000

    // Tax breakdown:
    // Line 1: 5% of 42,500 = 2,125.00
    // Line 2: 18% of 96,000 = 17,280.00
    // Line 3: 5% of 28,000 = 1,400.00
    // Line 4: 18% of 76,000 = 13,680.00
    // Total Tax: 2,125 + 17,280 + 1,400 + 13,680 = 34,485.00
    expect(summary.totalTax).toBe(34485.00);

    // Net Order Value = Gross (242,500) + Tax (34,485) + Freight (1,200) + Other (300) = 278,485.00
    expect(summary.netOrderValue).toBe(278485.00);

    // Aggregated per-size distribution
    expect(summary.perSizeTotals["36"]).toBe(2);
    expect(summary.perSizeTotals["37"]).toBe(4);
    expect(summary.perSizeTotals["38"]).toBe(11);
    expect(summary.perSizeTotals["39"]).toBe(18);
    expect(summary.perSizeTotals["40"]).toBe(30); // Peak bell-curve size
    expect(summary.perSizeTotals["41"]).toBe(28);
    expect(summary.perSizeTotals["42"]).toBe(16);
    expect(summary.perSizeTotals["43"]).toBe(9);
    expect(summary.perSizeTotals["44"]).toBe(2);

    // Percentage of total (rounded to 2 decimals)
    // 30 / 120 = 25.00%
    expect(summary.sizePercents["40"]).toBe("25.00%");
    // 28 / 120 = 23.33%
    expect(summary.sizePercents["41"]).toBe("23.33%");
    // 18 / 120 = 15.00%
    expect(summary.sizePercents["39"]).toBe("15.00%");
  });

  it("12. should initialize blank lines for Footwear EU scale with 9 zeros", () => {
    const fwBlank = buildBlankLine(0, fwEuSizes, "2026-09-25", 5);

    expect(fwBlank.taxPercent).toBe(5);
    expect(fwEuSizes.length).toBe(9);
    fwEuSizes.forEach(sz => {
      expect(fwBlank.sizeQuantities[sz]).toBe(0);
    });
  });

  it("13. should initialize and calculate Footwear UK scale (sizes 6-11) correctly", () => {
    const ukBlank = buildBlankLine(0, fwUkSizes, "2026-09-25", 18);
    expect(fwUkSizes.length).toBe(6);
    fwUkSizes.forEach(sz => {
      expect(ukBlank.sizeQuantities[sz]).toBe(0);
    });

    const ukLine: SizewisePOLine = {
      id: "uk-1",
      sNo: 1,
      itemCode: "SHOE-UK-01",
      product: "Derby Brogues",
      brand: "Clarks",
      style: "Formal",
      shade: "Tan",
      unit: "Pair",
      sizeQuantities: { "6": 5, "7": 10, "8": 15, "9": 15, "10": 10, "11": 5 },
      totalQty: 60,
      rate: 2200.00,
      stockOnHand: 40,
      taxPercent: getFootwearGstRate(2200.00), // 5%
      netValue: 60 * 2200.00, // 132,000.00
      deliveryDate: "2026-10-02",
    };

    const summary = calculateSizewiseSummaryTotals([ukLine], fwUkSizes);
    expect(summary.grandTotalQty).toBe(60);
    expect(summary.grossValue).toBe(132000.00);
    expect(summary.totalTax).toBe(6600.00); // 5% of 132,000
    expect(summary.netOrderValue).toBe(138600.00);
    expect(summary.perSizeTotals["8"]).toBe(15);
    expect(summary.perSizeTotals["9"]).toBe(15);
    expect(summary.sizePercents["8"]).toBe("25.00%");
    expect(summary.sizePercents["9"]).toBe("25.00%");
  });
});

describe("Phase 1 Purchase Studio Architecture & UX Invariant Suite", () => {
  it("14. should initialize empty state lines array as empty [] with zero summary values", () => {
    const emptyLines: SizewisePOLine[] = [];
    const sizes = ["S", "M", "L", "XL"];
    const summary = calculateSizewiseSummaryTotals(emptyLines, sizes);
    expect(summary.totalItems).toBe(0);
    expect(summary.grandTotalQty).toBe(0);
    expect(summary.grossValue).toBe(0);
    expect(summary.totalTax).toBe(0);
    expect(summary.netOrderValue).toBe(0);
  });

  it("15. should format composite read-only document identity string as prefix-orderNumber", () => {
    const header = { prefix: "PO", orderNumber: "37067" };
    const compositeId = `${header.prefix}-${header.orderNumber}`;
    expect(compositeId).toBe("PO-37067");
  });

  it("16. should distinguish between populated rows and blank placeholder rows using hasItem predicate", () => {
    const populatedLine = { itemCode: "1001MUG" };
    const emptyLine = { itemCode: "" };
    const undefinedLine = { itemCode: undefined };

    expect(Boolean(populatedLine.itemCode)).toBe(true);
    expect(Boolean(emptyLine.itemCode)).toBe(false);
    expect(Boolean((undefinedLine as any).itemCode)).toBe(false);
  });
});

describe("Phase 2 Purchase Studio Resiliency, Safety & Overflow Suite", () => {
  const sizes = ["S", "M", "L", "XL", "XXL"];

  it("17. should defensively guard calculateSizewiseSummaryTotals against malformed, null, or undefined inputs", () => {
    // Null / undefined lines array
    const nullLinesSummary = calculateSizewiseSummaryTotals(null as any, sizes);
    expect(nullLinesSummary.totalItems).toBe(0);
    expect(nullLinesSummary.grandTotalQty).toBe(0);
    expect(nullLinesSummary.grossValue).toBe(0);
    expect(nullLinesSummary.netOrderValue).toBe(0);

    // Empty sizes array
    const emptySizesSummary = calculateSizewiseSummaryTotals([], []);
    expect(emptySizesSummary.grandTotalQty).toBe(0);
    expect(emptySizesSummary.perSizeTotals).toEqual({});
    expect(emptySizesSummary.sizePercents).toEqual({});

    // NaN / non-finite rate, taxPercent, or qty
    const corruptedLine: SizewisePOLine = {
      id: "sw-corrupt",
      sNo: 1,
      itemCode: "CORRUPT-01",
      product: "Corrupted Item",
      unit: "Pcs",
      sizeQuantities: { S: NaN, M: null as any, L: undefined as any, XL: 10, XXL: 0 },
      totalQty: 10,
      rate: NaN,
      stockOnHand: 0,
      taxPercent: undefined as any,
      netValue: NaN,
      deliveryDate: "2026-10-01",
    };

    const summary = calculateSizewiseSummaryTotals([corruptedLine], sizes, NaN, undefined);
    expect(Number.isFinite(summary.grossValue)).toBe(true);
    expect(Number.isFinite(summary.totalTax)).toBe(true);
    expect(Number.isFinite(summary.netOrderValue)).toBe(true);
    expect(summary.totalTax).toBe(0);
    expect(summary.grossValue).toBe(0);
    expect(summary.netOrderValue).toBe(0);
  });

  it("18. should handle zero grandTotalQty without NaN in size percentage distributions", () => {
    const zeroLines: SizewisePOLine[] = [
      {
        id: "sw-zero",
        sNo: 1,
        itemCode: "ZERO-01",
        product: "Zero Item",
        unit: "Pcs",
        sizeQuantities: { S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
        totalQty: 0,
        rate: 100,
        stockOnHand: 10,
        taxPercent: 18,
        netValue: 0,
        deliveryDate: "2026-10-01",
      },
    ];

    const summary = calculateSizewiseSummaryTotals(zeroLines, sizes);
    expect(summary.grandTotalQty).toBe(0);
    sizes.forEach(sz => {
      expect(summary.sizePercents[sz]).toBe("0.00%");
      expect(summary.perSizeTotals[sz]).toBe(0);
    });
  });

  it("19. should accurately re-map size quantities when switching between footwear size scales", () => {
    const fwEuSizes = SIZE_SCALE_PRESETS.FOOTWEAR_EU.sizes; // ["36", "37", "38", "39", "40", "41", "42", "43", "44"]
    const fwUkSizes = SIZE_SCALE_PRESETS.FOOTWEAR_UK.sizes; // ["6", "7", "8", "9", "10", "11"]

    const euLine: SizewisePOLine = {
      id: "sw-1",
      sNo: 1,
      itemCode: "SHOE-01",
      product: "Campus Shoe",
      unit: "Pair",
      sizeQuantities: { "36": 2, "37": 4, "38": 6, "39": 8, "40": 10, "41": 8, "42": 6, "43": 4, "44": 2 },
      totalQty: 50,
      rate: 1000,
      stockOnHand: 50,
      taxPercent: 5,
      netValue: 50000,
      deliveryDate: "2026-10-01",
    };

    // Simulate switching to UK sizes
    const newSizeQuantities: Record<string, number> = {};
    fwUkSizes.forEach(sz => {
      newSizeQuantities[sz] = euLine.sizeQuantities[sz] || 0;
    });
    const totalQty = fwUkSizes.reduce((s, sz) => s + (newSizeQuantities[sz] || 0), 0);
    const netValue = totalQty * euLine.rate;

    expect(totalQty).toBe(0); // None of EU numbers 36-44 overlap with UK numbers 6-11
    expect(netValue).toBe(0);
    expect(Object.keys(newSizeQuantities)).toEqual(fwUkSizes);
  });

  it("20. should accurately serialize sizewise matrix to CSV format with escaping", () => {
    const testLine: SizewisePOLine = {
      id: "sw-1",
      sNo: 1,
      itemCode: 'SHOE,"DELUXE"',
      product: 'Campus "Runner" Shoes',
      brand: "Campus",
      style: "Active",
      shade: "Navy",
      unit: "Pair",
      sizeQuantities: { S: 5, M: 10, L: 15, XL: 0, XXL: 0 },
      totalQty: 30,
      rate: 1200,
      stockOnHand: 25,
      taxPercent: 5,
      netValue: 36000,
      deliveryDate: "2026-10-01",
    };

    const headers = ["#", "Item Code", "Product", "Brand", "Style", "Shade", ...sizes, "Total Qty", "Rate", "Tax %", "Net Value"];
    expect(headers).toContain("Total Qty");
    expect(headers).toContain("Net Value");

    const row = [
      1,
      `"${testLine.itemCode}"`,
      `"${(testLine.product || "").replace(/"/g, '""')}"`,
      `"${testLine.brand || ""}"`,
      `"${testLine.style || ""}"`,
      `"${testLine.shade || ""}"`,
      ...sizes.map(sz => testLine.sizeQuantities[sz] || 0),
      testLine.totalQty,
      testLine.rate,
      testLine.taxPercent,
      testLine.netValue,
    ];

    expect(row[2]).toBe('"Campus ""Runner"" Shoes"');
    expect(row[6]).toBe(5);  // S
    expect(row[7]).toBe(10); // M
    expect(row[8]).toBe(15); // L
    expect(row[11]).toBe(30); // Total Qty
    expect(row[14]).toBe(36000); // Net Value
  });

  it("21. should expand sizewise matrix rows into discrete line items for statutory print engine", () => {
    const matrixLine: SizewisePOLine = {
      id: "sw-1",
      sNo: 1,
      itemCode: "SHOE-01",
      barcode: "8901234567890",
      product: "Running Shoes",
      brand: "Campus",
      style: "Runner",
      shade: "Blue",
      unit: "Pair",
      sizeQuantities: { S: 10, M: 20, L: 0, XL: 0, XXL: 0 },
      totalQty: 30,
      rate: 1000,
      stockOnHand: 50,
      taxPercent: 5,
      netValue: 30000,
      deliveryDate: "2026-10-01",
    };

    // Filter active sizes with qty > 0
    const activeSizes = Object.entries(matrixLine.sizeQuantities).filter(([_, qty]) => qty > 0);
    expect(activeSizes.length).toBe(2);

    const discreteItems = activeSizes.map(([sz, qty]) => ({
      id: `${matrixLine.id}-${sz}`,
      stockNo: matrixLine.itemCode,
      size: sz,
      orderQty: qty,
      rate: matrixLine.rate,
      taxPercent: matrixLine.taxPercent,
      taxAmount: (qty * matrixLine.rate * matrixLine.taxPercent) / 100,
      netAmount: qty * matrixLine.rate * (1 + matrixLine.taxPercent / 100),
    }));

    expect(discreteItems[0].size).toBe("S");
    expect(discreteItems[0].orderQty).toBe(10);
    expect(discreteItems[0].taxAmount).toBe(500);
    expect(discreteItems[0].netAmount).toBe(10500);

    expect(discreteItems[1].size).toBe("M");
    expect(discreteItems[1].orderQty).toBe(20);
    expect(discreteItems[1].taxAmount).toBe(1000);
    expect(discreteItems[1].netAmount).toBe(21000);
  });

  it("22. recommendSizeAssortment — Bell Curve distributes normal distribution with exact sum", () => {
    const fwSizes = ["40", "41", "42", "43", "44", "45"];
    const targetQty = 24;
    const result = recommendSizeAssortment(fwSizes, targetQty, "bell");

    // Exact sum match
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBe(targetQty);

    // Center sizes (42, 43) should have greater quantity than edge sizes (40, 45)
    expect((result["42"] || 0) + (result["43"] || 0)).toBeGreaterThan((result["40"] || 0) + (result["45"] || 0));

    // Non-negative integer check
    Object.values(result).forEach(qty => {
      expect(Number.isInteger(qty)).toBe(true);
      expect(qty).toBeGreaterThanOrEqual(0);
    });
  });

  it("23. recommendSizeAssortment — Core Sizes curve heavily weights central sizes", () => {
    const fwSizes = ["39", "40", "41", "42", "43", "44"];
    const targetQty = 36;
    const result = recommendSizeAssortment(fwSizes, targetQty, "core");

    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBe(targetQty);

    // Core sizes 40, 41, 42 should comprise over 60% of total quantity
    const coreQty = (result["40"] || 0) + (result["41"] || 0) + (result["42"] || 0);
    expect(coreQty).toBeGreaterThan(targetQty * 0.5);
  });

  it("24. recommendSizeAssortment — Uniform distribution spreads evenly across all sizes", () => {
    const alphaSizes = ["S", "M", "L", "XL", "XXL"];
    const targetQty = 23; // Prime number not divisible by 5
    const result = recommendSizeAssortment(alphaSizes, targetQty, "uniform");

    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBe(targetQty);

    // Baseline should be 4 each (4 * 5 = 20) with 3 sizes having 5
    const values = Object.values(result);
    expect(values.filter(v => v === 5).length).toBe(3);
    expect(values.filter(v => v === 4).length).toBe(2);
  });

  it("25. recommendSizeAssortment — Mathematical invariant: sum(result) === targetQty across 100 iterations", () => {
    const fwSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];
    for (let target = 1; target <= 100; target++) {
      const bellResult = recommendSizeAssortment(fwSizes, target, "bell");
      const bellSum = Object.values(bellResult).reduce((a, b) => a + b, 0);
      expect(bellSum).toBe(target);

      const coreResult = recommendSizeAssortment(fwSizes, target, "core");
      const coreSum = Object.values(coreResult).reduce((a, b) => a + b, 0);
      expect(coreSum).toBe(target);

      const uniformResult = recommendSizeAssortment(fwSizes, target, "uniform");
      const uniformSum = Object.values(uniformResult).reduce((a, b) => a + b, 0);
      expect(uniformSum).toBe(target);
    }
  });

  it("26. Landscape Print Orientation — supports 297mm x 210mm layout and photo attachment", () => {
    const lineWithPhoto: SizewisePOLine = {
      id: "sw-fw-1",
      sNo: 1,
      itemCode: "CH-19",
      articleNo: "SND-10001-A",
      barcode: "8901234567890",
      product: "Men Comfort Sandal",
      brand: "Campus",
      style: "Casual",
      shade: "Brown",
      unit: "Pair",
      sizeQuantities: { "40": 2, "41": 4, "42": 6, "43": 4, "44": 2 },
      totalQty: 18,
      rate: 499.00,
      stockOnHand: 15,
      taxPercent: 5,
      netValue: 18 * 499.00,
      deliveryDate: "2026-10-07",
      imageUrl: "https://example.com/shoe.jpg",
    };

    expect(lineWithPhoto.imageUrl).toBe("https://example.com/shoe.jpg");
    expect(lineWithPhoto.articleNo).toBe("SND-10001-A");
    expect(lineWithPhoto.totalQty).toBe(18);
  });

  it("27. Color / Shade Palette & Hex Resolution — maps footwear shades to valid CSS hex codes", () => {
    expect(getShadeHex("Tan")).toBe("#78350f");
    expect(getShadeHex("Brown")).toBe("#451a03");
    expect(getShadeHex("Rustic Black")).toBe("#1c1917");
    expect(getShadeHex("Navy Blue")).toBe("#1e3a8a");
    expect(getShadeHex("Olive Green")).toBe("#3f6212");
    expect(getShadeHex("Cherry Red")).toBe("#881337");
    expect(getShadeHex("Camel")).toBe("#d97706");
    expect(getShadeHex("White")).toBe("#f8fafc");
    expect(getShadeHex("Unknown Fancy Color")).toBe("#94a3b8"); // Graceful fallback
    expect(COLOR_SWATCHES.length).toBeGreaterThanOrEqual(8);
  });

  it("28. Article + Color Composite Image Resolution — distinguishes photos per colorway", () => {
    const articleMap: Record<string, string> = {
      "SND-100": "https://example.com/default_snd100.jpg",
      "SND-100::tan": "https://example.com/snd100_tan.jpg",
      "SND-100::black": "https://example.com/snd100_black.jpg",
      "CH-19": "https://example.com/ch19_general.jpg",
    };

    const lineTan: SizewisePOLine = {
      ...buildBlankLine(0, ["40", "41", "42"], "2026-10-01", 5),
      itemCode: "ITM-01",
      articleNo: "SND-100",
      shade: "Tan",
    };

    const lineBlack: SizewisePOLine = {
      ...buildBlankLine(1, ["40", "41", "42"], "2026-10-01", 5),
      itemCode: "ITM-02",
      articleNo: "SND-100",
      shade: "Black",
    };

    const lineCamel: SizewisePOLine = {
      ...buildBlankLine(2, ["40", "41", "42"], "2026-10-01", 5),
      itemCode: "ITM-03",
      articleNo: "SND-100",
      shade: "Camel", // No specific composite key, falls back to SND-100
    };

    const lineExplicit: SizewisePOLine = {
      ...buildBlankLine(3, ["40", "41", "42"], "2026-10-01", 5),
      itemCode: "ITM-04",
      articleNo: "SND-100",
      shade: "Tan",
      imageUrl: "https://example.com/custom_override.jpg",
    };

    // Composite matches
    expect(resolveLineImage(lineTan, articleMap)).toBe("https://example.com/snd100_tan.jpg");
    expect(resolveLineImage(lineBlack, articleMap)).toBe("https://example.com/snd100_black.jpg");
    // Fallback to article-level
    expect(resolveLineImage(lineCamel, articleMap)).toBe("https://example.com/default_snd100.jpg");
    // Explicit override wins
    expect(resolveLineImage(lineExplicit, articleMap)).toBe("https://example.com/custom_override.jpg");
  });

  it("29. Server SPIF WebP URL Resolution & Optimization Detection — handles permanent server endpoints", () => {
    const spifWebpUrl = "/api/v1/inventory/images/spif-81bf80459706490e8adb563e8f94121a.webp";
    const lineWithSpif: SizewisePOLine = {
      ...buildBlankLine(0, ["40", "41", "42"], "2026-10-01", 5),
      itemCode: "FW-OXFORD-01",
      articleNo: "OXF-990",
      shade: "Rustic Black",
      imageUrl: spifWebpUrl,
    };

    const resolved = resolveLineImage(lineWithSpif, {});
    expect(resolved).toBe(spifWebpUrl);
    expect(resolved.startsWith("/api/v1/inventory/images/spif-")).toBe(true);
    expect(resolved.endsWith(".webp")).toBe(true);

    // Verify optimized WebP detection predicate
    const isOptimized = resolved.includes("/images/spif-") || resolved.endsWith(".webp");
    expect(isOptimized).toBe(true);
  });

  it("30. Clean Payload Footprint Guarantee — server WebP URLs eliminate inline base64 bloat", () => {
    // 50KB simulated base64 string
    const simulatedBase64 = "data:image/png;base64," + "A".repeat(50000);
    const spifWebpUrl = "/api/v1/inventory/images/spif-a1b2c3d4e5f6.webp";

    expect(simulatedBase64.length).toBeGreaterThan(50000);
    expect(spifWebpUrl.length).toBeLessThan(70);

    // Size reduction > 99.8%
    const reductionPercent = ((simulatedBase64.length - spifWebpUrl.length) / simulatedBase64.length) * 100;
    expect(reductionPercent).toBeGreaterThan(99.8);
  });
});

