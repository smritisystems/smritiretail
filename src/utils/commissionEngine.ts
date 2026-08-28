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

/**
 * Staff Commission & Incentive Engine
 *
 * Tracks sales rep performance and computes tiered commissions:
 *   Tiers           : Configurable slabs (e.g., 0–50k → 2%, 50k–100k → 3.5%, 100k+ → 5%)
 *   Targets         : Monthly revenue and unit-count targets per rep
 *   Commission      : Computed on net_sales (gross - returns - discounts)
 *   Bonuses         : Target-achievement bonus + top-performer bonus
 *   Payout Ledger   : PENDING → APPROVED → PAID / DISPUTED
 */

export type CommissionStatus = "PENDING" | "APPROVED" | "PAID" | "DISPUTED" | "CANCELLED";

export interface CommissionTier {
  fromValue: number;  // Inclusive
  toValue: number;    // Exclusive (use Infinity for top tier)
  ratePct: number;
}

export interface SalesRepTarget {
  repId: string;
  repName: string;
  branchCode: string;
  period: string;           // YYYY-MM
  revenueTarget: number;
  unitTarget: number;
}

export interface SalesEntry {
  txnId: string;
  repId: string;
  branchCode: string;
  txnDate: string;
  grossSales: number;
  returns: number;
  discounts: number;
  unitsSold: number;
}

export interface RepCommissionSummary {
  repId: string;
  repName: string;
  branchCode: string;
  period: string;
  grossSales: number;
  returns: number;
  discounts: number;
  netSales: number;
  unitsSold: number;
  revenueTarget: number;
  unitTarget: number;
  revenueAchievementPct: number;
  unitAchievementPct: number;
  commissionBase: number;    // = netSales
  tieredCommission: number;
  targetBonus: number;
  topPerformerBonus: number;
  totalCommission: number;
  appliedTiers: Array<{ tier: CommissionTier; salesInSlab: number; commission: number }>;
}

export interface CommissionPayout {
  payoutId: string;
  payoutNo: string;
  repId: string;
  repName: string;
  branchCode: string;
  period: string;
  netSales: number;
  totalCommission: number;
  status: CommissionStatus;
  approvedBy?: string;
  paidAt?: string;
  paidVia?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionConfig {
  tiers: CommissionTier[];
  targetAchievementBonusPct: number;   // Bonus % of net sales when ≥100% revenue target hit
  topPerformerBonusPct: number;        // Bonus % of net sales for branch top performer
}

export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  tiers: [
    { fromValue: 0,       toValue: 50000,   ratePct: 2.0  },
    { fromValue: 50000,   toValue: 100000,  ratePct: 3.5  },
    { fromValue: 100000,  toValue: 200000,  ratePct: 5.0  },
    { fromValue: 200000,  toValue: Infinity, ratePct: 6.5 },
  ],
  targetAchievementBonusPct: 0.5,   // 0.5% of net sales bonus when target fully achieved
  topPerformerBonusPct: 0.25,       // 0.25% of net sales for top performer in branch
};

export class CommissionEngine {
  private static payoutCounter = 1;

  /** Compute tiered commission on a net sales value */
  public static computeTieredCommission(
    netSales: number,
    tiers: CommissionTier[]
  ): { commission: number; appliedTiers: Array<{ tier: CommissionTier; salesInSlab: number; commission: number }> } {
    let remaining = netSales;
    let commission = 0;
    const appliedTiers: Array<{ tier: CommissionTier; salesInSlab: number; commission: number }> = [];

    for (const tier of tiers) {
      if (remaining <= 0) break;
      const slabSize   = tier.toValue === Infinity ? remaining : Math.min(remaining, tier.toValue - tier.fromValue);
      const salesInSlab = Math.min(remaining, slabSize);
      const tierComm   = Math.round(salesInSlab * (tier.ratePct / 100) * 100) / 100;
      commission       += tierComm;
      appliedTiers.push({ tier, salesInSlab, commission: tierComm });
      remaining        -= salesInSlab;
    }

    return { commission: Math.round(commission * 100) / 100, appliedTiers };
  }

  /** Compute commission summary for a single rep across their sales entries */
  public static computeRepCommission(
    repTarget: SalesRepTarget,
    entries: SalesEntry[],
    config: CommissionConfig = DEFAULT_COMMISSION_CONFIG,
    isTopPerformer: boolean = false
  ): RepCommissionSummary {
    const repEntries = entries.filter((e) => e.repId === repTarget.repId && e.txnDate.startsWith(repTarget.period));

    const grossSales = repEntries.reduce((s, e) => s + e.grossSales, 0);
    const returns    = repEntries.reduce((s, e) => s + e.returns, 0);
    const discounts  = repEntries.reduce((s, e) => s + e.discounts, 0);
    const netSales   = Math.round((grossSales - returns - discounts) * 100) / 100;
    const unitsSold  = repEntries.reduce((s, e) => s + e.unitsSold, 0);

    const revenueAchievementPct = repTarget.revenueTarget > 0
      ? Math.round((netSales / repTarget.revenueTarget) * 10000) / 100 : 0;
    const unitAchievementPct = repTarget.unitTarget > 0
      ? Math.round((unitsSold / repTarget.unitTarget) * 10000) / 100 : 0;

    const { commission: tieredCommission, appliedTiers } = this.computeTieredCommission(netSales, config.tiers);

    const targetBonus = revenueAchievementPct >= 100
      ? Math.round(netSales * (config.targetAchievementBonusPct / 100) * 100) / 100 : 0;

    const topPerformerBonus = isTopPerformer
      ? Math.round(netSales * (config.topPerformerBonusPct / 100) * 100) / 100 : 0;

    const totalCommission = Math.round((tieredCommission + targetBonus + topPerformerBonus) * 100) / 100;

    return {
      repId: repTarget.repId,
      repName: repTarget.repName,
      branchCode: repTarget.branchCode,
      period: repTarget.period,
      grossSales, returns, discounts, netSales, unitsSold,
      revenueTarget: repTarget.revenueTarget,
      unitTarget: repTarget.unitTarget,
      revenueAchievementPct, unitAchievementPct,
      commissionBase: netSales,
      tieredCommission, targetBonus, topPerformerBonus, totalCommission,
      appliedTiers,
    };
  }

  /** Rank reps by net sales, flag top performer per branch, compute all commissions */
  public static computeBranchCommissions(
    targets: SalesRepTarget[],
    entries: SalesEntry[],
    config: CommissionConfig = DEFAULT_COMMISSION_CONFIG
  ): RepCommissionSummary[] {
    // Group by branch
    const byBranch: Record<string, SalesRepTarget[]> = {};
    targets.forEach((t) => {
      (byBranch[t.branchCode] = byBranch[t.branchCode] ?? []).push(t);
    });

    const results: RepCommissionSummary[] = [];
    for (const [, branchTargets] of Object.entries(byBranch)) {
      // Find top performer (highest net sales) per branch
      const netSalesByRep = branchTargets.map((t) => {
        const e = entries.filter((x) => x.repId === t.repId && x.txnDate.startsWith(t.period));
        const net = e.reduce((s, x) => s + x.grossSales - x.returns - x.discounts, 0);
        return { repId: t.repId, net };
      });
      const topRepId = netSalesByRep.sort((a, b) => b.net - a.net)[0]?.repId;

      for (const target of branchTargets) {
        results.push(this.computeRepCommission(target, entries, config, target.repId === topRepId));
      }
    }

    return results.sort((a, b) => b.netSales - a.netSales);
  }

  /** Raise a payout record for a rep's commission summary */
  public static raisePayout(summary: RepCommissionSummary): CommissionPayout {
    const now    = new Date().toISOString();
    const payNo  = `CPAY-${now.slice(0, 7).replace(/-/g, "")}-${String(this.payoutCounter++).padStart(5, "0")}`;
    return {
      payoutId: `PYID-${Date.now()}`,
      payoutNo: payNo,
      repId:    summary.repId,
      repName:  summary.repName,
      branchCode: summary.branchCode,
      period:   summary.period,
      netSales: summary.netSales,
      totalCommission: summary.totalCommission,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
  }

  public static approve(payout: CommissionPayout, approvedBy: string): CommissionPayout {
    return { ...payout, status: "APPROVED", approvedBy, updatedAt: new Date().toISOString() };
  }

  public static markPaid(payout: CommissionPayout, paidVia: string): CommissionPayout {
    const now = new Date().toISOString();
    return { ...payout, status: "PAID", paidVia, paidAt: now, updatedAt: now };
  }

  public static dispute(payout: CommissionPayout, notes: string): CommissionPayout {
    return { ...payout, status: "DISPUTED", notes, updatedAt: new Date().toISOString() };
  }

  /** Ledger snapshot: aggregated payouts by status */
  public static payoutLedger(payouts: CommissionPayout[]): {
    totalPending: number; totalApproved: number; totalPaid: number; totalDisputed: number;
    pendingCount: number; approvedCount: number; paidCount: number; disputedCount: number;
    avgCommission: number;
  } {
    const byStatus = (s: CommissionStatus) => payouts.filter((p) => p.status === s);
    const sum = (ps: CommissionPayout[]) => Math.round(ps.reduce((a, p) => a + p.totalCommission, 0) * 100) / 100;

    const pending  = byStatus("PENDING");
    const approved = byStatus("APPROVED");
    const paid     = byStatus("PAID");
    const disputed = byStatus("DISPUTED");
    const avgCommission = payouts.length > 0 ? Math.round((sum(payouts) / payouts.length) * 100) / 100 : 0;

    return {
      totalPending: sum(pending),   pendingCount:  pending.length,
      totalApproved: sum(approved), approvedCount: approved.length,
      totalPaid: sum(paid),         paidCount:     paid.length,
      totalDisputed: sum(disputed), disputedCount: disputed.length,
      avgCommission,
    };
  }
}

export default CommissionEngine;
