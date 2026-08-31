/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.113.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Supplier Payment Terms & Aging Engine
 *
 * Tracks vendor invoices through their payment lifecycle:
 *   Aging Buckets  : 0–30d (CURRENT), 31–60d (OVERDUE_30),
 *                    61–90d (OVERDUE_60), 91–120d (OVERDUE_90),
 *                    >120d (CRITICAL)
 *   Payment Terms  : NET_30, NET_45, NET_60, NET_90, IMMEDIATE, CUSTOM
 *   Early-Pay      : If paid before earlyPayCutoffDays, discount % applied
 *   Due Calendar   : `buildDueCalendar()` groups invoices by due date
 *   Aging Report   : Per-vendor bucket summary + totals
 *   Invoice Status : UNPAID → PARTIALLY_PAID → PAID / OVERDUE / DISPUTED
 */

export type PaymentTerms   = "NET_30" | "NET_45" | "NET_60" | "NET_90" | "IMMEDIATE" | "CUSTOM";
export type InvoiceStatus  = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "DISPUTED";
export type AgingBucket    = "CURRENT" | "OVERDUE_30" | "OVERDUE_60" | "OVERDUE_90" | "CRITICAL";

export const TERMS_DAYS: Record<PaymentTerms, number> = {
  IMMEDIATE: 0,
  NET_30:    30,
  NET_45:    45,
  NET_60:    60,
  NET_90:    90,
  CUSTOM:    0,   // Uses customDays field
};

export interface PaymentRecord {
  paymentId:   string;
  paidAmt:     number;
  paidOn:      string;
  reference:   string;
  earlyPayDiscount: number;   // Discount earned if paid early
  netPaid:     number;        // paidAmt - earlyPayDiscount
}

export interface SupplierInvoice {
  invoiceId:      string;
  invoiceNo:      string;
  vendorId:       string;
  vendorName:     string;
  branchCode:     string;
  invoiceAmt:     number;
  paidAmt:        number;
  outstandingAmt: number;
  invoiceDate:    string;
  dueDate:        string;
  terms:          PaymentTerms;
  customDays?:    number;
  earlyPayCutoffDays: number;   // Days from invoice date for early-pay discount
  earlyPayDiscountPct: number;  // % discount if paid before cutoff
  status:         InvoiceStatus;
  agingBucket:    AgingBucket;
  daysOverdue:    number;
  payments:       PaymentRecord[];
  createdAt:      string;
  updatedAt:      string;
}

export interface AgingBucketSummary {
  bucket:    AgingBucket;
  label:     string;
  count:     number;
  totalAmt:  number;
}

export interface VendorAgingReport {
  vendorId:    string;
  vendorName:  string;
  invoiceCount: number;
  totalOutstanding: number;
  buckets:     AgingBucketSummary[];
  oldestDueDays: number;
  criticalAmt:   number;
}

export class SupplierPaymentEngine {
  private static invoiceCounter = 1;
  private static paymentCounter = 1;

  private static computeDueDate(invoiceDate: string, terms: PaymentTerms, customDays?: number): string {
    const days = terms === "CUSTOM" ? (customDays ?? 30) : TERMS_DAYS[terms];
    const due  = new Date(new Date(invoiceDate).getTime() + days * 86400000);
    return due.toISOString().slice(0, 10);
  }

  private static computeAgingBucket(dueDate: string, asOf: Date): { bucket: AgingBucket; daysOverdue: number } {
    const dueMs  = new Date(dueDate).getTime();
    const asOfMs = asOf.getTime();
    const daysOverdue = Math.max(0, Math.floor((asOfMs - dueMs) / 86400000));

    const bucket: AgingBucket =
      daysOverdue === 0 ? "CURRENT"
      : daysOverdue <= 30 ? "OVERDUE_30"
      : daysOverdue <= 60 ? "OVERDUE_60"
      : daysOverdue <= 90 ? "OVERDUE_90"
      : "CRITICAL";

    return { bucket, daysOverdue };
  }

  public static createInvoice(params: {
    vendorId:            string;
    vendorName:          string;
    branchCode:          string;
    invoiceNo:           string;
    invoiceAmt:          number;
    invoiceDate:         string;
    terms:               PaymentTerms;
    customDays?:         number;
    earlyPayCutoffDays?: number;
    earlyPayDiscountPct?: number;
  }, asOf: Date = new Date()): SupplierInvoice {
    const now     = new Date().toISOString();
    const dueDate = this.computeDueDate(params.invoiceDate, params.terms, params.customDays);
    const { bucket, daysOverdue } = this.computeAgingBucket(dueDate, asOf);

    return {
      invoiceId:    `INVID-${this.invoiceCounter++}`,
      invoiceNo:    params.invoiceNo,
      vendorId:     params.vendorId,
      vendorName:   params.vendorName,
      branchCode:   params.branchCode,
      invoiceAmt:   params.invoiceAmt,
      paidAmt:      0,
      outstandingAmt: params.invoiceAmt,
      invoiceDate:  params.invoiceDate,
      dueDate,
      terms:        params.terms,
      customDays:   params.customDays,
      earlyPayCutoffDays:  params.earlyPayCutoffDays  ?? 10,
      earlyPayDiscountPct: params.earlyPayDiscountPct ?? 2,
      status:       "UNPAID",
      agingBucket:  bucket,
      daysOverdue,
      payments:     [],
      createdAt:    now,
      updatedAt:    now,
    };
  }

  /** Record a payment — applies early-pay discount if within cutoff */
  public static recordPayment(
    invoice: SupplierInvoice,
    paidAmt: number,
    paidOn: string,
    reference: string
  ): SupplierInvoice {
    const now        = new Date().toISOString();
    const invoiceMs  = new Date(invoice.invoiceDate).getTime();
    const paidMs     = new Date(paidOn).getTime();
    const daysFromInvoice = Math.floor((paidMs - invoiceMs) / 86400000);
    const isEarlyPay = daysFromInvoice <= invoice.earlyPayCutoffDays;

    const earlyPayDiscount = isEarlyPay
      ? Math.round((paidAmt * invoice.earlyPayDiscountPct / 100) * 100) / 100
      : 0;
    const netPaid = Math.round((paidAmt - earlyPayDiscount) * 100) / 100;

    const payment: PaymentRecord = {
      paymentId:        `PYMID-${this.paymentCounter++}`,
      paidAmt,
      paidOn,
      reference,
      earlyPayDiscount,
      netPaid,
    };

    const totalPaid       = Math.round((invoice.paidAmt + paidAmt) * 100) / 100;
    const outstandingAmt  = Math.max(0, Math.round((invoice.invoiceAmt - totalPaid) * 100) / 100);

    const status: InvoiceStatus =
      outstandingAmt === 0     ? "PAID"
      : totalPaid > 0          ? "PARTIALLY_PAID"
      : "UNPAID";

    return {
      ...invoice,
      paidAmt:       totalPaid,
      outstandingAmt,
      status,
      payments:      [...invoice.payments, payment],
      updatedAt:     now,
    };
  }

  /** Refresh aging buckets for all invoices as of a given date */
  public static refreshAging(invoices: SupplierInvoice[], asOf: Date = new Date()): SupplierInvoice[] {
    return invoices.map((inv) => {
      if (inv.status === "PAID") return inv;
      const { bucket, daysOverdue } = this.computeAgingBucket(inv.dueDate, asOf);
      const status: InvoiceStatus   = daysOverdue > 0 && inv.status === "UNPAID" ? "OVERDUE" : inv.status;
      return { ...inv, agingBucket: bucket, daysOverdue, status, updatedAt: new Date().toISOString() };
    });
  }

  /** Build due calendar — group outstanding invoices by due date */
  public static buildDueCalendar(
    invoices: SupplierInvoice[]
  ): Array<{ dueDate: string; invoices: SupplierInvoice[]; totalDue: number }> {
    const outstanding = invoices.filter((i) => i.status !== "PAID");
    const byDate = outstanding.reduce<Record<string, SupplierInvoice[]>>((map, inv) => {
      (map[inv.dueDate] = map[inv.dueDate] ?? []).push(inv);
      return map;
    }, {});

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dueDate, invs]) => ({
        dueDate,
        invoices: invs,
        totalDue: Math.round(invs.reduce((s, i) => s + i.outstandingAmt, 0) * 100) / 100,
      }));
  }

  /** Per-vendor aging report */
  public static vendorAgingReport(
    invoices: SupplierInvoice[],
    asOf: Date = new Date()
  ): VendorAgingReport[] {
    const refreshed = this.refreshAging(invoices, asOf);
    const outstanding = refreshed.filter((i) => i.status !== "PAID");

    const byVendor = outstanding.reduce<Record<string, SupplierInvoice[]>>((map, inv) => {
      (map[inv.vendorId] = map[inv.vendorId] ?? []).push(inv);
      return map;
    }, {});

    const BUCKET_LABELS: Record<AgingBucket, string> = {
      CURRENT:    "Current (0–30d)",
      OVERDUE_30: "Overdue 31–60d",
      OVERDUE_60: "Overdue 61–90d",
      OVERDUE_90: "Overdue 91–120d",
      CRITICAL:   "Critical (>120d)",
    };

    return Object.entries(byVendor).map(([vendorId, invs]) => {
      const buckets: AgingBucketSummary[] = (
        ["CURRENT", "OVERDUE_30", "OVERDUE_60", "OVERDUE_90", "CRITICAL"] as AgingBucket[]
      ).map((bucket) => {
        const group = invs.filter((i) => i.agingBucket === bucket);
        return {
          bucket,
          label:    BUCKET_LABELS[bucket],
          count:    group.length,
          totalAmt: Math.round(group.reduce((s, i) => s + i.outstandingAmt, 0) * 100) / 100,
        };
      });

      const criticalAmt = buckets.find((b) => b.bucket === "CRITICAL")?.totalAmt ?? 0;
      const oldestDueDays = Math.max(...invs.map((i) => i.daysOverdue));

      return {
        vendorId,
        vendorName:        invs[0].vendorName,
        invoiceCount:      invs.length,
        totalOutstanding:  Math.round(invs.reduce((s, i) => s + i.outstandingAmt, 0) * 100) / 100,
        buckets,
        oldestDueDays,
        criticalAmt,
      };
    });
  }
}

export default SupplierPaymentEngine;
