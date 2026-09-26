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
  SIZE_SCALE_PRESETS,
  getFootwearGstRate,
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
