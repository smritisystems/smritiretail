/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.103.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Vendor Return & Debit Note Engine
 *
 * Manages the complete return-to-vendor workflow:
 *   RTV Lifecycle   : DRAFT → SUBMITTED → VENDOR_ACKNOWLEDGED → GOODS_DISPATCHED
 *                     → VENDOR_RECEIVED → DEBIT_NOTE_RAISED → SETTLED / DISPUTED
 *
 *   Debit Note      : Auto-generated on DEBIT_NOTE_RAISED status with:
 *                     - Net amount (returned goods cost value)
 *                     - GST reversal line items
 *                     - Reference to original PO and GRN
 *
 *   Balance Ledger  : Open debit notes per vendor; settled vs outstanding tracking
 */

export type RTVStatus =
  | "DRAFT" | "SUBMITTED" | "VENDOR_ACKNOWLEDGED" | "GOODS_DISPATCHED"
  | "VENDOR_RECEIVED" | "DEBIT_NOTE_RAISED" | "SETTLED" | "DISPUTED" | "CANCELLED";

export type ReturnReason =
  | "QUALITY_DEFECT" | "SHORT_EXPIRY" | "WRONG_ITEM" | "EXCESS_SUPPLY"
  | "DAMAGED_IN_TRANSIT" | "PRICE_DISCREPANCY" | "SPECIFICATION_MISMATCH";

export interface RTVLine {
  lineId: string;
  sku: string;
  productName: string;
  returnQty: number;
  unitCost: number;          // Original PO unit cost
  lineValue: number;         // returnQty × unitCost
  gstRate: number;
  gstAmount: number;         // lineValue × gstRate%
  totalWithGST: number;
  reason: ReturnReason;
  originalPOLineId?: string;
  originalGRNLineId?: string;
}

export interface RTVAuditEntry {
  auditId: string;
  fromStatus: RTVStatus;
  toStatus: RTVStatus;
  performedBy: string;
  timestamp: string;
  note?: string;
}

export interface ReturnToVendorOrder {
  rtvId: string;
  rtvNo: string;
  vendorId: string;
  vendorName: string;
  branchCode: string;
  originalPOId?: string;
  originalPONo?: string;
  lines: RTVLine[];
  totalNetValue: number;
  totalGST: number;
  totalWithGST: number;
  status: RTVStatus;
  requestedBy: string;
  approvedBy?: string;
  dispatchRef?: string;
  expectedCreditDate?: string;
  createdAt: string;
  updatedAt: string;
  auditTrail: RTVAuditEntry[];
  debitNote?: DebitNote;
}

export interface DebitNote {
  debitNoteId: string;
  debitNoteNo: string;
  rtvId: string;
  vendorId: string;
  vendorName: string;
  issuedAt: string;
  netAmount: number;
  gstAmount: number;
  totalAmount: number;
  lines: Array<{
    description: string;
    qty: number;
    unitCost: number;
    lineValue: number;
    gstRate: number;
    gstAmount: number;
  }>;
  status: "OPEN" | "SETTLED" | "PARTIALLY_SETTLED" | "DISPUTED";
  settledAmount: number;
  outstandingAmount: number;
}

export interface VendorBalanceLedger {
  vendorId: string;
  vendorName: string;
  totalDebitNotes: number;
  totalDebitValue: number;
  totalSettled: number;
  totalOutstanding: number;
  openDebitNotes: DebitNote[];
}

export class VendorReturnEngine {
  private static rtvCounter = 1;
  private static dnCounter  = 1;
  private static auditId = () => `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  public static createRTV(params: {
    vendorId: string;
    vendorName: string;
    branchCode: string;
    originalPOId?: string;
    originalPONo?: string;
    lines: Omit<RTVLine, "lineId" | "lineValue" | "gstAmount" | "totalWithGST">[];
    requestedBy: string;
  }): ReturnToVendorOrder {
    const now = new Date().toISOString();
    const rtvNo = `RTV-${now.slice(0, 10).replace(/-/g, "")}-${String(this.rtvCounter++).padStart(4, "0")}`;

    const lines: RTVLine[] = params.lines.map((l, i) => {
      const lineValue    = Math.round(l.returnQty * l.unitCost * 100) / 100;
      const gstAmount    = Math.round(lineValue * (l.gstRate / 100) * 100) / 100;
      const totalWithGST = Math.round((lineValue + gstAmount) * 100) / 100;
      return { ...l, lineId: `RTVL-${i + 1}`, lineValue, gstAmount, totalWithGST };
    });

    const totalNetValue  = Math.round(lines.reduce((s, l) => s + l.lineValue, 0) * 100) / 100;
    const totalGST       = Math.round(lines.reduce((s, l) => s + l.gstAmount, 0) * 100) / 100;
    const totalWithGST   = Math.round((totalNetValue + totalGST) * 100) / 100;

    return {
      rtvId: `RTVID-${Date.now()}`,
      rtvNo,
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      branchCode: params.branchCode,
      originalPOId: params.originalPOId,
      originalPONo: params.originalPONo,
      lines,
      totalNetValue,
      totalGST,
      totalWithGST,
      status: "DRAFT",
      requestedBy: params.requestedBy,
      createdAt: now,
      updatedAt: now,
      auditTrail: [{
        auditId: this.auditId(),
        fromStatus: "DRAFT",
        toStatus: "DRAFT",
        performedBy: params.requestedBy,
        timestamp: now,
        note: "RTV created",
      }],
    };
  }

  private static transition(
    rtv: ReturnToVendorOrder,
    toStatus: RTVStatus,
    performedBy: string,
    note?: string,
    extras: Partial<ReturnToVendorOrder> = {}
  ): ReturnToVendorOrder {
    const now = new Date().toISOString();
    const entry: RTVAuditEntry = {
      auditId: this.auditId(),
      fromStatus: rtv.status,
      toStatus,
      performedBy,
      timestamp: now,
      note,
    };
    return { ...rtv, ...extras, status: toStatus, updatedAt: now, auditTrail: [...rtv.auditTrail, entry] };
  }

  public static submit(rtv: ReturnToVendorOrder, submittedBy: string): ReturnToVendorOrder {
    return this.transition(rtv, "SUBMITTED", submittedBy, `Submitted by ${submittedBy}`);
  }

  public static acknowledge(rtv: ReturnToVendorOrder, approvedBy: string): ReturnToVendorOrder {
    return this.transition(rtv, "VENDOR_ACKNOWLEDGED", approvedBy, `Vendor acknowledged`, { approvedBy });
  }

  public static dispatch(rtv: ReturnToVendorOrder, dispatchRef: string, dispatchedBy: string): ReturnToVendorOrder {
    return this.transition(rtv, "GOODS_DISPATCHED", dispatchedBy, `Dispatched — Ref: ${dispatchRef}`, { dispatchRef });
  }

  public static confirmVendorReceipt(rtv: ReturnToVendorOrder, receivedBy: string): ReturnToVendorOrder {
    return this.transition(rtv, "VENDOR_RECEIVED", receivedBy, `Vendor confirmed receipt`);
  }

  /** Raise debit note — auto-generates DebitNote document */
  public static raiseDebitNote(rtv: ReturnToVendorOrder, raisedBy: string): ReturnToVendorOrder {
    const now = new Date().toISOString();
    const dnNo = `DN-${now.slice(0, 10).replace(/-/g, "")}-${String(this.dnCounter++).padStart(4, "0")}`;
    const debitNote: DebitNote = {
      debitNoteId: `DNID-${Date.now()}`,
      debitNoteNo: dnNo,
      rtvId: rtv.rtvId,
      vendorId: rtv.vendorId,
      vendorName: rtv.vendorName,
      issuedAt: now,
      netAmount: rtv.totalNetValue,
      gstAmount: rtv.totalGST,
      totalAmount: rtv.totalWithGST,
      lines: rtv.lines.map((l) => ({
        description: `${l.productName} (${l.sku}) — ${l.reason.replace(/_/g, " ")}`,
        qty: l.returnQty,
        unitCost: l.unitCost,
        lineValue: l.lineValue,
        gstRate: l.gstRate,
        gstAmount: l.gstAmount,
      })),
      status: "OPEN",
      settledAmount: 0,
      outstandingAmount: rtv.totalWithGST,
    };
    return this.transition(rtv, "DEBIT_NOTE_RAISED", raisedBy, `Debit Note ${dnNo} raised`, { debitNote });
  }

  /** Apply a settlement (full or partial) to the open debit note */
  public static settleDebitNote(
    rtv: ReturnToVendorOrder,
    settlementAmount: number,
    settledBy: string
  ): ReturnToVendorOrder {
    if (!rtv.debitNote) return rtv;
    const newSettled      = Math.round((rtv.debitNote.settledAmount + settlementAmount) * 100) / 100;
    const newOutstanding  = Math.round((rtv.debitNote.totalAmount - newSettled) * 100) / 100;
    const dnStatus        = newOutstanding <= 0 ? "SETTLED" : "PARTIALLY_SETTLED";
    const rtvStatus: RTVStatus = newOutstanding <= 0 ? "SETTLED" : rtv.status;
    const debitNote: DebitNote = { ...rtv.debitNote, settledAmount: newSettled, outstandingAmount: Math.max(0, newOutstanding), status: dnStatus };
    return this.transition(
      { ...rtv, debitNote },
      rtvStatus,
      settledBy,
      `Settlement of ₹${settlementAmount} applied — Outstanding: ₹${Math.max(0, newOutstanding)}`,
      { debitNote }
    );
  }

  /** Compute open debit note balance ledger for a vendor */
  public static computeVendorBalance(rtvOrders: ReturnToVendorOrder[], vendorId: string): VendorBalanceLedger {
    const vendorRTVs = rtvOrders.filter((r) => r.vendorId === vendorId && r.debitNote);
    const openDNs    = vendorRTVs.map((r) => r.debitNote!).filter((d) => d.status !== "SETTLED");
    const totalDV    = vendorRTVs.reduce((s, r) => s + (r.debitNote?.totalAmount ?? 0), 0);
    const totalSet   = vendorRTVs.reduce((s, r) => s + (r.debitNote?.settledAmount ?? 0), 0);
    return {
      vendorId,
      vendorName: vendorRTVs[0]?.vendorName ?? "",
      totalDebitNotes: vendorRTVs.length,
      totalDebitValue: Math.round(totalDV * 100) / 100,
      totalSettled:    Math.round(totalSet * 100) / 100,
      totalOutstanding: Math.round((totalDV - totalSet) * 100) / 100,
      openDebitNotes:  openDNs,
    };
  }
}

export default VendorReturnEngine;
