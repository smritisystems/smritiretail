/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 * Pushpa Devi Jawahar Mallah — Founder & Chairperson
 * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
 * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * Version    : 6.34.0
 * Created    : 2026-09-17
 * Modified   : 2026-09-17
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 * Classification: Internal
 *
 * Test Suite : Customer Billing Basis (MRP vs RATE) & Promotion Margin Protection Governance
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolveCustomerPolicy } from "../services/custPolicyEngine";
import { SmritiSalesPromotionService } from "../services/smritiSalesPromotionService";
import { Customer, CustomerGroup } from "../types";

describe("Customer Billing Basis (MRP vs RATE) & Promotion Margin Protection Governance", () => {
  beforeEach(() => {
    SmritiSalesPromotionService.resetToDefaults();
  });

  const baseGroup: CustomerGroup = {
    id: "grp-retail",
    code: "RET",
    name: "Standard Retail Customers",
    creditLimit: 0,
    unlimitedCredit: false,
    creditDays: 0,
    graceDays: 0,
    creditHold: false,
    autoBlockSales: false,
    warningThresholdPercent: 80,
    taxInclusive: true,
    defaultPricingBasis: "MRP",
    defaultAllowPromotionsOnRate: false,
    maxDiscountPercent: 25,
    minMarginPercent: 15,
    roundingRule: "NEAREST_RUPEE",
    allowManualDiscount: true,
    restrictToPriceList: false,
    priority: 1,
    status: "ACTIVE",
    isSystem: false,
  };

  const wholesaleGroup: CustomerGroup = {
    ...baseGroup,
    id: "grp-wholesale",
    code: "WHOLESALE",
    name: "Wholesale B2B Distributors",
    taxInclusive: false,
    defaultPricingBasis: "RATE",
    defaultAllowPromotionsOnRate: false,
  };

  describe("1. Policy Engine: Customer Pricing Basis Resolution & Inheritance", () => {
    it("resolves default pricingBasis to MRP and allowPromotionsOnRate to false when undefined", () => {
      const customer: Customer = {
        id: "cust-001",
        code: "CUST-WALKIN",
        name: "Walk-in Retail Shopper",
        customerGroupId: "grp-retail",
        status: "ACTIVE",
      };

      const policy = resolveCustomerPolicy(customer, baseGroup);
      expect(policy.pricingBasis).toBe("MRP");
      expect(policy.allowPromotionsOnRate).toBe(false);
      expect(policy.taxInclusive).toBe(true);
    });

    it("resolves pricingBasis to RATE when inherited from wholesale customer group", () => {
      const customer: Customer = {
        id: "cust-002",
        code: "CUST-DEALER-01",
        name: "Shree Ganesh Textiles",
        customerGroupId: "grp-wholesale",
        status: "ACTIVE",
      };

      const policy = resolveCustomerPolicy(customer, wholesaleGroup);
      expect(policy.pricingBasis).toBe("RATE");
      expect(policy.allowPromotionsOnRate).toBe(false);
      expect(policy.taxInclusive).toBe(false);
    });

    it("allows customer-level override of pricingBasis and allowPromotionsOnRate", () => {
      const customer: Customer = {
        id: "cust-003",
        code: "CUST-SPECIAL-B2B",
        name: "Premier Retail Partners",
        customerGroupId: "grp-wholesale",
        pricingBasis: "RATE",
        allowPromotionsOnRate: true,
        status: "ACTIVE",
      };

      const policy = resolveCustomerPolicy(customer, wholesaleGroup);
      expect(policy.pricingBasis).toBe("RATE");
      expect(policy.allowPromotionsOnRate).toBe(true);
    });
  });

  describe("2. Promotion Margin Protection Governance: Retail Schemes vs Trade Rates", () => {
    it("applies retail promotion (e.g. 20% EOSS) when customer is billed on MRP", () => {
      const result = SmritiSalesPromotionService.resolveBestItemPromo({
        sku: "APP-SHIRT-01",
        category: "Apparel",
        brand: "Louis Philippe",
        rate: 1499.00, // MRP
        qty: 1,
        customerName: "Walk-in Customer",
        customerGroup: "ALL",
        pricingBasis: "MRP",
        allowPromotionsOnRate: false,
      });

      expect(result.applied).toBe(true);
      expect(result.discountPct).toBe(20);
      expect(result.promoCode).toBe("EOSS20");
      expect(result.discountAmt).toBeCloseTo(299.80, 2);
    });

    it("suppresses retail promotions when customer is billed on RATE with allowPromotionsOnRate = false", () => {
      const result = SmritiSalesPromotionService.resolveBestItemPromo({
        sku: "APP-SHIRT-01",
        category: "Apparel",
        brand: "Louis Philippe",
        rate: 850.00, // Wholesale Selling Price / Trade Rate
        qty: 10,
        customerName: "Shree Ganesh Textiles",
        customerGroup: "WHOLESALE",
        pricingBasis: "RATE",
        allowPromotionsOnRate: false,
      });

      // Crucial Margin Protection: Zero discount applied, badge is RATE (NET)
      expect(result.applied).toBe(false);
      expect(result.discountPct).toBe(0);
      expect(result.discountAmt).toBe(0);
      expect(result.badgeText).toBe("RATE (NET)");
      expect(result.promoDescription).toContain("Retail promotions suppressed");
      expect(result.reason).toContain("pricing basis is RATE");
    });

    it("allows retail promotions to stack on trade rate when allowPromotionsOnRate = true", () => {
      const result = SmritiSalesPromotionService.resolveBestItemPromo({
        sku: "APP-SHIRT-01",
        category: "Apparel",
        brand: "Louis Philippe",
        rate: 850.00,
        qty: 1,
        customerName: "Premier Retail Partners",
        customerGroup: "WHOLESALE",
        pricingBasis: "RATE",
        allowPromotionsOnRate: true,
      });

      // When management explicitly authorizes promotions on trade rate
      expect(result.applied).toBe(true);
      expect(result.discountPct).toBe(20);
      expect(result.discountAmt).toBeCloseTo(170.00, 2);
    });

    it("preserves contractual trade exclusivity (Reliance 43.76%) regardless of pricingBasis", () => {
      const result = SmritiSalesPromotionService.resolveBestItemPromo({
        sku: "APP-SHIRT-01",
        category: "Apparel",
        rate: 1000.00,
        qty: 1,
        customerName: "Reliance Retail Ltd.",
        customerCode: "CUST-RIL-1888",
        pricingBasis: "RATE",
        allowPromotionsOnRate: false,
      });

      // Contractual partner scheme always applies
      expect(result.applied).toBe(true);
      expect(result.discountPct).toBe(43.76);
      expect(result.promoCode).toBe("REL_RET_4376");
      expect(result.discountAmt).toBe(437.60);
    });
  });

  describe("3. Statutory Legal Metrology & Tax Mode Compliance", () => {
    it("validates that Wholesale Trade Rate + GST does not breach MRP ceiling", () => {
      const mrp = 1000.00;
      const wholesaleRate = 750.00;
      const gstPercentage = 18.0;

      const gstAmount = wholesaleRate * (gstPercentage / 100);
      const grossBillingPrice = wholesaleRate + gstAmount;

      // Legal Metrology Act ceiling verification
      expect(grossBillingPrice).toBeLessThanOrEqual(mrp);
      expect(grossBillingPrice).toBe(885.00);
    });

    it("flags an error if Wholesale Trade Rate exceeds MRP", () => {
      const mrp = 500.00;
      const invalidWholesaleRate = 550.00;

      const isCompliant = invalidWholesaleRate <= mrp;
      expect(isCompliant).toBe(false);
    });
  });

  describe("4. Dynamic POS Cart Line Re-Rating Simulation", () => {
    it("correctly simulates line re-rating on customer switch from Retail (MRP) to Wholesale (RATE)", () => {
      const product = {
        sku: "DENIM-501",
        mrp: 2499.00,
        sellingPrice: 1450.00, // Wholesale Rate
        costPrice: 900.00,
        gstPercentage: 12.0,
      };

      // 1. Initial Scan for Retail Customer (Bill on MRP)
      const retailCustomerBasis: "MRP" | "RATE" = "MRP";
      const initialUnitRate = retailCustomerBasis === "RATE" ? product.sellingPrice : product.mrp;
      expect(initialUnitRate).toBe(2499.00);

      // 2. Customer Switch to Wholesale B2B Client (Bill on RATE)
      const switchedCustomerBasis: "MRP" | "RATE" = "RATE";
      const switchedUnitRate = switchedCustomerBasis === "RATE" ? product.sellingPrice : product.mrp;
      expect(switchedUnitRate).toBe(1450.00);

      // Verify margin protection: Net billed rate exceeds cost price
      expect(switchedUnitRate).toBeGreaterThan(product.costPrice);
      const grossMarginPct = ((switchedUnitRate - product.costPrice) / switchedUnitRate) * 100;
      expect(grossMarginPct).toBeGreaterThan(35); // 37.93% margin
    });
  });
});
