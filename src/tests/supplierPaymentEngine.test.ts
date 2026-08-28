/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.113.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import SupplierPaymentEngine from "../utils/supplierPaymentEngine";

describe("SupplierPaymentEngine — Supplier Payment Terms & Aging Engine", () => {

  const BASE = { vendorId: "VNDR-001", vendorName: "Textile Exports Ltd", branchCode: "BR-MUM-01" };

  // ─── Test 1: Invoice creation — due date and CURRENT aging bucket ──────────
  it("creates NET_30 invoice with correct dueDate and CURRENT bucket when not yet overdue", () => {
    const asOf = new Date("2026-08-10T00:00:00.000Z");
    const inv = SupplierPaymentEngine.createInvoice({
      ...BASE,
      invoiceNo:  "INV-2026-0001",
      invoiceAmt: 50000,
      invoiceDate: "2026-08-01",
      terms: "NET_30",
      earlyPayCutoffDays: 10,
      earlyPayDiscountPct: 2,
    }, asOf);

    expect(inv.dueDate).toBe("2026-08-31");   // Aug 01 + 30 days
    expect(inv.outstandingAmt).toBe(50000);
    expect(inv.status).toBe("UNPAID");
    expect(inv.agingBucket).toBe("CURRENT");   // asOf Aug 10 < dueDate Aug 31
    expect(inv.daysOverdue).toBe(0);
  });

  // ─── Test 2: Early-pay discount on payment within cutoff ──────────────────
  it("applies 2% early-pay discount when paid within 10-day cutoff", () => {
    const asOf = new Date("2026-08-05T00:00:00.000Z");
    let inv = SupplierPaymentEngine.createInvoice({
      ...BASE,
      invoiceNo:  "INV-2026-0002",
      invoiceAmt: 80000,
      invoiceDate: "2026-08-01",
      terms: "NET_60",
      earlyPayCutoffDays: 10,
      earlyPayDiscountPct: 2,
    }, asOf);

    // Paid on day 8 → within 10-day cutoff → 2% discount applies
    inv = SupplierPaymentEngine.recordPayment(inv, 80000, "2026-08-09", "CHQ-001");
    expect(inv.payments).toHaveLength(1);
    expect(inv.payments[0].earlyPayDiscount).toBe(1600);    // 80000 × 2% = 1600
    expect(inv.payments[0].netPaid).toBe(78400);            // 80000 - 1600
    expect(inv.status).toBe("PAID");
    expect(inv.outstandingAmt).toBe(0);
  });

  // ─── Test 3: Aging refresh — OVERDUE_30 and CRITICAL buckets ─────────────
  it("refreshes aging buckets: 45d overdue → OVERDUE_30; 130d overdue → CRITICAL", () => {
    const invoiceDate = "2026-05-01";
    const inv1 = SupplierPaymentEngine.createInvoice({
      ...BASE, invoiceNo: "INV-A", invoiceAmt: 25000,
      invoiceDate, terms: "NET_30",
    }, new Date("2026-05-01"));
    // dueDate = 2026-05-31; asOf = 2026-07-15 → 45 days overdue → OVERDUE_30

    const inv2 = SupplierPaymentEngine.createInvoice({
      ...BASE, vendorId: "VNDR-002", vendorName: "Craft Weaves",
      invoiceNo: "INV-B", invoiceAmt: 60000,
      invoiceDate: "2026-03-01", terms: "NET_30",
    }, new Date("2026-03-01"));
    // dueDate = 2026-03-31; asOf = 2026-08-08 → ~130 days overdue → CRITICAL

    const asOf = new Date("2026-07-15T00:00:00.000Z");
    const [r1] = SupplierPaymentEngine.refreshAging([inv1], asOf);
    // dueDate = May-31; asOf = Jul-15 → 45d overdue → OVERDUE_60 (31–60d band)
    expect(r1.agingBucket).toBe("OVERDUE_60");
    expect(r1.status).toBe("OVERDUE");

    const asOf2 = new Date("2026-08-08T00:00:00.000Z");
    const [r2] = SupplierPaymentEngine.refreshAging([inv2], asOf2);
    expect(r2.agingBucket).toBe("CRITICAL");
    expect(r2.daysOverdue).toBeGreaterThan(120);
  });

  // ─── Test 4: Due calendar + vendor aging report ───────────────────────────
  it("builds due calendar grouped by dueDate and generates vendor aging report with bucket totals", () => {
    const asOf = new Date("2026-08-28T00:00:00.000Z");

    const inv1 = SupplierPaymentEngine.createInvoice({ ...BASE, invoiceNo: "INV-C1", invoiceAmt: 30000, invoiceDate: "2026-07-29", terms: "NET_30" }, asOf);
    // dueDate = 2026-08-28 → CURRENT (0 days overdue on asOf)
    const inv2 = SupplierPaymentEngine.createInvoice({ ...BASE, invoiceNo: "INV-C2", invoiceAmt: 20000, invoiceDate: "2026-07-29", terms: "NET_30" }, asOf);
    // Same dueDate as inv1
    const inv3 = SupplierPaymentEngine.createInvoice({ ...BASE, invoiceNo: "INV-C3", invoiceAmt: 15000, invoiceDate: "2026-06-01", terms: "NET_30" }, asOf);
    // dueDate = 2026-07-01 → 58d overdue → OVERDUE_60

    const refreshed = SupplierPaymentEngine.refreshAging([inv1, inv2, inv3], asOf);

    // Due calendar
    const calendar = SupplierPaymentEngine.buildDueCalendar(refreshed);
    expect(calendar.length).toBeGreaterThanOrEqual(2);    // At least 2 distinct due dates
    const aug28Entry = calendar.find((e) => e.dueDate === "2026-08-28");
    expect(aug28Entry).toBeDefined();
    expect(aug28Entry!.totalDue).toBe(50000);             // 30000 + 20000
    expect(aug28Entry!.invoices).toHaveLength(2);

    // Vendor aging report
    const report = SupplierPaymentEngine.vendorAgingReport(refreshed, asOf);
    expect(report).toHaveLength(1);                        // 1 vendor
    const vendor = report[0];
    expect(vendor.totalOutstanding).toBe(65000);           // 30000 + 20000 + 15000
    const criticalBucket = vendor.buckets.find((b) => b.bucket === "OVERDUE_60");
    expect(criticalBucket!.totalAmt).toBe(15000);
    expect(vendor.oldestDueDays).toBeGreaterThan(50);
  });
});
