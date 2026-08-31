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

export type GiftCardStatus = "ACTIVE" | "PARTIALLY_USED" | "FULLY_REDEEMED" | "EXPIRED" | "BLOCKED";
export type GiftCardTxnType = "ISSUE" | "TOP_UP" | "REDEMPTION" | "BREAKAGE_CREDIT" | "EXPIRY_REVERSAL";

export interface GiftCard {
  cardNumber: string;
  cardAlias: string;
  maskedNumber: string;         // e.g., "XXXX-XXXX-XXXX-4521"
  originalAmount: number;
  currentBalance: number;
  status: GiftCardStatus;
  issuedTo?: string;            // Customer ID
  issuedAt: string;             // ISO date
  expiresAt: string;            // ISO date
  pin: string;                  // Hashed 6-digit PIN
  otpSecret?: string;           // OTP seed for TOTP-style 6-digit codes
  branchCode: string;
  transactions: GiftCardTxnLedger[];
}

export interface GiftCardTxnLedger {
  txnId: string;
  txnType: GiftCardTxnType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceVoucher?: string;    // Sales/PO voucher ref
  remarks: string;
  timestamp: string;
  operatorId?: string;
}

export interface GiftCardRedemptionRequest {
  cardNumber: string;
  otp: string;                  // 6-digit OTP
  redemptionAmount: number;
  salesVoucher: string;
  operatorId: string;
}

export interface GiftCardRedemptionResult {
  success: boolean;
  errorCode?: "INVALID_OTP" | "INSUFFICIENT_BALANCE" | "CARD_EXPIRED" | "CARD_BLOCKED" | "CARD_NOT_FOUND";
  errorMessage?: string;
  amountRedeemed: number;
  balanceAfter: number;
  ledgerEntry?: GiftCardTxnLedger;
}

export interface BreakageAnalysisResult {
  totalIssuedValue: number;
  totalRedeemedValue: number;
  totalExpiredValue: number;
  breakageRevenue: number;       // Expired + never-redeemed portion recognized as revenue
  breakagePct: number;
  cards: { cardNumber: string; maskedNumber: string; expiresAt: string; balance: number; }[];
}

export class GiftCardEngine {
  /** Mask card number for display */
  public static maskCardNumber(cardNumber: string): string {
    if (cardNumber.length < 4) return "****";
    return `XXXX-XXXX-XXXX-${cardNumber.slice(-4)}`;
  }

  /** Generate a deterministic OTP for testing (in production this is TOTP via backend) */
  public static generateOTP(cardNumber: string, timestamp: number = Date.now()): string {
    const window = Math.floor(timestamp / 30000); // 30-second TOTP window
    const seed = cardNumber.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return String((seed * window) % 1000000).padStart(6, "0");
  }

  /** Validate OTP within a ±1 window tolerance */
  public static validateOTP(cardNumber: string, otp: string, timestamp: number = Date.now()): boolean {
    for (const offset of [-1, 0, 1]) {
      const windowTs = timestamp + offset * 30000;
      if (this.generateOTP(cardNumber, windowTs) === otp) return true;
    }
    return false;
  }

  /** Issue a new gift card */
  public static issue(params: {
    cardNumber: string;
    issuedTo: string;
    amount: number;
    branchCode: string;
    operatorId: string;
    validityDays?: number;
  }): GiftCard {
    const now = new Date().toISOString();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (params.validityDays ?? 365));

    const txn: GiftCardTxnLedger = {
      txnId: `TXN-${Date.now()}`,
      txnType: "ISSUE",
      amount: params.amount,
      balanceBefore: 0,
      balanceAfter: params.amount,
      remarks: `Gift card issued to customer ${params.issuedTo}`,
      timestamp: now,
      operatorId: params.operatorId,
    };

    return {
      cardNumber: params.cardNumber,
      cardAlias: `GC-${params.cardNumber.slice(-6)}`,
      maskedNumber: this.maskCardNumber(params.cardNumber),
      originalAmount: params.amount,
      currentBalance: params.amount,
      status: "ACTIVE",
      issuedTo: params.issuedTo,
      issuedAt: now,
      expiresAt: expiryDate.toISOString(),
      pin: "hashed-pin-placeholder",
      branchCode: params.branchCode,
      transactions: [txn],
    };
  }

  /** Top-up an existing gift card */
  public static topUp(card: GiftCard, amount: number, operatorId: string, voucher?: string): GiftCard {
    if (card.status === "BLOCKED" || card.status === "EXPIRED") {
      throw new Error(`SMRITI-GC-001: Cannot top-up a ${card.status.toLowerCase()} card.`);
    }

    const before = card.currentBalance;
    const after = before + amount;

    const txn: GiftCardTxnLedger = {
      txnId: `TXN-${Date.now()}`,
      txnType: "TOP_UP",
      amount,
      balanceBefore: before,
      balanceAfter: after,
      referenceVoucher: voucher,
      remarks: `Top-up of ₹${amount}`,
      timestamp: new Date().toISOString(),
      operatorId,
    };

    return {
      ...card,
      currentBalance: after,
      status: "ACTIVE",
      transactions: [...card.transactions, txn],
    };
  }

  /** Redeem gift card with OTP validation */
  public static redeem(
    card: GiftCard,
    request: GiftCardRedemptionRequest,
    currentTime: number = Date.now()
  ): { card: GiftCard; result: GiftCardRedemptionResult } {
    // Guard: Card not found handled by caller
    if (card.status === "BLOCKED") {
      return {
        card,
        result: { success: false, errorCode: "CARD_BLOCKED", errorMessage: "This gift card has been blocked.", amountRedeemed: 0, balanceAfter: card.currentBalance },
      };
    }

    if (card.status === "EXPIRED" || new Date(card.expiresAt) < new Date()) {
      return {
        card: { ...card, status: "EXPIRED" },
        result: { success: false, errorCode: "CARD_EXPIRED", errorMessage: "This gift card has expired.", amountRedeemed: 0, balanceAfter: 0 },
      };
    }

    // OTP Validation
    if (!this.validateOTP(card.cardNumber, request.otp, currentTime)) {
      return {
        card,
        result: { success: false, errorCode: "INVALID_OTP", errorMessage: "Invalid OTP. Please retry.", amountRedeemed: 0, balanceAfter: card.currentBalance },
      };
    }

    if (request.redemptionAmount > card.currentBalance) {
      return {
        card,
        result: { success: false, errorCode: "INSUFFICIENT_BALANCE", errorMessage: `Insufficient balance. Available: ₹${card.currentBalance}`, amountRedeemed: 0, balanceAfter: card.currentBalance },
      };
    }

    const before = card.currentBalance;
    const after = before - request.redemptionAmount;

    const txn: GiftCardTxnLedger = {
      txnId: `TXN-${Date.now()}`,
      txnType: "REDEMPTION",
      amount: request.redemptionAmount,
      balanceBefore: before,
      balanceAfter: after,
      referenceVoucher: request.salesVoucher,
      remarks: `Redeemed ₹${request.redemptionAmount} against voucher ${request.salesVoucher}`,
      timestamp: new Date().toISOString(),
      operatorId: request.operatorId,
    };

    const newStatus: GiftCardStatus = after === 0 ? "FULLY_REDEEMED" : "PARTIALLY_USED";

    const updatedCard: GiftCard = {
      ...card,
      currentBalance: after,
      status: newStatus,
      transactions: [...card.transactions, txn],
    };

    return {
      card: updatedCard,
      result: { success: true, amountRedeemed: request.redemptionAmount, balanceAfter: after, ledgerEntry: txn },
    };
  }

  /** Calculate breakage revenue from expired/unredeemed cards */
  public static analyzeBreakage(cards: GiftCard[], asOfDate: Date = new Date()): BreakageAnalysisResult {
    let totalIssuedValue = 0;
    let totalRedeemedValue = 0;
    let totalExpiredValue = 0;
    const expiredCards: BreakageAnalysisResult["cards"] = [];

    for (const card of cards) {
      totalIssuedValue += card.originalAmount;
      totalRedeemedValue += card.originalAmount - card.currentBalance;

      if (card.status === "EXPIRED" || new Date(card.expiresAt) <= asOfDate) {
        totalExpiredValue += card.currentBalance;
        if (card.currentBalance > 0) {
          expiredCards.push({ cardNumber: card.cardNumber, maskedNumber: card.maskedNumber, expiresAt: card.expiresAt, balance: card.currentBalance });
        }
      }
    }

    const breakageRevenue = totalExpiredValue;
    const breakagePct = totalIssuedValue > 0 ? Math.round((breakageRevenue / totalIssuedValue) * 10000) / 100 : 0;

    return { totalIssuedValue, totalRedeemedValue, totalExpiredValue, breakageRevenue, breakagePct, cards: expiredCards };
  }
}

export default GiftCardEngine;
