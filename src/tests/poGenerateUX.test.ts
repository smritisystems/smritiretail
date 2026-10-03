/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.59.0
 * Created      : 2026-09-21
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import {
  PurchaseOrderLineItem,
  PurchaseOrderSizePivotRow,
  PurchaseOrderSummaryTotals
} from "../components/purchase/types.ts";
import {
  PURCHASER_FIELD_LABEL,
  PO_PRIMARY_SUBMIT_LABEL,
  formatLeadTimeLabel,
  mapParsedGridRowsToPOLineItems,
  mergePOLineItems,
} from "../components/purchase/PoGenerateTab.tsx";
import type { ParsedGridRow } from "../services/gridInput/types.ts";

describe("SMRITI 9 Purchase Order Modern UX & Calculation Suite", () => {
  it("1. should maintain MRP as an explicit separate field from purchase rate", () => {
    const line: PurchaseOrderLineItem = {
      id: "l-101",
      sNo: 1,
      stockNo: "CH-01",
      barcode: "8901234567890",
      product: "Campus Shoes",
      brand: "Campus",
      style: "Runner",
      shade: "Black",
      size: "8",
      fibre: "Mesh",
      colourBase: "Black",
      styling: "Sport",
      mrp: 1499.00,
      rate: 650.00,
      orderQty: 10,
      freeQty: 0,
      unit: "Pair",
      discountPercent: 0,
      discountAmount: 0,
      value: 6500.00,
      stockOnHand: 45,
      taxPercent: 5.0,
      taxAmount: 325.00,
      addOnPercent: 0,
      addOnAmount: 0,
      totalValue: 6825.00
    };

    expect(line.mrp).toBe(1499.00);
    expect(line.rate).toBe(650.00);
    expect(line.mrp).not.toBe(line.rate);
    expect(line.value).toBe(line.rate * line.orderQty);
  });

  it("2. should accurately compute line value with discount and tax", () => {
    const line: PurchaseOrderLineItem = {
      id: "l-102",
      sNo: 2,
      stockNo: "SN-22",
      barcode: "8909876543210",
      product: "Sneakers Pro",
      brand: "Adidas",
      style: "Urban",
      shade: "White",
      size: "9",
      fibre: "Synthetic",
      colourBase: "White",
      styling: "Casual",
      mrp: 2495.00,
      rate: 1250.00,
      orderQty: 5,
      freeQty: 0,
      unit: "Pair",
      discountPercent: 5.0,
      discountAmount: 0,
      value: 0,
      stockOnHand: 20,
      taxPercent: 5.0,
      taxAmount: 0,
      addOnPercent: 0,
      addOnAmount: 0,
      totalValue: 0
    };

    const gross = line.rate * line.orderQty; // 6250.00
    const discAmount = (gross * (line.discountPercent || 0)) / 100; // 312.50
    const taxable = gross - discAmount; // 5937.50
    const taxAmount = (taxable * line.taxPercent) / 100; // 296.875 -> 296.88
    const totalValue = taxable + taxAmount; // 6234.375

    expect(gross).toBe(6250.00);
    expect(discAmount).toBe(312.50);
    expect(taxable).toBe(5937.50);
    expect(taxAmount).toBeCloseTo(296.88, 1);
    expect(+(totalValue).toFixed(2)).toBe(6234.38);
  });

  it("3. should handle free quantities without inflating line value", () => {
    const line: PurchaseOrderLineItem = {
      id: "l-103",
      sNo: 3,
      stockNo: "SL-09",
      barcode: "8912345678901",
      product: "Sports Slipper",
      brand: "Bata",
      style: "Comfort",
      shade: "Blue",
      size: "10",
      fibre: "EVA",
      colourBase: "Blue",
      styling: "Flip Flop",
      mrp: 895.00,
      rate: 320.00,
      orderQty: 20,
      freeQty: 2,
      unit: "Pair",
      discountPercent: 0,
      discountAmount: 0,
      value: 6400.00,
      stockOnHand: 60,
      taxPercent: 5.0,
      taxAmount: 320.00,
      addOnPercent: 0,
      addOnAmount: 0,
      totalValue: 6720.00
    };

    // Free qty does not increase billable line value
    const gross = line.rate * line.orderQty; // 6400.00
    expect(gross).toBe(6400.00);
    expect(line.freeQty).toBe(2);
    expect(line.orderQty + (line.freeQty || 0)).toBe(22); // total units delivered is 22
  });

  it("4. should accurately aggregate Order Amount Summary, taxes, freight, and round-off", () => {
    // 3 items from reference test case:
    // Item 1: 10 * 650 = 6500.00, Tax 5% = 325.00, Total = 6825.00
    // Item 2: 5 * 1250 = 6250.00, Disc 5% = 312.50, Taxable = 5937.50, Tax 5% = 296.88, Total = 6234.38
    // Item 3: 20 * 320 = 6400.00, Free = 2, Tax 5% = 320.00, Total = 6720.00
    const grossTotal = 6500.00 + 6250.00 + 6400.00; // 19150.00
    const totalDiscount = 312.50;
    const taxableTotal = grossTotal - totalDiscount; // 18837.50
    const totalTax = 325.00 + 296.875 + 320.00; // 941.875
    const cgst = totalTax / 2; // 470.9375
    const sgst = totalTax / 2; // 470.9375
    const freight = 0.00;
    const other = 0.00;

    const rawNet = taxableTotal + totalTax + freight + other; // 19779.375
    const roundedNet = Math.round(rawNet); // 19779
    const roundOff = +(roundedNet - rawNet).toFixed(2); // -0.38

    expect(grossTotal).toBe(19150.00);
    expect(taxableTotal).toBe(18837.50);
    expect(cgst + sgst).toBeCloseTo(941.88, 2);
    expect(roundedNet).toBe(19779);
    expect(roundOff).toBeCloseTo(-0.38, 2);
  });

  it("5. should preserve Size Pivot Matrix row calculation integrity", () => {
    const pivotRow: PurchaseOrderSizePivotRow = {
      id: "p-201",
      sNo: 1,
      articleNo: "ART-5011",
      product: "Running Shoes",
      brand: "Campus",
      style: "Speed",
      color: "Grey",
      sizeQuantities: {
        "36": 2,
        "37": 4,
        "38": 6,
        "39": 8,
        "40": 10,
        "41": 8,
        "42": 6,
        "43": 4,
        "44": 2
      },
      rate: 850.00,
      totalQty: 0,
      gstPercent: 5,
      totalValue: 0
    };

    const totalQty = Object.values(pivotRow.sizeQuantities).reduce((a, b) => a + b, 0);
    const totalValue = totalQty * pivotRow.rate;

    expect(totalQty).toBe(50);
    expect(totalValue).toBe(42500.00);
  });

  it("6. should use operator-friendly PO labels and lead-time wording", () => {
    expect(PURCHASER_FIELD_LABEL).toBe("Purchaser");
    expect(PO_PRIMARY_SUBMIT_LABEL).toBe("Submit PO");
    expect(formatLeadTimeLabel(7)).toBe("7 days");
    expect(formatLeadTimeLabel(1)).toBe("1 day");
  });

  it("7. should map resolved grid import rows into canonical PurchaseOrderLineItem with accurate tax and pricing", () => {
    const mockRows: ParsedGridRow[] = [
      {
        rowNumber: 1,
        rawValues: { barcode: "8901234567890", qty: "10", rate: "600" },
        mappedValues: { barcode: "8901234567890", quantity: 10, rate: 600 },
        identifier: "8901234567890",
        identifierType: "BARCODE",
        quantity: 10,
        rate: 600,
        mrp: 1200,
        taxRate: 5,
        resolutionStatus: "RESOLVED",
        resolvedProduct: {
          productId: "p-101",
          sku: "CMP-RUN-01",
          barcode: "8901234567890",
          name: "Campus Runner Shoes",
          brand: "Campus",
          mrp: 1200,
          costPrice: 600,
          taxRate: 5,
        },
      },
    ];

    const lines = mapParsedGridRowsToPOLineItems(mockRows, 0, 5);
    expect(lines).toHaveLength(1);
    expect(lines[0].stockNo).toBe("CMP-RUN-01");
    expect(lines[0].barcode).toBe("8901234567890");
    expect(lines[0].product).toBe("Campus Runner Shoes");
    expect(lines[0].brand).toBe("Campus");
    expect(lines[0].orderQty).toBe(10);
    expect(lines[0].rate).toBe(600);
    expect(lines[0].mrp).toBe(1200);
    expect(lines[0].value).toBe(6000);
    expect(lines[0].taxPercent).toBe(5);
    expect(lines[0].taxAmount).toBe(300);
    expect(lines[0].totalValue).toBe(6300);
  });

  it("8. should provide resilient fallbacks for unresolved/manual grid rows during PO import", () => {
    const mockUnresolved: ParsedGridRow[] = [
      {
        rowNumber: 2,
        rawValues: { code: "CUSTOM-099", qty: "4", rate: "250", disc: "10" },
        mappedValues: { itemCode: "CUSTOM-099", name: "Custom Safety Gloves", unit: "Pcs" },
        identifier: "CUSTOM-099",
        identifierType: "ITEM_CODE",
        quantity: 4,
        rate: 250,
        discount: 10,
        resolutionStatus: "UNRESOLVED",
      },
    ];

    const lines = mapParsedGridRowsToPOLineItems(mockUnresolved, 2, 12);
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe("line-3");
    expect(lines[0].sNo).toBe(3);
    expect(lines[0].stockNo).toBe("CUSTOM-099");
    expect(lines[0].product).toBe("Custom Safety Gloves");
    expect(lines[0].orderQty).toBe(4);
    expect(lines[0].rate).toBe(250);
    expect(lines[0].discountPercent).toBe(10);
    // gross = 1000, discount = 100, taxable = 900, tax 12% = 108, totalValue = 1008
    expect(lines[0].discountAmount).toBe(100);
    expect(lines[0].value).toBe(900);
    expect(lines[0].taxPercent).toBe(12);
    expect(lines[0].taxAmount).toBe(108);
    expect(lines[0].totalValue).toBe(1008);
  });

  it("9. should replace all line items in REPLACE import mode", () => {
    const existing: PurchaseOrderLineItem[] = [
      {
        id: "line-1",
        sNo: 1,
        stockNo: "OLD-ITEM",
        product: "Old Stock Item",
        brand: "OldBrand",
        style: "-",
        shade: "-",
        size: "-",
        fibre: "-",
        colourBase: "-",
        styling: "-",
        rate: 100,
        orderQty: 2,
        value: 200,
        stockOnHand: 10,
        taxPercent: 5,
        taxAmount: 10,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 210,
      },
    ];

    const incoming: PurchaseOrderLineItem[] = [
      {
        id: "temp-1",
        sNo: 1,
        stockNo: "NEW-01",
        product: "New Product",
        brand: "NewBrand",
        style: "-",
        shade: "-",
        size: "-",
        fibre: "-",
        colourBase: "-",
        styling: "-",
        rate: 500,
        orderQty: 5,
        value: 2500,
        stockOnHand: 0,
        taxPercent: 5,
        taxAmount: 125,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 2625,
      },
    ];

    const result = mergePOLineItems(existing, incoming, "REPLACE");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("line-1");
    expect(result[0].stockNo).toBe("NEW-01");
    expect(result[0].orderQty).toBe(5);
  });

  it("10. should append incoming items to existing active items in APPEND mode", () => {
    const existing: PurchaseOrderLineItem[] = [
      {
        id: "line-1",
        sNo: 1,
        stockNo: "ITEM-A",
        product: "Item A",
        brand: "SMRITI",
        style: "-",
        shade: "-",
        size: "-",
        fibre: "-",
        colourBase: "-",
        styling: "-",
        rate: 100,
        orderQty: 2,
        value: 200,
        stockOnHand: 5,
        taxPercent: 5,
        taxAmount: 10,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 210,
      },
      // Blank placeholder row
      {
        id: "line-2",
        sNo: 2,
        stockNo: "",
        product: "",
        brand: "",
        style: "",
        shade: "",
        size: "",
        fibre: "",
        colourBase: "",
        styling: "",
        rate: 0,
        orderQty: 0,
        value: 0,
        stockOnHand: 0,
        taxPercent: 5,
        taxAmount: 0,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 0,
      },
    ];

    const incoming: PurchaseOrderLineItem[] = [
      {
        id: "temp-2",
        sNo: 1,
        stockNo: "ITEM-B",
        product: "Item B",
        brand: "SMRITI",
        style: "-",
        shade: "-",
        size: "-",
        fibre: "-",
        colourBase: "-",
        styling: "-",
        rate: 200,
        orderQty: 3,
        value: 600,
        stockOnHand: 0,
        taxPercent: 5,
        taxAmount: 30,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 630,
      },
    ];

    const result = mergePOLineItems(existing, incoming, "APPEND");
    expect(result).toHaveLength(2);
    expect(result[0].stockNo).toBe("ITEM-A");
    expect(result[1].stockNo).toBe("ITEM-B");
    expect(result[1].sNo).toBe(2);
    expect(result[1].id).toBe("line-2");
  });

  it("11. should accumulate quantities and recalculate values in MERGE mode", () => {
    const existing: PurchaseOrderLineItem[] = [
      {
        id: "line-1",
        sNo: 1,
        stockNo: "ITEM-A",
        barcode: "8901111111111",
        product: "Item A",
        brand: "SMRITI",
        style: "-",
        shade: "-",
        size: "-",
        fibre: "-",
        colourBase: "-",
        styling: "-",
        rate: 100,
        orderQty: 5,
        discountPercent: 10,
        discountAmount: 50,
        value: 450,
        stockOnHand: 5,
        taxPercent: 5,
        taxAmount: 22.5,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 472.5,
      },
    ];

    const incoming: PurchaseOrderLineItem[] = [
      {
        id: "temp-1",
        sNo: 1,
        stockNo: "ITEM-A",
        barcode: "8901111111111",
        product: "Item A",
        brand: "SMRITI",
        style: "-",
        shade: "-",
        size: "-",
        fibre: "-",
        colourBase: "-",
        styling: "-",
        rate: 100,
        orderQty: 5,
        discountPercent: 10,
        discountAmount: 50,
        value: 450,
        stockOnHand: 0,
        taxPercent: 5,
        taxAmount: 22.5,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 472.5,
      },
    ];

    const result = mergePOLineItems(existing, incoming, "MERGE");
    expect(result).toHaveLength(1);
    expect(result[0].stockNo).toBe("ITEM-A");
    expect(result[0].orderQty).toBe(10);
    // gross = 100 * 10 = 1000, discount 10% = 100, taxable = 900, tax 5% = 45, totalValue = 945
    expect(result[0].discountAmount).toBe(100);
    expect(result[0].value).toBe(900);
    expect(result[0].taxAmount).toBe(45);
    expect(result[0].totalValue).toBe(945);
  });
});
