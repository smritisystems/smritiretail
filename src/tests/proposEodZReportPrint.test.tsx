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
 * Classification: ProPOS EOD Register Closeout & Z-Report Print Verification Suite
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CashCountWarning,
  TenderCountWarning,
  VarianceNotesWarning,
  buildShiftClosePayload,
  calculateTenderVariance,
  createEodRegisterCloseout,
  normalizeZReport,
  parseTenderCount,
  selectOpenShift,
  SmritiProPosEodReport,
} from "../components/billing/propos/ProPosEodReportVie";

describe("SmritiProPosEodReport Print Suite", () => {
  it("normalizes the live API Z-Report contract and decimal string totals", () => {
    const report = normalizeZReport({
      shift_id: "shift-1",
      register_id: "register-1",
      cashier_id: "cashier-1",
      status: "OPEN",
      opened_at: "2026-11-25T03:00:00Z",
      opening_balance: "1000.00",
      cash_sales_total: "200.00",
      card_sales_total: "75.50",
      upi_sales_total: "24.50",
      total_sales: "300.00",
      total_invoices: "3",
      tax_total: "45.76",
      discount_total: "10.00",
      cash_drops_total: "20.00",
      till_expenses_total: "5.00",
      cash_in_total: "0.00",
      expected_cash: "1180.00",
      closing_balance: "0.00",
      variance: "0.00",
      denominations: { notes_500: 2, coins_total: "50.00" },
      cash_movements: [{
        id: "movement-1",
        shift_id: "shift-1",
        transaction_type: "CASH_DROP",
        amount: "20.00",
        reason: "Safe transfer",
        performed_by: "cashier-1",
      }],
    });

    expect(report.total_sales).toBe(300);
    expect(report.card_sales).toBe(75.5);
    expect(report.tax_total).toBe(45.76);
    expect(report.total_bills).toBe(3);
    expect(report.denominations?.coins).toBe(50);
    expect(report.cash_movements?.[0].amount).toBe(20);
    expect(report).not.toHaveProperty("other_sales");
  });

  it("does not report unavailable item, return, or gross/net totals as zero", () => {
    const report = normalizeZReport({
      shift_id: "shift-1",
      register_id: "register-1",
      cashier_id: "cashier-1",
      status: "OPEN",
      opened_at: "2026-11-25T03:00:00Z",
      opening_balance: "1000.00",
      cash_sales_total: "200.00",
      card_sales_total: "75.50",
      upi_sales_total: "24.50",
      total_sales: "300.00",
      total_invoices: "3",
      tax_total: "45.76",
      discount_total: "10.00",
      cash_drops_total: "20.00",
      till_expenses_total: "5.00",
      cash_in_total: "0.00",
      expected_cash: "1180.00",
      closing_balance: "0.00",
      variance: "0.00",
    });
    const closeout = createEodRegisterCloseout({
      shiftId: "shift-1",
      zReport: report,
      actualCash: 1180,
      actualCard: 75.5,
      actualUpi: 24.5,
      cashVariance: 0,
      remarks: "",
    });

    expect(closeout.totalSales).toBe(300);
    expect(closeout).not.toHaveProperty("totalItemsSold");
    expect(closeout).not.toHaveProperty("returnsTotal");
    expect(closeout).not.toHaveProperty("grossSales");
    expect(closeout).not.toHaveProperty("netSales");
  });

  it("warns before closing when expected cash is positive but the physical count is zero", () => {
    const warning = renderToStaticMarkup(
      <CashCountWarning expectedCash={1180} actualCashCounted={0} isLocked={false} />
    );

    expect(warning).toContain('role="alert"');
    expect(warning).toContain("Cash count is still zero");
    expect(warning).toContain("₹1,180.00");
    expect(warning).toContain("Count the drawer before closing");

    expect(renderToStaticMarkup(
      <CashCountWarning expectedCash={1180} actualCashCounted={1180} isLocked={false} />
    )).toBe("");
    expect(renderToStaticMarkup(
      <CashCountWarning expectedCash={1180} actualCashCounted={0} isLocked={true} />
    )).toBe("");
  });

  it("explains that terminal totals must be entered before an open shift can close", () => {
    const warning = renderToStaticMarkup(
      <TenderCountWarning isOpen cardEntered={false} upiEntered />
    );

    expect(warning).toContain('role="alert"');
    expect(warning).toContain("Card and UPI totals still need verification");
    expect(warning).toContain("Day Close cannot be finalized");
    expect(renderToStaticMarkup(
      <TenderCountWarning isOpen cardEntered upiEntered />
    )).toBe("");
    expect(renderToStaticMarkup(
      <TenderCountWarning isOpen={false} cardEntered={false} upiEntered={false} />
    )).toBe("");
  });

  it("requires a variance explanation before closing an open shift with a difference", () => {
    const warning = renderToStaticMarkup(
      <VarianceNotesWarning isOpen hasVariance notesEntered={false} />
    );

    expect(warning).toContain('role="alert"');
    expect(warning).toContain("Add a short explanation");
    expect(renderToStaticMarkup(
      <VarianceNotesWarning isOpen hasVariance notesEntered />
    )).toBe("");
    expect(renderToStaticMarkup(
      <VarianceNotesWarning isOpen={false} hasVariance notesEntered={false} />
    )).toBe("");
    expect(renderToStaticMarkup(
      <VarianceNotesWarning isOpen hasVariance={false} notesEntered={false} />
    )).toBe("");
  });

  it("calculates card and UPI variance instead of assuming every terminal is settled", () => {
    expect(calculateTenderVariance(75.5, 65.5)).toEqual({
      amount: -10,
      isMatched: false,
      isRecorded: true,
    });
    expect(calculateTenderVariance(24.5, 24.5)).toEqual({
      amount: 0,
      isMatched: true,
      isRecorded: true,
    });
    expect(calculateTenderVariance(100, 100.01).isMatched).toBe(false);
    expect(calculateTenderVariance(75.5, 65.5, -4.5)).toEqual({
      amount: -4.5,
      isMatched: false,
      isRecorded: true,
    });
    expect(calculateTenderVariance(100, undefined)).toEqual({
      amount: undefined,
      isMatched: false,
      isRecorded: false,
    });
    expect(parseTenderCount("")).toBeUndefined();
    expect(parseTenderCount("0")).toBe(0);
    expect(parseTenderCount("12.50")).toBe(12.5);
  });

  it("builds the Day Close request with the backend ShiftClose field names", () => {
    const payload = buildShiftClosePayload(
      5050,
      70,
      24.5,
      { notes_500: 10, coins: 50 },
      "  Cashier closeout  ",
    );

    expect(payload).toEqual({
      closing_balance: 5050,
      actual_card_counted: 70,
      actual_upi_counted: 24.5,
      closing_notes: "Cashier closeout",
      denominations: {
        notes_2000: 0,
        notes_500: 10,
        notes_200: 0,
        notes_100: 0,
        notes_50: 0,
        notes_20: 0,
        notes_10: 0,
        notes_5: 0,
        notes_2: 0,
        notes_1: 0,
        coins_total: 50,
      },
    });
  });

  it("normalizes persisted terminal totals and variances from a closed shift", () => {
    const report = normalizeZReport({
      shift_id: "shift-closed",
      register_id: "register-1",
      cashier_id: "cashier-1",
      status: "CLOSED",
      opened_at: "2026-11-25T03:00:00Z",
      opening_balance: "1000.00",
      cash_sales_total: "200.00",
      card_sales_total: "75.50",
      upi_sales_total: "24.50",
      actual_card_counted: "70.00",
      card_variance: "-5.50",
      actual_upi_counted: "25.00",
      upi_variance: "0.50",
      total_sales: "300.00",
      total_invoices: "3",
      tax_total: "45.76",
      discount_total: "10.00",
      cash_drops_total: "20.00",
      till_expenses_total: "5.00",
      cash_in_total: "0.00",
      expected_cash: "1180.00",
      closing_balance: "1180.00",
      variance: "0.00",
    });

    expect(report.actual_card_counted).toBe(70);
    expect(report.card_variance).toBe(-5.5);
    expect(report.actual_upi_counted).toBe(25);
    expect(report.upi_variance).toBe(0.5);
  });

  it("selects an open shift instead of a newer closed shift", () => {
    expect(selectOpenShift([
      { id: "closed-latest", status: "CLOSED" },
      { id: "open-older", status: "OPEN" },
    ])).toEqual({ id: "open-older", status: "OPEN" });
    expect(selectOpenShift([{ id: "closed-only", status: "CLOSED" }])).toBeNull();
  });

  it("1. renders printable Z-Report statement with #root suppression and A4 portrait dimensions", () => {
    const html = renderToStaticMarkup(
      <SmritiProPosEodReport onCommitCloseout={vi.fn()} />
    );

    expect(html).toContain("propos-eod-printable-statement");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("margin: 10mm 12mm 12mm 12mm");
  });

  it("2. enforces unrolled static flow and complete financial reconciliation sections", () => {
    const html = renderToStaticMarkup(
      <SmritiProPosEodReport onCommitCloseout={vi.fn()} />
    );

    expect(html).toContain("position: static !important");
    expect(html).toContain("width: 100% !important");
    expect(html).toContain("Transaction Breakdown");
    expect(html).toContain("Tender Reconciliation");
    expect(html).toContain("Card Variance");
    expect(html).toContain("UPI Variance");
    expect(html).toContain("Total Sales");
    expect(html).toContain("Discounts Allowed");
    expect(html).toContain("Cashier / Operator Signature");
    expect(html).toContain("Store Manager / Auditor Signature");
  });
});
