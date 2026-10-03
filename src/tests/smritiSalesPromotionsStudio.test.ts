/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 6.19.0
 * * Created    : 2026-09-14
 * * Modified   : 2026-09-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 *
 * SMRITI Sales Promotions Studio & Recipe Simulation Engine Unit Tests
 */

import { describe, it, expect } from "vitest";
import {
  SmritiSalesPromotionService,
  SmritiDefinedSalesPromotion,
  SimulatedCartLine
} from "../services/smritiSalesPromotionService";

describe("SMRITI Sales Promotions Studio & Human-First Rule Engine", () => {
  const sampleCart: SimulatedCartLine[] = [
    { id: "1", sku: "SHIRT-01", name: "Formal Shirt", category: "Apparel", brand: "Raymond", qty: 2, unitPrice: 1500 },
    { id: "2", sku: "SHIRT-02", name: "Casual Shirt", category: "Apparel", brand: "Peter England", qty: 1, unitPrice: 1000 },
    { id: "3", sku: "JEANS-01", name: "Denim Jeans", category: "Apparel", brand: "Levi's", qty: 1, unitPrice: 2500 }
  ];

  describe("1. 1-Click Popular Retail Recipes", () => {
    it("should provide well-formed retail recipes including Reliance Trade Concession", () => {
      const recipes = SmritiSalesPromotionService.getRecipes();
      expect(recipes.length).toBeGreaterThanOrEqual(9);

      const ids = recipes.map(r => r.id);
      expect(ids).toContain("recipe-bogo");
      expect(ids).toContain("recipe-flat-pct");
      expect(ids).toContain("recipe-flat-inr");
      expect(ids).toContain("recipe-combo-fixed");
      expect(ids).toContain("recipe-spend-save");
      expect(ids).toContain("recipe-happy-hours");
      expect(ids).toContain("recipe-clearance");
      expect(ids).toContain("recipe-vip");
      expect(ids).toContain("recipe-reliance-trade");

      // Verify every recipe has defaultScheme and madLibsTemplate
      recipes.forEach(r => {
        expect(r.name).toBeTruthy();
        expect(r.defaultScheme.code).toBeTruthy();
        expect(r.madLibsTemplate).toBeTruthy();
      });
    });
  });

  describe("2. Natural Language Rule Formatter ('Mad-Libs' Generator)", () => {
    it("should format BOGO rule in human-readable plain English", () => {
      const promo: Partial<SmritiDefinedSalesPromotion> = {
        category: "ITEM_OFFER_B2G1",
        buyQty: 2,
        freeQty: 1,
        appliedOn: "LOWEST_PRICE",
        applicableCategories: ["Apparel"],
        applicableCustomerGroups: ["ALL"]
      };
      const sentence = SmritiSalesPromotionService.formatPromotionAsSentence(promo);
      expect(sentence).toContain("for all customers");
      expect(sentence).toContain("buying 2 of Apparel gives 1 FREE on the cheapest piece");
    });

    it("should format Happy Hours and Day Gated promotions accurately", () => {
      const promo: Partial<SmritiDefinedSalesPromotion> = {
        category: "ITEM_DISCOUNT_PERCENT",
        discountValue: 20,
        isHappyHours: true,
        happyHoursStart: "14:00",
        happyHoursEnd: "17:00",
        daysOfWeek: ["MON", "TUE", "WED"],
        applicableCategories: ["Footwear"],
        applicableCustomerGroups: ["VIP"]
      };
      const sentence = SmritiSalesPromotionService.formatPromotionAsSentence(promo);
      expect(sentence).toContain("During Happy Hours (14:00 - 17:00)");
      expect(sentence).toContain("on MON, TUE, WED");
      expect(sentence).toContain("for VIP customers");
      expect(sentence).toContain("gives 20% OFF on Footwear");
    });

    it("should format Bill-Level Spend Threshold rules", () => {
      const promo: Partial<SmritiDefinedSalesPromotion> = {
        level: "BILL_LEVEL",
        category: "BILL_DISCOUNT_FLAT",
        discountValue: 500,
        minBillValue: 3000,
        maxDiscount: 500
      };
      const sentence = SmritiSalesPromotionService.formatPromotionAsSentence(promo);
      expect(sentence).toContain("gives flat ₹500 OFF on bills of ₹3,000 or more");
      expect(sentence).toContain("(max discount capped at ₹500)");
    });
  });

  describe("3. Live Cart Sandbox Simulator", () => {
    it("should accurately calculate B2G1 with lowest priced item free", () => {
      const bogoPromo: SmritiDefinedSalesPromotion = {
        id: "test-bogo",
        code: "B2G1",
        name: "Buy 2 Get 1 Free",
        description: "B2G1 on Apparel",
        level: "ITEM_LEVEL",
        category: "ITEM_OFFER_B2G1",
        priority: 1,
        discountValue: 100,
        buyQty: 2,
        freeQty: 1,
        minQty: 3,
        appliedOn: "LOWEST_PRICE",
        applicableCategories: ["Apparel"],
        applicableCustomerGroups: ["ALL"],
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        isActive: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      };

      // Cart has 4 apparel units: 2x 1500, 1x 1000, 1x 2500. Total Qty = 4.
      // One bundle of 3 qualifies (buy 2 + get 1 free).
      // Cheapest item is SHIRT-02 at ₹1,000.
      const res = SmritiSalesPromotionService.simulateCart(sampleCart, bogoPromo);
      expect(res.isEligible).toBe(true);
      expect(res.discountTotal).toBe(1000);
      expect(res.originalTotal).toBe(1500 * 2 + 1000 + 2500); // 6500
      expect(res.finalTotal).toBe(5500);

      // Verify SHIRT-02 was marked free
      const freeLine = res.lines.find(l => l.sku === "SHIRT-02");
      expect(freeLine?.isFreeItem).toBe(true);
      expect(freeLine?.discountAmount).toBe(1000);
      expect(freeLine?.finalLineTotal).toBe(0);
    });

    it("should accurately calculate B2G1 with highest priced item free when configured", () => {
      const bogoHighPromo: SmritiDefinedSalesPromotion = {
        id: "test-bogo-high",
        code: "B2G1_HIGH",
        name: "Buy 2 Get 1 Free (Highest)",
        description: "B2G1 on Apparel highest item",
        level: "ITEM_LEVEL",
        category: "ITEM_OFFER_B2G1",
        priority: 1,
        discountValue: 100,
        buyQty: 2,
        freeQty: 1,
        minQty: 3,
        appliedOn: "HIGHEST_PRICE",
        applicableCategories: ["Apparel"],
        applicableCustomerGroups: ["ALL"],
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        isActive: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      };

      // Highest price unit in bundle of 3 is 2500 (JEANS-01)
      const res = SmritiSalesPromotionService.simulateCart(sampleCart, bogoHighPromo);
      expect(res.isEligible).toBe(true);
      expect(res.discountTotal).toBe(2500);
      expect(res.finalTotal).toBe(4000);

      const freeLine = res.lines.find(l => l.sku === "JEANS-01");
      expect(freeLine?.isFreeItem).toBe(true);
      expect(freeLine?.discountAmount).toBe(2500);
      expect(freeLine?.finalLineTotal).toBe(0);
    });

    it("should accurately prorate Bill-Level discount across all lines", () => {
      const billPromo: SmritiDefinedSalesPromotion = {
        id: "test-bill-slab",
        code: "FEST500",
        name: "Flat ₹500 Off",
        description: "Spend ₹3,000 get ₹500 off",
        level: "BILL_LEVEL",
        category: "BILL_DISCOUNT_FLAT",
        priority: 1,
        discountValue: 500,
        minBillValue: 3000,
        applicableCustomerGroups: ["ALL"],
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        isActive: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      };

      // Gross total = 6500 >= 3000, so eligible
      const res = SmritiSalesPromotionService.simulateCart(sampleCart, billPromo);
      expect(res.isEligible).toBe(true);
      expect(res.discountTotal).toBe(500);
      expect(res.finalTotal).toBe(6000);

      // Sum of line discounts must equal exactly 500 (with rounding)
      const sumLineDiscounts = res.lines.reduce((acc, l) => acc + l.discountAmount, 0);
      expect(Math.round(sumLineDiscounts)).toBe(500);
    });

    it("should reject bill-level promotion if cart is below threshold", () => {
      const billPromoHigh: SmritiDefinedSalesPromotion = {
        id: "test-bill-high",
        code: "SPEND10K",
        name: "Spend 10k get 1k",
        description: "Requires 10k",
        level: "BILL_LEVEL",
        category: "BILL_DISCOUNT_FLAT",
        priority: 1,
        discountValue: 1000,
        minBillValue: 10000,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        isActive: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      };

      // Cart total = 6500 < 10000
      const res = SmritiSalesPromotionService.simulateCart(sampleCart, billPromoHigh);
      expect(res.isEligible).toBe(false);
      expect(res.discountTotal).toBe(0);
      expect(res.reason).toContain("Minimum cart value");
    });

    it("should reject promotion if outside Happy Hours time window", () => {
      const happyHourPromo: SmritiDefinedSalesPromotion = {
        id: "test-hh",
        code: "HH15",
        name: "Afternoon Happy Hours",
        description: "14:00 to 17:00",
        level: "ITEM_LEVEL",
        category: "ITEM_DISCOUNT_PERCENT",
        priority: 1,
        discountValue: 15,
        isHappyHours: true,
        happyHoursStart: "14:00",
        happyHoursEnd: "17:00",
        applicableCategories: ["Apparel"],
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        isActive: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      };

      // Test at 11:00 (outside window)
      const resOutside = SmritiSalesPromotionService.simulateCart(sampleCart, happyHourPromo, {
        simulatedTime: "11:00"
      });
      expect(resOutside.isEligible).toBe(false);
      expect(resOutside.reason).toContain("Happy hours active only between");

      // Test at 15:30 (inside window)
      const resInside = SmritiSalesPromotionService.simulateCart(sampleCart, happyHourPromo, {
        simulatedTime: "15:30"
      });
      expect(resInside.isEligible).toBe(true);
      expect(resInside.discountTotal).toBeGreaterThan(0);
    });

    it("should enforce customer group whitelist restrictions", () => {
      const vipPromo: SmritiDefinedSalesPromotion = {
        id: "test-vip",
        code: "VIP10",
        name: "VIP Club 10%",
        description: "Only VIPs",
        level: "BILL_LEVEL",
        category: "BILL_DISCOUNT_PERCENT",
        priority: 1,
        discountValue: 10,
        applicableCustomerGroups: ["VIP", "CORPORATE"],
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        isActive: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01"
      };

      // Standard walk-in customer
      const resStandard = SmritiSalesPromotionService.simulateCart(sampleCart, vipPromo, {
        customerGroup: "ALL"
      });
      expect(resStandard.isEligible).toBe(false);
      expect(resStandard.reason).toContain("Restricted to VIP, CORPORATE customers");

      // VIP customer
      const resVip = SmritiSalesPromotionService.simulateCart(sampleCart, vipPromo, {
        customerGroup: "VIP"
      });
      expect(resVip.isEligible).toBe(true);
      expect(resVip.discountTotal).toBe(650); // 10% of 6500
    });

    it("should accurately calculate Reliance Retail Store 43.76% discount on MRP", () => {
      const reliancePromo = SmritiSalesPromotionService.getAllDefinedPromotions().find(
        p => p.code === "REL_RET_4376"
      )!;

      expect(reliancePromo).toBeDefined();
      expect(reliancePromo.discountValue).toBe(43.76);
      expect(reliancePromo.level).toBe("ITEM_LEVEL");
      expect(reliancePromo.category).toBe("ITEM_DISCOUNT_PERCENT");

      // Test with a mock cart of 1 item with MRP 1000
      const testCart: SimulatedCartLine[] = [
        { id: "rel-1", sku: "SHIRT-REL-01", name: "Formal Cotton Shirt", category: "Apparel", brand: "Raymond", qty: 2, unitPrice: 1000 }
      ];

      // Total MRP = 2 * 1000 = 2000
      // 43.76% of 2000 = 875.20
      const res = SmritiSalesPromotionService.simulateCart(testCart, reliancePromo, {
        customerGroup: "RELIANCE_RETAIL"
      });

      expect(res.isEligible).toBe(true);
      expect(res.originalTotal).toBe(2000);
      expect(res.discountTotal).toBeCloseTo(875.20, 2);
      expect(res.finalTotal).toBeCloseTo(1124.80, 2);

      const line = res.lines[0];
      expect(line.discountAmount).toBeCloseTo(875.20, 2);
      expect(line.finalLineTotal).toBeCloseTo(1124.80, 2);
      expect(line.appliedRule).toContain("Reliance Retail Store 43.76% on MRP");
    });
  });
});

