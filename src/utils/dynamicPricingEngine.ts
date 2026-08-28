/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.86.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export interface DynamicPricingRule {
  id: string;
  name: string;
  code: string;
  type: "HAPPY_HOURS" | "TIERED_DISCOUNT" | "BOGO_BUNDLE" | "FLAT_DISCOUNT";
  startTime: string; // "14:00"
  endTime: string;   // "17:00"
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  discountPct?: number;
  flatDiscountAmt?: number;
  minBillAmount?: number;
  minQuantity?: number;
  applicableCategories?: string[];
  isStackable: boolean;
  isActive: boolean;
}

export interface PricingEvaluationItem {
  sku: string;
  category: string;
  qty: number;
  unitPrice: number;
  mrp: number;
  lineTotal: number;
  discountAmt: number;
  appliedPromoCode?: string;
}

export interface PricingEvaluationResult {
  originalSubtotal: number;
  totalDiscount: number;
  finalSubtotal: number;
  appliedRules: string[];
  evaluatedItems: PricingEvaluationItem[];
}

export class DynamicPricingEngine {
  public static isRuleActiveAt(rule: DynamicPricingRule, checkDate: Date = new Date()): boolean {
    if (!rule.isActive) return false;

    // Check Day of Week
    const currentDay = checkDate.getDay();
    if (!rule.daysOfWeek.includes(currentDay)) {
      return false;
    }

    // Check Time of Day
    const currentHours = checkDate.getHours();
    const currentMins = checkDate.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMins;

    const [startH, startM] = rule.startTime.split(":").map(Number);
    const startTotalMinutes = startH * 60 + startM;

    const [endH, endM] = rule.endTime.split(":").map(Number);
    const endTotalMinutes = endH * 60 + endM;

    return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
  }

  public static evaluateCart(
    items: PricingEvaluationItem[],
    rules: DynamicPricingRule[],
    evaluationTime: Date = new Date()
  ): PricingEvaluationResult {
    const originalSubtotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
    let totalDiscount = 0;
    const appliedRules: string[] = [];

    const evaluatedItems: PricingEvaluationItem[] = items.map((item) => ({
      ...item,
      lineTotal: item.qty * item.unitPrice,
      discountAmt: 0,
    }));

    const activeRules = rules.filter((r) => this.isRuleActiveAt(r, evaluationTime));

    for (const rule of activeRules) {
      if (rule.type === "HAPPY_HOURS" && rule.discountPct) {
        let ruleDiscount = 0;
        evaluatedItems.forEach((item) => {
          if (
            !rule.applicableCategories ||
            rule.applicableCategories.length === 0 ||
            rule.applicableCategories.includes(item.category)
          ) {
            const itemBase = item.qty * item.unitPrice;
            const itemDisc = Math.round((itemBase * (rule.discountPct || 0)) / 100);
            item.discountAmt = Math.max(item.discountAmt, itemDisc);
            item.lineTotal = itemBase - item.discountAmt;
            item.appliedPromoCode = rule.code;
            ruleDiscount += itemDisc;
          }
        });

        if (ruleDiscount > 0) {
          totalDiscount += ruleDiscount;
          appliedRules.push(rule.code);
        }
      } else if (rule.type === "FLAT_DISCOUNT" && rule.flatDiscountAmt) {
        if (!rule.minBillAmount || originalSubtotal >= rule.minBillAmount) {
          totalDiscount += rule.flatDiscountAmt;
          appliedRules.push(rule.code);
        }
      }
    }

    const finalSubtotal = Math.max(0, originalSubtotal - totalDiscount);

    return {
      originalSubtotal,
      totalDiscount,
      finalSubtotal,
      appliedRules,
      evaluatedItems,
    };
  }
}

export default DynamicPricingEngine;
