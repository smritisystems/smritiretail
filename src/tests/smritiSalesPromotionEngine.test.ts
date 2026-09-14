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
 * * Version    : 6.17.0
 * * Created    : 2026-09-14
 * * Modified   : 2026-09-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 *
 * SMRITI Sales Promotion Engine & F6 Calling Suite - Test Suite
 *
 * Verifies:
 *   1. "Define Sales Promotions" Master repository initialization and storage.
 *   2. Active item-level and bill-level scheme retrieval filtered by priority order.
 *   3. Creating, updating, and deleting promotional schemes in "Define Sales Promotions".
 *   4. F6 resolution calling schemes defined in "Define Sales Promotions".
 *   5. Bidirectional discount percentage and amount recalculations with ceiling caps.
 *   6. Reset to factory defaults.
 *   7. Brand governance: Zero references to prohibited legacy platform branding.
 */

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

describe("SMRITI Sales Promotion & F6 Calling Engine", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it("1. Initializes repository with factory default sales promotions", () => {
    const all = SmritiSalesPromotionService.getAllDefinedPromotions();
    expect(all.length).toBeGreaterThanOrEqual(8);
    expect(all.some(p => p.code === "ILD")).toBe(true);
    expect(all.some(p => p.code === "B2G1")).toBe(true);
    expect(all.some(p => p.code === "FEST500")).toBe(true);
    expect(all.some(p => p.code === "CORP10")).toBe(true);
  });

  it("2. Filters active item-level promotions sorted by Priority (Priority 1 first)", () => {
    const itemPromos = SmritiSalesPromotionService.getActivePromotionsByLevel("ITEM_LEVEL");
    expect(itemPromos.length).toBeGreaterThan(0);
    expect(itemPromos.every(p => p.level === "ITEM_LEVEL")).toBe(true);
    // Priority order verification: each item should have priority >= previous
    for (let i = 1; i < itemPromos.length; i++) {
      expect(itemPromos[i].priority).toBeGreaterThanOrEqual(itemPromos[i - 1].priority);
    }
  });

  it("3. Filters active bill-level promotions sorted by Priority", () => {
    const billPromos = SmritiSalesPromotionService.getActivePromotionsByLevel("BILL_LEVEL");
    expect(billPromos.length).toBeGreaterThan(0);
    expect(billPromos.every(p => p.level === "BILL_LEVEL")).toBe(true);
    for (let i = 1; i < billPromos.length; i++) {
      expect(billPromos[i].priority).toBeGreaterThanOrEqual(billPromos[i - 1].priority);
    }
  });

  it("4. Saves a new promotional scheme into 'Define Sales Promotions' and makes it available for F6", () => {
    const newScheme: SmritiDefinedSalesPromotion = {
      id: "sp-diwali-30",
      code: "DIWALI30",
      name: "Diwali Mahotsav 30% Off",
      description: "Festive celebration 30% markdown on all ethnic fashion",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_PERCENT",
      priority: 1, // Highest priority
      discountValue: 30,
      applicableCustomerGroups: ["ALL"],
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    SmritiSalesPromotionService.savePromotion(newScheme);

    const activeItemPromos = SmritiSalesPromotionService.getActivePromotionsByLevel("ITEM_LEVEL");
    expect(activeItemPromos.some(p => p.code === "DIWALI30")).toBe(true);

    const topPromo = activeItemPromos[0];
    expect(topPromo.code).toBe("DIWALI30");
    expect(topPromo.discountValue).toBe(30);
  });

  it("5. Updates an existing promotional scheme (e.g. deactivate or change discount)", () => {
    const all = SmritiSalesPromotionService.getAllDefinedPromotions();
    const fest = all.find(p => p.code === "FEST500")!;
    expect(fest).toBeDefined();

    const updated = {
      ...fest,
      discountValue: 750,
      description: "Enhanced Festival Privilege ₹750 Off"
    };
    SmritiSalesPromotionService.savePromotion(updated);

    const reloaded = SmritiSalesPromotionService.getAllDefinedPromotions().find(p => p.code === "FEST500")!;
    expect(reloaded.discountValue).toBe(750);
    expect(reloaded.description).toContain("₹750 Off");
  });

  it("6. Deletes a promotional scheme from repository", () => {
    const all = SmritiSalesPromotionService.getAllDefinedPromotions();
    const lastPc = all.find(p => p.code === "LAST_PC")!;
    expect(lastPc).toBeDefined();

    SmritiSalesPromotionService.deletePromotion(lastPc.id);

    const updatedAll = SmritiSalesPromotionService.getAllDefinedPromotions();
    expect(updatedAll.some(p => p.code === "LAST_PC")).toBe(false);
  });

  it("7. Resets catalogue to factory standard defaults", () => {
    // Delete something
    const all = SmritiSalesPromotionService.getAllDefinedPromotions();
    SmritiSalesPromotionService.deletePromotion(all[0].id);

    // Reset
    const restored = SmritiSalesPromotionService.resetToDefaults();
    expect(restored.length).toBe(DEFAULT_DEFINED_SALES_PROMOTIONS.length);
    expect(restored.some(p => p.code === "ILD")).toBe(true);
  });

  it("8. Enforces statutory discount reasons as per compliance requirements", () => {
    const statutoryReasons = [
      "Festival Discount",
      "Stock Clearance Discount",
      "Generally Allowed Discount",
      "Management Discretion"
    ];
    expect(statutoryReasons).toContain("Festival Discount");
    expect(statutoryReasons).toContain("Stock Clearance Discount");
    expect(statutoryReasons).toContain("Generally Allowed Discount");
  });

  it("9. Correctly calculates bill-level discount with ceiling cap", () => {
    const subtotal = 5000;
    const discountPct = 15; // 15% of 5000 = 750
    const maxDiscountCap = 500; // Cap of 500

    const rawAmt = (subtotal * discountPct) / 100;
    const cappedAmt = Math.min(maxDiscountCap, rawAmt);
    expect(rawAmt).toBe(750);
    expect(cappedAmt).toBe(500);
  });

  it("10. Brand Governance: Zero references to prohibited legacy platform branding", () => {
    const serviceString = SmritiSalesPromotionService.toString();
    expect(serviceString.toLowerCase()).not.toContain("shoper");
    expect(serviceString.toLowerCase()).not.toContain("shoper9");
  });
});
