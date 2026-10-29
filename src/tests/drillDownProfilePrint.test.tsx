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
 * Classification: DrillDown Entity Dossier Body Portal Print Verification Suite
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

describe("DrillDownSidePanel Profile Print Verification Suite", () => {
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

  it("1. mounts entity dossier modal outside #root to document.body via createPortal", () => {
    const filePath = path.resolve(__dirname, "../components/drilldown/DrillDownSidePanel.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    expect(componentCode).toContain("createPortal");
    expect(componentCode).toContain("document.body");
    expect(componentCode).toContain("drilldown-print-modal-root");
  });

  it("2. enforces A4 portrait sizing and #root suppression to prevent blank print preview", () => {
    const filePath = path.resolve(__dirname, "../components/drilldown/DrillDownSidePanel.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    expect(componentCode).toContain("size: A4 portrait;");
    expect(componentCode).toContain("margin: 8mm 10mm 10mm 10mm;");
    expect(componentCode).toContain("#root {");
    expect(componentCode).toContain("display: none !important;");

    // Static unrolling
    expect(componentCode).toContain(".drilldown-print-modal-root {");
    expect(componentCode).toContain("position: static !important;");
    expect(componentCode).toContain("display: block !important;");
    expect(componentCode).toContain("overflow: visible !important;");
  });

  it("3. wires print action buttons, printable dossier element, and keyboard listeners", () => {
    const filePath = path.resolve(__dirname, "../components/drilldown/DrillDownSidePanel.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    // Drawer buttons routing to modal
    expect(componentCode).toContain('data-testid="drilldown-print-profile-btn"');
    expect(componentCode).toContain('data-testid="drilldown-print-entity-btn"');
    expect(componentCode).toContain("setShowPrintProfileModal(true)");

    // Modal action button & printable content
    expect(componentCode).toContain('data-testid="drilldown-portal-print-action-btn"');
    expect(componentCode).toContain('id="drilldown-profile-printable"');
    expect(componentCode).toContain("Official Entity Dossier");
    expect(componentCode).toContain("drilldown-print-toolbar");

    // Keyboard shortcuts
    expect(componentCode).toContain('e.key === "Escape"');
    expect(componentCode).toContain("setShowPrintProfileModal(false)");
    expect(componentCode).toContain('e.key === "F9"');
    expect(componentCode).toContain("window.print()");
  });
});
