/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.15
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Employee Attendance & Payslip Studio Modal Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeAttendanceModal } from "../components/hr/EmployeeAttendanceModal";

describe("EmployeeAttendanceModal Architecture Suite", () => {
  it("1. returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <EmployeeAttendanceModal
        isOpen={false}
        onClose={() => {}}
      />
    );
    expect(html).toBe("");
  });

  it("2. renders attendance shell when isOpen is true", () => {
    const html = renderToStaticMarkup(
      <EmployeeAttendanceModal
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain("Employee Attendance &amp; Commission");
    expect(html).toContain("Attendance");
    expect(html).toContain("Commission");
    expect(html).toContain("Leave");
    expect(html).toContain("Payout");
  });
});
