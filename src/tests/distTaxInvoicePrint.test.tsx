/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.19
 * Created      : 2026-10-29
 * Modified     : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: DistTaxInvoice Statutory Print & Body Portal Verification Suite
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DistTaxInvoice, calculateTaxInvoiceMetrics, deriveCustomerInvoiceDefaults } from "../components/sales/DistTaxInvoice.tsx";
import fs from "fs";
import path from "path";

describe("DistTaxInvoice Statutory Print & Body Portal Suite", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it("1. calculates accurate GST metrics for B2B tax invoice draft", () => {
    const items = [
      {
        id: "line-1",
        sNo: 1,
        stockNo: "SKU-M-001",
        itemDescription: "Men Formal Cotton Shirt",
        rate: 1500,
        qty: 2,
        value: 3000,
        discCode: "NONE",
        discQty: 0,
        discPercent: 10,
        discAmt: 300,
        total: 2700,
        salesStaff: "EMP001",
        hsnCode: "6205",
        gstRate: 18,
      },
    ];

    const metrics = calculateTaxInvoiceMetrics(items, []);
    expect(metrics.itemCount).toBe(1);
    expect(metrics.totalQty).toBe(2);
    expect(metrics.salesValue).toBe(3000);
    expect(metrics.itemDiscount).toBe(300);
    expect(metrics.totalTax).toBe(486); // (3000 - 300) * 0.18 = 486
    expect(metrics.netAmount).toBe(3186); // 2700 + 486 = 3186
  });

  it("2. embeds SMRITI Enterprise Body Portal print stylesheet and #root suppression rules", () => {
    const filePath = path.resolve(__dirname, "../components/sales/DistTaxInvoice.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    // Verify key architectural print rules that prevent blank print preview
    expect(componentCode).toContain("createPortal");
    expect(componentCode).toContain("dist-tax-invoice-modal-root");
    expect(componentCode).toContain("@page");
    expect(componentCode).toContain("size: A4 portrait");
    expect(componentCode).toContain("#root {");
    expect(componentCode).toContain("display: none !important");
    expect(componentCode).toContain("dist-tax-invoice-toolbar");
    expect(componentCode).toContain("dist-tax-invoice-sheet");
  });

  it("3. binds Escape and F9 / Ctrl+P print studio listeners", () => {
    const filePath = path.resolve(__dirname, "../components/sales/DistTaxInvoice.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    expect(componentCode).toContain('setIsPrintModalOpen(false)');
    expect(componentCode).toContain('window.print()');
    expect(componentCode).toContain('e.key === "Escape"');
    expect(componentCode).toContain('e.key === "F9"');
  });
});
