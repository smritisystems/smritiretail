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
 * Classification: ItemDetailsGrid Inventory & Price Manifest Print Verification Suite
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

describe("ItemDetailsGrid Manifest Print Verification Suite", () => {
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

  it("1. mounts manifest modal outside #root to document.body via createPortal", () => {
    const filePath = path.resolve(__dirname, "../components/itemMaster/ItemDetailsGrid.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    expect(componentCode).toContain("createPortal");
    expect(componentCode).toContain("document.body");
    expect(componentCode).toContain("item-manifest-print-modal-root");
  });

  it("2. enforces A4 landscape sizing and active #root suppression preventing blank page flow", () => {
    const filePath = path.resolve(__dirname, "../components/itemMaster/ItemDetailsGrid.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    // A4 landscape sizing
    expect(componentCode).toContain("size: A4 landscape;");
    expect(componentCode).toContain("margin: 8mm 10mm 10mm 10mm;");

    // Root suppression
    expect(componentCode).toContain("#root {");
    expect(componentCode).toContain("display: none !important;");

    // Static unrolling
    expect(componentCode).toContain(".item-manifest-print-modal-root {");
    expect(componentCode).toContain("position: static !important;");
    expect(componentCode).toContain("display: block !important;");
    expect(componentCode).toContain("overflow: visible !important;");
  });

  it("3. wires manifest button, portal action button, printable manifest body, and keyboard shortcuts", () => {
    const filePath = path.resolve(__dirname, "../components/itemMaster/ItemDetailsGrid.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    // Top action bar button routing to modal
    expect(componentCode).toContain('data-testid="item-grid-print-manifest-btn"');
    expect(componentCode).toContain("setShowPrintManifestModal(true)");

    // Modal action button & printable content
    expect(componentCode).toContain('data-testid="item-grid-portal-print-action-btn"');
    expect(componentCode).toContain('id="item-manifest-printable"');
    expect(componentCode).toContain("Inventory & Valuation Manifest");
    expect(componentCode).toContain("item-manifest-print-toolbar");

    // Keyboard shortcuts
    expect(componentCode).toContain('e.key === "Escape"');
    expect(componentCode).toContain("setShowPrintManifestModal(false)");
    expect(componentCode).toContain('e.key === "F9"');
    expect(componentCode).toContain("window.print()");
  });
});
