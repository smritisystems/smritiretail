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

/**
 * Gift Voucher & Store Credit Engine
 *
 * Manages the full lifecycle of gift vouchers and store credit accounts:
 *   Issuance    : `issueVoucher()` — amount, expiry, single/multi-use
 *   Redemption  : `redeemVoucher()` — partial redemption supported; clamps to balance
 *   Refund      : `refundToCredit()` — converts a sales refund into store credit
 *   Expiry      : `expireIfDue()` / `expireBatch()` — idempotent expiry
 *   Ledger      : append-only transaction ledger per voucher
 *   Balance     : derived on every mutation; never stored separately
 */

export type VoucherType    = "GIFT_VOUCHER" | "STORE_CREDIT" | "REFUND_CREDIT" | "PROMO_CREDIT";
export type VoucherStatus  = "ACTIVE" | "REDEEMED" | "PARTIALLY_REDEEMED" | "EXPIRED" | "CANCELLED";
export type TxnKind        = "ISSUE" | "REDEEM" | "REFUND_CREDIT" | "EXPIRE" | "CANCEL" | "ADJUST";

export interface VoucherTxn {
  txnId:       string;
  kind:        TxnKind;
  amount:      number;   // Positive = credit, Negative = debit
  balanceAfter: number;
  performedBy:  string;
  refNo?:       string;
  timestamp:    string;
  note?:        string;
}

export interface GiftVoucher {
  voucherId:   string;
  voucherCode: string;
  type:        VoucherType;
  issuedTo?:   string;   // Customer ID or name
  issuedAmt:   number;
  balance:     number;
  status:      VoucherStatus;
  multiUse:    boolean;  // false = single redemption
  expiresAt:   string;
  issuedAt:    string;
  issuedBy:    string;
  branchCode:  string;
  ledger:      VoucherTxn[];
  updatedAt:   string;
}

export interface RedemptionResult {
  voucher:      GiftVoucher;
  redeemedAmt:  number;   // Actual amount deducted (may be < requested if balance short)
  remainingAmt: number;   // balance after redemption
  fullySettled: boolean;  // true if requested amount fully covered by voucher
}

export class GiftVoucherEngine {
  private static counter   = 1;
  private static txnCounter = 1;
  private static code() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 12 }, (_, i) =>
      i > 0 && i % 4 === 0 ? "-" + chars[Math.floor(Math.random() * chars.length)]
      : chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  }
  private static txnId = () => `VTXN-${this.txnCounter++}`;

  /** Issue a new gift voucher or store credit */
  public static issueVoucher(params: {
    type:        VoucherType;
    amount:      number;
    issuedBy:    string;
    branchCode:  string;
    issuedTo?:   string;
    multiUse?:   boolean;
    validDays?:  number;   // Default 365
    refNo?:      string;
    note?:       string;
  }): GiftVoucher {
    const now      = new Date().toISOString();
    const validDays = params.validDays ?? 365;
    const expiresAt = new Date(Date.now() + validDays * 86400000).toISOString();
    const voucherId = `VCHR-${this.counter++}`;
    const voucherCode = this.code();

    const txn: VoucherTxn = {
      txnId: this.txnId(), kind: "ISSUE", amount: params.amount,
      balanceAfter: params.amount, performedBy: params.issuedBy,
      refNo: params.refNo, timestamp: now, note: params.note ?? `Issued — ${params.type}`,
    };

    return {
      voucherId, voucherCode,
      type:      params.type,
      issuedTo:  params.issuedTo,
      issuedAmt: params.amount,
      balance:   params.amount,
      status:    "ACTIVE",
      multiUse:  params.multiUse ?? true,
      expiresAt,
      issuedAt:  now,
      issuedBy:  params.issuedBy,
      branchCode: params.branchCode,
      ledger:    [txn],
      updatedAt: now,
    };
  }

  /** Redeem voucher — partial redemption supported */
  public static redeemVoucher(
    voucher: GiftVoucher,
    requestedAmt: number,
    performedBy: string,
    refNo?: string,
    asOf: Date = new Date()
  ): RedemptionResult {
    if (voucher.status === "EXPIRED" || voucher.status === "CANCELLED" || voucher.status === "REDEEMED") {
      throw new Error(`Voucher ${voucher.voucherCode} is ${voucher.status} — cannot redeem.`);
    }
    if (new Date(voucher.expiresAt) < asOf) {
      throw new Error(`Voucher ${voucher.voucherCode} has expired.`);
    }
    if (voucher.balance <= 0) {
      throw new Error(`Voucher ${voucher.voucherCode} has zero balance.`);
    }

    const redeemedAmt  = Math.min(requestedAmt, voucher.balance);
    const remainingAmt = Math.round((voucher.balance - redeemedAmt) * 100) / 100;
    const fullySettled = requestedAmt <= voucher.balance;
    const now          = new Date().toISOString();

    const status: VoucherStatus =
      remainingAmt === 0
        ? "REDEEMED"
        : "PARTIALLY_REDEEMED";

    const txn: VoucherTxn = {
      txnId: this.txnId(), kind: "REDEEM", amount: -redeemedAmt,
      balanceAfter: remainingAmt, performedBy, refNo,
      timestamp: now, note: `Redeemed ₹${redeemedAmt}`,
    };

    const updated: GiftVoucher = {
      ...voucher,
      balance:   remainingAmt,
      status:    !voucher.multiUse && remainingAmt > 0 ? "REDEEMED" : status,
      ledger:    [...voucher.ledger, txn],
      updatedAt: now,
    };

    return { voucher: updated, redeemedAmt, remainingAmt, fullySettled };
  }

  /** Convert a refund amount into store credit */
  public static refundToCredit(params: {
    refundAmt:   number;
    customerId:  string;
    performedBy: string;
    branchCode:  string;
    saleRefNo:   string;
    validDays?:  number;
  }): GiftVoucher {
    return this.issueVoucher({
      type:       "REFUND_CREDIT",
      amount:     params.refundAmt,
      issuedBy:   params.performedBy,
      branchCode: params.branchCode,
      issuedTo:   params.customerId,
      multiUse:   true,
      validDays:  params.validDays ?? 180,
      refNo:      params.saleRefNo,
      note:       `Refund credit — Sale ${params.saleRefNo}`,
    });
  }

  /** Expire voucher if past expiresAt */
  public static expireIfDue(voucher: GiftVoucher, asOf: Date = new Date()): GiftVoucher {
    if (voucher.status !== "ACTIVE" && voucher.status !== "PARTIALLY_REDEEMED") return voucher;
    if (new Date(voucher.expiresAt) >= asOf) return voucher;

    const now = new Date().toISOString();
    const txn: VoucherTxn = {
      txnId: this.txnId(), kind: "EXPIRE", amount: 0,
      balanceAfter: voucher.balance, performedBy: "SYSTEM",
      timestamp: now, note: `Auto-expired. Forfeited balance: ₹${voucher.balance}`,
    };
    return { ...voucher, status: "EXPIRED", ledger: [...voucher.ledger, txn], updatedAt: now };
  }

  public static expireBatch(vouchers: GiftVoucher[], asOf: Date = new Date()): GiftVoucher[] {
    return vouchers.map((v) => this.expireIfDue(v, asOf));
  }

  /** Adjust balance (e.g. admin top-up or forfeiture) */
  public static adjust(
    voucher: GiftVoucher, delta: number, performedBy: string, note: string
  ): GiftVoucher {
    const now        = new Date().toISOString();
    const newBalance = Math.max(0, Math.round((voucher.balance + delta) * 100) / 100);
    const txn: VoucherTxn = {
      txnId: this.txnId(), kind: "ADJUST", amount: delta,
      balanceAfter: newBalance, performedBy, timestamp: now, note,
    };
    return { ...voucher, balance: newBalance, ledger: [...voucher.ledger, txn], updatedAt: now };
  }

  /** Portfolio summary across a set of vouchers */
  public static portfolioSummary(vouchers: GiftVoucher[]): {
    totalIssued:     number;
    totalBalance:    number;
    totalRedeemed:   number;
    byType:          Record<VoucherType, number>;
    byStatus:        Record<VoucherStatus, number>;
    expiringSoon30d: number;
  } {
    const totalIssued   = Math.round(vouchers.reduce((s, v) => s + v.issuedAmt, 0) * 100) / 100;
    const totalBalance  = Math.round(vouchers.reduce((s, v) => s + v.balance, 0) * 100) / 100;
    const totalRedeemed = Math.round((totalIssued - totalBalance) * 100) / 100;
    const now30         = Date.now() + 30 * 86400000;

    const byType    = {} as Record<VoucherType, number>;
    const byStatus  = {} as Record<VoucherStatus, number>;
    for (const v of vouchers) {
      byType[v.type]     = (byType[v.type]   || 0) + v.balance;
      byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    }

    const expiringSoon30d = vouchers.filter(
      (v) => (v.status === "ACTIVE" || v.status === "PARTIALLY_REDEEMED")
        && new Date(v.expiresAt).getTime() <= now30
    ).length;

    return { totalIssued, totalBalance, totalRedeemed, byType, byStatus, expiringSoon30d };
  }
}

export default GiftVoucherEngine;
