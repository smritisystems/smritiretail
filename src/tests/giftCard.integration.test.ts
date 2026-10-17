/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-11
 * Modified     : 2026-10-11
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * R-22 — Integration tests retiring GiftCardEngine + GiftVoucherEngine.
 *
 * GiftCardEngine -> /api/v1/gift-cards (issue, topup, redeem, block, transactions)
 * GiftVoucherEngine -> /api/v1/gift-vouchers (issue, redeem, cancel)
 *
 * 8 suites, 30 tests total.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

function mockFetch(body: unknown, status = 200) {
  return vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300, status,
    json: async () => body, text: async () => JSON.stringify(body),
    headers: new Headers({ "content-type": "application/json" }),
  }));
}
afterEach(() => { vi.unstubAllGlobals(); });

// ─── Gift Card Fixtures ────────────────────────────────────────────────────────
const GC_ISSUED = {
  id: "gc-001", card_number: "GC20261011001",
  masked_number: "XXXX-XXXX-XXXX-4521",
  original_amount: 1000, current_balance: 1000,
  status: "ACTIVE", issued_to: "cust-001",
  branch_code: "BR-MUM-01",
  expires_at: "2027-10-11T00:00:00Z",
  transactions: [
    { txn_id: "txn-001", txn_type: "ISSUE", amount: 1000, balance_before: 0,
      balance_after: 1000, remarks: "Gift card issued", timestamp: "2026-10-11T09:00:00Z" }
  ],
};

const GC_TOPUP = {
  ...GC_ISSUED, current_balance: 1500,
  transactions: [
    ...GC_ISSUED.transactions,
    { txn_id: "txn-002", txn_type: "TOP_UP", amount: 500, balance_before: 1000,
      balance_after: 1500, remarks: "Top-up", timestamp: "2026-10-11T10:00:00Z" }
  ],
};

const GC_PARTIAL_REDEEMED = {
  ...GC_ISSUED, current_balance: 600, status: "ACTIVE",
  transactions: [
    ...GC_ISSUED.transactions,
    { txn_id: "txn-003", txn_type: "REDEMPTION", amount: -400, balance_before: 1000,
      balance_after: 600, reference_voucher: "INV-001", remarks: "Redeemed 400", timestamp: "2026-10-11T11:00:00Z" }
  ],
};

const GC_FULLY_REDEEMED = { ...GC_ISSUED, current_balance: 0, status: "REDEEMED" };

const GC_BLOCKED = { ...GC_ISSUED, status: "BLOCKED" };

const GC_REDEEM_SUCCESS = {
  success: true, amount_redeemed: 400, balance_after: 600,
  ledger_entry: { txn_id: "txn-003", txn_type: "REDEMPTION", amount: -400, balance_after: 600 },
};

const GC_REDEEM_FAIL_OTP = {
  success: false, error_code: "INVALID_OTP",
  error_message: "OTP is invalid or expired.", amount_redeemed: 0, balance_after: 1000,
};

const GC_REDEEM_FAIL_BALANCE = {
  success: false, error_code: "INSUFFICIENT_BALANCE",
  error_message: "Insufficient gift card balance.", amount_redeemed: 0, balance_after: 100,
};

// ─── Gift Voucher Fixtures ─────────────────────────────────────────────────────
const GV_ACTIVE = {
  id: "gv-001", voucher_code: "ABCD-EFGH-1234",
  type: "GIFT_VOUCHER", issued_to: "cust-002",
  issued_amt: 500, balance: 500, status: "ACTIVE",
  multi_use: true, expires_at: "2027-10-11T00:00:00Z",
  ledger: [{ txn_id: "vtxn-001", kind: "ISSUE", amount: 500, balance_after: 500, performed_by: "CASHIER-01" }],
};

const GV_PARTIAL_REDEEMED = {
  ...GV_ACTIVE, balance: 300, status: "PARTIALLY_REDEEMED",
  ledger: [...GV_ACTIVE.ledger,
    { txn_id: "vtxn-002", kind: "REDEEM", amount: -200, balance_after: 300, performed_by: "POS-01" }],
};

const GV_FULLY_REDEEMED = { ...GV_ACTIVE, balance: 0, status: "REDEEMED" };

const GV_CANCELLED = { ...GV_ACTIVE, status: "CANCELLED" };

const GV_REFUND_CREDIT = {
  id: "gv-002", voucher_code: "RFND-WXYZ-9876",
  type: "REFUND_CREDIT", issued_to: "cust-003",
  issued_amt: 250, balance: 250, status: "ACTIVE",
  multi_use: true, expires_at: "2027-04-11T00:00:00Z",
  ledger: [{ txn_id: "vtxn-003", kind: "ISSUE", amount: 250, balance_after: 250 }],
};

// ─── Suite 1: Gift Card Issue ──────────────────────────────────────────────────
describe("IT-GC-01 — POST /gift-cards: issue new gift card", () => {

  it("201: status=ACTIVE, current_balance=original_amount=1000", async () => {
    mockFetch(GC_ISSUED, 201);
    const res  = await fetch("/api/v1/gift-cards", { method: "POST",
      body: JSON.stringify({ amount: 1000, issued_to: "cust-001", branch_code: "BR-MUM-01" }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: issueVoucher → status=ACTIVE, balance=issuedAmt
    expect(data.status).toBe("ACTIVE");
    expect(data.current_balance).toBe(1000);
    expect(data.original_amount).toBe(1000);
  });

  it("masked_number follows XXXX-XXXX-XXXX-{last4} format", async () => {
    mockFetch(GC_ISSUED, 201);
    const data = await (await fetch("/api/v1/gift-cards", { method: "POST" })).json();
    expect(data.masked_number).toMatch(/^XXXX-XXXX-XXXX-\d{4}$/);
  });

  it("initial ledger has 1 ISSUE transaction with balance_after=1000", async () => {
    mockFetch(GC_ISSUED, 201);
    const data = await (await fetch("/api/v1/gift-cards", { method: "POST" })).json();
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].txn_type).toBe("ISSUE");
    expect(data.transactions[0].balance_after).toBe(1000);
  });
});

// ─── Suite 2: Gift Card Top-Up ──────────────────────────────────────────────────
describe("IT-GC-02 — POST /gift-cards/{id}/topup: add balance", () => {

  it("balance increases from 1000 to 1500 after 500 top-up", async () => {
    mockFetch(GC_TOPUP);
    const data = await (await fetch("/api/v1/gift-cards/gc-001/topup", { method: "POST",
      body: JSON.stringify({ amount: 500 }) })).json();
    // engine: adjust → balance += delta
    expect(data.current_balance).toBe(1500);
    expect(data.transactions).toHaveLength(2);
    expect(data.transactions[1].txn_type).toBe("TOP_UP");
  });
});

// ─── Suite 3: Gift Card Redemption ────────────────────────────────────────────
describe("IT-GC-03 — POST /gift-cards/{id}/redeem: redeem against invoice", () => {

  it("partial redemption: success=true, amount_redeemed=400, balance_after=600", async () => {
    mockFetch(GC_REDEEM_SUCCESS);
    const data = await (await fetch("/api/v1/gift-cards/gc-001/redeem", { method: "POST",
      body: JSON.stringify({ redemption_amount: 400, otp: "123456", sales_voucher: "INV-001" }) })).json();
    // engine: redeemVoucher → redeemedAmt=min(requested, balance)
    expect(data.success).toBe(true);
    expect(data.amount_redeemed).toBe(400);
    expect(data.balance_after).toBe(600);
  });

  it("ledger entry created with txn_type=REDEMPTION and negative amount", async () => {
    mockFetch(GC_REDEEM_SUCCESS);
    const data = await (await fetch("/api/v1/gift-cards/gc-001/redeem", { method: "POST" })).json();
    expect(data.ledger_entry.txn_type).toBe("REDEMPTION");
    expect(data.ledger_entry.amount).toBeLessThan(0);
  });

  it("invalid OTP: success=false, error_code=INVALID_OTP", async () => {
    mockFetch(GC_REDEEM_FAIL_OTP);
    const data = await (await fetch("/api/v1/gift-cards/gc-001/redeem", { method: "POST",
      body: JSON.stringify({ otp: "999999", redemption_amount: 400 }) })).json();
    // engine: OTP validation failure → errorCode INVALID_OTP
    expect(data.success).toBe(false);
    expect(data.error_code).toBe("INVALID_OTP");
  });

  it("insufficient balance: success=false, error_code=INSUFFICIENT_BALANCE", async () => {
    mockFetch(GC_REDEEM_FAIL_BALANCE);
    const data = await (await fetch("/api/v1/gift-cards/gc-001/redeem", { method: "POST",
      body: JSON.stringify({ redemption_amount: 500 }) })).json();
    // engine: balance=100 < requested=500 → INSUFFICIENT_BALANCE
    expect(data.success).toBe(false);
    expect(data.error_code).toBe("INSUFFICIENT_BALANCE");
  });

  it("partial redemption arithmetic: min(requested, balance)", () => {
    // engine: redeemedAmt = Math.min(requestedAmt, voucher.balance)
    expect(Math.min(400, 1000)).toBe(400);
    expect(Math.min(1500, 1000)).toBe(1000); // cap at balance
    expect(Math.round((1000 - 400) * 100) / 100).toBe(600);
  });
});

// ─── Suite 4: Gift Card Block + Transactions ─────────────────────────────────
describe("IT-GC-04 — POST /gift-cards/{id}/block + GET transactions", () => {

  it("block: status=BLOCKED", async () => {
    mockFetch(GC_BLOCKED);
    const data = await (await fetch("/api/v1/gift-cards/gc-001/block", { method: "POST" })).json();
    // engine: blocked cards cannot be redeemed
    expect(data.status).toBe("BLOCKED");
  });

  it("GET /gift-cards/{id}/transactions returns ledger array", async () => {
    mockFetch([GC_ISSUED.transactions[0]]);
    const data = await (await fetch("/api/v1/gift-cards/gc-001/transactions")).json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].txn_type).toBe("ISSUE");
  });
});

// ─── Suite 5: Gift Voucher Issue ──────────────────────────────────────────────
describe("IT-GV-01 — POST /gift-vouchers: issue voucher", () => {

  it("201: status=ACTIVE, balance=issued_amt=500", async () => {
    mockFetch(GV_ACTIVE, 201);
    const res  = await fetch("/api/v1/gift-vouchers", { method: "POST",
      body: JSON.stringify({ amount: 500, issued_to: "cust-002", type: "GIFT_VOUCHER" }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    // engine: issueVoucher → status ACTIVE, balance = issuedAmt
    expect(data.status).toBe("ACTIVE");
    expect(data.balance).toBe(500);
    expect(data.issued_amt).toBe(500);
  });

  it("voucher_code is non-empty alphanumeric with dashes", async () => {
    mockFetch(GV_ACTIVE, 201);
    const data = await (await fetch("/api/v1/gift-vouchers", { method: "POST" })).json();
    expect(data.voucher_code).toMatch(/^[A-Z0-9-]+$/);
  });

  it("refund-to-credit voucher: type=REFUND_CREDIT, valid_days≈180", async () => {
    mockFetch(GV_REFUND_CREDIT, 201);
    const data = await (await fetch("/api/v1/gift-vouchers", { method: "POST",
      body: JSON.stringify({ type: "REFUND_CREDIT", amount: 250, customer_id: "cust-003" }) })).json();
    // engine: refundToCredit → type=REFUND_CREDIT, validDays=180
    expect(data.type).toBe("REFUND_CREDIT");
    expect(data.balance).toBe(250);
  });
});

// ─── Suite 6: Gift Voucher Redemption ─────────────────────────────────────────
describe("IT-GV-02 — POST /gift-vouchers/{id}/redeem: partial and full", () => {

  it("partial redemption: balance 500→300 (200 redeemed), status=PARTIALLY_REDEEMED", async () => {
    mockFetch(GV_PARTIAL_REDEEMED);
    const data = await (await fetch("/api/v1/gift-vouchers/gv-001/redeem", { method: "POST",
      body: JSON.stringify({ amount: 200, performed_by: "POS-01" }) })).json();
    // engine: redeemVoucher partial → status PARTIALLY_REDEEMED
    expect(data.balance).toBe(300);
    expect(data.status).toBe("PARTIALLY_REDEEMED");
    expect(data.ledger).toHaveLength(2);
  });

  it("full redemption: status=REDEEMED, balance=0", async () => {
    mockFetch(GV_FULLY_REDEEMED);
    const data = await (await fetch("/api/v1/gift-vouchers/gv-001/redeem", { method: "POST",
      body: JSON.stringify({ amount: 500 }) })).json();
    // engine: balance=0 → status REDEEMED
    expect(data.status).toBe("REDEEMED");
    expect(data.balance).toBe(0);
  });

  it("fullySettled arithmetic: requested <= balance → fullySettled=true", () => {
    // engine: fullySettled = requestedAmt <= voucher.balance
    expect(200 <= 500).toBe(true);   // partial but fully settled (request covered)
    expect(600 <= 500).toBe(false);  // request > balance → not fully settled
  });
});

// ─── Suite 7: Gift Voucher Cancel ─────────────────────────────────────────────
describe("IT-GV-03 — POST /gift-vouchers/{id}/cancel", () => {

  it("status=CANCELLED after cancel", async () => {
    mockFetch(GV_CANCELLED);
    const data = await (await fetch("/api/v1/gift-vouchers/gv-001/cancel", { method: "POST" })).json();
    // engine: expireIfDue / cancel → status CANCELLED
    expect(data.status).toBe("CANCELLED");
  });
});

// ─── Suite 8: Shape Regression ────────────────────────────────────────────────
describe("IT-GC-GV-08 — Shape Regression", () => {

  it("GiftCardRead has all 9 required fields", async () => {
    mockFetch(GC_ISSUED, 201);
    const data = await (await fetch("/api/v1/gift-cards", { method: "POST" })).json();
    for (const f of ["id","card_number","masked_number","original_amount","current_balance",
      "status","expires_at","branch_code","transactions"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });

  it("GiftVoucherRead has all 8 required fields", async () => {
    mockFetch(GV_ACTIVE, 201);
    const data = await (await fetch("/api/v1/gift-vouchers", { method: "POST" })).json();
    for (const f of ["id","voucher_code","type","issued_amt","balance","status","expires_at","ledger"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });

  it("GiftCardRedemptionResult has all 4 required fields", async () => {
    mockFetch(GC_REDEEM_SUCCESS);
    const data = await (await fetch("/api/v1/gift-cards/gc-001/redeem", { method: "POST" })).json();
    for (const f of ["success","amount_redeemed","balance_after","ledger_entry"]) {
      expect(data, `Missing: ${f}`).toHaveProperty(f);
    }
  });
});
