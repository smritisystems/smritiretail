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
 * * Version    : 6.28.0
 * * Created    : 2026-09-16
 * * Modified   : 2026-09-16
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 *
 * SMRITI POS Item-Level Sales Promotion Auto-Select Test Suite
 *
 * Verifies:
 *   1. Direct Item Scan & Resolution (Auto-populates best promotional scheme)
 *   2. Customer Group Contract Auto-Inheritance (Reliance Retail 43.76% MRP markdown)
 *   3. Highest Discount Wins Arbitration (Category 10% vs Brand 20% vs Contract 43.76%)
 *   4. Volume & B2G1 Incremental Scan Progression (Dynamic re-evaluation on duplicate scan)
 *   5. Schedule & Happy Hours Window Restrictions
 *   6. Flat Discount Percentage & Amount Computation
 *   7. Bill-Level Slab Threshold Qualification (Activates only when subtotal >= minBillValue)
 *   8. Bill-Level Ceiling Cap Enforcement (maxDiscount ceiling bounds discount amount)
 *   9. Customer Group Contract Inheritance for Bill-Level Promos (VIP / Institutional)
 *   10. Highest Discount Wins Arbitration across competing Bill-Level Schemes
 */

vi.mock("../lib/apiFetchV1", () => ({
  apiFetchV1: vi.fn()
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SmritiSalesPromotionService,
  SmritiDefinedSalesPromotion,
  DEFAULT_DEFINED_SALES_PROMOTIONS
} from "../services/smritiSalesPromotionService";

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, val: string) => { mockStorage[key] = String(val); }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((idx: number) => Object.keys(mockStorage)[idx] || null)
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true
});

describe("SMRITI POS Item-Level Sales Promotion Auto-Select", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    SmritiSalesPromotionService.resetToDefaults();
  });

  it("1. Resolves default item-level discount on single product scan", () => {
    const res = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "8887462974824",
      barcode: "8887462974824",
      category: "Apparel",
      brand: "SMRITI",
      rate: 999.00,
      qty: 1
    });

    expect(res.promo).not.toBeNull();
    expect(res.discountPct).toBeGreaterThan(0);
    expect(res.discountAmt).toBeCloseTo((999 * res.discountPct) / 100, 2);
    expect(res.promoCode).toBeDefined();
    expect(res.appliedOnQty).toBe(1);
  });

  it("2. Commercial Customer Group Auto-Inheritance: Reliance Retail contract auto-applies 43.76%", () => {
    // Add Reliance institutional scheme
    SmritiSalesPromotionService.savePromotion({
      id: "promo-reliance-4376",
      code: "REL_RET_4376",
      name: "Reliance Retail Institutional Contract 43.76%",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_PERCENT",
      discountValue: 43.76,
      priority: 10,
      isActive: true,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      description: "Reliance contractual wholesale price markdown of 43.76% on MRP",
      rules: [
        {
          id: "rule-rel-1",
          ruleType: "CUSTOMER_GROUP",
          targetValue: "RELIANCE",
          discountType: "PERCENT",
          discountValue: 43.76
        }
      ]
    });

    const res = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "SKU-DENIM-01",
      barcode: "8901234567890",
      rate: 1999.00,
      qty: 1,
      customerGroup: "RELIANCE_RETAIL"
    });

    expect(res.promo).not.toBeNull();
    expect(res.promoCode).toBe("REL_RET_4376");
    expect(res.discountPct).toBe(43.76);
    expect(res.discountAmt).toBeCloseTo((1999 * 43.76) / 100, 2);
  });

  it("3. Highest Discount Wins: Arbitrates between multiple competing schemes to give maximum customer savings", () => {
    // Scheme A: 10% on Category Apparel
    SmritiSalesPromotionService.savePromotion({
      id: "promo-apparel-10",
      code: "CAT_APP_10",
      name: "Apparel 10% Off",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_PERCENT",
      discountValue: 10,
      priority: 1,
      isActive: true,
      rules: [
        {
          id: "r-cat-1",
          ruleType: "CATEGORY",
          targetValue: "Apparel",
          discountType: "PERCENT",
          discountValue: 10
        }
      ]
    });

    // Scheme B: 25% on Brand SMRITI Premium
    SmritiSalesPromotionService.savePromotion({
      id: "promo-brand-25",
      code: "BRD_SMR_25",
      name: "SMRITI Brand 25% Off",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_PERCENT",
      discountValue: 25,
      priority: 2,
      isActive: true,
      rules: [
        {
          id: "r-brd-1",
          ruleType: "BRAND",
          targetValue: "SMRITI",
          discountType: "PERCENT",
          discountValue: 25
        }
      ]
    });

    // When an item matches both Category and Brand, 25% > 10% -> Scheme B wins
    const res = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "SKU-TOP-001",
      category: "Apparel",
      brand: "SMRITI",
      rate: 1000.00,
      qty: 1
    });

    expect(res.promoCode).toBe("BRD_SMR_25");
    expect(res.discountPct).toBe(25);
    expect(res.discountAmt).toBe(250.00);
  });

  it("4. Incremental Duplicate Scan: B2G1 dynamically unlocks on the 3rd scanned unit", () => {
    // Ensure B2G1 promo exists with minQty = 3
    SmritiSalesPromotionService.savePromotion({
      id: "promo-b2g1-apparel",
      code: "B2G1",
      name: "Buy 2 Get 1 Free",
      level: "ITEM_LEVEL",
      category: "ITEM_OFFER_B2G1",
      discountValue: 100,
      priority: 5,
      isActive: true,
      rules: [
        {
          id: "rule-b2g1",
          ruleType: "MIN_QTY",
          minQuantity: 3,
          discountType: "B2G1",
          discountValue: 100
        }
      ]
    });

    // Scan 1: Qty 1 -> Does not qualify for B2G1
    const scan1 = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "SKU-SHIRT-01",
      category: "Apparel",
      rate: 900.00,
      qty: 1
    });
    expect(scan1.promoCode).not.toBe("B2G1");

    // Scan 2: Qty 2 -> Does not qualify for B2G1
    const scan2 = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "SKU-SHIRT-01",
      category: "Apparel",
      rate: 900.00,
      qty: 2
    });
    expect(scan2.promoCode).not.toBe("B2G1");

    // Scan 3: Qty 3 -> Qualifies for B2G1! 1 unit free out of 3 = 900 discount (33.33% line discount)
    const scan3 = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "SKU-SHIRT-01",
      category: "Apparel",
      rate: 900.00,
      qty: 3
    });
    expect(scan3.promoCode).toBe("B2G1");
    expect(scan3.discountAmt).toBe(900.00);
    expect(scan3.discountPct).toBeCloseTo(33.33, 1);
  });

  it("5. Happy Hours Time Restrictions: Promo applies strictly within the scheduled time window", () => {
    SmritiSalesPromotionService.savePromotion({
      id: "promo-happy-hour",
      code: "HAPPY14TO16",
      name: "Afternoon Happy Hours 15% Off",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_PERCENT",
      discountValue: 15,
      priority: 8,
      isActive: true,
      timeFrom: "14:00",
      timeTo: "16:00",
      rules: [
        {
          id: "r-hh",
          ruleType: "CATEGORY",
          targetValue: "Beverages",
          discountType: "PERCENT",
          discountValue: 15
        }
      ]
    });

    // At 15:00 (inside window) -> Scheme triggers
    const insideTime = new Date("2026-09-16T15:00:00");
    const resInside = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "SKU-COFFEE-01",
      category: "Beverages",
      rate: 200.00,
      qty: 1,
      evalDate: insideTime
    });
    expect(resInside.promoCode).toBe("HAPPY14TO16");
    expect(resInside.discountPct).toBe(15);

    // At 18:00 (outside window) -> Scheme does not trigger
    const outsideTime = new Date("2026-09-16T18:00:00");
    const resOutside = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "SKU-COFFEE-01",
      category: "Beverages",
      rate: 200.00,
      qty: 1,
      evalDate: outsideTime
    });
    expect(resOutside.promoCode).not.toBe("HAPPY14TO16");
  });

  it("6. Flat Discount Computation: Flat ₹150 markdown computes exact percentage against unit price", () => {
    SmritiSalesPromotionService.savePromotion({
      id: "promo-flat-150",
      code: "FLAT150",
      name: "Flat ₹150 Off Shoes",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_FLAT",
      discountValue: 150,
      priority: 9,
      isActive: true,
      rules: [
        {
          id: "r-flat-shoes",
          ruleType: "CATEGORY",
          targetValue: "Footwear",
          discountType: "FLAT",
          discountValue: 150
        }
      ]
    });

    const res = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "SKU-SNEAKER-01",
      category: "Footwear",
      rate: 1500.00,
      qty: 2
    });

    expect(res.promoCode).toBe("FLAT150");
    // Flat ₹150 per piece on 2 pieces = ₹300 total discount
    expect(res.discountAmt).toBe(300.00);
    // 300 / 3000 = 10% effective discount
    expect(res.discountPct).toBe(10.00);
  });

  it("7. Bill-Level Slab Threshold: Activates scheme only when cart subtotal meets minBillValue", () => {
    // FEST500: Flat ₹500 off on bills >= ₹3,000
    SmritiSalesPromotionService.savePromotion({
      id: "promo-bill-fest500",
      code: "FEST500",
      name: "Festival ₹500 Off",
      level: "BILL_LEVEL",
      category: "BILL_DISCOUNT_FLAT",
      discountValue: 500,
      minBillValue: 3000,
      priority: 5,
      isActive: true,
      rules: []
    });

    // Subtotal ₹2,500 (< ₹3,000) -> Does not qualify
    const resUnder = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal: 2500,
      itemsCount: 3
    });
    expect(resUnder.applied).toBe(false);
    expect(resUnder.promoCode).toBe("NONE");
    expect(resUnder.discountAmt).toBe(0);

    // Subtotal ₹3,200 (>= ₹3,000) -> Qualifies and auto-applies ₹500
    const resOver = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal: 3200,
      itemsCount: 4
    });
    expect(resOver.applied).toBe(true);
    expect(resOver.promoCode).toBe("FEST500");
    expect(resOver.discountAmt).toBe(500);
    expect(resOver.discountPct).toBe(15.63);
  });

  it("8. Bill-Level Ceiling Cap: maxDiscount ceiling strictly caps percentage discounts", () => {
    // MEGA20: 20% off on bills >= ₹2,000 with maxDiscount capped at ₹400
    SmritiSalesPromotionService.savePromotion({
      id: "promo-bill-mega20",
      code: "MEGA20",
      name: "Mega Savings 20% Capped",
      level: "BILL_LEVEL",
      category: "BILL_DISCOUNT_PERCENT",
      discountValue: 20,
      minBillValue: 2000,
      maxDiscount: 400,
      priority: 4,
      isActive: true,
      rules: []
    });

    // Subtotal ₹2,500 (< ₹3,000 so FEST500 is inactive; >= ₹2,000 so MEGA20 qualifies)
    // 20% of ₹2,500 = ₹500, but capped at ₹400
    const res = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal: 2500,
      itemsCount: 3
    });

    expect(res.applied).toBe(true);
    expect(res.promoCode).toBe("MEGA20");
    expect(res.discountAmt).toBe(400); // Strictly capped
    expect(res.discountPct).toBe(16.00); // 400 / 2500 * 100 = 16%
  });

  it("9. Customer Group Contract Inheritance for Bill-Level Promos: VIP customers auto-qualify", () => {
    // VIP_PRIVILEGE: 10% off for VIP customer group
    SmritiSalesPromotionService.savePromotion({
      id: "promo-bill-vip",
      code: "VIP10",
      name: "VIP Exclusive 10% Bill Discount",
      level: "BILL_LEVEL",
      category: "BILL_DISCOUNT_PERCENT",
      discountValue: 10,
      minBillValue: 1000,
      priority: 2,
      isActive: true,
      applicableCustomerGroups: ["VIP"],
      rules: [
        {
          id: "r-vip-group",
          ruleType: "CUSTOMER_GROUP",
          targetValue: "VIP",
          discountType: "PERCENT",
          discountValue: 10
        }
      ]
    });

    // Regular customer -> Ineligible
    const resReg = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal: 2000,
      customerGroup: "RETAIL"
    });
    expect(resReg.promoCode).not.toBe("VIP10");

    // VIP customer -> Eligible & receives 10% off (₹200 on ₹2,000)
    const resVip = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal: 2000,
      customerGroup: "VIP"
    });
    expect(resVip.applied).toBe(true);
    expect(resVip.promoCode).toBe("VIP10");
    expect(resVip.discountAmt).toBe(200);
    expect(resVip.discountPct).toBe(10);
  });

  it("10. Highest Discount Wins Arbitration across competing Bill-Level Schemes", () => {
    // Scheme A: Flat ₹700 off on bills >= ₹3,000 (Priority 5)
    SmritiSalesPromotionService.savePromotion({
      id: "promo-bill-flat700",
      code: "FLAT700_BILL",
      name: "Flat ₹700 Off",
      level: "BILL_LEVEL",
      category: "BILL_DISCOUNT_FLAT",
      discountValue: 700,
      minBillValue: 3000,
      priority: 5,
      isActive: true,
      rules: []
    });

    // Scheme B: 20% off on bills >= ₹3,000 with maxDiscount ₹900 (Priority 6)
    SmritiSalesPromotionService.savePromotion({
      id: "promo-bill-pct20",
      code: "PCT20_BILL",
      name: "20% Off Bill",
      level: "BILL_LEVEL",
      category: "BILL_DISCOUNT_PERCENT",
      discountValue: 20,
      minBillValue: 3000,
      maxDiscount: 900,
      priority: 6,
      isActive: true,
      rules: []
    });

    // On ₹4,000 cart:
    // FEST500 gives: ₹500
    // Scheme A gives: ₹700
    // Scheme B gives: 20% of 4000 = ₹800 (<= 900)
    // 800 > 700 > 500 -> Scheme B wins despite lower priority number!
    const res4000 = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal: 4000
    });
    expect(res4000.applied).toBe(true);
    expect(res4000.promoCode).toBe("PCT20_BILL");
    expect(res4000.discountAmt).toBe(800);

    // On ₹3,200 cart:
    // FEST500 gives: ₹500
    // Scheme A gives: ₹700
    // Scheme B gives: 20% of 3200 = ₹640
    // 700 > 640 > 500 -> Scheme A wins!
    const res3200 = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal: 3200
    });
    expect(res3200.applied).toBe(true);
    expect(res3200.promoCode).toBe("FLAT700_BILL");
    expect(res3200.discountAmt).toBe(700);
  });
});
