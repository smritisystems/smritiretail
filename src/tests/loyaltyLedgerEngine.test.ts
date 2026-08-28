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

import { describe, it, expect } from "vitest";
import LoyaltyLedgerEngine, {
  LoyaltyLedgerEntry,
  LOYALTY_CONFIG,
} from "../utils/loyaltyLedgerEngine";

describe("LoyaltyLedgerEngine — Dynamic Loyalty Points Burn & Earn Ledger", () => {
  const NOW = new Date("2026-08-28T00:00:00.000Z");
  const CUST = "CUST-001";

  function makeEarnEntry(overrides: Partial<LoyaltyLedgerEntry> = {}): LoyaltyLedgerEntry {
    return LoyaltyLedgerEngine.earnFromPurchase({
      customerId: CUST,
      invoiceNo: "INV-001",
      invoiceValue: 2000,
      earnedAt: "2026-08-27T10:00:00.000Z",
      ...overrides as any,
    });
  }

  // ─── Test 1: Earn from purchase — points and expiry calculation ───────────
  it("earns correct points from purchase and computes expiry date at +365 days", () => {
    const entry = LoyaltyLedgerEngine.earnFromPurchase({
      customerId: CUST,
      invoiceNo: "INV-2026-001",
      invoiceValue: 5000,
      earnedAt: "2026-08-28T09:00:00.000Z",
    });

    expect(entry.points).toBe(5000);       // 1 point per ₹1
    expect(entry.eventType).toBe("EARN_PURCHASE");
    expect(entry.status).toBe("ACTIVE");
    expect(entry.expiresAt).toBeDefined();

    const expiresAt = new Date(entry.expiresAt!);
    const earnedAt  = new Date("2026-08-28T09:00:00.000Z");
    const diffDays  = Math.round((expiresAt.getTime() - earnedAt.getTime()) / 86400000);
    expect(diffDays).toBe(LOYALTY_CONFIG.pointsExpiryDays);  // 365 days

    // Bonus earn — signup
    const signup = LoyaltyLedgerEngine.earnBonus({
      customerId: CUST,
      eventType: "EARN_SIGNUP_BONUS",
      referenceNo: "SIGNUP-001",
      earnedAt: "2026-08-28T09:00:00.000Z",
    });
    expect(signup.points).toBe(LOYALTY_CONFIG.signupBonus);   // 200
    expect(signup.eventType).toBe("EARN_SIGNUP_BONUS");
  });

  // ─── Test 2: Balance computation with expiry-aware available balance ──────
  it("computes live balance correctly, excluding expired entries from available balance", () => {
    const activeEntry = LoyaltyLedgerEngine.earnFromPurchase({
      customerId: CUST, invoiceNo: "INV-A", invoiceValue: 3000, earnedAt: "2026-08-01T00:00:00.000Z",
    });
    // Create entry expired 1 day ago
    const expiredEntry: LoyaltyLedgerEntry = {
      entryId: "TEST-EXP",
      customerId: CUST,
      eventType: "EARN_PURCHASE",
      points: 1000,
      referenceNo: "INV-EXP",
      earnedAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2026-08-27T00:00:00.000Z",  // expired yesterday
      status: "ACTIVE",
    };
    const burnEntry: LoyaltyLedgerEntry = {
      entryId: "TEST-BURN",
      customerId: CUST,
      eventType: "BURN_REDEMPTION",
      points: -500,
      referenceNo: "INV-BURN",
      earnedAt: "2026-08-10T00:00:00.000Z",
      status: "REDEEMED",
    };

    const balance = LoyaltyLedgerEngine.computeBalance([activeEntry, expiredEntry, burnEntry], CUST, NOW);

    expect(balance.totalEarned).toBe(4000);         // 3000 + 1000
    expect(balance.totalBurned).toBe(500);
    expect(balance.availableBalance).toBe(3000);    // Only active (non-expired) entry
    expect(balance.totalExpired).toBe(1000);        // Expired entry counted
  });

  // ─── Test 3: Redemption with cap and minimum balance guard ───────────────
  it("approves valid redemptions, enforces 20% invoice cap, and rejects when min balance insufficient", () => {
    const entry = LoyaltyLedgerEngine.earnFromPurchase({
      customerId: CUST, invoiceNo: "INV-BASE", invoiceValue: 10000, earnedAt: "2026-07-01T00:00:00.000Z",
    });
    const balance = LoyaltyLedgerEngine.computeBalance([entry], CUST, NOW);

    // Invoice ₹2000 → max 20% = ₹400 = 1600 pts (at ₹0.25/pt)
    const result = LoyaltyLedgerEngine.processRedemption({
      customerId: CUST, invoiceNo: "INV-REDEEM", invoiceValue: 2000,
      pointsRequested: 5000, balance, redeemedAt: NOW.toISOString(),
    });

    expect(result.approved).toBe(true);
    expect(result.pointsToRedeem).toBeLessThanOrEqual(1600);   // Capped by 20% of ₹2000
    expect(result.monetaryValue).toBeGreaterThan(0);
    expect(result.burnEntry).toBeDefined();
    expect(result.burnEntry!.points).toBeLessThan(0);          // Debit entry

    // Zero balance → should reject
    const emptyBalance = { ...balance, availableBalance: 0, grossBalance: 0 };
    const rejected = LoyaltyLedgerEngine.processRedemption({
      customerId: CUST, invoiceNo: "INV-REJ", invoiceValue: 2000,
      pointsRequested: 500, balance: emptyBalance, redeemedAt: NOW.toISOString(),
    });
    expect(rejected.approved).toBe(false);
    expect(rejected.rejectionReason).toBeDefined();
  });

  // ─── Test 4: Expiry sweep creates write-off entries ───────────────────────
  it("runs expiry sweep and creates BURN_EXPIRY_WRITEOFF entries for expired ACTIVE points", () => {
    const expired1: LoyaltyLedgerEntry = {
      entryId: "EXP-1", customerId: CUST, eventType: "EARN_PURCHASE", points: 800,
      referenceNo: "INV-OLD-1", earnedAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:00:00.000Z", status: "ACTIVE",
    };
    const expired2: LoyaltyLedgerEntry = {
      entryId: "EXP-2", customerId: CUST, eventType: "EARN_BIRTHDAY", points: 150,
      referenceNo: "BDAY-2025", earnedAt: "2025-03-01T00:00:00.000Z",
      expiresAt: "2026-03-01T00:00:00.000Z", status: "ACTIVE",
    };
    const active: LoyaltyLedgerEntry = {
      entryId: "ACT-1", customerId: CUST, eventType: "EARN_PURCHASE", points: 500,
      referenceNo: "INV-RECENT", earnedAt: "2026-07-01T00:00:00.000Z",
      expiresAt: "2027-07-01T00:00:00.000Z", status: "ACTIVE",
    };

    const sweep = LoyaltyLedgerEngine.runExpirySweep([expired1, expired2, active], NOW);

    expect(sweep.expiredEntries).toHaveLength(2);
    expect(sweep.totalExpiredPoints).toBe(950);       // 800 + 150
    expect(sweep.writeOffEntries).toHaveLength(1);    // One write-off per customer
    expect(sweep.writeOffEntries[0].eventType).toBe("BURN_EXPIRY_WRITEOFF");
    expect(sweep.writeOffEntries[0].points).toBe(-950);
  });
});
