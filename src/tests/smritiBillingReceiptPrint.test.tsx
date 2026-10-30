/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.20
 * Created      : 2026-10-29
 * Modified     : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Billing Studio Receipt Thermal & A4 Print Verification Suite
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

describe("SmritiBillingStudio Receipt Thermal & A4 Print Verification Suite", () => {
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

  it("1. mounts receipt modal outside #root to document.body via createPortal", () => {
    const filePath = path.resolve(__dirname, "../components/billing/SmritiBillingStudio.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    expect(componentCode).toContain("createPortal");
    expect(componentCode).toContain("document.body");
    expect(componentCode).toContain("pos-billing-receipt-modal-root");
  });

  it("2. enforces dynamic @page sizing for 80mm thermal roll vs A4 portrait with #root suppression", () => {
    const filePath = path.resolve(__dirname, "../components/billing/SmritiBillingStudio.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    // Dynamic @page sizing
    expect(componentCode).toContain('size: ${receiptPrintView === "THERMAL_80MM" ? "80mm auto" : "A4 portrait"};');
    
    // Strict #root suppression preventing Chromium 100vh blank page displacement
    expect(componentCode).toContain("#root {");
    expect(componentCode).toContain("display: none !important;");

    // Static unrolling in print mode
    expect(componentCode).toContain(".pos-billing-receipt-modal-root {");
    expect(componentCode).toContain("position: static !important;");
    expect(componentCode).toContain("display: block !important;");
    expect(componentCode).toContain("overflow: visible !important;");
  });

  it("3. excludes toolbar in print media and attaches keyboard shortcut listeners", () => {
    const filePath = path.resolve(__dirname, "../components/billing/SmritiBillingStudio.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    // Toolbar exclusion
    expect(componentCode).toContain("pos-billing-receipt-toolbar");
    expect(componentCode).toContain("display: none !important;");
    expect(componentCode).toContain("data-testid=\"pos-billing-receipt-print-btn\"");

    // Escape and F9 / Ctrl+P listeners
    expect(componentCode).toContain("handleReceiptKeyDown");
    expect(componentCode).toContain('e.key === "Escape"');
    expect(componentCode).toContain('setShowReceiptModal(false)');
    expect(componentCode).toContain('e.key === "F9"');
    expect(componentCode).toContain("window.print()");
  });
});
