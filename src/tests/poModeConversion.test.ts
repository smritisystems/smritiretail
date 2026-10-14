import { describe, it, expect } from "vitest";
import {
  convertSizewiseToStandardLines,
  convertStandardToSizewiseLines,
  syncSizewiseHeaderToStandard,
  syncStandardHeaderToSizewise,
} from "../components/purchase/poModeConversion.ts";
import type { SizewisePOLine } from "../components/purchase/PoSizewiseTab.tsx";
import type { PurchaseOrderLineItem, PurchaseOrderHeader } from "../components/purchase/types.ts";

describe("SMRITI Retail OS — Purchase Order Mode Conversion (Sizewise <-> Standard)", () => {
  const footwearEuSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];

  const sampleSizewiseLine: SizewisePOLine = {
    id: "sw-line-1",
    sNo: 1,
    itemCode: "SH-03-I-BLACK",
    articleNo: "SH-03-I",
    barcode: "",
    product: "TATLD FORMAL SHOE, BLACK",
    brand: "Tattly Threads",
    style: "SH-03-I",
    shade: "BLACK",
    unit: "Pair",
    sizeQuantities: {
      "36": 4,
      "37": 8,
      "38": 14,
      "39": 18,
      "40": 20,
      "41": 18,
      "42": 14,
      "43": 8,
      "44": 4,
    },
    totalQty: 108,
    rate: 660,
    stockOnHand: 0,
    taxPercent: 5,
    netValue: 71280,
    deliveryDate: "2026-10-21",
  };

  it("1. Expands Sizewise line (108 units across 9 sizes) into exactly 9 barcode-wise Standard rows", () => {
    const standardLines = convertSizewiseToStandardLines([sampleSizewiseLine]);

    expect(standardLines).toHaveLength(9);

    const totalQty = standardLines.reduce((sum, l) => sum + l.orderQty, 0);
    expect(totalQty).toBe(108);

    const sizes = standardLines.map((l) => l.size);
    expect(sizes).toEqual(footwearEuSizes);

    const expectedQtys = [4, 8, 14, 18, 20, 18, 14, 8, 4];
    const actualQtys = standardLines.map((l) => l.orderQty);
    expect(actualQtys).toEqual(expectedQtys);

    // Verify fields on row 0
    const row0 = standardLines[0];
    expect(row0.stockNo).toBe("SH-03-I-BLACK-36");
    expect(row0.style).toBe("SH-03-I");
    expect(row0.shade).toBe("BLACK");
    expect(row0.size).toBe("36");
    expect(row0.rate).toBe(660);
    expect(row0.unit).toBe("Pair");
    expect(row0.taxPercent).toBe(5);
    expect(row0.value).toBe(4 * 660); // 2640
    expect(row0.totalValue).toBe(2640 + (2640 * 0.05)); // 2772
  });

  it("2. Excludes zero-quantity variants by default without creating empty order rows", () => {
    const lineWithZeros: SizewisePOLine = {
      ...sampleSizewiseLine,
      sizeQuantities: {
        "36": 0,
        "37": 10,
        "38": 0,
        "39": 20,
        "40": 0,
        "41": 0,
        "42": 15,
        "43": 0,
        "44": 0,
      },
      totalQty: 45,
    };

    const standardLines = convertSizewiseToStandardLines([lineWithZeros]);

    // Only sizes 37, 39, and 42 have qty > 0
    expect(standardLines).toHaveLength(3);
    expect(standardLines.map((l) => l.size)).toEqual(["37", "39", "42"]);
    expect(standardLines.map((l) => l.orderQty)).toEqual([10, 20, 15]);
    expect(standardLines.reduce((s, l) => s + l.orderQty, 0)).toBe(45);
  });

  it("3. Regroups individual variant rows back into Sizewise matrix with exact size mapping", () => {
    const standardLines = convertSizewiseToStandardLines([sampleSizewiseLine]);

    const regroupedSizewise = convertStandardToSizewiseLines(standardLines, footwearEuSizes);

    expect(regroupedSizewise).toHaveLength(1);
    const sw = regroupedSizewise[0];
    expect(sw.articleNo).toBe("SH-03-I");
    expect(sw.shade).toBe("BLACK");
    expect(sw.totalQty).toBe(108);
    expect(sw.rate).toBe(660);
    expect(sw.netValue).toBe(108 * 660);
    expect(sw.sizeQuantities).toEqual({
      "36": 4,
      "37": 8,
      "38": 14,
      "39": 18,
      "40": 20,
      "41": 18,
      "42": 14,
      "43": 8,
      "44": 4,
    });
  });

  it("4. Preserves edits made in Standard mode when switching back to Sizewise", () => {
    const standardLines = convertSizewiseToStandardLines([sampleSizewiseLine]);

    // Simulate operator editing size 40 quantity from 20 -> 25 in Standard mode
    const editedStandardLines = standardLines.map((l) =>
      l.size === "40" ? { ...l, orderQty: 25, value: 25 * 660 } : l
    );

    const regroupedSizewise = convertStandardToSizewiseLines(editedStandardLines, footwearEuSizes);

    expect(regroupedSizewise).toHaveLength(1);
    const sw = regroupedSizewise[0];
    expect(sw.sizeQuantities["40"]).toBe(25);
    expect(sw.totalQty).toBe(113); // 108 + 5
    expect(sw.netValue).toBe(113 * 660);
  });

  it("5. Is idempotent and prevents duplication across repeated tab switches", () => {
    const pass1Standard = convertSizewiseToStandardLines([sampleSizewiseLine]);
    const pass1Sizewise = convertStandardToSizewiseLines(pass1Standard, footwearEuSizes);
    const pass2Standard = convertSizewiseToStandardLines(pass1Sizewise);
    const pass2Sizewise = convertStandardToSizewiseLines(pass2Standard, footwearEuSizes);

    expect(pass2Standard).toHaveLength(9);
    expect(pass2Standard.reduce((s, l) => s + l.orderQty, 0)).toBe(108);

    expect(pass2Sizewise).toHaveLength(1);
    expect(pass2Sizewise[0].totalQty).toBe(108);
    expect(pass2Sizewise[0].sizeQuantities).toEqual(sampleSizewiseLine.sizeQuantities);
  });

  it("6. Synchronizes document header details without losing order number, supplier, or terms", () => {
    const sizewiseHeader = {
      documentType: "Purchase Order",
      prefix: "PO",
      orderNumber: "978758",
      orderDate: "2026-10-14",
      supplierId: "sup-001",
      supplierName: "Test Supplier GRN",
      deliveryDate: "2026-10-21",
      leadTimeDays: 7,
      deliveryLocation: "Main Store (MAIN)",
      commonTaxPercent: 5,
      freightAmount: 150,
      otherCharges: 50,
      paymentTerms: "30 Days",
      freightCharges: "Paid by Supplier",
      currency: "INR - Indian Rupee",
      buyer: "admin (MANAGER)",
      department: "Footwear Merchandising",
      supplierReference: "REF-SUP-77",
      specialInstructions: "Handle with care",
      remarks: "Sample indent",
      internalNotes: "Internal review passed",
      priceList: "Default Purchase Price",
    };

    const stdHeader = syncSizewiseHeaderToStandard(sizewiseHeader);
    expect(stdHeader.orderNumber).toBe("978758");
    expect(stdHeader.supplierId).toBe("sup-001");
    expect(stdHeader.supplierName).toBe("Test Supplier GRN");
    expect(stdHeader.paymentTerms).toBe("30 Days");
    expect(stdHeader.commonTaxPercent).toBe(5);

    const roundtripHeader = syncStandardHeaderToSizewise(stdHeader);
    expect(roundtripHeader.orderNumber).toBe("978758");
    expect(roundtripHeader.supplierName).toBe("Test Supplier GRN");
    expect(roundtripHeader.paymentTerms).toBe("30 Days");
    expect(roundtripHeader.department).toBe("Footwear Merchandising");
  });
});
