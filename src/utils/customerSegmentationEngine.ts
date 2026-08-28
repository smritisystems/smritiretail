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

/**
 * Customer Segmentation & AI Micro-Cohort Engine
 *
 * Implements RFM (Recency-Frequency-Monetary) scoring:
 *   - Recency  : days since last purchase (lower = better, score 1–5)
 *   - Frequency: total transaction count (higher = better, score 1–5)
 *   - Monetary : total lifetime spend (higher = better, score 1–5)
 *
 * Micro-cohort tagging from RFM composite:
 *   Champions, Loyal Customers, Potential Loyalists, New Customers,
 *   At Risk, Can't Lose Them, Hibernating, Lost
 *
 * Targeted promotion eligibility mapping per cohort.
 */

export interface CustomerTransaction {
  customerId: string;
  invoiceNo: string;
  invoiceDate: string;    // ISO
  netValue: number;
}

export interface RFMScore {
  recencyScore: number;    // 1–5 (5 = bought recently)
  frequencyScore: number;  // 1–5 (5 = buys often)
  monetaryScore: number;   // 1–5 (5 = highest spender)
  compositeScore: number;  // Weighted composite (0–100)
  rfmLabel: string;        // "555", "123" etc
}

export type MicroCohort =
  | "CHAMPIONS"
  | "LOYAL_CUSTOMERS"
  | "POTENTIAL_LOYALISTS"
  | "NEW_CUSTOMERS"
  | "PROMISING"
  | "NEED_ATTENTION"
  | "AT_RISK"
  | "CANT_LOSE_THEM"
  | "HIBERNATING"
  | "LOST";

export interface CustomerSegment {
  customerId: string;
  customerName: string;
  rfm: RFMScore;
  cohort: MicroCohort;
  lastPurchaseDate: string;
  totalTransactions: number;
  lifetimeValue: number;
  avgOrderValue: number;
  daysSinceLastPurchase: number;
  promotionEligibility: PromotionEligibility;
}

export interface PromotionEligibility {
  winbackOffer: boolean;          // For AT_RISK / CANT_LOSE / LOST
  loyaltyDoublePts: boolean;      // For CHAMPIONS / LOYAL
  earlyAccess: boolean;           // For CHAMPIONS / POTENTIAL_LOYALISTS
  birthdayCoupon: boolean;        // Always eligible
  flashSaleInvite: boolean;       // For high monetary scores
  reEngagementEmail: boolean;     // For HIBERNATING / LOST
}

export interface SegmentationReport {
  asOf: string;
  totalCustomers: number;
  cohortSummary: Record<MicroCohort, number>;
  avgLifetimeValue: number;
  avgOrderValue: number;
  topCohortByCount: MicroCohort;
  segments: CustomerSegment[];
}

/** RFM scoring thresholds (quintile-based) */
const RECENCY_THRESHOLDS  = [7, 30, 90, 180];   // days (< each threshold = higher score)
const FREQUENCY_THRESHOLDS = [1, 3, 6, 12];      // transactions (> each = higher score)
const MONETARY_THRESHOLDS  = [1000, 5000, 15000, 50000]; // INR lifetime value

/** Cohort label lookup from RFM composite */
const COHORT_RULES: Array<{ fn: (r: number, f: number, m: number) => boolean; cohort: MicroCohort }> = [
  { fn: (r, f, m) => r >= 4 && f >= 4 && m >= 4,                    cohort: "CHAMPIONS" },
  { fn: (r, f, m) => f >= 4 && m >= 3,                               cohort: "LOYAL_CUSTOMERS" },
  { fn: (r, f, m) => r >= 3 && f >= 2 && m >= 2,                    cohort: "POTENTIAL_LOYALISTS" },
  { fn: (r, f, m) => r >= 4 && f <= 2,                               cohort: "NEW_CUSTOMERS" },
  { fn: (r, f, m) => r >= 3 && f <= 2 && m <= 2,                    cohort: "PROMISING" },
  { fn: (r, f, m) => r === 3 && f >= 3,                              cohort: "NEED_ATTENTION" },
  { fn: (r, f, m) => r === 2 && (f >= 3 || m >= 3),                 cohort: "AT_RISK" },
  { fn: (r, f, m) => r <= 2 && f >= 4 && m >= 4,                    cohort: "CANT_LOSE_THEM" },
  { fn: (r, f, m) => r === 2 && f <= 2,                              cohort: "HIBERNATING" },
  { fn: () => true,                                                    cohort: "LOST" },
];

function scoreFromThresholds(value: number, thresholds: number[], higherIsBetter: boolean): number {
  if (higherIsBetter) {
    if (value > thresholds[3]) return 5;
    if (value > thresholds[2]) return 4;
    if (value > thresholds[1]) return 3;
    if (value > thresholds[0]) return 2;
    return 1;
  } else {
    // Lower value = better (recency)
    if (value <= thresholds[0]) return 5;
    if (value <= thresholds[1]) return 4;
    if (value <= thresholds[2]) return 3;
    if (value <= thresholds[3]) return 2;
    return 1;
  }
}

function resolvePromotion(seg: CustomerSegment["rfm"] & { cohort: MicroCohort }): PromotionEligibility {
  return {
    winbackOffer:        ["AT_RISK", "CANT_LOSE_THEM", "LOST", "HIBERNATING"].includes(seg.cohort),
    loyaltyDoublePts:    ["CHAMPIONS", "LOYAL_CUSTOMERS"].includes(seg.cohort),
    earlyAccess:         ["CHAMPIONS", "POTENTIAL_LOYALISTS"].includes(seg.cohort),
    birthdayCoupon:      true,
    flashSaleInvite:     seg.monetaryScore >= 4,
    reEngagementEmail:   ["HIBERNATING", "LOST"].includes(seg.cohort),
  };
}

export class CustomerSegmentationEngine {
  /** Score a single customer from their transaction history */
  public static scoreCustomer(params: {
    customerId: string;
    customerName: string;
    transactions: CustomerTransaction[];
    asOf: Date;
  }): CustomerSegment {
    const { transactions, asOf } = params;
    if (transactions.length === 0) {
      const rfm: RFMScore = { recencyScore: 1, frequencyScore: 1, monetaryScore: 1, compositeScore: 20, rfmLabel: "111" };
      return {
        customerId: params.customerId, customerName: params.customerName, rfm,
        cohort: "LOST", lastPurchaseDate: "", totalTransactions: 0, lifetimeValue: 0,
        avgOrderValue: 0, daysSinceLastPurchase: 9999,
        promotionEligibility: resolvePromotion({ ...rfm, cohort: "LOST" }),
      };
    }

    const sorted = [...transactions].sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
    const lastDate = new Date(sorted[0].invoiceDate);
    const daysSinceLast = Math.floor((asOf.getTime() - lastDate.getTime()) / 86400000);
    const lifetimeValue = transactions.reduce((s, t) => s + t.netValue, 0);
    const avgOrderValue = Math.round((lifetimeValue / transactions.length) * 100) / 100;

    const r = scoreFromThresholds(daysSinceLast, RECENCY_THRESHOLDS, false);
    const f = scoreFromThresholds(transactions.length, FREQUENCY_THRESHOLDS, true);
    const m = scoreFromThresholds(lifetimeValue, MONETARY_THRESHOLDS, true);
    const compositeScore = Math.round((r * 0.3 + f * 0.35 + m * 0.35) * 20);

    const rfm: RFMScore = { recencyScore: r, frequencyScore: f, monetaryScore: m, compositeScore, rfmLabel: `${r}${f}${m}` };
    const { cohort } = COHORT_RULES.find((rule) => rule.fn(r, f, m))!;

    return {
      customerId: params.customerId,
      customerName: params.customerName,
      rfm,
      cohort,
      lastPurchaseDate: sorted[0].invoiceDate,
      totalTransactions: transactions.length,
      lifetimeValue,
      avgOrderValue,
      daysSinceLastPurchase: daysSinceLast,
      promotionEligibility: resolvePromotion({ ...rfm, cohort }),
    };
  }

  /** Score all customers and build a full segmentation report */
  public static buildReport(params: {
    customers: Array<{ customerId: string; customerName: string }>;
    allTransactions: CustomerTransaction[];
    asOf: Date;
  }): SegmentationReport {
    const segments = params.customers.map((c) => {
      const txns = params.allTransactions.filter((t) => t.customerId === c.customerId);
      return this.scoreCustomer({ ...c, transactions: txns, asOf: params.asOf });
    });

    const cohortSummary = {} as Record<MicroCohort, number>;
    let totalLTV = 0, totalAOV = 0;

    for (const seg of segments) {
      cohortSummary[seg.cohort] = (cohortSummary[seg.cohort] ?? 0) + 1;
      totalLTV += seg.lifetimeValue;
      totalAOV += seg.avgOrderValue;
    }

    const topCohortByCount = (Object.entries(cohortSummary) as [MicroCohort, number][])
      .sort((a, b) => b[1] - a[1])[0][0];

    return {
      asOf: params.asOf.toISOString(),
      totalCustomers: segments.length,
      cohortSummary,
      avgLifetimeValue: segments.length > 0 ? Math.round(totalLTV / segments.length) : 0,
      avgOrderValue: segments.length > 0 ? Math.round(totalAOV / segments.length) : 0,
      topCohortByCount,
      segments,
    };
  }

  /** Filter segments by cohort */
  public static filterByCohort(segments: CustomerSegment[], cohort: MicroCohort): CustomerSegment[] {
    return segments.filter((s) => s.cohort === cohort);
  }

  /** Filter segments by promotion eligibility key */
  public static filterByPromotion(
    segments: CustomerSegment[],
    promoKey: keyof PromotionEligibility
  ): CustomerSegment[] {
    return segments.filter((s) => s.promotionEligibility[promoKey]);
  }
}

export default CustomerSegmentationEngine;
