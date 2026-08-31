/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.114.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import GiftVoucherEngine from "../utils/giftVoucherEngine";

describe("GiftVoucherEngine — Gift Voucher & Store Credit Engine", () => {

  const BASE = { issuedBy: "MGR-001", branchCode: "BR-MUM-01" };

  // ─── Test 1: Issue & full redemption ──────────────────────────────────────
  it("issues a GIFT_VOUCHER and fully redeems it — status transitions to REDEEMED", () => {
    const v = GiftVoucherEngine.issueVoucher({ ...BASE, type: "GIFT_VOUCHER", amount: 1000 });
    expect(v.balance).toBe(1000);
    expect(v.status).toBe("ACTIVE");
    expect(v.ledger).toHaveLength(1);
    expect(v.ledger[0].kind).toBe("ISSUE");

    const { voucher: redeemed, redeemedAmt, remainingAmt, fullySettled } =
      GiftVoucherEngine.redeemVoucher(v, 1000, "CASHIER-001", "INV-0081");
    expect(redeemedAmt).toBe(1000);
    expect(remainingAmt).toBe(0);
    expect(fullySettled).toBe(true);
    expect(redeemed.status).toBe("REDEEMED");
    expect(redeemed.balance).toBe(0);
    expect(redeemed.ledger).toHaveLength(2);
    expect(redeemed.ledger[1].kind).toBe("REDEEM");
  });

  // ─── Test 2: Partial redemption & balance clamping ────────────────────────
  it("partially redeems — balance clamps when requested > balance", () => {
    const v = GiftVoucherEngine.issueVoucher({ ...BASE, type: "STORE_CREDIT", amount: 500 });

    // Redeem 300 — partially
    const { voucher: v2, redeemedAmt: r1 } = GiftVoucherEngine.redeemVoucher(v, 300, "CASHIER-001");
    expect(r1).toBe(300);
    expect(v2.balance).toBe(200);
    expect(v2.status).toBe("PARTIALLY_REDEEMED");

    // Try to redeem 300 but only 200 left — clamped to 200
    const { voucher: v3, redeemedAmt: r2, fullySettled } = GiftVoucherEngine.redeemVoucher(v2, 300, "CASHIER-001");
    expect(r2).toBe(200);
    expect(fullySettled).toBe(false);     // 300 requested but only 200 given
    expect(v3.status).toBe("REDEEMED");
    expect(v3.ledger).toHaveLength(3);    // ISSUE + 2 REDEEM
  });

  // ─── Test 3: Refund to credit & expiry ────────────────────────────────────
  it("converts refund to REFUND_CREDIT voucher; expireIfDue marks EXPIRED past expiresAt", () => {
    const credit = GiftVoucherEngine.refundToCredit({
      refundAmt:  750, customerId: "CUST-042",
      performedBy: "MGR-001", branchCode: "BR-MUM-01",
      saleRefNo: "SALE-0091", validDays: 180,
    });
    expect(credit.type).toBe("REFUND_CREDIT");
    expect(credit.balance).toBe(750);
    expect(credit.issuedTo).toBe("CUST-042");
    expect(credit.multiUse).toBe(true);
    expect(credit.ledger[0].note).toContain("SALE-0091");

    // Expire: set expiresAt in the past
    const expired = { ...credit, expiresAt: "2020-01-01T00:00:00.000Z" };
    const afterExpiry = GiftVoucherEngine.expireIfDue(expired, new Date("2026-08-28T00:00:00.000Z"));
    expect(afterExpiry.status).toBe("EXPIRED");
    expect(afterExpiry.ledger.at(-1)!.kind).toBe("EXPIRE");

    // Idempotent — calling again doesn't add another entry
    const again = GiftVoucherEngine.expireIfDue(afterExpiry, new Date("2026-08-28T00:00:00.000Z"));
    expect(again.ledger).toHaveLength(afterExpiry.ledger.length);
  });

  // ─── Test 4: Adjust + portfolio summary ───────────────────────────────────
  it("adjust() top-ups balance; portfolioSummary aggregates correctly across vouchers", () => {
    const v1 = GiftVoucherEngine.issueVoucher({ ...BASE, type: "GIFT_VOUCHER",  amount: 2000 });
    const v2 = GiftVoucherEngine.issueVoucher({ ...BASE, type: "STORE_CREDIT",  amount: 500  });
    const v3 = GiftVoucherEngine.issueVoucher({ ...BASE, type: "PROMO_CREDIT",  amount: 200  });

    const v1Adjusted = GiftVoucherEngine.adjust(v1, 500, "MGR-001", "Top-up campaign");
    expect(v1Adjusted.balance).toBe(2500);
    expect(v1Adjusted.ledger.at(-1)!.kind).toBe("ADJUST");
    expect(v1Adjusted.ledger.at(-1)!.balanceAfter).toBe(2500);

    const summary = GiftVoucherEngine.portfolioSummary([v1Adjusted, v2, v3]);
    expect(summary.totalIssued).toBe(2700);    // 2000 + 500 + 200
    expect(summary.totalBalance).toBe(3200);   // 2500 + 500 + 200
    expect(summary.totalRedeemed).toBe(-500);  // issued < balance due to top-up — negative OK
    expect(summary.byStatus["ACTIVE"]).toBe(3);
    expect(summary.byType["GIFT_VOUCHER"]).toBe(2500);
  });
});
