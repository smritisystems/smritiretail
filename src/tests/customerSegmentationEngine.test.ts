/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.98.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import CustomerSegmentationEngine, {
  CustomerTransaction,
  MicroCohort,
} from "../utils/customerSegmentationEngine";

describe("CustomerSegmentationEngine — Customer Segmentation & AI Micro-Cohort Engine", () => {
  const AS_OF = new Date("2026-08-28T00:00:00.000Z");

  // ─── Fixture helpers ──────────────────────────────────────────────────────
  function txn(invoiceDate: string, netValue: number, customerId = "CUST-001"): CustomerTransaction {
    return { customerId, invoiceNo: `INV-${Date.now()}-${Math.random()}`, invoiceDate, netValue };
  }

  // ─── Test 1: RFM scoring — Champions identification ───────────────────────
  it("scores a high-value frequent recent buyer as CHAMPIONS with RFM 5xx composite", () => {
    // Bought 3 days ago, 15 transactions, ₹80,000 LTV → R=5, F=5, M=4+ → CHAMPIONS
    const transactions: CustomerTransaction[] = [
      txn("2026-08-25T00:00:00.000Z", 20000),
      txn("2026-07-10T00:00:00.000Z", 15000),
      txn("2026-06-15T00:00:00.000Z", 12000),
      txn("2026-05-20T00:00:00.000Z", 10000),
      txn("2026-04-01T00:00:00.000Z", 8000),
      txn("2026-03-10T00:00:00.000Z", 6000),
      txn("2026-02-14T00:00:00.000Z", 4000),
      txn("2026-01-01T00:00:00.000Z", 3000),
      txn("2025-12-25T00:00:00.000Z", 2000),
    ];

    const seg = CustomerSegmentationEngine.scoreCustomer({
      customerId: "CUST-001", customerName: "Priya Sharma", transactions, asOf: AS_OF,
    });

    expect(seg.rfm.recencyScore).toBe(5);        // Bought 3 days ago
    expect(seg.rfm.frequencyScore).toBeGreaterThanOrEqual(4); // 9 transactions
    expect(seg.rfm.monetaryScore).toBeGreaterThanOrEqual(4);  // ₹80K LTV
    expect(seg.cohort).toBe("CHAMPIONS");
    expect(seg.promotionEligibility.loyaltyDoublePts).toBe(true);
    expect(seg.promotionEligibility.earlyAccess).toBe(true);
    expect(seg.promotionEligibility.winbackOffer).toBe(false);
    expect(seg.lifetimeValue).toBe(80000);
    expect(seg.daysSinceLastPurchase).toBe(3);
  });

  // ─── Test 2: LOST customer scoring ────────────────────────────────────────
  it("scores a customer with no recent purchases and low LTV as LOST with win-back eligibility", () => {
    // Last bought 400 days ago, only 1 transaction, ₹500 LTV → R=1, F=1, M=1 → LOST
    const transactions: CustomerTransaction[] = [
      txn("2025-07-15T00:00:00.000Z", 500),   // ~378 days ago
    ];

    const seg = CustomerSegmentationEngine.scoreCustomer({
      customerId: "CUST-002", customerName: "Rahul Gupta", transactions, asOf: AS_OF,
    });

    expect(seg.rfm.recencyScore).toBe(1);
    expect(seg.rfm.frequencyScore).toBe(1);
    expect(seg.rfm.monetaryScore).toBe(1);
    expect(seg.cohort).toBe("LOST");
    expect(seg.promotionEligibility.winbackOffer).toBe(true);
    expect(seg.promotionEligibility.reEngagementEmail).toBe(true);
    expect(seg.promotionEligibility.loyaltyDoublePts).toBe(false);
    expect(seg.promotionEligibility.birthdayCoupon).toBe(true);  // Always eligible
  });

  // ─── Test 3: Full segmentation report ────────────────────────────────────
  it("builds a complete report with cohort summary, avg LTV, and top cohort identification", () => {
    const customers = [
      { customerId: "C1", customerName: "Champion Customer" },
      { customerId: "C2", customerName: "Lost Customer" },
      { customerId: "C3", customerName: "New Customer" },
    ];

    const allTransactions: CustomerTransaction[] = [
      // C1: Champion — recent, frequent, high value
      ...Array.from({ length: 9 }, (_, i) =>
        txn(new Date(2026, 7, 25 - i * 15).toISOString(), 9000, "C1")
      ),
      // C2: Lost — old single purchase
      txn("2025-07-01T00:00:00.000Z", 400, "C2"),
      // C3: New — bought 2 days ago, once
      txn("2026-08-26T00:00:00.000Z", 2000, "C3"),
    ];

    const report = CustomerSegmentationEngine.buildReport({ customers, allTransactions, asOf: AS_OF });

    expect(report.totalCustomers).toBe(3);
    expect(report.segments).toHaveLength(3);
    expect(report.cohortSummary["CHAMPIONS"]).toBeGreaterThanOrEqual(1);
    expect(report.cohortSummary["LOST"]).toBeGreaterThanOrEqual(1);
    expect(report.avgLifetimeValue).toBeGreaterThan(0);
    expect(report.topCohortByCount).toBeDefined();

    // Filter by cohort
    const champions = CustomerSegmentationEngine.filterByCohort(report.segments, "CHAMPIONS");
    expect(champions.length).toBeGreaterThanOrEqual(1);
    expect(champions[0].customerId).toBe("C1");
  });

  // ─── Test 4: Promotion eligibility filtering ──────────────────────────────
  it("filters segments by promotion eligibility key — winback targets correct cohorts", () => {
    const customers = [
      { customerId: "CHAMP", customerName: "Champion" },
      { customerId: "LOST1", customerName: "Lost One" },
      { customerId: "LOST2", customerName: "Lost Two" },
    ];

    const allTransactions: CustomerTransaction[] = [
      // CHAMP: recent high-value frequent
      ...Array.from({ length: 10 }, (_, i) =>
        txn(new Date(2026, 7, 20 - i * 10).toISOString(), 10000, "CHAMP")
      ),
      // LOST1, LOST2: ancient single purchases
      txn("2025-01-01T00:00:00.000Z", 300, "LOST1"),
      txn("2025-02-01T00:00:00.000Z", 400, "LOST2"),
    ];

    const report = CustomerSegmentationEngine.buildReport({ customers, allTransactions, asOf: AS_OF });

    const winbackTargets = CustomerSegmentationEngine.filterByPromotion(report.segments, "winbackOffer");
    const earlyAccessTargets = CustomerSegmentationEngine.filterByPromotion(report.segments, "earlyAccess");

    // Champions should NOT be in winback; LOST customers should be
    expect(winbackTargets.every((s) => s.customerId !== "CHAMP")).toBe(true);
    expect(winbackTargets.length).toBeGreaterThanOrEqual(2);

    // Champion should be in earlyAccess
    expect(earlyAccessTargets.some((s) => s.customerId === "CHAMP")).toBe(true);

    // birthdayCoupon = all customers eligible
    const birthdayTargets = CustomerSegmentationEngine.filterByPromotion(report.segments, "birthdayCoupon");
    expect(birthdayTargets.length).toBe(3);
  });
});
