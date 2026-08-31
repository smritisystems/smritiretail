/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.96.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Dynamic Loyalty Points Burn & Earn Ledger
 *
 * Implements a double-entry loyalty ledger:
 *   - EARN events: purchases, sign-up bonus, referral, birthday, manual credit
 *   - BURN events: redemption at POS, voucher conversion, expiry write-off
 *   - Expiry scheduling: points expire after configurable TTL days
 *   - Redemption caps: max redeemable % of invoice value + min balance guard
 *   - Real-time balance with expiry-aware available balance
 */

export type LedgerEventType =
  | "EARN_PURCHASE"
  | "EARN_SIGNUP_BONUS"
  | "EARN_REFERRAL"
  | "EARN_BIRTHDAY"
  | "EARN_MANUAL_CREDIT"
  | "BURN_REDEMPTION"
  | "BURN_VOUCHER_CONVERSION"
  | "BURN_EXPIRY_WRITEOFF"
  | "ADJUSTMENT_DEBIT"
  | "ADJUSTMENT_CREDIT";

export type LedgerEntryStatus = "ACTIVE" | "EXPIRED" | "REDEEMED" | "REVERSED";

export interface LoyaltyLedgerEntry {
  entryId: string;
  customerId: string;
  eventType: LedgerEventType;
  points: number;             // Positive = credit, Negative = debit
  referenceNo: string;        // Invoice number / voucher / reason
  earnedAt: string;           // ISO timestamp
  expiresAt?: string;         // ISO timestamp for EARN entries
  status: LedgerEntryStatus;
  note?: string;
}

export interface LoyaltyBalance {
  customerId: string;
  totalEarned: number;
  totalBurned: number;
  totalExpired: number;
  grossBalance: number;       // totalEarned - totalBurned - totalExpired
  availableBalance: number;   // Excluding entries whose expiresAt has passed
  expiringIn30Days: number;   // Points expiring within next 30 days
  nextExpiryDate?: string;
  nextExpiryPoints?: number;
}

export interface RedemptionResult {
  approved: boolean;
  pointsToRedeem: number;
  monetaryValue: number;      // Points × conversionRate (₹ per point)
  burnEntry?: LoyaltyLedgerEntry;
  rejectionReason?: string;
}

export interface ExpirySchedule {
  customerId: string;
  expiredEntries: LoyaltyLedgerEntry[];
  totalExpiredPoints: number;
  writeOffEntries: LoyaltyLedgerEntry[];
}

/** Engine configuration */
export const LOYALTY_CONFIG = {
  pointsPerRupee: 1,           // 1 point per ₹1 spent
  rupeePerPoint: 0.25,         // ₹0.25 per point redeemed
  pointsExpiryDays: 365,       // Points expire after 1 year
  maxRedemptionPct: 0.20,      // Max 20% of invoice value can be redeemed as points
  minBalanceAfterBurn: 50,     // Must retain at least 50 points after redemption
  signupBonus: 200,            // Points awarded on new signup
  referralBonus: 100,          // Points awarded on successful referral
  birthdayBonus: 150,          // Points awarded on birthday
};

export class LoyaltyLedgerEngine {
  /** Generate a deterministic entry ID */
  private static entryId(): string {
    return `LDG-${Date.now()}-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`;
  }

  /** Calculate expiry date from earned date */
  public static calcExpiryDate(earnedAt: string, ttlDays = LOYALTY_CONFIG.pointsExpiryDays): string {
    const d = new Date(earnedAt);
    d.setDate(d.getDate() + ttlDays);
    return d.toISOString();
  }

  /** Create an EARN entry from a purchase */
  public static earnFromPurchase(params: {
    customerId: string;
    invoiceNo: string;
    invoiceValue: number;
    earnedAt: string;
  }): LoyaltyLedgerEntry {
    const points = Math.floor(params.invoiceValue * LOYALTY_CONFIG.pointsPerRupee);
    return {
      entryId: this.entryId(),
      customerId: params.customerId,
      eventType: "EARN_PURCHASE",
      points,
      referenceNo: params.invoiceNo,
      earnedAt: params.earnedAt,
      expiresAt: this.calcExpiryDate(params.earnedAt),
      status: "ACTIVE",
      note: `Earned ${points} pts on ₹${params.invoiceValue} purchase`,
    };
  }

  /** Create a bonus EARN entry (signup / referral / birthday / manual) */
  public static earnBonus(params: {
    customerId: string;
    eventType: Extract<LedgerEventType, "EARN_SIGNUP_BONUS" | "EARN_REFERRAL" | "EARN_BIRTHDAY" | "EARN_MANUAL_CREDIT">;
    referenceNo: string;
    customPoints?: number;
    earnedAt: string;
  }): LoyaltyLedgerEntry {
    const defaultPoints: Record<string, number> = {
      EARN_SIGNUP_BONUS: LOYALTY_CONFIG.signupBonus,
      EARN_REFERRAL: LOYALTY_CONFIG.referralBonus,
      EARN_BIRTHDAY: LOYALTY_CONFIG.birthdayBonus,
      EARN_MANUAL_CREDIT: 0,
    };
    const points = params.customPoints ?? defaultPoints[params.eventType] ?? 0;
    return {
      entryId: this.entryId(),
      customerId: params.customerId,
      eventType: params.eventType,
      points,
      referenceNo: params.referenceNo,
      earnedAt: params.earnedAt,
      expiresAt: this.calcExpiryDate(params.earnedAt),
      status: "ACTIVE",
    };
  }

  /** Compute live balance from ledger entries as of a given date */
  public static computeBalance(entries: LoyaltyLedgerEntry[], customerId: string, asOf: Date): LoyaltyBalance {
    const now = asOf;
    const in30 = new Date(now);
    in30.setDate(now.getDate() + 30);

    let totalEarned = 0;
    let totalBurned = 0;
    let totalExpired = 0;
    let availableBalance = 0;
    let expiringIn30Days = 0;
    let nextExpiryDate: string | undefined;
    let nextExpiryPoints: number | undefined;

    for (const e of entries) {
      if (e.customerId !== customerId) continue;

      if (e.points > 0) {
        totalEarned += e.points;
        const isExpired = e.expiresAt && new Date(e.expiresAt) <= now;
        const isRedeemed = e.status === "REDEEMED";

        if (!isExpired && !isRedeemed && e.status === "ACTIVE") {
          availableBalance += e.points;
          if (e.expiresAt && new Date(e.expiresAt) <= in30) {
            expiringIn30Days += e.points;
            if (!nextExpiryDate || e.expiresAt < nextExpiryDate) {
              nextExpiryDate = e.expiresAt;
              nextExpiryPoints = e.points;
            }
          }
        }
        if (isExpired && e.status !== "REDEEMED") totalExpired += e.points;
      } else {
        totalBurned += Math.abs(e.points);
      }
    }

    return {
      customerId,
      totalEarned,
      totalBurned,
      totalExpired,
      grossBalance: totalEarned - totalBurned - totalExpired,
      availableBalance,
      expiringIn30Days,
      nextExpiryDate,
      nextExpiryPoints,
    };
  }

  /** Validate and process a redemption */
  public static processRedemption(params: {
    customerId: string;
    invoiceNo: string;
    invoiceValue: number;
    pointsRequested: number;
    balance: LoyaltyBalance;
    redeemedAt: string;
  }): RedemptionResult {
    const maxRedeemableByValue = Math.floor(
      (params.invoiceValue * LOYALTY_CONFIG.maxRedemptionPct) / LOYALTY_CONFIG.rupeePerPoint
    );
    const maxRedeemable = Math.min(maxRedeemableByValue, params.balance.availableBalance);
    const pointsToRedeem = Math.min(params.pointsRequested, maxRedeemable);

    if (pointsToRedeem <= 0) {
      return { approved: false, pointsToRedeem: 0, monetaryValue: 0, rejectionReason: "Insufficient points or redemption cap reached" };
    }
    if (params.balance.availableBalance - pointsToRedeem < LOYALTY_CONFIG.minBalanceAfterBurn) {
      const allowed = params.balance.availableBalance - LOYALTY_CONFIG.minBalanceAfterBurn;
      if (allowed <= 0) return { approved: false, pointsToRedeem: 0, monetaryValue: 0, rejectionReason: `Minimum balance of ${LOYALTY_CONFIG.minBalanceAfterBurn} pts must be retained` };
    }

    const monetaryValue = Math.round(pointsToRedeem * LOYALTY_CONFIG.rupeePerPoint * 100) / 100;
    const burnEntry: LoyaltyLedgerEntry = {
      entryId: this.entryId(),
      customerId: params.customerId,
      eventType: "BURN_REDEMPTION",
      points: -pointsToRedeem,
      referenceNo: params.invoiceNo,
      earnedAt: params.redeemedAt,
      status: "REDEEMED",
      note: `Redeemed ${pointsToRedeem} pts = ₹${monetaryValue} on ${params.invoiceNo}`,
    };

    return { approved: true, pointsToRedeem, monetaryValue, burnEntry };
  }

  /** Run expiry sweep — mark expired EARN entries and create BURN_EXPIRY_WRITEOFF */
  public static runExpirySweep(entries: LoyaltyLedgerEntry[], asOf: Date): ExpirySchedule {
    const customersProcessed = new Set<string>();
    const expiredEntries: LoyaltyLedgerEntry[] = [];
    const writeOffEntries: LoyaltyLedgerEntry[] = [];

    for (const e of entries) {
      if (e.points > 0 && e.status === "ACTIVE" && e.expiresAt && new Date(e.expiresAt) <= asOf) {
        expiredEntries.push({ ...e, status: "EXPIRED" });
        customersProcessed.add(e.customerId);
      }
    }

    const byCustomer: Record<string, number> = {};
    for (const e of expiredEntries) byCustomer[e.customerId] = (byCustomer[e.customerId] ?? 0) + e.points;

    for (const [cid, pts] of Object.entries(byCustomer)) {
      writeOffEntries.push({
        entryId: this.entryId(),
        customerId: cid,
        eventType: "BURN_EXPIRY_WRITEOFF",
        points: -pts,
        referenceNo: `EXPIRY-${asOf.toISOString().slice(0, 10)}`,
        earnedAt: asOf.toISOString(),
        status: "REDEEMED",
        note: `${pts} pts expired on ${asOf.toISOString().slice(0, 10)}`,
      });
    }

    return {
      customerId: [...customersProcessed].join(","),
      expiredEntries,
      totalExpiredPoints: Object.values(byCustomer).reduce((s, v) => s + v, 0),
      writeOffEntries,
    };
  }
}

export default LoyaltyLedgerEngine;
