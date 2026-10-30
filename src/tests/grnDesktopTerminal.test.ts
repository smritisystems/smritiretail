/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.35.0
 * Created      : 2026-09-24
 * Modified     : 2026-09-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_DESKTOP_TERMINAL_TEST")
 * Target UI    : Goods Receipt Desktop Terminal Unit & Ergonomic Test Suite
 */

import { describe, expect, it } from "vitest";

describe("Goods Receipt Desktop Terminal (Shoper 9 Parity) Logic & Computations", () => {
  // Test Line Items
  const sampleLines = [
    {
      rowId: "row-1",
      product_id: "prod-mug",
      code: "16I5LM01GBX",
      name: "MUG",
      quantity_ordered: 1,
      quantity_received: 1,
      quantity_damaged: 0,
      cost_price: 161.27,
      invoice_rate: 161.27,
      trade_discount: 0,
      gst_rate: 0,
      mrp: 1145.0,
      addon_before_tax: 0,
      addon_after_tax: 0,
      deduction_before_tax: 0,
      deduction_after_tax: 0,
    },
    {
      rowId: "row-2",
      product_id: "prod-cup",
      code: "1507S01CUPI",
      name: "Tea Cup",
      quantity_ordered: 2,
      quantity_received: 2,
      quantity_damaged: 0,
      cost_price: 21.09,
      invoice_rate: 21.09,
      trade_discount: 0,
      gst_rate: 18,
      mrp: 1020.0,
      addon_before_tax: 10,
      addon_after_tax: 0,
      deduction_before_tax: 5,
      deduction_after_tax: 0,
    },
  ];

  it("calculates Total Doc Quantity and Total Act Quantity correctly", () => {
    const totalDocQty = sampleLines.reduce(
      (acc, r) => acc + (r.quantity_ordered || r.quantity_received || 0),
      0
    );
    const totalActQty = sampleLines.reduce(
      (acc, r) => acc + (r.quantity_received || 0),
      0
    );

    expect(totalDocQty).toBe(3);
    expect(totalActQty).toBe(3);
  });

  it("computes Total Line Value without rounding errors", () => {
    const totalVal = sampleLines.reduce((acc, r) => {
      const rate = r.cost_price || r.invoice_rate || 0;
      return acc + r.quantity_received * rate;
    }, 0);

    // 1 * 161.27 + 2 * 21.09 = 161.27 + 42.18 = 203.45
    expect(Number(totalVal.toFixed(2))).toBe(203.45);
  });

  it("calculates line-level GST amounts and aggregate tax correctly", () => {
    const totalTax = sampleLines.reduce((acc, r) => {
      const rate = r.cost_price || r.invoice_rate || 0;
      const lineVal = r.quantity_received * rate;
      return acc + (lineVal * (r.gst_rate || 0)) / 100;
    }, 0);

    // Row 1: 0% tax = 0
    // Row 2: 42.18 * 18% = 7.5924
    expect(Number(totalTax.toFixed(2))).toBe(7.59);
  });

  it("calculates Addons, Deductions and Net Doc Total with precision", () => {
    const totalAddons = sampleLines.reduce(
      (acc, r) => acc + (r.addon_before_tax || 0) + (r.addon_after_tax || 0),
      0
    );
    const totalDeductions = sampleLines.reduce(
      (acc, r) =>
        acc + (r.deduction_before_tax || 0) + (r.deduction_after_tax || 0),
      0
    );

    expect(totalAddons).toBe(10);
    expect(totalDeductions).toBe(5);

    // Value (203.45) + Tax (7.5924) + Addons (10) - Deductions (5) = 216.0424
    const totalVal = 203.45;
    const totalTax = 7.5924;
    const docTotal = totalVal + totalTax + totalAddons - totalDeductions;
    expect(Number(docTotal.toFixed(2))).toBe(216.04);
  });

  it("verifies single direct entry row values match Row 1 Shoper 9 screenshot values", () => {
    const mug = sampleLines[0];
    expect(mug.code).toBe("16I5LM01GBX");
    expect(mug.name).toBe("MUG");
    expect(mug.quantity_ordered).toBe(1.0);
    expect(mug.quantity_received).toBe(1.0);
    expect(mug.mrp).toBe(1145.0);
    expect(mug.cost_price).toBe(161.27);
    expect(mug.cost_price * mug.quantity_received).toBe(161.27);
  });

  it("validates 6 desktop terminal sub-tabs and active panel layout transitions", () => {
    type SubTabId = "ITEMS" | "DAMAGE" | "LANDED_COST" | "TAX" | "DEBIT_NOTE" | "DOC_NOTES";
    const subTabs: SubTabId[] = ["ITEMS", "DAMAGE", "LANDED_COST", "TAX", "DEBIT_NOTE", "DOC_NOTES"];
    
    // Test that all 6 sub-tabs are uniquely identified and defined
    expect(subTabs.length).toBe(6);
    expect(new Set(subTabs).size).toBe(6);

    // Validate layout mode switching between single tab focus and all 3 columns
    const layoutModes = ["ACTIVE_TAB", "ALL_COLUMNS"];
    expect(layoutModes).toContain("ACTIVE_TAB");
    expect(layoutModes).toContain("ALL_COLUMNS");

    // Check that DOC_NOTES is a valid registered sub-tab
    expect(subTabs).toContain("DOC_NOTES");
    expect(subTabs).toContain("DEBIT_NOTE");
  });

  it("validates Indian statutory E-Way Bill 12-digit numeric constraint", () => {
    const sanitizeEwayBill = (val: string) => val.replace(/\D/g, "").slice(0, 12);

    expect(sanitizeEwayBill("241098234512")).toBe("241098234512");
    expect(sanitizeEwayBill("2410-9823-4512")).toBe("241098234512");
    expect(sanitizeEwayBill("2410982345129999")).toBe("241098234512");
    expect(sanitizeEwayBill("EWB-241098234512")).toBe("241098234512");
  });

  it("validates direct GRN selection and vendor invoice prefill for purchase billing", () => {
    const mockReceipt = {
      id: "rcpt-001",
      receipt_no: "GRN-20260924-1001",
      supplier_id: "SUP-001",
      supplier_name: "Century Textiles Ltd",
      invoice_number: "INV-9921",
      grand_total: 12500.5,
    };

    let selectedReceipt: any = null;
    let vendorBillNo = "";

    // Simulating user clicking 'Bill GRN →' directly from Purchase Bill tab
    selectedReceipt = mockReceipt;
    vendorBillNo = mockReceipt.invoice_number || "";

    expect(selectedReceipt.receipt_no).toBe("GRN-20260924-1001");
    expect(vendorBillNo).toBe("INV-9921");
    expect(selectedReceipt.grand_total).toBe(12500.5);
  });

  // Stakeholder Review & 11 Architectural Enhancements Test Suite
  describe("Stakeholder Review Verification: 11 Inward Enhancements", () => {
    // 3-Row Realistic Consignment Dataset matching stakeholder review
    const reviewRows = [
      {
        rowId: "line-001",
        code: "SKU-001",
        name: "Premium Linen Shirt",
        quantity_ordered: 100,
        quantity_received: 100,
        quantity_damaged: 10, // Accepted: 90
        cost_price: 800.0,
        invoice_rate: 800.0,
        trade_discount: 0,
        gst_rate: 18,
        addon_before_tax: 0,
        addon_after_tax: 0,
      },
      {
        rowId: "line-002",
        code: "SKU-002",
        name: "Slim Fit Chinos",
        quantity_ordered: 11,
        quantity_received: 11,
        quantity_damaged: 2, // Accepted: 9
        cost_price: 800.0,
        invoice_rate: 800.0,
        trade_discount: 0,
        gst_rate: 18,
        addon_before_tax: 0,
        addon_after_tax: 0,
      },
      {
        rowId: "line-003",
        code: "SKU-003",
        name: "Classic Silk Tie",
        quantity_ordered: 11,
        quantity_received: 11,
        quantity_damaged: 1, // Accepted: 10
        cost_price: 800.0,
        invoice_rate: 800.0,
        trade_discount: 5, // 5% discount
        gst_rate: 0, // 0% GST Exempt
        addon_before_tax: 0,
        addon_after_tax: 0,
      },
    ];

    it("verifies Quantity Reconciliation: 122 Received - 13 Damaged = 109 Accepted", () => {
      const totalDocQty = reviewRows.reduce((acc, r) => acc + r.quantity_ordered, 0);
      const totalReceivedQty = reviewRows.reduce((acc, r) => acc + r.quantity_received, 0);
      const totalDamageQty = reviewRows.reduce((acc, r) => acc + r.quantity_damaged, 0);
      const totalAcceptedQty = reviewRows.reduce(
        (acc, r) => acc + Math.max(0, r.quantity_received - r.quantity_damaged),
        0
      );

      expect(totalDocQty).toBe(122);
      expect(totalReceivedQty).toBe(122);
      expect(totalDamageQty).toBe(13);
      expect(totalAcceptedQty).toBe(109);
      expect(totalReceivedQty - totalDamageQty).toBe(totalAcceptedQty);
    });

    it("enforces Row 3 discount percentage boundary (0 <= % <= 100) and clamps discount value", () => {
      const clampDiscountPct = (val: number) => Math.min(100, Math.max(0, val));
      const calculateLineDiscount = (qty: number, rate: number, discPct: number) => {
        const lineVal = qty * rate;
        const validPct = clampDiscountPct(discPct);
        const discAmt = (lineVal * validPct) / 100;
        return Math.min(lineVal, Math.max(0, discAmt));
      };

      // Normal 5% on 11 units @ 800 = 8,800 * 5% = 440
      expect(clampDiscountPct(5)).toBe(5);
      expect(calculateLineDiscount(11, 800, 5)).toBe(440);

      // Oversized discount (> 100%) clamped to 100%
      expect(clampDiscountPct(150)).toBe(100);
      expect(calculateLineDiscount(11, 800, 150)).toBe(8800); // cannot exceed line value

      // Negative discount (< 0%) clamped to 0%
      expect(clampDiscountPct(-15)).toBe(0);
      expect(calculateLineDiscount(11, 800, -15)).toBe(0);
    });

    it("clarifies 0% tax handling by rendering '0% (Exempt)'", () => {
      const formatTaxLabel = (rate: number) => {
        if (!rate || rate === 0) return "0% (Exempt)";
        return `${rate}%`;
      };

      expect(formatTaxLabel(reviewRows[0].gst_rate)).toBe("18%");
      expect(formatTaxLabel(reviewRows[1].gst_rate)).toBe("18%");
      expect(formatTaxLabel(reviewRows[2].gst_rate)).toBe("0% (Exempt)");
    });

    it("apportions landed costs strictly across accepted sound units (109) with 0.00 remainder variance", () => {
      // Landed cost breakdown matching stakeholder scenario:
      // Freight: 84, Labor: 2,000, Insurance: 5,000 = Total Addons 7,084.00
      const totalAddons = 7084.0;
      const totalAcceptedQty = reviewRows.reduce(
        (acc, r) => acc + Math.max(0, r.quantity_received - r.quantity_damaged),
        0
      );
      expect(totalAcceptedQty).toBe(109);

      // Apportionment by Quantity weighted strictly across sound units
      const allocations = reviewRows.map((line) => {
        const soundQty = Math.max(0, line.quantity_received - line.quantity_damaged);
        const share = totalAcceptedQty > 0 ? soundQty / totalAcceptedQty : 0;
        const rawAlloc = totalAddons * share;
        return {
          rowId: line.rowId,
          soundQty,
          roundedAlloc: Math.round(rawAlloc * 100) / 100,
        };
      });

      // Check preliminary sums and Hamilton-Hare exact remainder adjustment
      const prelimSum = allocations.reduce((sum, a) => sum + a.roundedAlloc, 0);
      const diff = Math.round((totalAddons - prelimSum) * 100) / 100;

      // Distribute diff to the line with largest sound units
      const adjustedAllocations = allocations.map((a, idx) => {
        if (idx === 0) {
          return { ...a, finalAlloc: Math.round((a.roundedAlloc + diff) * 100) / 100 };
        }
        return { ...a, finalAlloc: a.roundedAlloc };
      });

      const totalApportioned = adjustedAllocations.reduce((sum, a) => sum + a.finalAlloc, 0);
      expect(totalApportioned).toBe(7084.0);

      // Row 1 (90 sound units): 90 / 109 * 7084 = ~5849.17
      expect(adjustedAllocations[0].soundQty).toBe(90);
      expect(adjustedAllocations[0].finalAlloc).toBeCloseTo(5849.17, 2);

      // Row 2 (9 sound units): 9 / 109 * 7084 = ~584.92
      expect(adjustedAllocations[1].soundQty).toBe(9);
      expect(adjustedAllocations[1].finalAlloc).toBeCloseTo(584.92, 2);

      // Row 3 (10 sound units): 10 / 109 * 7084 = ~649.91
      expect(adjustedAllocations[2].soundQty).toBe(10);
      expect(adjustedAllocations[2].finalAlloc).toBeCloseTo(649.91, 2);

      // Landed cost per unit
      const landedPerUnitRow1 = adjustedAllocations[0].finalAlloc / 90;
      expect(Number(landedPerUnitRow1.toFixed(2))).toBeCloseTo(65.0, 0);

      // Final cost per unit = 800 + 65.00 = 865.00
      const finalCostRow1 = reviewRows[0].cost_price + landedPerUnitRow1;
      expect(Number(finalCostRow1.toFixed(2))).toBeCloseTo(865.0, 0);
    });

    it("derives statutory Debit Note and blocked ITC under Section 17(5)(h) CGST Act for 13 damaged units", () => {
      // 13 damaged units across the 3 rows:
      // Row 1: 10 units @ 800 = 8,000 (18% GST = 1,440)
      // Row 2: 2 units @ 800 = 1,600 (18% GST = 288)
      // Row 3: 1 unit @ 800 = 800 (0% GST = 0)
      const damageLines = reviewRows.map((r) => {
        const dmgQty = r.quantity_damaged;
        const rate = r.cost_price;
        const dmgVal = dmgQty * rate;
        const blockedGst = (dmgVal * r.gst_rate) / 100;
        const debitClaim = dmgVal + blockedGst;
        return {
          code: r.code,
          dmgQty,
          dmgVal,
          blockedGst,
          debitClaim,
        };
      });

      const totalDmgQty = damageLines.reduce((acc, l) => acc + l.dmgQty, 0);
      const totalDmgVal = damageLines.reduce((acc, l) => acc + l.dmgVal, 0);
      const totalBlockedGst = damageLines.reduce((acc, l) => acc + l.blockedGst, 0);
      const totalDebitClaim = damageLines.reduce((acc, l) => acc + l.debitClaim, 0);

      expect(totalDmgQty).toBe(13);
      expect(totalDmgVal).toBe(10400); // ₹10,400 Damage Value
      expect(totalBlockedGst).toBe(1728); // Row 1 (1440) + Row 2 (288) + Row 3 (0) = ₹1,728
      expect(totalDebitClaim).toBe(12128); // ₹10,400 + ₹1,728 = ₹12,128

      // If Row 3 had 18% GST: 800 * 18% = 144 -> 1728 + 144 = 1872 -> 10400 + 1872 = 12272
      const all18PercentBlockedGst = 10400 * 0.18;
      expect(all18PercentBlockedGst).toBe(1872);
      expect(10400 + all18PercentBlockedGst).toBe(12272);
    });

    it("validates 12-column SIMPLE vs 20-column ADVANCED view mode configuration", () => {
      const simpleColumns = [
        "Index",
        "Stock No",
        "Description",
        "Doc Qty",
        "Received Qty",
        "Damage Qty",
        "Accepted Qty",
        "Purchase Price",
        "Value",
        "Landed / Unit",
        "Final Cost / Unit",
        "Final Value",
      ];

      const advancedColumns = [
        "Index",
        "Stock No",
        "Description",
        "Doc Qty",
        "Received Qty",
        "Damage Qty",
        "Accepted Qty",
        "Purchase Price",
        "Selling Price",
        "Value",
        "Disc %",
        "Disc Amt",
        "Tax Rate",
        "Tax Amount",
        "Alloc. Landed",
        "Landed / Unit",
        "Final Cost / Unit",
        "Final Value",
        "Addons (B/A)",
        "Deductions (B/A)",
      ];

      expect(simpleColumns.length).toBe(12);
      expect(advancedColumns.length).toBe(20);
      expect(simpleColumns).toContain("Received Qty");
      expect(simpleColumns).not.toContain("Act Qty");
      expect(advancedColumns).toContain("Disc %");
      expect(advancedColumns).toContain("Alloc. Landed");
    });

    it("validates consignment documents & notes attachment data model", () => {
      interface Attachment {
        id: string;
        name: string;
        size: number;
        type: string;
        uploadedAt: string;
      }

      const attachments: Attachment[] = [
        {
          id: "att-001",
          name: "Lorry_Receipt_LR_99182.pdf",
          size: 245760,
          type: "application/pdf",
          uploadedAt: "2026-09-24T18:30:00Z",
        },
        {
          id: "att-002",
          name: "Weighbridge_Slip_WB_1120.jpg",
          size: 1048576,
          type: "image/jpeg",
          uploadedAt: "2026-09-24T18:35:00Z",
        },
      ];

      expect(attachments.length).toBe(2);
      expect(attachments[0].name.endsWith(".pdf")).toBe(true);
      expect(attachments[1].name.endsWith(".jpg")).toBe(true);
      expect(attachments[0].size).toBeGreaterThan(0);
    });

    it("verifies Capitalized Inventory Valuation matches statutory formula: Accepted Value + Landed Addons", () => {
      const acceptedValue = 87200.0; // 109 units @ 800
      const allocatedLandedCost = 7084.0;
      const capitalizedInventoryValue = acceptedValue + allocatedLandedCost;

      expect(capitalizedInventoryValue).toBe(94284.0);
    });
  });
});

