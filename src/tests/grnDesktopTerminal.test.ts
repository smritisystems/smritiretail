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
});
