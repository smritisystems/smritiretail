/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.102.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import PLDashboardEngine, {
  SalesTxn, ShrinkageEntry, OperatingCost, PL_CONFIG,
} from "../utils/plDashboardEngine";

describe("PLDashboardEngine — Store-Level P&L Dashboard", () => {
  const BRANCH = "BR-MUM-01";
  const FROM   = "2026-08-01";
  const TO     = "2026-08-31";

  const TRANSACTIONS: SalesTxn[] = [
    { txnId: "T001", branchCode: BRANCH, txnDate: "2026-08-05", grossSales: 85000, returns: 3000, cogs: 51000, discountGiven: 5000 },
    { txnId: "T002", branchCode: BRANCH, txnDate: "2026-08-12", grossSales: 120000, returns: 5000, cogs: 72000, discountGiven: 18000 },
    { txnId: "T003", branchCode: BRANCH, txnDate: "2026-08-20", grossSales: 95000, returns: 2000, cogs: 57000, discountGiven: 4000 },
    { txnId: "T004", branchCode: "BR-DEL-01", txnDate: "2026-08-18", grossSales: 200000, returns: 0, cogs: 100000, discountGiven: 0 },  // Different branch — must be excluded
  ];

  const SHRINKAGE: ShrinkageEntry[] = [
    { entryId: "S001", branchCode: BRANCH, date: "2026-08-10", reason: "THEFT",  costValue: 4500, qty: 5 },
    { entryId: "S002", branchCode: BRANCH, date: "2026-08-25", reason: "DAMAGE", costValue: 1200, qty: 2 },
  ];

  const OP_COSTS: OperatingCost[] = [
    { branchCode: BRANCH, period: "2026-08", rent: 45000, staffCost: 120000, utilities: 8000, other: 5000 },
  ];

  // ─── Test 1: Correct P&L computation ─────────────────────────────────────
  it("computes correct net revenue, gross margin, shrinkage, markdown, net profit for branch", () => {
    const report = PLDashboardEngine.computePL({
      branchCode: BRANCH, periodType: "MONTHLY", periodLabel: "2026-08",
      fromDate: FROM, toDate: TO,
      transactions: TRANSACTIONS, shrinkage: SHRINKAGE, operatingCosts: OP_COSTS,
    });

    // Only 3 branch txns included (BR-DEL-01 excluded)
    expect(report.txnCount).toBe(3);
    expect(report.grossSales).toBe(300000);          // 85k+120k+95k
    expect(report.totalReturns).toBe(10000);         // 3k+5k+2k
    expect(report.netRevenue).toBe(290000);

    // COGS = 51k+72k+57k = 180k
    expect(report.cogs).toBe(180000);
    expect(report.grossMargin).toBe(110000);         // 290k-180k
    expect(report.grossMarginPct).toBeCloseTo(37.93, 1);

    // Shrinkage = 4500+1200 = 5700
    expect(report.shrinkageCost).toBe(5700);

    // Markdown: T002 discount 18000 on grossSales 120000 → threshold=12000 → markdown=6000
    // T001: threshold=8500, discount=5000 → 0 markdown
    // T003: threshold=9500, discount=4000 → 0 markdown
    expect(report.markdownCost).toBe(6000);

    // Operating = 45k+120k+8k+5k = 178k
    expect(report.operatingCost).toBe(178000);

    // Net Profit = 110000 - 5700 - 6000 - 178000 = -79700
    expect(report.netProfit).toBe(-79700);
    expect(report.plLines).toHaveLength(9);
  });

  // ─── Test 2: Return rate and avg order value ──────────────────────────────
  it("computes return rate and average order value correctly", () => {
    const report = PLDashboardEngine.computePL({
      branchCode: BRANCH, periodType: "MONTHLY", periodLabel: "2026-08",
      fromDate: FROM, toDate: TO,
      transactions: TRANSACTIONS, shrinkage: SHRINKAGE, operatingCosts: OP_COSTS,
    });

    // Return rate = 10000 / 300000 = 3.33%
    expect(report.returnRate).toBeCloseTo(3.33, 1);
    // Avg order value = 290000 / 3 = 96666.67
    expect(report.avgOrderValue).toBeCloseTo(96666.67, 0);
  });

  // ─── Test 3: Multi-period trend ───────────────────────────────────────────
  it("computes trend across multiple periods — correct growth % and averages", () => {
    const r1 = PLDashboardEngine.computePL({ branchCode: BRANCH, periodType: "MONTHLY", periodLabel: "2026-06", fromDate: "2026-06-01", toDate: "2026-06-30", transactions: [{ txnId: "TX1", branchCode: BRANCH, txnDate: "2026-06-15", grossSales: 200000, returns: 5000, cogs: 120000, discountGiven: 5000 }], shrinkage: [], operatingCosts: [] });
    const r2 = PLDashboardEngine.computePL({ branchCode: BRANCH, periodType: "MONTHLY", periodLabel: "2026-07", fromDate: "2026-07-01", toDate: "2026-07-31", transactions: [{ txnId: "TX2", branchCode: BRANCH, txnDate: "2026-07-15", grossSales: 240000, returns: 4000, cogs: 140000, discountGiven: 8000 }], shrinkage: [], operatingCosts: [] });
    const r3 = PLDashboardEngine.computePL({ branchCode: BRANCH, periodType: "MONTHLY", periodLabel: "2026-08", fromDate: FROM, toDate: TO, transactions: TRANSACTIONS, shrinkage: SHRINKAGE, operatingCosts: OP_COSTS });

    const trend = PLDashboardEngine.computeTrend([r3, r1, r2]); // Unsorted input — engine must sort

    expect(trend.periods).toHaveLength(3);
    expect(trend.periods[0].periodLabel).toBe("2026-06");  // Sorted ascending
    expect(trend.periods[2].periodLabel).toBe("2026-08");

    // Revenue growth: (290000 - 236000) / 236000 = 22.88%
    expect(trend.revenueGrowthPct).toBeCloseTo(22.88, 0);
    expect(trend.avgGrossMarginPct).toBeGreaterThan(0);
  });

  // ─── Test 4: Branch comparison ────────────────────────────────────────────
  it("compareBranches sorts by netProfit descending", () => {
    const r1 = PLDashboardEngine.computePL({ branchCode: "BR-A", periodType: "MONTHLY", periodLabel: "2026-08", fromDate: FROM, toDate: TO, transactions: [{ txnId: "T1", branchCode: "BR-A", txnDate: "2026-08-10", grossSales: 500000, returns: 0, cogs: 250000, discountGiven: 10000 }], shrinkage: [], operatingCosts: [] });
    const r2 = PLDashboardEngine.computePL({ branchCode: "BR-B", periodType: "MONTHLY", periodLabel: "2026-08", fromDate: FROM, toDate: TO, transactions: [{ txnId: "T2", branchCode: "BR-B", txnDate: "2026-08-10", grossSales: 300000, returns: 0, cogs: 200000, discountGiven: 5000 }], shrinkage: [], operatingCosts: [] });

    const ranked = PLDashboardEngine.compareBranches([r2, r1]);
    expect(ranked[0].branchCode).toBe("BR-A");  // Higher net profit first
    expect(ranked[0].netProfit).toBeGreaterThan(ranked[1].netProfit);
  });
});
