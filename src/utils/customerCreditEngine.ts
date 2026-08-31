/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.119.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Customer Credit Limit & Outstanding Engine
 *
 * Manages B2B customer credit lifecycle:
 *   Limit Setup  : `setLimit()` — credit limit, payment terms, grace days
 *   Invoice Post : `postInvoice()` — adds to outstanding, checks utilisation
 *   Payment Post : `postPayment()` — reduces outstanding; allocates to oldest first
 *   Credit Hold  : `holdCredit()` / `releaseCredit()` — freeze further credit sales
 *   Aging Report : `agingReport()` — 5-bucket aging by customer
 *   Utilisation  : `utilisationPct = outstandingAmt / creditLimit × 100`
 *   Breach Alert : `utilisationPct > 100` → limit breached
 */

export type CreditAccountStatus = "ACTIVE" | "ON_HOLD" | "SUSPENDED" | "CLOSED";
export type InvoiceStatus       = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "WRITTEN_OFF";
export type AgingBucket         = "CURRENT" | "OVERDUE_30" | "OVERDUE_60" | "OVERDUE_90" | "CRITICAL";

export interface CreditInvoice {
  invoiceId:     string;
  invoiceNo:     string;
  customerId:    string;
  invoiceDate:   string;
  dueDate:       string;
  invoiceAmt:    number;
  paidAmt:       number;
  outstandingAmt: number;
  status:        InvoiceStatus;
  agingBucket:   AgingBucket;
  daysOverdue:   number;
}

export interface PaymentAllocation {
  invoiceId:    string;
  invoiceNo:    string;
  allocatedAmt: number;
  balanceBefore: number;
  balanceAfter:  number;
}

export interface CreditPaymentRecord {
  paymentId:   string;
  customerId:  string;
  paidOn:      string;
  paidAmt:     number;
  reference:   string;
  allocations: PaymentAllocation[];
}

export interface CreditAccount {
  accountId:      string;
  customerId:     string;
  customerName:   string;
  creditLimit:    number;
  outstandingAmt: number;
  availableCredit: number;
  utilisationPct:  number;
  limitBreached:   boolean;
  paymentTermDays: number;
  graceDays:       number;
  status:          CreditAccountStatus;
  holdReason?:     string;
  invoices:        CreditInvoice[];
  payments:        CreditPaymentRecord[];
  createdAt:       string;
  updatedAt:       string;
}

export class CustomerCreditEngine {
  private static counter        = 1;
  private static invoiceCounter = 1;
  private static payCounter     = 1;

  private static computeAgingBucket(dueDate: string, asOf: Date): { bucket: AgingBucket; daysOverdue: number } {
    const days = Math.floor((asOf.getTime() - new Date(dueDate).getTime()) / 86400000);
    if (days <= 0)  return { bucket: "CURRENT",    daysOverdue: 0 };
    if (days <= 30) return { bucket: "OVERDUE_30", daysOverdue: days };
    if (days <= 60) return { bucket: "OVERDUE_60", daysOverdue: days };
    if (days <= 90) return { bucket: "OVERDUE_90", daysOverdue: days };
    return              { bucket: "CRITICAL",    daysOverdue: days };
  }

  private static recalcAccount(account: CreditAccount): CreditAccount {
    const outstandingAmt  = Math.round(account.invoices.filter((i) => i.status !== "PAID" && i.status !== "WRITTEN_OFF").reduce((s, i) => s + i.outstandingAmt, 0) * 100) / 100;
    const availableCredit = Math.round((account.creditLimit - outstandingAmt) * 100) / 100;
    const utilisationPct  = Math.round((outstandingAmt / account.creditLimit) * 10000) / 100;
    const limitBreached   = outstandingAmt > account.creditLimit;
    return { ...account, outstandingAmt, availableCredit, utilisationPct, limitBreached };
  }

  /** Create or update a customer credit account */
  public static setLimit(params: {
    customerId:      string;
    customerName:    string;
    creditLimit:     number;
    paymentTermDays: number;
    graceDays?:      number;
  }): CreditAccount {
    const now = new Date().toISOString();
    return {
      accountId:      `CACC-${this.counter++}`,
      customerId:     params.customerId,
      customerName:   params.customerName,
      creditLimit:    params.creditLimit,
      outstandingAmt: 0,
      availableCredit: params.creditLimit,
      utilisationPct:  0,
      limitBreached:   false,
      paymentTermDays: params.paymentTermDays,
      graceDays:       params.graceDays ?? 0,
      status:          "ACTIVE",
      invoices:        [],
      payments:        [],
      createdAt: now, updatedAt: now,
    };
  }

  /** Post a new credit invoice to the account */
  public static postInvoice(
    account:     CreditAccount,
    invoiceNo:   string,
    invoiceAmt:  number,
    invoiceDate: string,
    asOf:        Date = new Date()
  ): CreditAccount {
    if (account.status === "ON_HOLD" || account.status === "SUSPENDED") {
      throw new Error(`Credit account for ${account.customerName} is ${account.status} — cannot post invoice.`);
    }
    const dueDate = new Date(new Date(invoiceDate).getTime() + account.paymentTermDays * 86400000).toISOString().slice(0, 10);
    const { bucket, daysOverdue } = this.computeAgingBucket(dueDate, asOf);

    const invoice: CreditInvoice = {
      invoiceId:     `CINV-${this.invoiceCounter++}`,
      invoiceNo, customerId: account.customerId,
      invoiceDate,  dueDate,
      invoiceAmt,   paidAmt: 0, outstandingAmt: invoiceAmt,
      status:       "OPEN", agingBucket: bucket, daysOverdue,
    };
    const updated = { ...account, invoices: [...account.invoices, invoice], updatedAt: new Date().toISOString() };
    return this.recalcAccount(updated);
  }

  /**
   * Post a payment — allocates to oldest invoices first (FIFO by dueDate).
   * Returns updated account + allocation details.
   */
  public static postPayment(
    account:   CreditAccount,
    paidAmt:   number,
    paidOn:    string,
    reference: string
  ): { account: CreditAccount; paymentRecord: CreditPaymentRecord } {
    const unpaid = [...account.invoices]
      .filter((i) => i.status !== "PAID" && i.status !== "WRITTEN_OFF" && i.outstandingAmt > 0)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const allocations: PaymentAllocation[] = [];
    let remaining = paidAmt;

    const invoiceMap = new Map(account.invoices.map((i) => [i.invoiceId, { ...i }]));

    for (const inv of unpaid) {
      if (remaining <= 0) break;
      const apply        = Math.min(remaining, inv.outstandingAmt);
      const balanceBefore = inv.outstandingAmt;
      const balanceAfter  = Math.round((balanceBefore - apply) * 100) / 100;
      const updated       = invoiceMap.get(inv.invoiceId)!;
      updated.paidAmt        = Math.round((updated.paidAmt + apply) * 100) / 100;
      updated.outstandingAmt = balanceAfter;
      updated.status         = balanceAfter === 0 ? "PAID" : "PARTIALLY_PAID";
      invoiceMap.set(inv.invoiceId, updated);
      allocations.push({ invoiceId: inv.invoiceId, invoiceNo: inv.invoiceNo, allocatedAmt: apply, balanceBefore, balanceAfter });
      remaining -= apply;
    }

    const paymentRecord: CreditPaymentRecord = {
      paymentId:  `CPAY-${this.payCounter++}`,
      customerId: account.customerId,
      paidOn, paidAmt, reference, allocations,
    };

    const updated: CreditAccount = {
      ...account,
      invoices: account.invoices.map((i) => invoiceMap.get(i.invoiceId) ?? i),
      payments: [...account.payments, paymentRecord],
      updatedAt: new Date().toISOString(),
    };

    return { account: this.recalcAccount(updated), paymentRecord };
  }

  /** Refresh aging buckets on all open invoices */
  public static refreshAging(account: CreditAccount, asOf: Date = new Date()): CreditAccount {
    const invoices = account.invoices.map((i) => {
      if (i.status === "PAID" || i.status === "WRITTEN_OFF") return i;
      const { bucket, daysOverdue } = this.computeAgingBucket(i.dueDate, asOf);
      const status: InvoiceStatus = daysOverdue > 0 && i.status === "OPEN" ? "OVERDUE" : i.status;
      return { ...i, agingBucket: bucket, daysOverdue, status };
    });
    return this.recalcAccount({ ...account, invoices, updatedAt: new Date().toISOString() });
  }

  /** Place credit hold */
  public static holdCredit(account: CreditAccount, heldBy: string, reason: string): CreditAccount {
    return { ...account, status: "ON_HOLD", holdReason: reason, updatedAt: new Date().toISOString() };
  }

  /** Release credit hold */
  public static releaseCredit(account: CreditAccount, releasedBy: string): CreditAccount {
    return { ...account, status: "ACTIVE", holdReason: undefined, updatedAt: new Date().toISOString() };
  }

  /** 5-bucket aging report across accounts */
  public static agingReport(
    accounts: CreditAccount[],
    asOf:     Date = new Date()
  ): Array<{
    customerId:   string;
    customerName: string;
    creditLimit:  number;
    outstanding:  number;
    utilisationPct: number;
    limitBreached:  boolean;
    status:         CreditAccountStatus;
    buckets: Array<{ bucket: AgingBucket; count: number; totalAmt: number }>;
  }> {
    const BUCKETS: AgingBucket[] = ["CURRENT", "OVERDUE_30", "OVERDUE_60", "OVERDUE_90", "CRITICAL"];
    return accounts.map((acc) => {
      const refreshed = this.refreshAging(acc, asOf);
      const buckets = BUCKETS.map((bucket) => {
        const matching = refreshed.invoices.filter((i) => i.agingBucket === bucket && i.status !== "PAID" && i.status !== "WRITTEN_OFF");
        return { bucket, count: matching.length, totalAmt: Math.round(matching.reduce((s, i) => s + i.outstandingAmt, 0) * 100) / 100 };
      });
      return {
        customerId:     refreshed.customerId,
        customerName:   refreshed.customerName,
        creditLimit:    refreshed.creditLimit,
        outstanding:    refreshed.outstandingAmt,
        utilisationPct: refreshed.utilisationPct,
        limitBreached:  refreshed.limitBreached,
        status:         refreshed.status,
        buckets,
      };
    });
  }
}

export default CustomerCreditEngine;
