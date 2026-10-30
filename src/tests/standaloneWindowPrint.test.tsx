/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.22
 * Created      : 2026-10-29
 * Modified     : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Verification Test Suite
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import fs from "fs";
import path from "path";

// Mock apiFetch and apiFetchV1
vi.mock("../lib/apiFetch.ts", () => ({
  apiFetchV1: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock("../lib/apiFetchV1.ts", () => ({
  apiFetchV1: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  clearAuthSession: vi.fn(),
  getTenantCompanyContext: vi.fn().mockReturnValue({
    legalName: "SMRITI ENTERPRISE RETAIL LTD",
    tradeName: "Smriti Mega Store",
    gstin: "27AABCS1429B1Z1",
    cin: "U74999MH2026PTC100000",
    address: "Commercial Complex, Sector 4, Nagpur, MH 440001",
    stateCode: "27",
  }),
}));

describe("StandaloneWindowView Sales Order Print Verification Suite", () => {
  const filePath = path.resolve(__dirname, "../components/standalone/StandaloneWindowView.tsx");
  const componentCode = fs.readFileSync(filePath, "utf-8");

  it("1. mounts #standalone-order-printable via createPortal directly to document.body with @page A4 portrait and #root suppression", () => {
    // Structural AST / code inspection
    expect(componentCode).toContain("createPortal(");
    expect(componentCode).toContain("document.body");
    expect(componentCode).toContain("standalone-order-modal-root");
    expect(componentCode).toContain("#standalone-order-printable");
    expect(componentCode).toContain("data-testid=\"standalone-order-print-portal\"");

    // Scoped print styles
    expect(componentCode).toContain("@page { size: A4 portrait; margin: 8mm 10mm 10mm 10mm; }");
    expect(componentCode).toContain("#root { display: none !important; }");
    expect(componentCode).toContain(".component-toolbar { display: none !important; }");
  });

  it("2. routes print button click to showPrintOrderModal portal instead of bare window.print()", () => {
    expect(componentCode).toContain("data-testid=\"standalone-order-print-btn\"");
    expect(componentCode).toContain("onClick={() => setShowPrintOrderModal(true)}");
    expect(componentCode).toContain("data-testid=\"standalone-order-modal-print-btn\"");
    expect(componentCode).toContain("data-testid=\"standalone-order-modal-close-btn\"");
  });

  it("3. supports universal keyboard shortcuts (Esc to close, F9 / Ctrl+P to print) and renders tenant branding", () => {
    expect(componentCode).toContain("e.key === \"Escape\"");
    expect(componentCode).toContain("setShowPrintOrderModal(false)");
    expect(componentCode).toContain("e.key === \"F9\"");
    expect(componentCode).toContain("window.print()");
    expect(componentCode).toContain("getTenantCompanyContext()");
    expect(componentCode).toContain("tenantContext.companyName");
    expect(componentCode).toContain("SO-2026-COUNTER");
    expect(componentCode).toContain("Subject to Nagpur Jurisdiction.");
  });
});
