/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.17
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: ProPOS Shift Handover & Daily Reports Print Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProPosShiftHandoverSlip } from "../components/billing/propos/ProPosShiftHandoverSlip";
import { SmritiDailyReportsDashboard } from "../components/billing/propos/ProPosDailyReports";
import { POSZReportData } from "../components/billing/propos/types";

describe("ProPOS Shift Handover & Daily Reports Print Suite", () => {
  const mockShiftData: POSZReportData = {
    shift_id: "SH-20261029-01",
    shift_code: "REG-01-MORNING",
    register_id: "POS-TERMINAL-01",
    cashier_id: "USR-001",
    cashier_name: "Rahul Verma",
    start_time: "2026-10-29T09:00:00Z",
    end_time: "2026-10-29T17:00:00Z",
    total_sales: 45000,
    total_bills: 32,
    cash_sales: 18000,
    card_sales: 15000,
    upi_sales: 12000,
    opening_float: 2000,
    cash_in_total: 0,
    cash_drops_total: 5000,
    till_expenses_total: 200,
    net_expected_cash: 14800,
    actual_cash_counted: 14800,
    cash_variance: 0,
    denominations: {
      notes_500: 28,
      notes_200: 3,
      notes_100: 2,
    },
  };

  it("1. ProPosShiftHandoverSlip renders 80mm thermal receipt with #root suppression and static flow", () => {
    const html = renderToStaticMarkup(
      <ProPosShiftHandoverSlip data={mockShiftData} />
    );

    expect(html).toContain("thermal-handover-slip-print-area");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: 80mm auto");
    expect(html).toContain("margin: 0");
    expect(html).toContain("position: static !important");
    expect(html).toContain("width: 80mm !important");
    expect(html).toContain("CASHIER SHIFT HANDOVER REPORT");
    expect(html).toContain("Rahul Verma");
    expect(html).toContain("Cashier Sign");
    expect(html).toContain("Manager Sign");
  });

  it("2. SmritiDailyReportsDashboard renders A4 portrait daily analytics report with #root suppression", () => {
    const html = renderToStaticMarkup(
      <SmritiDailyReportsDashboard />
    );

    expect(html).toContain("propos-daily-report-printable");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("margin: 10mm 12mm 12mm 12mm");
    expect(html).toContain("position: static !important");
    expect(html).toContain("width: 100% !important");
    expect(html).toContain("ProPOS Daily Sales &amp; Shift Analytics Statement");
    expect(html).toContain("Hourly Rush &amp; Footfall Breakdown");
    expect(html).toContain("Cashier Shift Reconciliation &amp; Basket Analysis");
    expect(html).toContain("Store Manager Sign &amp; Stamp");
  });
});
