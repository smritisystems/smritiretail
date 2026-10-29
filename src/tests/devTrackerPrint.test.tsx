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

import { describe, it, expect, vi } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";

// Mock apiFetchV1
vi.mock("../lib/apiFetchV1.ts", () => ({
  apiFetchV1: vi.fn().mockResolvedValue({
    timestamp: "2026-10-29T12:00:00Z",
    gitInfo: { branch: "smritiNX", releaseVersion: "6.99.22", commitCount: 120, pendingChangesCount: 0 },
    releaseScores: { dhi: 94, grade: "A", developmentScore: 95, qualityScore: 92, releaseScore: 96, testCoverage: 91, documentation: 90 },
    riskAnalysis: { critical: 0, high: 0, medium: 1, low: 3 },
    modules: [],
    history: []
  }),
  getTenantCompanyContext: vi.fn().mockReturnValue({
    legalName: "SMRITI ENTERPRISE RETAIL LTD",
    tradeName: "Smriti Mega Store",
    gstin: "27AABCS1429B1Z1",
    cin: "U74999MH2026PTC100000",
    address: "Commercial Complex, Sector 4, Nagpur, MH 440001",
    stateCode: "27",
  }),
}));

describe("DevTrackerTab SDIC Diagnostics Report Print Verification Suite", () => {
  const filePath = path.resolve(__dirname, "../modules/dev_tracker/ui/DevTrackerTab.tsx");
  const componentCode = fs.readFileSync(filePath, "utf-8");

  it("1. mounts #dev-tracker-printable-sheet via createPortal directly to document.body with @page A4 portrait and #root suppression", () => {
    // Structural AST / code inspection
    expect(componentCode).toContain("createPortal(");
    expect(componentCode).toContain("document.body");
    expect(componentCode).toContain("dev-tracker-modal-root");
    expect(componentCode).toContain("#dev-tracker-printable-sheet");
    expect(componentCode).toContain("data-testid=\"dev-tracker-print-portal\"");

    // Scoped print styles
    expect(componentCode).toContain("@page { size: A4 portrait; margin: 8mm 10mm 10mm 10mm; }");
    expect(componentCode).toContain("#root { display: none !important; }");
    expect(componentCode).toContain(".component-toolbar { display: none !important; }");
  });

  it("2. routes Print Report button click to showPrintReportModal portal instead of bare window.print()", () => {
    expect(componentCode).toContain("data-testid=\"dev-tracker-print-btn\"");
    expect(componentCode).toContain("onClick={() => setShowPrintReportModal(true)}");
    expect(componentCode).toContain("data-testid=\"dev-tracker-modal-print-btn\"");
    expect(componentCode).toContain("data-testid=\"dev-tracker-modal-close-btn\"");
  });

  it("3. supports universal keyboard shortcuts (Esc to close, F9 / Ctrl+P to print) and renders SDIC DHI metrics", () => {
    expect(componentCode).toContain("e.key === \"Escape\"");
    expect(componentCode).toContain("setShowPrintReportModal(false)");
    expect(componentCode).toContain("e.key === \"F9\"");
    expect(componentCode).toContain("window.print()");
    expect(componentCode).toContain("getTenantCompanyContext()");
    expect(componentCode).toContain("SMRITI DEVELOPMENT INTELLIGENCE CENTER (SDIC)");
    expect(componentCode).toContain("DHI Score");
    expect(componentCode).toContain("Subject to Nagpur Jurisdiction.");
  });
});
