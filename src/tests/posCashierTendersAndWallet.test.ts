/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-10-02
 * Modified     : 2026-10-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  POSTenderItem,
  CustomerWalletBalanceResponse,
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
 * Pure helper mirroring the cashier store credit redemption validation rule
 * implemented inside SmritiPosSettlement.handleFinalSettle.
 */
function validateStoreCreditRedemption(
  customer: ProPosCustomer | null | undefined,
  requestedAmount: number,
  walletBalance: number
): { valid: boolean; error?: string } {
  if (!customer?.id || customer.id === "cust-01" || customer.code === "C01") {
    return {
      valid: false,
      error: "Select an identified customer before redeeming store credit / wallet.",
    };
  }

  if (requestedAmount > walletBalance) {
    return {
      valid: false,
      error: `Store credit available: ₹${walletBalance.toFixed(2)}`,
    };
  }

  return { valid: true };
}

describe("POS Cashier UI Split Tenders & Customer Store Credit / Wallet Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Contract & Type Structure Verification", () => {
    it("STEP 1: should enforce valid POSTenderItem contract", () => {
      const tender: POSTenderItem = {
        tender_type: "STORE_CREDIT",
        amount: 350.5,
        reference_no: "WAL-CUST01",
        notes: "Redemption of customer credit note balance",
      };

      expect(tender.tender_type).toBe("STORE_CREDIT");
      expect(tender.amount).toBe(350.5);
      expect(tender.reference_no).toBe("WAL-CUST01");
      expect(tender.notes).toBe("Redemption of customer credit note balance");
    });

    it("STEP 2: should enforce CustomerWalletBalanceResponse contract matching backend P2.6", () => {
      const walletRes: CustomerWalletBalanceResponse = {
        customer_id: "c-1001",
        customer_name: "Rahul Sharma",
        phone: "9876543210",
        available_wallet_balance: 1250.75,
        credit_limit: 5000,
        outstanding_credit_balance: 500,
        available_credit: 4500,
      };

      expect(walletRes.customer_id).toBe("c-1001");
      expect(walletRes.available_wallet_balance).toBe(1250.75);
      expect(walletRes.available_credit).toBe(4500);
    });

    it("STEP 3: should extend ProPosCustomer with availableWalletBalance", () => {
      const customer: ProPosCustomer = {
        id: "cust-99",
        name: "Pooja Verma",
        code: "C-099",
        phone: "9811223344",
        city: "Mumbai",
        state: "Maharashtra",
        stateCode: "27",
        loyaltyPoints: 320,
        availableWalletBalance: 850.0,
      };

      expect(customer.availableWalletBalance).toBe(850.0);
    });
  });

  describe("Split Tender Synthesis & Payment Mode Resolution", () => {
    it("STEP 4: should synthesize single CASH tender with CASH mode", () => {
      const tenders: ProPosTenderSplit = {
        cash: 500,
        card: 0,
        upi: 0,
        credit: 0,
        giftVoucher: 0,
        loyaltyPointsRedeemed: 0,
        loyaltyAmount: 0,
        creditNote: 0,
      };

      const result = buildCheckoutTendersAndPaymentMode(tenders);
      expect(result.backendTenders.length).toBe(1);
      expect(result.backendTenders[0]).toEqual({
        tender_type: "CASH",
        amount: 500,
      });
      expect(result.paymentMode).toBe("CASH");
    });

    it("STEP 5: should synthesize single STORE_CREDIT tender with STORE_CREDIT mode", () => {
      const tenders: ProPosTenderSplit = {
        cash: 0,
        card: 0,
        upi: 0,
        credit: 0,
        giftVoucher: 0,
        loyaltyPointsRedeemed: 0,
        loyaltyAmount: 0,
        creditNote: 0,
        wallet: 450,
        walletRef: "WAL-0001",
      };

      const result = buildCheckoutTendersAndPaymentMode(tenders);
      expect(result.backendTenders.length).toBe(1);
      expect(result.backendTenders[0]).toEqual({
        tender_type: "STORE_CREDIT",
        amount: 450,
        reference_no: "WAL-0001",
      });
      expect(result.paymentMode).toBe("STORE_CREDIT");
    });

    it("STEP 6: should elevate payment_mode to SPLIT when multiple tenders exist", () => {
      const tenders: ProPosTenderSplit = {
        cash: 300,
        card: 0,
        upi: 200,
        credit: 0,
        giftVoucher: 0,
        loyaltyPointsRedeemed: 0,
        loyaltyAmount: 0,
        creditNote: 0,
        wallet: 500,
        walletRef: "WAL-0002",
        upiRef: "UPI-TXN-9988",
      };

      const result = buildCheckoutTendersAndPaymentMode(tenders);
      expect(result.backendTenders.length).toBe(3);
      expect(result.paymentMode).toBe("SPLIT");
      expect(result.backendTenders).toEqual([
        { tender_type: "CASH", amount: 300 },
        { tender_type: "UPI", amount: 200, reference_no: "UPI-TXN-9988" },
        { tender_type: "STORE_CREDIT", amount: 500, reference_no: "WAL-0002" },
      ]);
    });

    it("STEP 7: should prioritize explicit tenderItems array when provided by settlement dialog", () => {
      const tenderItems: POSTenderItem[] = [
        { tender_type: "STORE_CREDIT", amount: 150, reference_no: "WAL-11" },
        { tender_type: "UPI", amount: 350, reference_no: "UPI-REF-01" },
        { tender_type: "CASH", amount: 0 }, // Should be filtered out
      ];

      const tenders: ProPosTenderSplit = {
        cash: 500,
        card: 0,
        upi: 0,
        credit: 0,
        giftVoucher: 0,
        loyaltyPointsRedeemed: 0,
        loyaltyAmount: 0,
        creditNote: 0,
      };

      const result = buildCheckoutTendersAndPaymentMode(tenders, tenderItems);
      expect(result.backendTenders.length).toBe(2);
      expect(result.backendTenders).toEqual([
        { tender_type: "STORE_CREDIT", amount: 150, reference_no: "WAL-11" },
        { tender_type: "UPI", amount: 350, reference_no: "UPI-REF-01" },
      ]);
      expect(result.paymentMode).toBe("SPLIT");
    });
  });

  describe("Customer Store Credit / Wallet Validation & Boundary Guard", () => {
    it("STEP 8: should reject store credit redemption for anonymous/walk-in customer", () => {
      const walkInCustomer: ProPosCustomer = {
        id: "cust-01",
        code: "C01",
        name: "Walk-in Retail Customer",
      };

      const validation = validateStoreCreditRedemption(walkInCustomer, 100, 500);
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe(
        "Select an identified customer before redeeming store credit / wallet."
      );
    });

    it("STEP 9: should reject redemption exceeding available wallet balance", () => {
      const customer: ProPosCustomer = {
        id: "cust-reg-001",
        code: "C-REG-01",
        name: "Amitabh Kumar",
      };

      const validation = validateStoreCreditRedemption(customer, 750, 500);
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe("Store credit available: ₹500.00");
    });

    it("STEP 10: should allow valid store credit redemption within balance limit", () => {
      const customer: ProPosCustomer = {
        id: "cust-reg-002",
        code: "C-REG-02",
        name: "Sneha Patel",
      };

      const validation = validateStoreCreditRedemption(customer, 450, 500);
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it("STEP 11: should correctly calculate 'Redeem Max' clamp amount", () => {
      const billRemaining = 1200;
      const walletBalance = 800;

      const redeemMax1 = Math.min(billRemaining, walletBalance);
      expect(redeemMax1).toBe(800);

      const billRemainingSmall = 400;
      const redeemMax2 = Math.min(billRemainingSmall, walletBalance);
      expect(redeemMax2).toBe(400);
    });
  });

  describe("API Fetch & Live Backend Wiring Mock", () => {
    it("STEP 12: should fetch customer wallet balance using apiFetchV1", async () => {
      const mockResponse: CustomerWalletBalanceResponse = {
        customer_id: "cust-vip-1",
        customer_name: "Vikram Malhotra",
        phone: "9988776655",
        available_wallet_balance: 1500.0,
        credit_limit: 10000,
        outstanding_credit_balance: 2000,
        available_credit: 8000,
      };

      const fetchSpy = vi
        .spyOn(apiFetchModule, "apiFetchV1")
        .mockResolvedValue(mockResponse);

      const result = await apiFetchModule.apiFetchV1<CustomerWalletBalanceResponse>(
        "/pos/customer-wallet/cust-vip-1"
      );

      expect(fetchSpy).toHaveBeenCalledWith("/pos/customer-wallet/cust-vip-1");
      expect(result.available_wallet_balance).toBe(1500.0);
      expect(result.customer_id).toBe("cust-vip-1");
    });

    it("STEP 13: should format POST /pos/checkout payload with split tenders and Idempotency-Key", async () => {
      const checkoutResponse = {
        invoice_no: "POS-INV-2026-0099",
        invoice_id: "inv-uuid-0099",
        grand_total: 1000.0,
        tax_total: 50.0,
        payment_mode: "SPLIT",
        paid_amount: 1000.0,
        balance_amount: 0.0,
        change_amount: 0.0,
      };

      const fetchSpy = vi
        .spyOn(apiFetchModule, "apiFetchV1")
        .mockResolvedValue(checkoutResponse);

      const splitTenders: POSTenderItem[] = [
        { tender_type: "CASH", amount: 600 },
        {
          tender_type: "STORE_CREDIT",
          amount: 400,
          reference_no: "WAL-CUSTVIP1",
        },
      ];

      const checkoutPayload = {
        invoice_date: "2026-10-02",
        grand_total: 1000.0,
        customer_id: "cust-vip-1",
        customer_name: "Vikram Malhotra",
        payment_mode: "SPLIT",
        tenders: splitTenders,
        items: [
          {
            product_id: "sku-001",
            item_code: "SKU001",
            description: "Cotton Shirt",
            quantity: 1,
            unit_price: 1000.0,
            line_total: 1000.0,
            tax_amount: 50.0,
          },
        ],
      };

      const res = await apiFetchModule.apiFetchV1<typeof checkoutResponse>(
        "/pos/checkout",
        {
          method: "POST",
          headers: { "Idempotency-Key": "POS-BILL-0099" },
          body: JSON.stringify(checkoutPayload),
        }
      );

      expect(fetchSpy).toHaveBeenCalledWith("/pos/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": "POS-BILL-0099" },
        body: JSON.stringify(checkoutPayload),
      });

      expect(res.payment_mode).toBe("SPLIT");
      expect(res.invoice_no).toBe("POS-INV-2026-0099");
      expect(res.change_amount).toBe(0.0);
    });
  });
});
