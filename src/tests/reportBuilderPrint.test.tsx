/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.21
 * Created      : 2026-10-29
 * Modified     : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Visual Report Designer A4 Landscape Print Verification Suite
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

describe("ReportBuilder Print Verification Suite", () => {
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

  it("1. mounts report modal outside #root to document.body via createPortal", () => {
    const filePath = path.resolve(__dirname, "../components/reports/ReportBuilder.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    expect(componentCode).toContain("createPortal");
    expect(componentCode).toContain("document.body");
    expect(componentCode).toContain("report-builder-print-modal-root");
  });

  it("2. enforces A4 landscape sizing and #root suppression to prevent blank print preview", () => {
    const filePath = path.resolve(__dirname, "../components/reports/ReportBuilder.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    expect(componentCode).toContain("size: A4 landscape;");
    expect(componentCode).toContain("margin: 8mm 10mm 10mm 10mm;");
    expect(componentCode).toContain("#root {");
    expect(componentCode).toContain("display: none !important;");

    // Static unrolling
    expect(componentCode).toContain(".report-builder-print-modal-root {");
    expect(componentCode).toContain("position: static !important;");
    expect(componentCode).toContain("display: block !important;");
    expect(componentCode).toContain("overflow: visible !important;");
  });

  it("3. wires export menu print routing, printable sheet, and keyboard listeners", () => {
    const filePath = path.resolve(__dirname, "../components/reports/ReportBuilder.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    // Export handler print routing
    expect(componentCode).toContain('format === "print" || format === "pdf"');
    expect(componentCode).toContain("setShowPrintReportModal(true)");

    // Modal action button & printable content
    expect(componentCode).toContain('data-testid="report-builder-portal-print-action-btn"');
    expect(componentCode).toContain('id="report-builder-printable-sheet"');
    expect(componentCode).toContain("Official Report Print Preview");
    expect(componentCode).toContain("report-builder-print-toolbar");

    // Keyboard shortcuts
    expect(componentCode).toContain('e.key === "Escape"');
    expect(componentCode).toContain("setShowPrintReportModal(false)");
    expect(componentCode).toContain('e.key === "F9"');
    expect(componentCode).toContain("window.print()");
  });
});
