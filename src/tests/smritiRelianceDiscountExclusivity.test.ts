/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-17
 * Modified     : 2026-09-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Reliance Retail Ltd. 43.76% Discount Exclusivity & Promotion Suppression
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SmritiSalesPromotionService } from "../services/smritiSalesPromotionService";

describe("Reliance Retail Ltd. 43.76% Contractual Markdown & Promotion Exclusivity", () => {
  beforeEach(() => {
    SmritiSalesPromotionService.resetToDefaults();
  });

  it("1. Accurate Customer Recognition: Identifies Reliance Retail by name, code, or group", () => {
    expect(SmritiSalesPromotionService.isRelianceCustomer({ name: "Reliance Retail Ltd." })).toBe(true);
    expect(SmritiSalesPromotionService.isRelianceCustomer({ name: "Reliance Retail Limited" })).toBe(true);
    expect(SmritiSalesPromotionService.isRelianceCustomer({ code: "CUST-RIL-1888" })).toBe(true);
    expect(SmritiSalesPromotionService.isRelianceCustomer({ code: "CUST-001" })).toBe(true);
    expect(SmritiSalesPromotionService.isRelianceCustomer({ customerGroup: "RELIANCE" })).toBe(true);
    expect(SmritiSalesPromotionService.isRelianceCustomer({ customerGroup: "CG-LargeRetail" })).toBe(true);
    expect(SmritiSalesPromotionService.isRelianceCustomer({ name: "John Doe", code: "CUST-999", customerGroup: "REGULAR" })).toBe(false);
  });

  it("2. Dynamic Assignment: ensureReliance4376Promotion guarantees REL_RET_4376 exists and is active", () => {
    const promo = SmritiSalesPromotionService.ensureReliance4376Promotion();
    expect(promo.code).toBe("REL_RET_4376");
    expect(promo.discountValue).toBe(43.76);
    expect(promo.isActive).toBe(true);
    expect(promo.applicableCustomerGroups).toContain("RELIANCE");
    expect(promo.applicableCustomerGroups).toContain("CG-LargeRetail");
  });

  it("3. Promotion Exclusivity: Skips all general retail discounts (ILD 10%, etc.) and applies exact 43.76% for Reliance Retail", () => {
    // Standard retail customer gets standard promotional discount (20% End of Season Sale) on Apparel
    const standardRes = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "APP-001",
      category: "Apparel",
      rate: 1000,
      qty: 1,
      customerName: "Walk-in Customer",
      customerGroup: "ALL"
    });
    expect(standardRes.applied).toBe(true);
    expect(standardRes.discountPct).toBe(20);
    expect(standardRes.promoCode).toBe("EOSS20");

    // Reliance Retail Ltd. gets 43.76% REL_RET_4376 and ILD 10% is skipped
    const relianceRes = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: "APP-001",
      category: "Apparel",
      rate: 1000,
      qty: 1,
      customerName: "Reliance Retail Ltd.",
      customerCode: "CUST-RIL-1888",
      customerGroup: "cg-default"
    });
    expect(relianceRes.applied).toBe(true);
    expect(relianceRes.discountPct).toBe(43.76);
    expect(relianceRes.promoCode).toBe("REL_RET_4376");
    expect(relianceRes.discountAmt).toBe(437.60);
    expect(relianceRes.reason).toContain("Reliance Retail trade concession");
  });

  it("4. Bill-Level Promotion Suppression: Skips all bill discounts for Reliance Retail Ltd.", () => {
    // Normal high-value cart qualifies for bill promotions
    const normalBillRes = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal: 5000,
      customerName: "General VIP",
      customerGroup: "ALL"
    });
    // Reliance Retail customer has bill promotions suppressed
    const relianceBillRes = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal: 5000,
      customerName: "Reliance Retail Ltd.",
      customerCode: "CUST-001",
      customerGroup: "CG-LargeRetail"
    });
    expect(relianceBillRes.applied).toBe(false);
    expect(relianceBillRes.promoCode).toBe("NONE");
    expect(relianceBillRes.reason).toContain("Reliance Retail Ltd.");
  });
});
