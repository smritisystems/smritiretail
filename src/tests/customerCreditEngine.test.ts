/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.119.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import CustomerCreditEngine from "../utils/customerCreditEngine";

describe("CustomerCreditEngine — Customer Credit Limit & Outstanding Engine", () => {

  // ─── Test 1: setLimit + postInvoice — utilisation + limit breach ──────────
  it("postInvoice updates outstanding and utilisationPct; limit breach detected", () => {
    let acc = CustomerCreditEngine.setLimit({
      customerId: "CUST-001", customerName: "Apex Garments",
      creditLimit: 100000, paymentTermDays: 30,
    });
    expect(acc.creditLimit).toBe(100000);
    expect(acc.outstandingAmt).toBe(0);
    expect(acc.utilisationPct).toBe(0);
    expect(acc.limitBreached).toBe(false);

    const asOf = new Date("2026-08-28T00:00:00.000Z");
    acc = CustomerCreditEngine.postInvoice(acc, "INV-0001", 60000, "2026-07-28", asOf);
    expect(acc.outstandingAmt).toBe(60000);
    expect(acc.availableCredit).toBe(40000);
    expect(acc.utilisationPct).toBe(60);
    expect(acc.limitBreached).toBe(false);

    // Post another invoice that breaches limit
    acc = CustomerCreditEngine.postInvoice(acc, "INV-0002", 50000, "2026-08-01", asOf);
    expect(acc.outstandingAmt).toBe(110000);
    expect(acc.limitBreached).toBe(true);
    expect(acc.utilisationPct).toBe(110);
    expect(acc.invoices).toHaveLength(2);
  });

  // ─── Test 2: postPayment — FIFO allocation across invoices ───────────────
  it("postPayment allocates to oldest invoice first (FIFO by dueDate)", () => {
    const asOf = new Date("2026-08-01T00:00:00.000Z");
    let acc = CustomerCreditEngine.setLimit({
      customerId: "CUST-002", customerName: "Blue Thread Co",
      creditLimit: 200000, paymentTermDays: 30,
    });
    acc = CustomerCreditEngine.postInvoice(acc, "INV-0010", 40000, "2026-06-01", asOf);  // Due Jul-01
    acc = CustomerCreditEngine.postInvoice(acc, "INV-0011", 60000, "2026-07-01", asOf);  // Due Jul-31

    const { account: acc2, paymentRecord } =
      CustomerCreditEngine.postPayment(acc, 50000, "2026-08-01", "NEFT-REF-001");

    // First 40000 → INV-0010 (fully paid), next 10000 → INV-0011 (partial)
    const inv1 = acc2.invoices.find((i) => i.invoiceNo === "INV-0010")!;
    const inv2 = acc2.invoices.find((i) => i.invoiceNo === "INV-0011")!;
    expect(inv1.status).toBe("PAID");
    expect(inv1.outstandingAmt).toBe(0);
    expect(inv2.status).toBe("PARTIALLY_PAID");
    expect(inv2.outstandingAmt).toBe(50000);     // 60000 - 10000

    expect(paymentRecord.allocations).toHaveLength(2);
    expect(paymentRecord.allocations[0].allocatedAmt).toBe(40000);
    expect(paymentRecord.allocations[1].allocatedAmt).toBe(10000);

    expect(acc2.outstandingAmt).toBe(50000);     // Only INV-0011 remaining
    expect(acc2.utilisationPct).toBe(25);        // 50000/200000
  });

  // ─── Test 3: refreshAging — bucket assignments + credit hold/release ──────
  it("refreshAging assigns correct buckets; holdCredit blocks postInvoice", () => {
    let acc = CustomerCreditEngine.setLimit({
      customerId: "CUST-003", customerName: "Craft Weaves",
      creditLimit: 150000, paymentTermDays: 30,
    });
    const invoice1Date = "2026-05-01";  // Due: Jun-01
    const invoice2Date = "2026-06-01";  // Due: Jul-01
    const asOf = new Date("2026-08-28T00:00:00.000Z");

    acc = CustomerCreditEngine.postInvoice(acc, "INV-A", 30000, invoice1Date, new Date("2026-05-01"));
    acc = CustomerCreditEngine.postInvoice(acc, "INV-B", 20000, invoice2Date, new Date("2026-06-01"));

    const refreshed = CustomerCreditEngine.refreshAging(acc, asOf);
    const invA = refreshed.invoices.find((i) => i.invoiceNo === "INV-A")!;
    const invB = refreshed.invoices.find((i) => i.invoiceNo === "INV-B")!;

    // INV-A due Jun-01 → asOf Aug-28: Math.floor((Aug-28 - Jun-01) / 86400000) = 88 or 89 depending on ms offset
    // Jun-01 is parsed as UTC midnight; Aug-28 midnight UTC = 88 full days (Jun has 30d: 29 remaining + 31-Jul + 28-Aug = 88)
    // But invoiceDate "2026-05-01" + 30 termsDays → dueDate "2026-05-31"; asOf Aug-28 = 89 days overdue → OVERDUE_90
    expect(invA.agingBucket).toBe("OVERDUE_90");
    expect(invA.daysOverdue).toBe(89);   // May-31 → Aug-28 = 89 days

    // INV-B due Jul-01 (Jun-01 + 30d) → asOf Aug-28 = 58 days overdue → OVERDUE_60
    expect(invB.agingBucket).toBe("OVERDUE_60");
    expect(invB.daysOverdue).toBe(58);

    // Credit hold blocks new invoices
    const held = CustomerCreditEngine.holdCredit(acc, "MGR-001", "Overdue balance");
    expect(held.status).toBe("ON_HOLD");
    expect(() => CustomerCreditEngine.postInvoice(held, "INV-C", 5000, "2026-08-28", asOf)).toThrow("ON_HOLD");

    const released = CustomerCreditEngine.releaseCredit(held, "MGR-001");
    expect(released.status).toBe("ACTIVE");
    expect(released.holdReason).toBeUndefined();
  });

  // ─── Test 4: agingReport across multiple accounts ─────────────────────────
  it("agingReport returns per-account 5-bucket breakdown with utilisation and breach flag", () => {
    const asOf = new Date("2026-08-28T00:00:00.000Z");

    let acc1 = CustomerCreditEngine.setLimit({ customerId: "C-01", customerName: "Vendor A", creditLimit: 50000, paymentTermDays: 30 });
    let acc2 = CustomerCreditEngine.setLimit({ customerId: "C-02", customerName: "Vendor B", creditLimit: 80000, paymentTermDays: 30 });

    acc1 = CustomerCreditEngine.postInvoice(acc1, "I-01", 60000, "2026-05-01", asOf);  // Breaches limit; 88d overdue
    acc2 = CustomerCreditEngine.postInvoice(acc2, "I-02", 40000, "2026-08-01", asOf);  // Within limit; current

    const report = CustomerCreditEngine.agingReport([acc1, acc2], asOf);
    expect(report).toHaveLength(2);

    const r1 = report.find((r) => r.customerId === "C-01")!;
    expect(r1.limitBreached).toBe(true);
    expect(r1.outstanding).toBe(60000);
    const criticalBucket = r1.buckets.find((b) => b.bucket === "OVERDUE_90")!;
    expect(criticalBucket.totalAmt).toBe(60000);  // 88 days → OVERDUE_90

    const r2 = report.find((r) => r.customerId === "C-02")!;
    expect(r2.limitBreached).toBe(false);
    expect(r2.utilisationPct).toBe(50);  // 40000/80000
    const currentBucket = r2.buckets.find((b) => b.bucket === "CURRENT")!;
    expect(currentBucket.totalAmt).toBe(40000);
  });
});
