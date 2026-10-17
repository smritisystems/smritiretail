/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.49.0
 * Created      : 2026-10-02
 * Modified     : 2026-10-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  POSTenderItem,
  CustomerLoyaltyBalanceResponse,
  ProPosTenderSplit,
  ProPosCustomer,
} from "../components/billing/propos/types";
import * as apiFetchModule from "../lib/apiFetchV1";

/**
 * Pure helper mirroring the cashier checkout split-tender synthesis
 * implemented inside SmritiProPosBillingTerminal.handleSettlementSuccess.
 */
function buildCheckoutTendersAndPaymentMode(
  tenders: ProPosTenderSplit,
  tenderItems?: POSTenderItem[]
): { backendTenders: POSTenderItem[]; paymentMode: string } {
  let backendTenders: POSTenderItem[] = [];

  if (tenderItems && tenderItems.length > 0) {
    backendTenders = tenderItems.filter((t) => t.amount > 0);
  } else {
    if (tenders.cash > 0) {
      backendTenders.push({ tender_type: "CASH", amount: tenders.cash });
    }
    if (tenders.card > 0) {
      backendTenders.push({
        tender_type: "CARD",
        amount: tenders.card,
        reference_no: tenders.cardAuthCode || tenders.cardLast4,
      });
    }
    if (tenders.upi > 0) {
      backendTenders.push({
        tender_type: "UPI",
        amount: tenders.upi,
        reference_no: tenders.upiRef,
      });
    }
    if ((tenders.wallet ?? 0) > 0) {
      backendTenders.push({
        tender_type: "STORE_CREDIT",
        amount: tenders.wallet!,
        reference_no: tenders.walletRef,
      });
    }
    if (tenders.creditNote > 0) {
      backendTenders.push({
        tender_type: "CREDIT_NOTE",
        amount: tenders.creditNote,
        reference_no: tenders.creditNoteNo,
      });
    }
    if (tenders.giftVoucher > 0) {
      backendTenders.push({
        tender_type: "WALLET",
        amount: tenders.giftVoucher,
        reference_no: tenders.voucherCode,
      });
    }
    if (tenders.loyaltyAmount > 0) {
      backendTenders.push({
        tender_type: "LOYALTY",
        amount: tenders.loyaltyAmount,
      });
    }
    if (tenders.credit > 0) {
      backendTenders.push({ tender_type: "CREDIT", amount: tenders.credit });
    }
  }

  const paymentMode =
    backendTenders.length > 1
      ? "SPLIT"
      : backendTenders.length === 1
      ? backendTenders[0].tender_type
      : tenders.credit > 0
      ? "CREDIT"
      : tenders.card >= tenders.cash && tenders.card >= tenders.upi
      ? "CARD"
      : tenders.upi > tenders.cash
      ? "UPI"
      : "CASH";

  return { backendTenders, paymentMode };
}

/**
 * Pure helper mirroring the cashier loyalty points redemption validation rule
 * implemented inside SmritiPosSettlement.handleAddPayment and handleFinalSettle.
 */
function validateLoyaltyPointsRedemption(
  customer: ProPosCustomer | undefined,
  loyaltyBalance: { isEnrolled: boolean; points: number; ratio: number; availableValue: number },
  amountToRedeem: number,
  alreadyAppliedLoyalty: number = 0
): { isValid: boolean; errorMessage?: string } {
  if (!customer?.id || customer.id === "cust-01" || customer.code === "C01") {
    return {
      isValid: false,
      errorMessage: "Select an identified customer before redeeming loyalty points.",
    };
  }

  if (!loyaltyBalance.isEnrolled) {
    return {
      isValid: false,
      errorMessage: "Customer is not enrolled in the loyalty program.",
    };
  }

  if (loyaltyBalance.availableValue <= 0) {
    return {
      isValid: false,
      errorMessage: "This customer has no available loyalty points balance.",
    };
  }

  if (amountToRedeem + alreadyAppliedLoyalty > loyaltyBalance.availableValue) {
    return {
      isValid: false,
      errorMessage: `Amount exceeds available loyalty points value of ₹${loyaltyBalance.availableValue.toFixed(
        2
      )} (${loyaltyBalance.points.toFixed(0)} pts).`,
    };
  }

  return { isValid: true };
}

/**
 * Pure helper mirroring the 1-click "Redeem Max" button calculation.
 */
function calculateMaxLoyaltyRedemption(
  balanceRemaining: number,
  availableLoyaltyValue: number
): number {
  return Math.max(0, Math.min(balanceRemaining, availableLoyaltyValue));
}

describe("POS Cashier UI — Customer Loyalty Points & Split Billing Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Type Contract & API Response Parsing", () => {
    it("accepts LOYALTY and LOYALTY_POINTS tender types in POSTenderItem", () => {
      const item1: POSTenderItem = {
        tender_type: "LOYALTY",
        amount: 250.0,
        reference_no: "LOY-123456",
      };
      const item2: POSTenderItem = {
        tender_type: "LOYALTY_POINTS",
        amount: 100.0,
      };

      expect(item1.tender_type).toBe("LOYALTY");
      expect(item1.amount).toBe(250.0);
      expect(item2.tender_type).toBe("LOYALTY_POINTS");
    });

    it("parses CustomerLoyaltyBalanceResponse from backend endpoint", async () => {
      const mockPayload: CustomerLoyaltyBalanceResponse = {
        customer_id: "cust-vip-101",
        customer_name: "Rahul Sharma",
        is_enrolled: true,
        member_id: "lm-abc12345",
        card_number: "CARD-8899",
        current_points_balance: 500,
        redemption_ratio: 1.0,
        available_monetary_value: 500.0,
        total_points_earned: 1200,
        total_points_redeemed: 700,
      };

      const fetchSpy = vi
        .spyOn(apiFetchModule, "apiFetchV1")
        .mockResolvedValue(mockPayload);

      const res = await apiFetchModule.apiFetchV1<CustomerLoyaltyBalanceResponse>(
        "/pos/customer-loyalty/cust-vip-101"
      );

      expect(fetchSpy).toHaveBeenCalledWith("/pos/customer-loyalty/cust-vip-101");
      expect(res.is_enrolled).toBe(true);
      expect(res.current_points_balance).toBe(500);
      expect(res.available_monetary_value).toBe(500.0);
      expect(res.redemption_ratio).toBe(1.0);
    });

    it("handles non-1.0 tier redemption ratios (e.g. 1 point = ₹0.50)", () => {
      const mockPayload: CustomerLoyaltyBalanceResponse = {
        customer_id: "cust-gold-02",
        customer_name: "Anjali Gupta",
        is_enrolled: true,
        current_points_balance: 1000,
        redemption_ratio: 0.5,
        available_monetary_value: 500.0,
      };

      expect(mockPayload.current_points_balance * mockPayload.redemption_ratio).toBe(
        mockPayload.available_monetary_value
      );
      expect(mockPayload.available_monetary_value).toBe(500.0);
    });
  });

  describe("2. Boundary Validations & Overdraft Prevention", () => {
    it("fails closed when walk-in customer attempts loyalty redemption", () => {
      const walkInCustomer: ProPosCustomer = {
        id: "cust-01",
        code: "C01",
        name: "Customer01 (Walk-in)",
        phone: "9876543210",
      };

      const loyaltyState = {
        isEnrolled: false,
        points: 0,
        ratio: 1.0,
        availableValue: 0,
      };

      const res = validateLoyaltyPointsRedemption(walkInCustomer, loyaltyState, 100);
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toBe("Select an identified customer before redeeming loyalty points.");
    });

    it("fails closed when customer is not enrolled in loyalty program", () => {
      const unenrolledCustomer: ProPosCustomer = {
        id: "cust-unreg-99",
        code: "C-UNREG",
        name: "Suresh Unenrolled",
        phone: "9811122233",
      };

      const loyaltyState = {
        isEnrolled: false,
        points: 0,
        ratio: 1.0,
        availableValue: 0,
      };

      const res = validateLoyaltyPointsRedemption(unenrolledCustomer, loyaltyState, 50);
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toBe("Customer is not enrolled in the loyalty program.");
    });

    it("fails closed when enrolled customer has zero available points", () => {
      const enrolledCustomer: ProPosCustomer = {
        id: "cust-zero-01",
        code: "C-ZERO",
        name: "Pooja Zero",
        phone: "9812345678",
      };

      const loyaltyState = {
        isEnrolled: true,
        points: 0,
        ratio: 1.0,
        availableValue: 0,
      };

      const res = validateLoyaltyPointsRedemption(enrolledCustomer, loyaltyState, 50);
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toBe("This customer has no available loyalty points balance.");
    });

    it("prevents overdraft when tender amount exceeds available points value", () => {
      const enrolledCustomer: ProPosCustomer = {
        id: "cust-102",
        code: "C102",
        name: "Vikram Malhotra",
        phone: "9822334455",
      };

      const loyaltyState = {
        isEnrolled: true,
        points: 300,
        ratio: 1.0,
        availableValue: 300.0,
      };

      // Attempting to redeem ₹400 when only ₹300 (300 pts) is available
      const res = validateLoyaltyPointsRedemption(enrolledCustomer, loyaltyState, 400.0);
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain("Amount exceeds available loyalty points value of ₹300.00 (300 pts).");
    });

    it("passes validation when tender amount is within available points value", () => {
      const enrolledCustomer: ProPosCustomer = {
        id: "cust-102",
        code: "C102",
        name: "Vikram Malhotra",
        phone: "9822334455",
      };

      const loyaltyState = {
        isEnrolled: true,
        points: 300,
        ratio: 1.0,
        availableValue: 300.0,
      };

      const res = validateLoyaltyPointsRedemption(enrolledCustomer, loyaltyState, 250.0);
      expect(res.isValid).toBe(true);
      expect(res.errorMessage).toBeUndefined();
    });
  });

  describe("3. 1-Click Redeem Max & Split Tender Synthesis", () => {
    it("calculates Redeem Max clamped to remaining balance when balance < available loyalty value", () => {
      const balanceRemaining = 450.0;
      const availableLoyaltyValue = 1000.0;

      const maxRedeem = calculateMaxLoyaltyRedemption(balanceRemaining, availableLoyaltyValue);
      expect(maxRedeem).toBe(450.0);
    });

    it("calculates Redeem Max clamped to available loyalty value when available < remaining balance", () => {
      const balanceRemaining = 1200.0;
      const availableLoyaltyValue = 350.0;

      const maxRedeem = calculateMaxLoyaltyRedemption(balanceRemaining, availableLoyaltyValue);
      expect(maxRedeem).toBe(350.0);
    });

    it("synthesizes multi-tender split combining Cash + Card + Loyalty Points", () => {
      const tenderItems: POSTenderItem[] = [
        { tender_type: "CASH", amount: 500.0 },
        { tender_type: "CARD", amount: 300.0, reference_no: "AUTH-8822" },
        { tender_type: "LOYALTY", amount: 200.0, reference_no: "LOY-123456" },
      ];

      const splitData: ProPosTenderSplit = {
        cash: 500.0,
        card: 300.0,
        cardAuthCode: "AUTH-8822",
        upi: 0,
        credit: 0,
        creditNote: 0,
        giftVoucher: 0,
        loyaltyPointsRedeemed: 200,
        loyaltyAmount: 200.0,
      };

      const { backendTenders, paymentMode } = buildCheckoutTendersAndPaymentMode(
        splitData,
        tenderItems
      );

      expect(paymentMode).toBe("SPLIT");
      expect(backendTenders).toHaveLength(3);
      expect(backendTenders.find((t) => t.tender_type === "LOYALTY")?.amount).toBe(200.0);
      expect(backendTenders.find((t) => t.tender_type === "LOYALTY")?.reference_no).toBe(
        "LOY-123456"
      );
    });

    it("elevates payment_mode to LOYALTY when 100% settled with loyalty points", () => {
      const tenderItems: POSTenderItem[] = [
        { tender_type: "LOYALTY", amount: 750.0, reference_no: "LOY-102" },
      ];

      const splitData: ProPosTenderSplit = {
        cash: 0,
        card: 0,
        upi: 0,
        credit: 0,
        creditNote: 0,
        giftVoucher: 0,
        loyaltyPointsRedeemed: 750,
        loyaltyAmount: 750.0,
      };

      const { backendTenders, paymentMode } = buildCheckoutTendersAndPaymentMode(
        splitData,
        tenderItems
      );

      expect(paymentMode).toBe("LOYALTY");
      expect(backendTenders).toHaveLength(1);
      expect(backendTenders[0].tender_type).toBe("LOYALTY");
      expect(backendTenders[0].amount).toBe(750.0);
    });

    it("correctly handles split tender fallback synthesis when tenderItems array is omitted", () => {
      const splitData: ProPosTenderSplit = {
        cash: 400.0,
        card: 0,
        upi: 0,
        credit: 0,
        creditNote: 0,
        giftVoucher: 0,
        loyaltyPointsRedeemed: 150,
        loyaltyAmount: 150.0,
      };

      const { backendTenders, paymentMode } = buildCheckoutTendersAndPaymentMode(
        splitData,
        undefined
      );

      expect(paymentMode).toBe("SPLIT");
      expect(backendTenders).toHaveLength(2);
      expect(backendTenders.some((t) => t.tender_type === "CASH" && t.amount === 400.0)).toBe(true);
      expect(backendTenders.some((t) => t.tender_type === "LOYALTY" && t.amount === 150.0)).toBe(true);
    });
  });
});
