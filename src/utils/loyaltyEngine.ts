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

export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
export type PointsEventType = "EARN_PURCHASE" | "EARN_BONUS" | "REDEEM" | "EXPIRE" | "TIER_UPGRADE_BONUS";

export interface LoyaltyTierDefinition {
  tier: LoyaltyTier;
  label: string;
  minLifetimeSpend: number;    // INR
  pointsEarnRate: number;      // Points per ₹100 spent
  redemptionRate: number;      // INR value per 1 point (e.g., 0.25 = 25 paise)
  birthdayMultiplier: number;  // e.g., 3x points on birthday month
  bonusUpgradePoints: number;  // Points awarded on tier upgrade
}

export interface LoyaltyCustomer {
  customerId: string;
  name: string;
  mobile: string;
  email?: string;
  currentTier: LoyaltyTier;
  lifetimeSpend: number;
  availablePoints: number;
  totalEarnedPoints: number;
  totalRedeemedPoints: number;
  birthdayMonth?: number;        // 1–12
  enrolledAt: string;
  lastTransactionAt: string;
  pointsHistory: LoyaltyPointsEvent[];
}

export interface LoyaltyPointsEvent {
  eventId: string;
  eventType: PointsEventType;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceVoucher?: string;
  spendAmount?: number;
  remarks: string;
  timestamp: string;
}

export interface TierProgressionResult {
  customerId: string;
  previousTier: LoyaltyTier;
  newTier: LoyaltyTier;
  tierChanged: boolean;
  pointsToNextTier: number;
  nextTier: LoyaltyTier | null;
  lifetimeSpendToNextTier: number;
  upgradeBonus?: LoyaltyPointsEvent;
}

export interface PointsRedemptionResult {
  success: boolean;
  errorCode?: "INSUFFICIENT_POINTS" | "BELOW_MIN_REDEMPTION" | "CUSTOMER_NOT_FOUND";
  errorMessage?: string;
  pointsRedeemed: number;
  cashEquivalent: number;
  balanceAfter: number;
  event?: LoyaltyPointsEvent;
}

// ──────────────────────────────────────────────────────────────────
// Tier configuration table
// ──────────────────────────────────────────────────────────────────
export const TIER_DEFINITIONS: Record<LoyaltyTier, LoyaltyTierDefinition> = {
  BRONZE: {
    tier: "BRONZE",
    label: "Bronze",
    minLifetimeSpend: 0,
    pointsEarnRate: 1,         // 1 pt per ₹100
    redemptionRate: 0.25,      // ₹0.25 per point
    birthdayMultiplier: 2,
    bonusUpgradePoints: 0,
  },
  SILVER: {
    tier: "SILVER",
    label: "Silver",
    minLifetimeSpend: 10000,
    pointsEarnRate: 2,
    redemptionRate: 0.30,
    birthdayMultiplier: 2.5,
    bonusUpgradePoints: 200,
  },
  GOLD: {
    tier: "GOLD",
    label: "Gold",
    minLifetimeSpend: 50000,
    pointsEarnRate: 4,
    redemptionRate: 0.40,
    birthdayMultiplier: 3,
    bonusUpgradePoints: 500,
  },
  PLATINUM: {
    tier: "PLATINUM",
    label: "Platinum",
    minLifetimeSpend: 150000,
    pointsEarnRate: 6,
    redemptionRate: 0.50,
    birthdayMultiplier: 4,
    bonusUpgradePoints: 1000,
  },
  DIAMOND: {
    tier: "DIAMOND",
    label: "Diamond",
    minLifetimeSpend: 500000,
    pointsEarnRate: 10,
    redemptionRate: 0.75,
    birthdayMultiplier: 5,
    bonusUpgradePoints: 2500,
  },
};

export const TIER_ORDER: LoyaltyTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
export const MIN_REDEMPTION_POINTS = 50;

export class LoyaltyEngine {
  /** Resolve the tier for a given lifetime spend */
  public static resolveTier(lifetimeSpend: number): LoyaltyTier {
    let resolved: LoyaltyTier = "BRONZE";
    for (const tier of TIER_ORDER) {
      if (lifetimeSpend >= TIER_DEFINITIONS[tier].minLifetimeSpend) {
        resolved = tier;
      }
    }
    return resolved;
  }

  /** Earn points from a purchase. Returns updated customer + event. */
  public static earnPoints(
    customer: LoyaltyCustomer,
    purchaseAmount: number,
    voucher: string,
    purchaseDate: Date = new Date(),
    operatorId?: string
  ): { customer: LoyaltyCustomer; event: LoyaltyPointsEvent; progression: TierProgressionResult } {
    const tierDef = TIER_DEFINITIONS[customer.currentTier];
    let basePoints = Math.floor((purchaseAmount / 100) * tierDef.pointsEarnRate);

    // Birthday month multiplier
    const isBirthdayMonth = customer.birthdayMonth !== undefined && purchaseDate.getMonth() + 1 === customer.birthdayMonth;
    if (isBirthdayMonth) {
      basePoints = Math.floor(basePoints * tierDef.birthdayMultiplier);
    }

    const newLifetimeSpend = customer.lifetimeSpend + purchaseAmount;
    const balanceBefore = customer.availablePoints;
    const balanceAfter = balanceBefore + basePoints;

    const event: LoyaltyPointsEvent = {
      eventId: `EVT-${Date.now()}`,
      eventType: "EARN_PURCHASE",
      points: basePoints,
      balanceBefore,
      balanceAfter,
      referenceVoucher: voucher,
      spendAmount: purchaseAmount,
      remarks: `Earned ${basePoints} pts on ₹${purchaseAmount} purchase${isBirthdayMonth ? " (Birthday Month Bonus!)" : ""}`,
      timestamp: purchaseDate.toISOString(),
    };

    const updatedCustomer: LoyaltyCustomer = {
      ...customer,
      lifetimeSpend: newLifetimeSpend,
      availablePoints: balanceAfter,
      totalEarnedPoints: customer.totalEarnedPoints + basePoints,
      lastTransactionAt: purchaseDate.toISOString(),
      pointsHistory: [...customer.pointsHistory, event],
    };

    // Resolve tier progression
    const progression = this.checkTierProgression(updatedCustomer, customer.currentTier);

    // Apply tier upgrade to customer if changed
    const finalCustomer: LoyaltyCustomer = {
      ...updatedCustomer,
      currentTier: progression.newTier,
      availablePoints: updatedCustomer.availablePoints + (progression.upgradeBonus?.points ?? 0),
      totalEarnedPoints: updatedCustomer.totalEarnedPoints + (progression.upgradeBonus?.points ?? 0),
      pointsHistory: progression.upgradeBonus
        ? [...updatedCustomer.pointsHistory, progression.upgradeBonus]
        : updatedCustomer.pointsHistory,
    };

    return { customer: finalCustomer, event, progression };
  }

  /** Redeem points for cash value */
  public static redeemPoints(
    customer: LoyaltyCustomer,
    pointsToRedeem: number,
    voucher: string,
    operatorId?: string
  ): { customer: LoyaltyCustomer; result: PointsRedemptionResult } {
    if (pointsToRedeem < MIN_REDEMPTION_POINTS) {
      return {
        customer,
        result: { success: false, errorCode: "BELOW_MIN_REDEMPTION", errorMessage: `Minimum redemption is ${MIN_REDEMPTION_POINTS} points.`, pointsRedeemed: 0, cashEquivalent: 0, balanceAfter: customer.availablePoints },
      };
    }

    if (pointsToRedeem > customer.availablePoints) {
      return {
        customer,
        result: { success: false, errorCode: "INSUFFICIENT_POINTS", errorMessage: `Insufficient points. Available: ${customer.availablePoints}`, pointsRedeemed: 0, cashEquivalent: 0, balanceAfter: customer.availablePoints },
      };
    }

    const tierDef = TIER_DEFINITIONS[customer.currentTier];
    const cashEquivalent = Math.round(pointsToRedeem * tierDef.redemptionRate * 100) / 100;
    const balanceBefore = customer.availablePoints;
    const balanceAfter = balanceBefore - pointsToRedeem;

    const event: LoyaltyPointsEvent = {
      eventId: `EVT-${Date.now()}`,
      eventType: "REDEEM",
      points: -pointsToRedeem,
      balanceBefore,
      balanceAfter,
      referenceVoucher: voucher,
      remarks: `Redeemed ${pointsToRedeem} pts for ₹${cashEquivalent} against ${voucher}`,
      timestamp: new Date().toISOString(),
    };

    const updatedCustomer: LoyaltyCustomer = {
      ...customer,
      availablePoints: balanceAfter,
      totalRedeemedPoints: customer.totalRedeemedPoints + pointsToRedeem,
      lastTransactionAt: event.timestamp,
      pointsHistory: [...customer.pointsHistory, event],
    };

    return {
      customer: updatedCustomer,
      result: { success: true, pointsRedeemed: pointsToRedeem, cashEquivalent, balanceAfter, event },
    };
  }

  /** Evaluate tier progression and generate upgrade bonus */
  private static checkTierProgression(customer: LoyaltyCustomer, previousTier: LoyaltyTier): TierProgressionResult {
    const newTier = this.resolveTier(customer.lifetimeSpend);
    const tierChanged = newTier !== previousTier;

    const currentTierIdx = TIER_ORDER.indexOf(newTier);
    const nextTier: LoyaltyTier | null = currentTierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIdx + 1] : null;
    const nextTierDef = nextTier ? TIER_DEFINITIONS[nextTier] : null;
    const lifetimeSpendToNextTier = nextTierDef ? Math.max(0, nextTierDef.minLifetimeSpend - customer.lifetimeSpend) : 0;

    let upgradeBonus: LoyaltyPointsEvent | undefined;
    if (tierChanged) {
      const bonusPts = TIER_DEFINITIONS[newTier].bonusUpgradePoints;
      if (bonusPts > 0) {
        upgradeBonus = {
          eventId: `EVT-UPGRADE-${Date.now()}`,
          eventType: "TIER_UPGRADE_BONUS",
          points: bonusPts,
          balanceBefore: customer.availablePoints,
          balanceAfter: customer.availablePoints + bonusPts,
          remarks: `Welcome to ${newTier} tier! Upgrade bonus of ${bonusPts} pts awarded.`,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Compute spend to next tier
    const currentTierSpendThreshold = TIER_DEFINITIONS[newTier].minLifetimeSpend;
    const pointsToNextTier = nextTier ? Math.max(0, Math.ceil((lifetimeSpendToNextTier / 100) * TIER_DEFINITIONS[newTier].pointsEarnRate)) : 0;

    return { customerId: customer.customerId, previousTier, newTier, tierChanged, pointsToNextTier, nextTier, lifetimeSpendToNextTier, upgradeBonus };
  }

  /** Get publicly available tier progression info */
  public static getTierProgression(customer: LoyaltyCustomer): TierProgressionResult {
    return this.checkTierProgression(customer, customer.currentTier);
  }
}

export default LoyaltyEngine;
