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

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DynamicPricingEngine,
  DynamicPricingRule,
  PricingEvaluationItem,
} from "../utils/dynamicPricingEngine";
import { DynamicPricingStudioModal } from "../components/billing/propos/DynamicPricingStudioModal";

describe("SMRITI Real-Time Dynamic Pricing & Happy Hours Discount Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleRules: DynamicPricingRule[] = [
    {
      id: "rule-hh-01",
      name: "Afternoon Happy Hours (20% Off)",
      code: "HAPPY-HOURS-20",
      type: "HAPPY_HOURS",
      startTime: "14:00",
      endTime: "17:00",
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      discountPct: 20,
      applicableCategories: ["Apparel"],
      isStackable: false,
      isActive: true,
    },
  ];

  const sampleItems: PricingEvaluationItem[] = [
    {
      sku: "APP-POLO-NAVY-M",
      category: "Apparel",
      qty: 2,
      unitPrice: 1000,
      mrp: 1200,
      lineTotal: 2000,
      discountAmt: 0,
    },
  ];

  it("STEP 1: should export DynamicPricingStudioModal component function", () => {
    expect(typeof DynamicPricingStudioModal).toBe("function");
  });

  it("STEP 2: should accurately detect active vs inactive time window", () => {
    // 3:30 PM on Wednesday (August 26, 2026) -> Day 3, 15:30
    const activeDate = new Date(2026, 7, 26, 15, 30, 0);
    const inactiveDate = new Date(2026, 7, 26, 11, 0, 0); // 11:00 AM

    expect(DynamicPricingEngine.isRuleActiveAt(sampleRules[0], activeDate)).toBe(true);
    expect(DynamicPricingEngine.isRuleActiveAt(sampleRules[0], inactiveDate)).toBe(false);
  });

  it("STEP 3: should compute 20% discount on Apparel category during Happy Hours", () => {
    const activeDate = new Date(2026, 7, 26, 15, 30, 0);
    const result = DynamicPricingEngine.evaluateCart(sampleItems, sampleRules, activeDate);

    expect(result.originalSubtotal).toBe(2000);
    expect(result.totalDiscount).toBe(400); // 20% of 2000
    expect(result.finalSubtotal).toBe(1600);
    expect(result.appliedRules).toContain("HAPPY-HOURS-20");
  });

  it("STEP 4: should not apply discounts outside happy hours time window", () => {
    const inactiveDate = new Date(2026, 7, 26, 11, 0, 0);
    const result = DynamicPricingEngine.evaluateCart(sampleItems, sampleRules, inactiveDate);

    expect(result.originalSubtotal).toBe(2000);
    expect(result.totalDiscount).toBe(0);
    expect(result.finalSubtotal).toBe(2000);
    expect(result.appliedRules.length).toBe(0);
  });
});
