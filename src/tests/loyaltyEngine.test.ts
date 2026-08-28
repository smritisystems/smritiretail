/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.88.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import LoyaltyEngine, { LoyaltyCustomer, TIER_DEFINITIONS, TIER_ORDER } from "../utils/loyaltyEngine";

describe("LoyaltyEngine — Customer 360 & Loyalty Tier Progression Matrix", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  function makeBronzeCustomer(): LoyaltyCustomer {
    return {
      customerId: "CUST-BRONZE-001",
      name: "Priya Mehta",
      mobile: "9820001234",
      currentTier: "BRONZE",
      lifetimeSpend: 0,
      availablePoints: 0,
      totalEarnedPoints: 0,
      totalRedeemedPoints: 0,
      birthdayMonth: 8,   // August
      enrolledAt: new Date().toISOString(),
      lastTransactionAt: new Date().toISOString(),
      pointsHistory: [],
    };
  }

  // ─── Test 1: Tier resolution from lifetime spend ─────────────────────────
  it("resolves correct tier for each spend threshold in TIER_DEFINITIONS", () => {
    expect(LoyaltyEngine.resolveTier(0)).toBe("BRONZE");
    expect(LoyaltyEngine.resolveTier(5000)).toBe("BRONZE");
    expect(LoyaltyEngine.resolveTier(10000)).toBe("SILVER");
    expect(LoyaltyEngine.resolveTier(50000)).toBe("GOLD");
    expect(LoyaltyEngine.resolveTier(150000)).toBe("PLATINUM");
    expect(LoyaltyEngine.resolveTier(500000)).toBe("DIAMOND");

    // All tier definitions have earn rates in ascending order
    for (let i = 0; i < TIER_ORDER.length - 1; i++) {
      const current = TIER_DEFINITIONS[TIER_ORDER[i]].pointsEarnRate;
      const next = TIER_DEFINITIONS[TIER_ORDER[i + 1]].pointsEarnRate;
      expect(next).toBeGreaterThan(current);
    }
  });

  // ─── Test 2: Point earn and birthday month multiplier ────────────────────
  it("earns correct points from a purchase and applies birthday month multiplier in August", () => {
    const customer = makeBronzeCustomer();
    const purchaseDate = new Date(2026, 7, 15); // August 2026 (month index 7 = August)

    const { customer: updated, event, progression } = LoyaltyEngine.earnPoints(
      customer,
      2000,      // ₹2000 purchase
      "INV-2026-0001",
      purchaseDate
    );

    // Bronze: 1 pt per ₹100 × 2x birthday multiplier = 2 × 20 = 40 pts
    const expectedBasePoints = Math.floor((2000 / 100) * TIER_DEFINITIONS["BRONZE"].pointsEarnRate);
    const expectedWithMultiplier = Math.floor(expectedBasePoints * TIER_DEFINITIONS["BRONZE"].birthdayMultiplier);

    expect(event.points).toBe(expectedWithMultiplier);
    expect(updated.availablePoints).toBe(expectedWithMultiplier);
    expect(updated.lifetimeSpend).toBe(2000);
    expect(event.remarks).toMatch(/Birthday Month Bonus/);
  });

  // ─── Test 3: Tier upgrade to SILVER with upgrade bonus points ────────────
  it("upgrades customer from BRONZE to SILVER on reaching ₹10,000 lifetime spend and awards upgrade bonus", () => {
    const customer: LoyaltyCustomer = {
      ...makeBronzeCustomer(),
      lifetimeSpend: 9500,    // Just below SILVER threshold
      availablePoints: 95,
      totalEarnedPoints: 95,
    };

    const purchaseDate = new Date(2026, 1, 15); // Non-birthday month
    const { customer: upgraded, progression } = LoyaltyEngine.earnPoints(
      customer,
      600,        // 9500 + 600 = 10100 → crosses SILVER at 10000
      "INV-2026-0099",
      purchaseDate
    );

    expect(upgraded.currentTier).toBe("SILVER");
    expect(progression.tierChanged).toBe(true);
    expect(progression.newTier).toBe("SILVER");
    expect(progression.previousTier).toBe("BRONZE");
    // Upgrade bonus for SILVER is 200 pts
    expect(progression.upgradeBonus?.points).toBe(TIER_DEFINITIONS["SILVER"].bonusUpgradePoints);
    expect(upgraded.availablePoints).toBeGreaterThanOrEqual(95 + TIER_DEFINITIONS["SILVER"].bonusUpgradePoints);
  });

  // ─── Test 4: Points redemption with cash equivalent and guard checks ─────
  it("redeems points for correct cash equivalent and blocks redemption below minimum threshold", () => {
    const customer: LoyaltyCustomer = {
      ...makeBronzeCustomer(),
      currentTier: "GOLD",
      availablePoints: 300,
      totalEarnedPoints: 300,
    };

    // Valid redemption
    const { customer: redeemed, result } = LoyaltyEngine.redeemPoints(customer, 200, "INV-REDEEM-001");
    expect(result.success).toBe(true);
    expect(result.pointsRedeemed).toBe(200);
    expect(result.cashEquivalent).toBe(200 * TIER_DEFINITIONS["GOLD"].redemptionRate);  // 200 × 0.40 = ₹80
    expect(redeemed.availablePoints).toBe(100);
    expect(redeemed.totalRedeemedPoints).toBe(200);

    // Below minimum (50 pts) should fail
    const { result: tooFew } = LoyaltyEngine.redeemPoints(customer, 30, "INV-REDEEM-002");
    expect(tooFew.success).toBe(false);
    expect(tooFew.errorCode).toBe("BELOW_MIN_REDEMPTION");

    // More than available should fail
    const { result: tooMany } = LoyaltyEngine.redeemPoints(customer, 500, "INV-REDEEM-003");
    expect(tooMany.success).toBe(false);
    expect(tooMany.errorCode).toBe("INSUFFICIENT_POINTS");
  });
});
