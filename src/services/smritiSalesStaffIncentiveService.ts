/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.31.0
 * Created      : 2026-09-17
 * Modified     : 2026-09-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Line-Level Sales Staff Attribution & Commission Tracking Engine
 */

import { CommissionRule, ProPosCartItem } from "../components/billing/propos/types.ts";

export interface LineStaffAttribution {
  lineId: string;
  sku: string;
  name: string;
  category?: string;
  lineTotal: number;
  salesStaffCode: string;
  salesStaffName?: string;
  matchedRuleId?: string;
  commissionPct: number;
  commissionEarned: number;
}

export interface StaffCommissionSummary {
  salesStaffCode: string;
  salesStaffName: string;
  totalItemsSold: number;
  totalTurnover: number;
  totalCommissionEarned: number;
  lines: LineStaffAttribution[];
}

export class SmritiSalesStaffIncentiveService {
  /**
   * Default commission rule table if none provided from database.
   */
  public static getDefaultRules(): CommissionRule[] {
    return [
      {
        id: "comm-default-1",
        salesStaffCode: "SM1",
        staffName: "Staff Member 01",
        category: "All Categories",
        tierMin: 0,
        tierMax: 50000,
        commissionPct: 2.0,
        effectiveFrom: "2026-01-01",
        isActive: true,
      },
      {
        id: "comm-default-2",
        salesStaffCode: "SM1",
        staffName: "Staff Member 01",
        category: "All Categories",
        tierMin: 50001,
        tierMax: 200000,
        commissionPct: 3.5,
        effectiveFrom: "2026-01-01",
        isActive: true,
      },
      {
        id: "comm-default-3",
        salesStaffCode: "SM2",
        staffName: "Staff Member 02",
        category: "Apparel",
        tierMin: 0,
        tierMax: 100000,
        commissionPct: 3.0,
        effectiveFrom: "2026-01-01",
        isActive: true,
      },
      {
        id: "comm-default-4",
        salesStaffCode: "SM2",
        staffName: "Staff Member 02",
        category: "Footwear",
        tierMin: 0,
        tierMax: 100000,
        commissionPct: 4.0,
        effectiveFrom: "2026-01-01",
        isActive: true,
      },
    ];
  }

  /**
   * Evaluates each cart item and attributes commission to the respective sales staff member.
   * If an item has no explicit salesStaff, it falls back to the defaultHeaderStaff.
   */
  public static calculateBasketCommissions(params: {
    cartItems: ProPosCartItem[];
    defaultHeaderStaff?: string;
    rules?: CommissionRule[];
  }): {
    lineAttributions: LineStaffAttribution[];
    staffSummaries: StaffCommissionSummary[];
    totalBasketCommission: number;
  } {
    const { cartItems, defaultHeaderStaff = "SM1", rules = this.getDefaultRules() } = params;
    const activeRules = rules.filter((r) => r.isActive);

    // 1. Group items by sales staff to evaluate turnover slabs accurately
    const staffTurnoverMap = new Map<string, number>();
    for (const item of cartItems) {
      const staffCode = (item.salesStaff || defaultHeaderStaff).trim().toUpperCase();
      const currentTurnover = staffTurnoverMap.get(staffCode) || 0;
      staffTurnoverMap.set(staffCode, currentTurnover + (item.lineTotal || 0));
    }

    const lineAttributions: LineStaffAttribution[] = [];
    const staffSummaryMap = new Map<string, StaffCommissionSummary>();

    for (const item of cartItems) {
      const staffCode = (item.salesStaff || defaultHeaderStaff).trim().toUpperCase();
      const staffTurnover = staffTurnoverMap.get(staffCode) || 0;
      const itemCategory = (item.brand || "General").trim(); // or category if available

      // Find best matching rule for staff member based on category and turnover tier
      const candidateRules = activeRules.filter((r) => {
        if (r.salesStaffCode.toUpperCase() !== staffCode) return false;
        if (staffTurnover < r.tierMin || staffTurnover > r.tierMax) return false;
        if (r.category !== "All Categories" && r.category.toLowerCase() !== itemCategory.toLowerCase()) {
          return false;
        }
        return true;
      });

      // Prefer category-specific rule over 'All Categories'
      candidateRules.sort((a, b) => {
        if (a.category !== "All Categories" && b.category === "All Categories") return -1;
        if (a.category === "All Categories" && b.category !== "All Categories") return 1;
        return b.commissionPct - a.commissionPct;
      });

      const matchedRule = candidateRules[0];
      const commissionPct = matchedRule ? matchedRule.commissionPct : 0.0;
      const commissionEarned = Math.round(((item.lineTotal * commissionPct) / 100) * 100) / 100;

      const attr: LineStaffAttribution = {
        lineId: item.id,
        sku: item.sku,
        name: item.name,
        category: itemCategory,
        lineTotal: item.lineTotal,
        salesStaffCode: staffCode,
        salesStaffName: matchedRule?.staffName || `Attendant ${staffCode}`,
        matchedRuleId: matchedRule?.id,
        commissionPct,
        commissionEarned,
      };
      lineAttributions.push(attr);

      // Aggregate into staff summary
      const existingSummary = staffSummaryMap.get(staffCode) || {
        salesStaffCode: staffCode,
        salesStaffName: matchedRule?.staffName || `Attendant ${staffCode}`,
        totalItemsSold: 0,
        totalTurnover: 0,
        totalCommissionEarned: 0,
        lines: [],
      };
      existingSummary.totalItemsSold += item.qty;
      existingSummary.totalTurnover += item.lineTotal;
      existingSummary.totalCommissionEarned += commissionEarned;
      existingSummary.lines.push(attr);
      staffSummaryMap.set(staffCode, existingSummary);
    }

    const staffSummaries = Array.from(staffSummaryMap.values());
    const totalBasketCommission = staffSummaries.reduce(
      (sum, s) => sum + s.totalCommissionEarned,
      0
    );

    return {
      lineAttributions,
      staffSummaries,
      totalBasketCommission: Math.round(totalBasketCommission * 100) / 100,
    };
  }
}
