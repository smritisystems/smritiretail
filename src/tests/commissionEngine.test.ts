/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.107.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import CommissionEngine, { DEFAULT_COMMISSION_CONFIG, SalesRepTarget, SalesEntry } from "../utils/commissionEngine";

describe("CommissionEngine — Staff Commission & Incentive Engine", () => {
  const PERIOD = "2026-08";
  const BRANCH = "BR-MUM-01";

  const TARGETS: SalesRepTarget[] = [
    { repId: "REP-01", repName: "Vikram Singh",   branchCode: BRANCH, period: PERIOD, revenueTarget: 150000, unitTarget: 300 },
    { repId: "REP-02", repName: "Ananya Pillai",  branchCode: BRANCH, period: PERIOD, revenueTarget: 150000, unitTarget: 300 },
    { repId: "REP-03", repName: "Rajesh Sharma",  branchCode: BRANCH, period: PERIOD, revenueTarget: 100000, unitTarget: 200 },
  ];

  const ENTRIES: SalesEntry[] = [
    // REP-01: netSales = 220000 - 10000 - 5000 = 205000 → exceeds target → gets target + top performer bonus
    { txnId: "T001", repId: "REP-01", branchCode: BRANCH, txnDate: "2026-08-15", grossSales: 220000, returns: 10000, discounts: 5000, unitsSold: 380 },
    // REP-02: netSales = 120000 - 5000 - 3000 = 112000 → below 150k target → no target bonus
    { txnId: "T002", repId: "REP-02", branchCode: BRANCH, txnDate: "2026-08-18", grossSales: 120000, returns: 5000,  discounts: 3000, unitsSold: 240 },
    // REP-03: netSales = 90000 - 2000 - 1000 = 87000 → below 100k target → no target bonus
    { txnId: "T003", repId: "REP-03", branchCode: BRANCH, txnDate: "2026-08-20", grossSales: 90000,  returns: 2000,  discounts: 1000, unitsSold: 180 },
  ];

  // ─── Test 1: Tiered commission computation ────────────────────────────────
  it("computes tiered commission correctly for a net sales value spanning multiple slabs", () => {
    // netSales = 205000
    // Slab 1: 0-50000 × 2%   = 1000
    // Slab 2: 50000-100000 × 3.5% = 1750
    // Slab 3: 100000-200000 × 5% = 5000
    // Slab 4: 200000-205000 × 6.5% = 325
    // Total = 1000 + 1750 + 5000 + 325 = 8075
    const { commission, appliedTiers } = CommissionEngine.computeTieredCommission(205000, DEFAULT_COMMISSION_CONFIG.tiers);
    expect(commission).toBe(8075);
    expect(appliedTiers).toHaveLength(4);
    expect(appliedTiers[0].commission).toBe(1000);
    expect(appliedTiers[1].commission).toBe(1750);
    expect(appliedTiers[2].commission).toBe(5000);
    expect(appliedTiers[3].commission).toBeCloseTo(325, 1);
  });

  // ─── Test 2: Rep commission with target bonus ─────────────────────────────
  it("REP-01 gets target bonus (≥100% achievement) and top-performer bonus", () => {
    const summary = CommissionEngine.computeRepCommission(TARGETS[0], ENTRIES, DEFAULT_COMMISSION_CONFIG, true);
    expect(summary.netSales).toBe(205000);
    expect(summary.revenueAchievementPct).toBeCloseTo(136.67, 0);   // 205000/150000
    expect(summary.unitAchievementPct).toBeCloseTo(126.67, 0);      // 380/300
    expect(summary.tieredCommission).toBe(8075);
    // Target bonus: 205000 × 0.5% = 1025
    expect(summary.targetBonus).toBe(1025);
    // Top performer bonus: 205000 × 0.25% = 512.5
    expect(summary.topPerformerBonus).toBe(512.5);
    expect(summary.totalCommission).toBe(8075 + 1025 + 512.5);      // 9612.5
  });

  // ─── Test 3: REP-02 below target — no bonus ───────────────────────────────
  it("REP-02 below revenue target gets tiered commission only — no bonuses", () => {
    const summary = CommissionEngine.computeRepCommission(TARGETS[1], ENTRIES, DEFAULT_COMMISSION_CONFIG, false);
    expect(summary.netSales).toBe(112000);
    expect(summary.revenueAchievementPct).toBeCloseTo(74.67, 0);
    // Slab 1: 50000×2%=1000, Slab 2: 50000×3.5%=1750, Slab 3: 12000×5%=600 → 3350
    expect(summary.tieredCommission).toBe(3350);
    expect(summary.targetBonus).toBe(0);
    expect(summary.topPerformerBonus).toBe(0);
    expect(summary.totalCommission).toBe(3350);
  });

  // ─── Test 4: Payout lifecycle + ledger aggregation ───────────────────────
  it("raises payouts, applies lifecycle transitions, and ledger sums are correct", () => {
    const summaries = CommissionEngine.computeBranchCommissions(TARGETS, ENTRIES);
    expect(summaries[0].repId).toBe("REP-01");  // Highest net sales first

    let p1 = CommissionEngine.raisePayout(summaries[0]);
    let p2 = CommissionEngine.raisePayout(summaries[1]);
    let p3 = CommissionEngine.raisePayout(summaries[2]);

    p1 = CommissionEngine.approve(p1, "HR-MGR-01");
    p1 = CommissionEngine.markPaid(p1, "BANK-TRANSFER");
    p2 = CommissionEngine.approve(p2, "HR-MGR-01");
    // p3 stays PENDING

    expect(p1.status).toBe("PAID");
    expect(p1.paidVia).toBe("BANK-TRANSFER");
    expect(p2.status).toBe("APPROVED");
    expect(p3.status).toBe("PENDING");

    const ledger = CommissionEngine.payoutLedger([p1, p2, p3]);
    expect(ledger.paidCount).toBe(1);
    expect(ledger.approvedCount).toBe(1);
    expect(ledger.pendingCount).toBe(1);
    expect(ledger.totalPaid).toBe(summaries[0].totalCommission);
    expect(ledger.totalApproved).toBe(summaries[1].totalCommission);
    expect(ledger.avgCommission).toBeGreaterThan(0);
  });
});
