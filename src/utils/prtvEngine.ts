/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.115.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Purchase Return to Vendor (PRTV) Engine
 *
 * Manages vendor return orders from creation through settlement:
 *   PRTV Order  : `createReturn()` — line-level qty, reason, and return type
 *   Debit Note  : `generateDebitNote()` — calculates net debit value incl. tax
 *   Dispatch    : `markDispatched()` — records courier + tracking
 *   Vendor Ack  : `acknowledge()` — vendor confirms receipt
 *   Settlement  : `settle()` — links debit note against open payables
 *   Status flow : DRAFT → APPROVED → DISPATCHED → ACKNOWLEDGED → SETTLED / REJECTED
 */

export type PRTVStatus  = "DRAFT" | "APPROVED" | "DISPATCHED" | "ACKNOWLEDGED" | "SETTLED" | "REJECTED";
export type ReturnReason = "DEFECTIVE" | "EXCESS_STOCK" | "QUALITY_REJECTION" | "WRONG_ITEM" | "EXPIRED" | "OTHER";

export interface PRTVLine {
  lineId:       string;
  poLineRef?:   string;
  sku:          string;
  productName:  string;
  returnQty:    number;
  unitCost:     number;
  totalCost:    number;
  taxPct:       number;
  taxAmt:       number;
  netReturnAmt: number;
  reason:       ReturnReason;
  reasonNote?:  string;
}

export interface DebitNote {
  debitNoteNo:   string;
  generatedAt:   string;
  vendorId:      string;
  vendorName:    string;
  subTotal:      number;
  totalTax:      number;
  netDebitAmt:   number;
  linkedPRTVId:  string;
}

export interface DispatchInfo {
  dispatchedAt: string;
  courier:      string;
  trackingNo:   string;
  dispatchedBy: string;
}

export interface PRTVAuditEntry {
  auditId:     string;
  action:      string;
  performedBy: string;
  timestamp:   string;
  note?:       string;
}

export interface PRTVOrder {
  prtvId:      string;
  prtvNo:      string;
  vendorId:    string;
  vendorName:  string;
  branchCode:  string;
  poRef?:      string;
  status:      PRTVStatus;
  lines:       PRTVLine[];
  subTotal:    number;
  totalTax:    number;
  netReturnAmt: number;
  debitNote?:  DebitNote;
  dispatch?:   DispatchInfo;
  acknowledgedAt?: string;
  settlement?: { settledAt: string; settledBy: string; payableRef: string; settledAmt: number };
  auditTrail:  PRTVAuditEntry[];
  createdAt:   string;
  createdBy:   string;
  updatedAt:   string;
}

export class PRTVEngine {
  private static counter      = 1;
  private static lineCounter  = 1;
  private static dnCounter    = 1;
  private static auditId      = () => `PAUD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  private static recalc(lines: PRTVLine[]): { subTotal: number; totalTax: number; netReturnAmt: number } {
    const subTotal     = Math.round(lines.reduce((s, l) => s + l.totalCost, 0) * 100) / 100;
    const totalTax     = Math.round(lines.reduce((s, l) => s + l.taxAmt, 0) * 100) / 100;
    const netReturnAmt = Math.round(lines.reduce((s, l) => s + l.netReturnAmt, 0) * 100) / 100;
    return { subTotal, totalTax, netReturnAmt };
  }

  public static createReturn(params: {
    vendorId:   string;
    vendorName: string;
    branchCode: string;
    createdBy:  string;
    poRef?:     string;
    lines: Array<{
      sku:         string;
      productName: string;
      returnQty:   number;
      unitCost:    number;
      taxPct:      number;
      reason:      ReturnReason;
      reasonNote?: string;
      poLineRef?:  string;
    }>;
  }): PRTVOrder {
    const now    = new Date().toISOString();
    const prtvNo = `PRTV-${params.branchCode}-${now.slice(0, 10).replace(/-/g, "")}-${String(this.counter++).padStart(4, "0")}`;

    const lines: PRTVLine[] = params.lines.map((l) => {
      const totalCost  = Math.round(l.unitCost * l.returnQty * 100) / 100;
      const taxAmt     = Math.round((totalCost * l.taxPct / 100) * 100) / 100;
      const netReturnAmt = Math.round((totalCost + taxAmt) * 100) / 100;
      return {
        lineId: `PLINE-${this.lineCounter++}`,
        poLineRef: l.poLineRef,
        sku: l.sku, productName: l.productName,
        returnQty: l.returnQty, unitCost: l.unitCost,
        totalCost, taxPct: l.taxPct, taxAmt, netReturnAmt,
        reason: l.reason, reasonNote: l.reasonNote,
      };
    });

    const totals = this.recalc(lines);

    const audit: PRTVAuditEntry = {
      auditId: this.auditId(), action: "PRTV_CREATED",
      performedBy: params.createdBy, timestamp: now,
      note: `${lines.length} line(s), net ₹${totals.netReturnAmt}`,
    };

    return {
      prtvId: `PRTVID-${Date.now()}`, prtvNo,
      vendorId: params.vendorId, vendorName: params.vendorName,
      branchCode: params.branchCode, poRef: params.poRef,
      status: "DRAFT", lines, ...totals,
      auditTrail: [audit],
      createdAt: now, createdBy: params.createdBy, updatedAt: now,
    };
  }

  /** Approve and generate debit note */
  public static approve(order: PRTVOrder, approvedBy: string): PRTVOrder {
    if (order.status !== "DRAFT") throw new Error(`Cannot approve — status is ${order.status}`);
    const now   = new Date().toISOString();
    const dnNo  = `DN-${order.branchCode}-${now.slice(0, 10).replace(/-/g, "")}-${String(this.dnCounter++).padStart(4, "0")}`;

    const debitNote: DebitNote = {
      debitNoteNo: dnNo, generatedAt: now,
      vendorId: order.vendorId, vendorName: order.vendorName,
      subTotal: order.subTotal, totalTax: order.totalTax,
      netDebitAmt: order.netReturnAmt, linkedPRTVId: order.prtvId,
    };

    const audit: PRTVAuditEntry = {
      auditId: this.auditId(), action: "APPROVED",
      performedBy: approvedBy, timestamp: now,
      note: `Debit Note ${dnNo} generated — ₹${order.netReturnAmt}`,
    };

    return { ...order, status: "APPROVED", debitNote, auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }

  /** Mark dispatched with courier info */
  public static markDispatched(
    order: PRTVOrder, courier: string, trackingNo: string, dispatchedBy: string
  ): PRTVOrder {
    if (order.status !== "APPROVED") throw new Error(`Cannot dispatch — status is ${order.status}`);
    const now = new Date().toISOString();
    const dispatch: DispatchInfo = { dispatchedAt: now, courier, trackingNo, dispatchedBy };
    const audit: PRTVAuditEntry = {
      auditId: this.auditId(), action: "DISPATCHED",
      performedBy: dispatchedBy, timestamp: now,
      note: `${courier} — ${trackingNo}`,
    };
    return { ...order, status: "DISPATCHED", dispatch, auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }

  /** Vendor acknowledges receipt */
  public static acknowledge(order: PRTVOrder, acknowledgedBy: string): PRTVOrder {
    if (order.status !== "DISPATCHED") throw new Error(`Cannot acknowledge — status is ${order.status}`);
    const now = new Date().toISOString();
    const audit: PRTVAuditEntry = {
      auditId: this.auditId(), action: "ACKNOWLEDGED",
      performedBy: acknowledgedBy, timestamp: now, note: "Vendor confirmed receipt",
    };
    return { ...order, status: "ACKNOWLEDGED", acknowledgedAt: now, auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }

  /** Settle debit against open payable */
  public static settle(
    order: PRTVOrder, settledBy: string, payableRef: string, settledAmt: number
  ): PRTVOrder {
    if (order.status !== "ACKNOWLEDGED") throw new Error(`Cannot settle — status is ${order.status}`);
    const now = new Date().toISOString();
    const settlement = { settledAt: now, settledBy, payableRef, settledAmt };
    const audit: PRTVAuditEntry = {
      auditId: this.auditId(), action: "SETTLED",
      performedBy: settledBy, timestamp: now,
      note: `Settled ₹${settledAmt} against ${payableRef}`,
    };
    return { ...order, status: "SETTLED", settlement, auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }

  /** Reject (from DRAFT or APPROVED) */
  public static reject(order: PRTVOrder, rejectedBy: string, reason: string): PRTVOrder {
    if (!["DRAFT", "APPROVED"].includes(order.status)) throw new Error(`Cannot reject — status is ${order.status}`);
    const now = new Date().toISOString();
    const audit: PRTVAuditEntry = {
      auditId: this.auditId(), action: "REJECTED",
      performedBy: rejectedBy, timestamp: now, note: reason,
    };
    return { ...order, status: "REJECTED", auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }
}

export default PRTVEngine;
