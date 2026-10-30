/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.18
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Attendance Muster Roll & Wages Statement Print Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceWorkspaceTab } from "../components/hr/AttendanceWorkspaceTab";

describe("AttendanceWorkspaceTab Print Verification Suite", () => {
  it("1. renders Form II Statutory Muster Roll printable sheet with A4 landscape page size and #root suppression", () => {
    const html = renderToStaticMarkup(
      <AttendanceWorkspaceTab initialSection="muster_roll" />
    );

    expect(html).toContain("att-muster-printable-sheet");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: A4 landscape");
    expect(html).toContain("margin: 8mm");
    expect(html).toContain("Form II Statutory Muster Roll Matrix (Rule 27(1))");
    expect(html).toContain("HR Manager / Timekeeper Signature");
  });

  it("2. renders Monthly Wage Statement printable sheet with A4 portrait page size and #root suppression", () => {
    const html = renderToStaticMarkup(
      <AttendanceWorkspaceTab initialSection="wages" />
    );

    expect(html).toContain("att-wages-printable-sheet");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("margin: 10mm 12mm 12mm 12mm");
    expect(html).toContain("Monthly Payroll &amp; Wage Statement");
    expect(html).toContain("Prepared by (Payroll Executive)");
    expect(html).toContain("Approved by (Finance / Director)");
  });
});
