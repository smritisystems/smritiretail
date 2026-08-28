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

export type SupplierSLAStatus = "GREEN" | "AMBER" | "RED" | "CRITICAL";
export type GRNQualityVerdict = "ACCEPTED" | "PARTIAL_REJECTION" | "FULL_REJECTION";

export interface SupplierProfile {
  supplierId: string;
  supplierName: string;
  gstIn?: string;
  category: string;             // e.g. "Apparel", "Electronics"
  contractedLeadTimeDays: number;
  contractedFillRatePct: number; // e.g. 95 = 95%
  penaltyPerDayDelay?: number;   // INR per day overdue
}

export interface PurchaseOrderRecord {
  poNumber: string;
  supplierId: string;
  orderedQty: number;
  orderedValue: number;
  poDate: string;               // ISO
  expectedDeliveryDate: string; // ISO
  actualDeliveryDate?: string;  // ISO — set when GRN received
  grnNumber?: string;
  receivedQty?: number;
  acceptedQty?: number;
  rejectedQty?: number;
  rejectionReason?: string;
  qualityVerdict?: GRNQualityVerdict;
}

export interface SupplierScorecardEntry {
  supplierId: string;
  supplierName: string;
  category: string;
  totalOrders: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  avgLeadTimeDays: number;
  contractedLeadTimeDays: number;
  onTimeDeliveryPct: number;
  fillRatePct: number;          // (acceptedQty / orderedQty) * 100
  qualityRejectionPct: number;  // (rejectedQty / receivedQty) * 100
  totalPenaltyAccrued: number;  // INR
  slaStatus: SupplierSLAStatus;
  scorecard: number;            // 0–100 composite score
  orders: PurchaseOrderRecord[];
}

export interface VendorSLAReport {
  asOfDate: string;
  totalSuppliers: number;
  greenSuppliers: number;
  amberSuppliers: number;
  redSuppliers: number;
  criticalSuppliers: number;
  avgScorecard: number;
  entries: SupplierScorecardEntry[];
}

export class SupplierScorecardEngine {
  /** Compute lead-time days between two ISO date strings */
  public static leadTimeDays(fromDate: string, toDate: string): number {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  /** Determine SLA status from scorecard number */
  public static resolveSLAStatus(score: number): SupplierSLAStatus {
    if (score >= 85) return "GREEN";
    if (score >= 70) return "AMBER";
    if (score >= 50) return "RED";
    return "CRITICAL";
  }

  /** Compute composite scorecard (0–100) */
  public static computeScore(params: {
    onTimeDeliveryPct: number;
    fillRatePct: number;
    qualityRejectionPct: number;
  }): number {
    // Weighted composite: OTD 50%, Fill Rate 35%, Quality 15%
    const qualityScore = Math.max(0, 100 - params.qualityRejectionPct * 10);
    const raw =
      params.onTimeDeliveryPct * 0.50 +
      params.fillRatePct * 0.35 +
      qualityScore * 0.15;
    return Math.round(Math.min(100, Math.max(0, raw)));
  }

  /** Build a scorecard entry for a single supplier */
  public static buildScorecard(
    profile: SupplierProfile,
    orders: PurchaseOrderRecord[],
    asOfDate: Date = new Date()
  ): SupplierScorecardEntry {
    const completedOrders = orders.filter((o) => o.actualDeliveryDate);

    let onTime = 0;
    let late = 0;
    let totalLeadDays = 0;
    let totalOrdered = 0;
    let totalAccepted = 0;
    let totalReceived = 0;
    let totalRejected = 0;
    let totalPenalty = 0;

    for (const order of completedOrders) {
      const actual = this.leadTimeDays(order.poDate, order.actualDeliveryDate!);
      const expected = this.leadTimeDays(order.poDate, order.expectedDeliveryDate);
      const daysLate = Math.max(0, actual - expected);

      totalLeadDays += actual;
      totalOrdered += order.orderedQty;
      totalAccepted += order.acceptedQty ?? order.receivedQty ?? 0;
      totalReceived += order.receivedQty ?? 0;
      totalRejected += order.rejectedQty ?? 0;

      if (daysLate === 0) {
        onTime++;
      } else {
        late++;
        if (profile.penaltyPerDayDelay) {
          totalPenalty += daysLate * profile.penaltyPerDayDelay;
        }
      }
    }

    const totalCompleted = completedOrders.length;
    const onTimeDeliveryPct = totalCompleted > 0 ? Math.round((onTime / totalCompleted) * 100) : 0;
    const fillRatePct = totalOrdered > 0 ? Math.round((totalAccepted / totalOrdered) * 1000) / 10 : 0;
    const qualityRejectionPct = totalReceived > 0 ? Math.round((totalRejected / totalReceived) * 1000) / 10 : 0;
    const avgLeadTimeDays = totalCompleted > 0 ? Math.round(totalLeadDays / totalCompleted) : 0;

    const scorecard = this.computeScore({ onTimeDeliveryPct, fillRatePct, qualityRejectionPct });
    const slaStatus = this.resolveSLAStatus(scorecard);

    return {
      supplierId: profile.supplierId,
      supplierName: profile.supplierName,
      category: profile.category,
      totalOrders: orders.length,
      onTimeDeliveries: onTime,
      lateDeliveries: late,
      avgLeadTimeDays,
      contractedLeadTimeDays: profile.contractedLeadTimeDays,
      onTimeDeliveryPct,
      fillRatePct,
      qualityRejectionPct,
      totalPenaltyAccrued: totalPenalty,
      slaStatus,
      scorecard,
      orders,
    };
  }

  /** Generate a full multi-supplier SLA report */
  public static generateReport(
    profiles: SupplierProfile[],
    allOrders: PurchaseOrderRecord[],
    asOfDate: Date = new Date()
  ): VendorSLAReport {
    const entries: SupplierScorecardEntry[] = profiles.map((p) => {
      const supplierOrders = allOrders.filter((o) => o.supplierId === p.supplierId);
      return this.buildScorecard(p, supplierOrders, asOfDate);
    });

    entries.sort((a, b) => b.scorecard - a.scorecard);

    const avgScorecard = entries.length > 0
      ? Math.round(entries.reduce((s, e) => s + e.scorecard, 0) / entries.length)
      : 0;

    return {
      asOfDate: asOfDate.toISOString(),
      totalSuppliers: entries.length,
      greenSuppliers:    entries.filter((e) => e.slaStatus === "GREEN").length,
      amberSuppliers:    entries.filter((e) => e.slaStatus === "AMBER").length,
      redSuppliers:      entries.filter((e) => e.slaStatus === "RED").length,
      criticalSuppliers: entries.filter((e) => e.slaStatus === "CRITICAL").length,
      avgScorecard,
      entries,
    };
  }
}

export default SupplierScorecardEngine;
