/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Canonical Return to Vendor (RTV) Domain Engine
 *
 * Governs the standardized enterprise procurement return lifecycle:
 *   1. Return Request       : Line-level defect/excess identification (DRAFT / REQUESTED)
 *   2. Approval             : Commercial & purchase manager authorization (APPROVED / SUBMITTED)
 *   3. Dispatch             : Physical dispatch via courier / logistics with tracking (GOODS_DISPATCHED)
 *   4. Vendor Receipt       : Vendor confirmation and acknowledgment (VENDOR_RECEIVED)
 *   5. Debit/Credit Settlement: Automated GST-compliant debit note generation (DEBIT_NOTE_RAISED)
 *   6. Closed               : Payables ledger reconciliation and account settlement (SETTLED / CLOSED)
 *
 * Reconciles and unifies legacy PRTVEngine and VendorReturnEngine under one contract.
 */

export type CanonicalRTVStatus =
  | "REQUESTED"           // Initial draft/request created
  | "APPROVED"            // Authorized by manager / purchase team
  | "GOODS_DISPATCHED"    // Shipped to vendor with logistics tracking
  | "VENDOR_RECEIVED"     // Acknowledged / received by supplier warehouse
  | "DEBIT_NOTE_RAISED"   // Debit note generated, reversal booked in ledger
  | "SETTLED"             // Closed and matched against payables
  | "DISPUTED"            // Vendor disputed goods or quantity
  | "CANCELLED";          // Aborted before dispatch

// Legacy aliases for backward compatibility
export type RTVStatus =
  | "DRAFT" | "SUBMITTED" | "VENDOR_ACKNOWLEDGED" | "GOODS_DISPATCHED"
  | "VENDOR_RECEIVED" | "DEBIT_NOTE_RAISED" | "SETTLED" | "DISPUTED" | "CANCELLED";

export type PRTVStatus = "DRAFT" | "APPROVED" | "DISPATCHED" | "ACKNOWLEDGED" | "SETTLED" | "REJECTED";

export type CanonicalReturnReason =
  | "QUALITY_DEFECT"
  | "SHORT_EXPIRY"
  | "WRONG_ITEM"
  | "EXCESS_SUPPLY"
  | "DAMAGED_IN_TRANSIT"
  | "PRICE_DISCREPANCY"
  | "SPECIFICATION_MISMATCH"
  | "OTHER";

export type ReturnReason = CanonicalReturnReason;

export interface CanonicalRTVLine {
  lineId: string;
  sku: string;
  productName: string;
  returnQty: number;
  unitCost: number;
  lineValue: number;         // returnQty * unitCost
  gstRate: number;           // percentage e.g. 5, 12, 18
  gstAmount: number;         // lineValue * (gstRate / 100)
  totalWithGST: number;      // lineValue + gstAmount
  reason: CanonicalReturnReason;
  reasonNote?: string;
  originalPOLineId?: string;
  originalGRNLineId?: string;
}

export interface CanonicalDebitNote {
  debitNoteNo: string;
  rtvId: string;
  rtvNo: string;
  vendorId: string;
  vendorName: string;
  netGoodsValue: number;
  gstReversalAmount: number;
  totalDebitAmount: number;
  generatedAt: string;
  settled: boolean;
  settledAt?: string;
  settledBy?: string;
  referencePO?: string;
}

export interface CanonicalDispatchInfo {
  dispatchedAt: string;
  courier: string;
  trackingNo: string;
  dispatchedBy: string;
}

export interface CanonicalRTVAuditEntry {
  auditId: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  performedBy: string;
  timestamp: string;
  note?: string;
}

export interface CanonicalRTVOrder {
  rtvId: string;
  rtvNo: string;
  vendorId: string;
  vendorName: string;
  branchCode: string;
  originalPOId?: string;
  originalPONo?: string;
  lines: CanonicalRTVLine[];
  totalNetValue: number;
  totalGST: number;
  totalWithGST: number;
  status: CanonicalRTVStatus;
  legacyStatus?: RTVStatus;
  requestedBy: string;
  approvedBy?: string;
  dispatchInfo?: CanonicalDispatchInfo;
  debitNote?: CanonicalDebitNote;
  expectedCreditDate?: string;
  auditTrail: CanonicalRTVAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export class CanonicalRTVDomainEngine {
  private orders: Map<string, CanonicalRTVOrder> = new Map();
  private debitNotes: Map<string, CanonicalDebitNote> = new Map();
  private counter: number = 100;
  private dnCounter: number = 500;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.orders.clear();
    this.debitNotes.clear();
    this.counter = 100;
    this.dnCounter = 500;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Return Request Creation
  // ─────────────────────────────────────────────────────────────────────────
  createReturnRequest(params: {
    vendorId: string;
    vendorName: string;
    branchCode: string;
    originalPOId?: string;
    originalPONo?: string;
    requestedBy: string;
    lines: {
      sku: string;
      productName: string;
      returnQty: number;
      unitCost: number;
      gstRate?: number;
      taxPct?: number;
      reason: CanonicalReturnReason | string;
      reasonNote?: string;
      originalPOLineId?: string;
      originalGRNLineId?: string;
    }[];
  }): CanonicalRTVOrder {
    if (!params.vendorId || !params.vendorName) {
      throw new Error("Vendor ID and Vendor Name are mandatory for RTV creation.");
    }
    if (!params.lines || params.lines.length === 0) {
      throw new Error("At least one return line item is required.");
    }

    this.counter++;
    const rtvId = `RTV-${Date.now()}-${this.counter}`;
    const rtvNo = `RTV-2026-${String(this.counter).padStart(4, "0")}`;

    let totalNet = 0;
    let totalTax = 0;

    const computedLines: CanonicalRTVLine[] = params.lines.map((ln, idx) => {
      if (ln.returnQty <= 0) {
        throw new Error(`Invalid return quantity for SKU ${ln.sku}: must be > 0.`);
      }
      if (ln.unitCost < 0) {
        throw new Error(`Unit cost for SKU ${ln.sku} cannot be negative.`);
      }
      const rate = ln.gstRate !== undefined ? ln.gstRate : (ln.taxPct !== undefined ? ln.taxPct : 5);
      const lineValue = Math.round(ln.returnQty * ln.unitCost * 100) / 100;
      const gstAmount = Math.round(lineValue * (rate / 100) * 100) / 100;
      const totalWithGST = Math.round((lineValue + gstAmount) * 100) / 100;

      totalNet += lineValue;
      totalTax += gstAmount;

      return {
        lineId: `line-${idx + 1}-${Date.now()}`,
        sku: ln.sku,
        productName: ln.productName,
        returnQty: ln.returnQty,
        unitCost: ln.unitCost,
        lineValue,
        gstRate: rate,
        gstAmount,
        totalWithGST,
        reason: (ln.reason as CanonicalReturnReason) || "QUALITY_DEFECT",
        reasonNote: ln.reasonNote,
        originalPOLineId: ln.originalPOLineId,
        originalGRNLineId: ln.originalGRNLineId,
      };
    });

    const now = new Date().toISOString();
    const order: CanonicalRTVOrder = {
      rtvId,
      rtvNo,
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      branchCode: params.branchCode,
      originalPOId: params.originalPOId,
      originalPONo: params.originalPONo,
      lines: computedLines,
      totalNetValue: Math.round(totalNet * 100) / 100,
      totalGST: Math.round(totalTax * 100) / 100,
      totalWithGST: Math.round((totalNet + totalTax) * 100) / 100,
      status: "REQUESTED",
      legacyStatus: "DRAFT",
      requestedBy: params.requestedBy,
      auditTrail: [
        {
          auditId: `aud-${Date.now()}-1`,
          fromStatus: "NONE",
          toStatus: "REQUESTED",
          action: "RETURN_REQUESTED",
          performedBy: params.requestedBy,
          timestamp: now,
          note: `Created RTV ${rtvNo} for vendor ${params.vendorName}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(rtvId, order);
    return order;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Approval
  // ─────────────────────────────────────────────────────────────────────────
  approveReturn(rtvId: string, approvedBy: string, note?: string): CanonicalRTVOrder {
    const order = this.getOrderOrThrow(rtvId);
    if (order.status !== "REQUESTED") {
      throw new Error(`Cannot approve RTV in status '${order.status}'. Must be 'REQUESTED'.`);
    }

    const now = new Date().toISOString();
    order.status = "APPROVED";
    order.legacyStatus = "SUBMITTED";
    order.approvedBy = approvedBy;
    order.updatedAt = now;
    order.auditTrail.push({
      auditId: `aud-${Date.now()}`,
      fromStatus: "REQUESTED",
      toStatus: "APPROVED",
      action: "RETURN_APPROVED",
      performedBy: approvedBy,
      timestamp: now,
      note: note || "Commercial & inventory return approved by manager.",
    });

    return order;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Dispatch
  // ─────────────────────────────────────────────────────────────────────────
  dispatchReturn(
    rtvId: string,
    dispatchData: { courier: string; trackingNo: string; dispatchedBy: string },
    note?: string
  ): CanonicalRTVOrder {
    const order = this.getOrderOrThrow(rtvId);
    if (order.status !== "APPROVED") {
      throw new Error(`Cannot dispatch RTV in status '${order.status}'. Must be 'APPROVED'.`);
    }

    const now = new Date().toISOString();
    order.status = "GOODS_DISPATCHED";
    order.legacyStatus = "GOODS_DISPATCHED";
    order.dispatchInfo = {
      courier: dispatchData.courier,
      trackingNo: dispatchData.trackingNo,
      dispatchedBy: dispatchData.dispatchedBy,
      dispatchedAt: now,
    };
    order.updatedAt = now;
    order.auditTrail.push({
      auditId: `aud-${Date.now()}`,
      fromStatus: "APPROVED",
      toStatus: "GOODS_DISPATCHED",
      action: "GOODS_DISPATCHED",
      performedBy: dispatchData.dispatchedBy,
      timestamp: now,
      note: note || `Dispatched via ${dispatchData.courier} (AWB: ${dispatchData.trackingNo})`,
    });

    return order;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Vendor Receipt / Acknowledgment
  // ─────────────────────────────────────────────────────────────────────────
  recordVendorReceipt(rtvId: string, ackBy: string, expectedCreditDate?: string, note?: string): CanonicalRTVOrder {
    const order = this.getOrderOrThrow(rtvId);
    if (order.status !== "GOODS_DISPATCHED") {
      throw new Error(`Cannot record vendor receipt for RTV in status '${order.status}'. Must be 'GOODS_DISPATCHED'.`);
    }

    const now = new Date().toISOString();
    order.status = "VENDOR_RECEIVED";
    order.legacyStatus = "VENDOR_RECEIVED";
    order.expectedCreditDate = expectedCreditDate;
    order.updatedAt = now;
    order.auditTrail.push({
      auditId: `aud-${Date.now()}`,
      fromStatus: "GOODS_DISPATCHED",
      toStatus: "VENDOR_RECEIVED",
      action: "VENDOR_ACKNOWLEDGED",
      performedBy: ackBy,
      timestamp: now,
      note: note || "Vendor acknowledged physical receipt of returned consignment.",
    });

    return order;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: Debit Note & Reversal Settlement
  // ─────────────────────────────────────────────────────────────────────────
  raiseDebitNote(rtvId: string, raisedBy: string, note?: string): CanonicalDebitNote {
    const order = this.getOrderOrThrow(rtvId);
    if (order.status !== "VENDOR_RECEIVED" && order.status !== "APPROVED") {
      throw new Error(`Cannot raise debit note in status '${order.status}'. Must be 'VENDOR_RECEIVED' or 'APPROVED'.`);
    }

    this.dnCounter++;
    const dnNo = `DN-2026-${String(this.dnCounter).padStart(5, "0")}`;
    const now = new Date().toISOString();

    const dn: CanonicalDebitNote = {
      debitNoteNo: dnNo,
      rtvId: order.rtvId,
      rtvNo: order.rtvNo,
      vendorId: order.vendorId,
      vendorName: order.vendorName,
      netGoodsValue: order.totalNetValue,
      gstReversalAmount: order.totalGST,
      totalDebitAmount: order.totalWithGST,
      generatedAt: now,
      settled: false,
      referencePO: order.originalPONo,
    };

    order.status = "DEBIT_NOTE_RAISED";
    order.legacyStatus = "DEBIT_NOTE_RAISED";
    order.debitNote = dn;
    order.updatedAt = now;
    order.auditTrail.push({
      auditId: `aud-${Date.now()}`,
      fromStatus: "VENDOR_RECEIVED",
      toStatus: "DEBIT_NOTE_RAISED",
      action: "DEBIT_NOTE_RAISED",
      performedBy: raisedBy,
      timestamp: now,
      note: note || `Automated debit note ${dnNo} created for ₹${order.totalWithGST}`,
    });

    this.debitNotes.set(dnNo, dn);
    return dn;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: Close / Settle RTV
  // ─────────────────────────────────────────────────────────────────────────
  closeAndSettle(rtvId: string, settledBy: string, note?: string): CanonicalRTVOrder {
    const order = this.getOrderOrThrow(rtvId);
    if (order.status !== "DEBIT_NOTE_RAISED") {
      throw new Error(`Cannot settle RTV in status '${order.status}'. Must be 'DEBIT_NOTE_RAISED'.`);
    }

    const now = new Date().toISOString();
    order.status = "SETTLED";
    order.legacyStatus = "SETTLED";
    if (order.debitNote) {
      order.debitNote.settled = true;
      order.debitNote.settledAt = now;
      order.debitNote.settledBy = settledBy;
    }
    order.updatedAt = now;
    order.auditTrail.push({
      auditId: `aud-${Date.now()}`,
      fromStatus: "DEBIT_NOTE_RAISED",
      toStatus: "SETTLED",
      action: "RTV_CLOSED_SETTLED",
      performedBy: settledBy,
      timestamp: now,
      note: note || "Debit note adjusted against vendor payable ledger. RTV closed.",
    });

    return order;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query Helpers
  // ─────────────────────────────────────────────────────────────────────────
  getOrder(rtvId: string): CanonicalRTVOrder | undefined {
    return this.orders.get(rtvId);
  }

  getAllOrders(): CanonicalRTVOrder[] {
    return Array.from(this.orders.values());
  }

  getOrdersByVendor(vendorId: string): CanonicalRTVOrder[] {
    return Array.from(this.orders.values()).filter(o => o.vendorId === vendorId);
  }

  getDebitNotes(): CanonicalDebitNote[] {
    return Array.from(this.debitNotes.values());
  }

  private getOrderOrThrow(rtvId: string): CanonicalRTVOrder {
    const order = this.orders.get(rtvId);
    if (!order) {
      throw new Error(`RTV Order '${rtvId}' not found.`);
    }
    return order;
  }
}

export const canonicalRtvEngine = new CanonicalRTVDomainEngine();
export default canonicalRtvEngine;
