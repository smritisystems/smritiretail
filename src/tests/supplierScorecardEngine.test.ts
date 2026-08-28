/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.90.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import SupplierScorecardEngine, {
  SupplierProfile,
  PurchaseOrderRecord,
} from "../utils/supplierScorecardEngine";

describe("SupplierScorecardEngine — Vendor SLA Compliance Audit", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  const SUPPLIER_A: SupplierProfile = {
    supplierId: "SUP-001",
    supplierName: "Kapoor Textiles Ltd.",
    category: "Apparel",
    contractedLeadTimeDays: 7,
    contractedFillRatePct: 95,
    penaltyPerDayDelay: 500,
  };

  const SUPPLIER_B: SupplierProfile = {
    supplierId: "SUP-002",
    supplierName: "Mehta Synthetics Pvt.",
    category: "Footwear",
    contractedLeadTimeDays: 10,
    contractedFillRatePct: 90,
    penaltyPerDayDelay: 200,
  };

  function makeOrders(supplierId: string, records: {
    days: number; daysLate: number; ordered: number; accepted: number; rejected: number;
  }[]): PurchaseOrderRecord[] {
    return records.map((r, i) => {
      const poDate = new Date(2026, 5, 1 + i * 10);
      const expectedDate = new Date(poDate);
      expectedDate.setDate(expectedDate.getDate() + r.days);
      const actualDate = new Date(expectedDate);
      actualDate.setDate(actualDate.getDate() + r.daysLate);
      return {
        poNumber: `PO-${supplierId}-${i + 1}`,
        supplierId,
        orderedQty: r.ordered,
        orderedValue: r.ordered * 500,
        poDate: poDate.toISOString(),
        expectedDeliveryDate: expectedDate.toISOString(),
        actualDeliveryDate: actualDate.toISOString(),
        receivedQty: r.accepted + r.rejected,
        acceptedQty: r.accepted,
        rejectedQty: r.rejected,
        qualityVerdict: r.rejected > 0 ? "PARTIAL_REJECTION" : "ACCEPTED",
      };
    });
  }

  // ─── Test 1: Lead-time days calculation ──────────────────────────────────
  it("calculates lead-time days correctly between two ISO dates", () => {
    const days = SupplierScorecardEngine.leadTimeDays("2026-06-01T00:00:00.000Z", "2026-06-08T00:00:00.000Z");
    expect(days).toBe(7);

    const sameDays = SupplierScorecardEngine.leadTimeDays("2026-06-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z");
    expect(sameDays).toBe(0);
  });

  // ─── Test 2: Scorecard composite calculation ──────────────────────────────
  it("computes composite scorecard with correct weights and SLA status classification", () => {
    // 90% OTD × 0.5 + 95% Fill × 0.35 + (100 - 5×10) × 0.15 = 45 + 33.25 + 7.5 = 85.75 → 86 → GREEN
    const score = SupplierScorecardEngine.computeScore({ onTimeDeliveryPct: 90, fillRatePct: 95, qualityRejectionPct: 5 });
    expect(score).toBe(86);
    expect(SupplierScorecardEngine.resolveSLAStatus(score)).toBe("GREEN");

    // Poor supplier: 50% OTD, 70% fill, 20% rejection
    const badScore = SupplierScorecardEngine.computeScore({ onTimeDeliveryPct: 50, fillRatePct: 70, qualityRejectionPct: 20 });
    expect(badScore).toBeLessThan(70);
    expect(SupplierScorecardEngine.resolveSLAStatus(badScore)).toMatch(/^(RED|CRITICAL)$/);

    // SLA status ladder
    expect(SupplierScorecardEngine.resolveSLAStatus(90)).toBe("GREEN");
    expect(SupplierScorecardEngine.resolveSLAStatus(75)).toBe("AMBER");
    expect(SupplierScorecardEngine.resolveSLAStatus(60)).toBe("RED");
    expect(SupplierScorecardEngine.resolveSLAStatus(40)).toBe("CRITICAL");
  });

  // ─── Test 3: Scorecard entry build with penalty accrual ──────────────────
  it("builds a supplier scorecard entry with correct OTD%, fill rate, and penalty calculation", () => {
    // 2 on-time, 1 late by 3 days → penalty = 3 × ₹500 = ₹1500
    const orders = makeOrders("SUP-001", [
      { days: 7, daysLate: 0, ordered: 100, accepted: 98, rejected: 2 },
      { days: 7, daysLate: 0, ordered: 100, accepted: 100, rejected: 0 },
      { days: 7, daysLate: 3, ordered: 100, accepted: 90, rejected: 5 },
    ]);

    const entry = SupplierScorecardEngine.buildScorecard(SUPPLIER_A, orders);

    expect(entry.totalOrders).toBe(3);
    expect(entry.onTimeDeliveries).toBe(2);
    expect(entry.lateDeliveries).toBe(1);
    expect(entry.onTimeDeliveryPct).toBe(67);       // 2/3 = 66.7 → 67
    expect(entry.totalPenaltyAccrued).toBe(1500);   // 3 days × ₹500
    expect(entry.qualityRejectionPct).toBeGreaterThan(0);
    expect(["GREEN", "AMBER", "RED", "CRITICAL"]).toContain(entry.slaStatus);
  });

  // ─── Test 4: Multi-supplier report generation and ranking ────────────────
  it("generates multi-supplier SLA report sorted by scorecard descending", () => {
    // SUPPLIER_A: all on-time, high fill rate → should rank higher
    const ordersA = makeOrders("SUP-001", [
      { days: 7, daysLate: 0, ordered: 100, accepted: 98, rejected: 0 },
      { days: 7, daysLate: 0, ordered: 100, accepted: 99, rejected: 1 },
    ]);

    // SUPPLIER_B: frequently late, low fill rate → should rank lower
    const ordersB = makeOrders("SUP-002", [
      { days: 10, daysLate: 5, ordered: 200, accepted: 140, rejected: 30 },
      { days: 10, daysLate: 7, ordered: 200, accepted: 120, rejected: 40 },
    ]);

    const report = SupplierScorecardEngine.generateReport(
      [SUPPLIER_A, SUPPLIER_B],
      [...ordersA, ...ordersB]
    );

    expect(report.totalSuppliers).toBe(2);
    expect(report.entries).toHaveLength(2);
    // Entries sorted descending by scorecard — SUP-001 should be first
    expect(report.entries[0].supplierId).toBe("SUP-001");
    expect(report.entries[0].scorecard).toBeGreaterThan(report.entries[1].scorecard);
    expect(typeof report.avgScorecard).toBe("number");
    expect(report.avgScorecard).toBeGreaterThan(0);
  });
});
