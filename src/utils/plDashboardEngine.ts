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

/**
 * Store-Level Profit & Loss Dashboard Engine
 *
 * Computes daily, weekly, and monthly P&L metrics for a branch:
 *   Revenue         : Gross Sales − Returns
 *   COGS            : Sum of (costPrice × qty) across sold lines
 *   Gross Margin    : Revenue − COGS
 *   GM%             : Gross Margin / Revenue × 100
 *   Shrinkage Cost  : Value of stock written off (theft, damage, expiry)
 *   Markdown Cost   : Discount value given above policy threshold
 *   Operating Cost  : Rent + Staff + Utilities + Other
 *   Net Profit      : Gross Margin − Shrinkage − Markdown − Operating
 *   Net Margin%     : Net Profit / Revenue × 100
 */

export type PeriodType = "DAILY" | "WEEKLY" | "MONTHLY";

export interface SalesTxn {
  txnId: string;
  branchCode: string;
  txnDate: string;          // ISO date string YYYY-MM-DD
  grossSales: number;
  returns: number;
  cogs: number;             // Total cost of goods sold for this txn
  discountGiven: number;    // Total discount on this txn
}

export interface ShrinkageEntry {
  entryId: string;
  branchCode: string;
  date: string;             // ISO date
  reason: "THEFT" | "DAMAGE" | "EXPIRY" | "ADMIN_ERROR";
  costValue: number;        // Cost value of written-off stock
  qty: number;
}

export interface OperatingCost {
  branchCode: string;
  period: string;           // YYYY-MM for monthly, YYYY-WXX for weekly, YYYY-MM-DD for daily
  rent: number;
  staffCost: number;
  utilities: number;
  other: number;
}

export interface PLLine {
  label: string;
  value: number;
  pctOfRevenue?: number;   // Where applicable
  isDeduction?: boolean;
}

export interface BranchPLReport {
  branchCode: string;
  periodType: PeriodType;
  periodLabel: string;      // e.g. "2026-08-28", "2026-W35", "2026-08"
  fromDate: string;
  toDate: string;
  // Revenue
  grossSales: number;
  totalReturns: number;
  netRevenue: number;
  // Cost of goods
  cogs: number;
  grossMargin: number;
  grossMarginPct: number;
  // Deductions
  shrinkageCost: number;
  shrinkagePct: number;
  markdownCost: number;
  markdownPct: number;
  // Operating
  operatingCost: number;
  operatingCostPct: number;
  // Bottom line
  netProfit: number;
  netMarginPct: number;
  // Breakdown lines for display
  plLines: PLLine[];
  // Supporting counts
  txnCount: number;
  avgOrderValue: number;
  returnRate: number;       // returns / grossSales %
}

export interface MultiPeriodTrend {
  branchCode: string;
  periods: Array<{
    periodLabel: string;
    netRevenue: number;
    grossMarginPct: number;
    netMarginPct: number;
    shrinkageCost: number;
  }>;
  avgGrossMarginPct: number;
  avgNetMarginPct: number;
  revenueGrowthPct: number;  // Latest vs previous period
}

export const PL_CONFIG = {
  markdownPolicyThresholdPct: 10,   // Discounts above 10% of line value are classified as markdown cost
};

export class PLDashboardEngine {
  /** Compute P&L for a branch over a set of transactions, shrinkage entries, and operating costs */
  public static computePL(params: {
    branchCode: string;
    periodType: PeriodType;
    periodLabel: string;
    fromDate: string;
    toDate: string;
    transactions: SalesTxn[];
    shrinkage: ShrinkageEntry[];
    operatingCosts: OperatingCost[];
  }): BranchPLReport {
    const { branchCode, periodType, periodLabel, fromDate, toDate } = params;

    // Filter to branch & date range
    const txns = params.transactions.filter(
      (t) => t.branchCode === branchCode && t.txnDate >= fromDate && t.txnDate <= toDate
    );
    const shrinkageEntries = params.shrinkage.filter(
      (s) => s.branchCode === branchCode && s.date >= fromDate && s.date <= toDate
    );
    const opCosts = params.operatingCosts.filter((o) => o.branchCode === branchCode);

    // Revenue
    const grossSales   = Math.round(txns.reduce((s, t) => s + t.grossSales, 0) * 100) / 100;
    const totalReturns = Math.round(txns.reduce((s, t) => s + t.returns, 0) * 100) / 100;
    const netRevenue   = Math.round((grossSales - totalReturns) * 100) / 100;

    // COGS & Gross Margin
    const cogs         = Math.round(txns.reduce((s, t) => s + t.cogs, 0) * 100) / 100;
    const grossMargin  = Math.round((netRevenue - cogs) * 100) / 100;
    const grossMarginPct = netRevenue > 0 ? Math.round((grossMargin / netRevenue) * 10000) / 100 : 0;

    // Shrinkage
    const shrinkageCost = Math.round(shrinkageEntries.reduce((s, e) => s + e.costValue, 0) * 100) / 100;
    const shrinkagePct  = netRevenue > 0 ? Math.round((shrinkageCost / netRevenue) * 10000) / 100 : 0;

    // Markdown cost: discount given above policy threshold
    const markdownCost = Math.round(txns.reduce((s, t) => {
      const thresholdValue = t.grossSales * (PL_CONFIG.markdownPolicyThresholdPct / 100);
      return s + Math.max(0, t.discountGiven - thresholdValue);
    }, 0) * 100) / 100;
    const markdownPct = netRevenue > 0 ? Math.round((markdownCost / netRevenue) * 10000) / 100 : 0;

    // Operating cost
    const operatingCost = Math.round(opCosts.reduce((s, o) => s + o.rent + o.staffCost + o.utilities + o.other, 0) * 100) / 100;
    const operatingCostPct = netRevenue > 0 ? Math.round((operatingCost / netRevenue) * 10000) / 100 : 0;

    // Net Profit
    const netProfit    = Math.round((grossMargin - shrinkageCost - markdownCost - operatingCost) * 100) / 100;
    const netMarginPct = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 10000) / 100 : 0;

    // Supporting
    const txnCount    = txns.length;
    const avgOrderValue = txnCount > 0 ? Math.round((netRevenue / txnCount) * 100) / 100 : 0;
    const returnRate  = grossSales > 0 ? Math.round((totalReturns / grossSales) * 10000) / 100 : 0;

    // P&L Lines for display
    const pctOf = (v: number) => netRevenue > 0 ? Math.round((v / netRevenue) * 10000) / 100 : 0;
    const plLines: PLLine[] = [
      { label: "Gross Sales",        value: grossSales },
      { label: "Returns",            value: -totalReturns, isDeduction: true },
      { label: "Net Revenue",        value: netRevenue },
      { label: "COGS",               value: -cogs, pctOfRevenue: pctOf(cogs), isDeduction: true },
      { label: "Gross Margin",       value: grossMargin, pctOfRevenue: grossMarginPct },
      { label: "Shrinkage Cost",     value: -shrinkageCost, pctOfRevenue: shrinkagePct, isDeduction: true },
      { label: "Markdown Cost",      value: -markdownCost, pctOfRevenue: markdownPct, isDeduction: true },
      { label: "Operating Cost",     value: -operatingCost, pctOfRevenue: operatingCostPct, isDeduction: true },
      { label: "Net Profit",         value: netProfit, pctOfRevenue: netMarginPct },
    ];

    return {
      branchCode, periodType, periodLabel, fromDate, toDate,
      grossSales, totalReturns, netRevenue,
      cogs, grossMargin, grossMarginPct,
      shrinkageCost, shrinkagePct,
      markdownCost, markdownPct,
      operatingCost, operatingCostPct,
      netProfit, netMarginPct,
      plLines, txnCount, avgOrderValue, returnRate,
    };
  }

  /** Compute multi-period trend for a branch (e.g. last 6 months) */
  public static computeTrend(reports: BranchPLReport[]): MultiPeriodTrend {
    if (reports.length === 0) {
      return { branchCode: "", periods: [], avgGrossMarginPct: 0, avgNetMarginPct: 0, revenueGrowthPct: 0 };
    }
    const sorted = [...reports].sort((a, b) => a.periodLabel.localeCompare(b.periodLabel));
    const periods = sorted.map((r) => ({
      periodLabel:      r.periodLabel,
      netRevenue:       r.netRevenue,
      grossMarginPct:   r.grossMarginPct,
      netMarginPct:     r.netMarginPct,
      shrinkageCost:    r.shrinkageCost,
    }));
    const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;
    const avgGrossMarginPct = avg(sorted.map((r) => r.grossMarginPct));
    const avgNetMarginPct   = avg(sorted.map((r) => r.netMarginPct));
    const revenueGrowthPct  = sorted.length >= 2
      ? Math.round(((sorted.at(-1)!.netRevenue - sorted.at(-2)!.netRevenue) / (sorted.at(-2)!.netRevenue || 1)) * 10000) / 100
      : 0;
    return { branchCode: sorted[0].branchCode, periods, avgGrossMarginPct, avgNetMarginPct, revenueGrowthPct };
  }

  /** Compare P&L across multiple branches for the same period */
  public static compareBranches(reports: BranchPLReport[]): BranchPLReport[] {
    return [...reports].sort((a, b) => b.netProfit - a.netProfit);
  }
}

export default PLDashboardEngine;
