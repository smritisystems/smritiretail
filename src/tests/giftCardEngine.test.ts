/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.87.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import GiftCardEngine, { GiftCard } from "../utils/giftCardEngine";

describe("GiftCardEngine — Enterprise Gift Card & Stored-Value Ledger", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  const CARD_NUMBER = "7841200430054521";

  function makeActiveCard(): GiftCard {
    return GiftCardEngine.issue({
      cardNumber: CARD_NUMBER,
      issuedTo: "CUST-001",
      amount: 5000,
      branchCode: "BR-MUM-01",
      operatorId: "OPR-001",
      validityDays: 365,
    });
  }

  // ─── Test 1: Card issuance, masking, and ISSUE ledger entry ────────────────
  it("issues a gift card with correct balance, masked number, and ISSUE ledger entry", () => {
    const card = makeActiveCard();

    expect(card.cardNumber).toBe(CARD_NUMBER);
    expect(card.maskedNumber).toBe("XXXX-XXXX-XXXX-4521");
    expect(card.originalAmount).toBe(5000);
    expect(card.currentBalance).toBe(5000);
    expect(card.status).toBe("ACTIVE");
    expect(card.branchCode).toBe("BR-MUM-01");

    // Ledger entry
    expect(card.transactions).toHaveLength(1);
    expect(card.transactions[0].txnType).toBe("ISSUE");
    expect(card.transactions[0].balanceBefore).toBe(0);
    expect(card.transactions[0].balanceAfter).toBe(5000);
  });

  // ─── Test 2: Top-up increases balance and appends TOP_UP ledger entry ──────
  it("tops-up gift card balance correctly and creates a TOP_UP ledger entry", () => {
    const card = makeActiveCard();
    const topped = GiftCardEngine.topUp(card, 2000, "OPR-001", "RCPT-0042");

    expect(topped.currentBalance).toBe(7000);
    expect(topped.status).toBe("ACTIVE");
    expect(topped.transactions).toHaveLength(2);

    const topUpTxn = topped.transactions[1];
    expect(topUpTxn.txnType).toBe("TOP_UP");
    expect(topUpTxn.balanceBefore).toBe(5000);
    expect(topUpTxn.balanceAfter).toBe(7000);
    expect(topUpTxn.referenceVoucher).toBe("RCPT-0042");
  });

  // ─── Test 3: OTP-secured redemption ────────────────────────────────────────
  it("redeems gift card after valid OTP and marks FULLY_REDEEMED when balance hits zero", () => {
    const card = makeActiveCard();
    const now = Date.now();
    const validOtp = GiftCardEngine.generateOTP(CARD_NUMBER, now);

    const { card: redeemed, result } = GiftCardEngine.redeem(
      card,
      { cardNumber: CARD_NUMBER, otp: validOtp, redemptionAmount: 5000, salesVoucher: "INV-2026-001", operatorId: "OPR-001" },
      now
    );

    expect(result.success).toBe(true);
    expect(result.amountRedeemed).toBe(5000);
    expect(result.balanceAfter).toBe(0);
    expect(redeemed.status).toBe("FULLY_REDEEMED");
    expect(redeemed.transactions).toHaveLength(2);
    expect(redeemed.transactions[1].txnType).toBe("REDEMPTION");

    // Invalid OTP should be rejected
    const { result: badResult } = GiftCardEngine.redeem(
      card,
      { cardNumber: CARD_NUMBER, otp: "000000", redemptionAmount: 100, salesVoucher: "INV-2026-002", operatorId: "OPR-001" },
      now
    );
    expect(badResult.success).toBe(false);
    expect(badResult.errorCode).toBe("INVALID_OTP");
  });

  // ─── Test 4: Breakage revenue analysis ─────────────────────────────────────
  it("correctly computes breakage revenue from expired cards with remaining balance", () => {
    const activeCard = makeActiveCard();

    // Simulate an expired card with remaining balance
    const expiredDate = new Date();
    expiredDate.setFullYear(expiredDate.getFullYear() - 1);

    const expiredCard: GiftCard = {
      ...GiftCardEngine.issue({ cardNumber: "7841200430059999", issuedTo: "CUST-002", amount: 3000, branchCode: "BR-DEL-01", operatorId: "OPR-002", validityDays: 1 }),
      expiresAt: expiredDate.toISOString(),
      status: "EXPIRED",
      currentBalance: 1200,   // ₹1200 unredeemed at expiry → breakage revenue
    };

    const analysis = GiftCardEngine.analyzeBreakage([activeCard, expiredCard]);

    expect(analysis.totalIssuedValue).toBe(8000);          // 5000 + 3000
    expect(analysis.totalRedeemedValue).toBe(1800);        // 3000 - 1200 (active card untouched)
    expect(analysis.breakageRevenue).toBe(1200);           // expired balance
    expect(analysis.breakagePct).toBe(15);                 // 1200/8000 = 15%
    expect(analysis.cards).toHaveLength(1);
    expect(analysis.cards[0].maskedNumber).toBe("XXXX-XXXX-XXXX-9999");
  });
});
