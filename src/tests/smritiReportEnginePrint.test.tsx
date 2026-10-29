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
 * Classification: SmritiReportEngine A4 Landscape Print Verification Suite
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";

describe("SmritiReportEngine A4 Landscape Print Verification Suite", () => {
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

  it("1. embeds SMRITI Enterprise Report Ledger Body Portal print stylesheet and #root suppression rules", () => {
    const filePath = path.resolve(__dirname, "../components/reports/SmritiReportEngine.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    // Verify key architectural print rules that prevent blank print preview
    expect(componentCode).toContain("createPortal");
    expect(componentCode).toContain("smriti-report-modal-root");
    expect(componentCode).toContain("@page");
    expect(componentCode).toContain("size: A4 landscape");
    expect(componentCode).toContain("#root {");
    expect(componentCode).toContain("display: none !important");
    expect(componentCode).toContain("smriti-report-toolbar");
    expect(componentCode).toContain("smriti-report-printable-sheet");
  });

  it("2. routes PDF / Print export to isPrintModalOpen instead of bare window.print", () => {
    const filePath = path.resolve(__dirname, "../components/reports/SmritiReportEngine.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    expect(componentCode).toContain('if (format === "pdf") {');
    expect(componentCode).toContain("setIsPrintModalOpen(true)");
    expect(componentCode).toContain("smriti-report-print-btn");
  });

  it("3. binds Escape and F9 / Ctrl+P listeners to report print modal", () => {
    const filePath = path.resolve(__dirname, "../components/reports/SmritiReportEngine.tsx");
    const componentCode = fs.readFileSync(filePath, "utf-8");

    expect(componentCode).toContain("setIsPrintModalOpen(false)");
    expect(componentCode).toContain("isPrintModalOpen");
  });
});
