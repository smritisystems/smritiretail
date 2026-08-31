/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.101.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Vendor Purchase Order Approval Workflow & 3-Way Match Engine
 *
 * Manages the full PO lifecycle and three-way matching:
 *   PO Lifecycle  : DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_RECEIVED
 *                   → RECEIVED → INVOICED → THREE_WAY_MATCHED → CLOSED / DISPUTED
 *
 *   3-Way Match   : Compares PO ↔ GRN ↔ Vendor Invoice per line with configurable
 *                   tolerance bands (qty tolerance %, price tolerance %)
 *                   Result → MATCHED / PRICE_VARIANCE / QTY_VARIANCE / BOTH_VARIANCE / UNMATCHED
 */

export type POStatus =
  | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT"
  | "PARTIALLY_RECEIVED" | "RECEIVED" | "INVOICED"
  | "THREE_WAY_MATCHED" | "CLOSED" | "DISPUTED" | "CANCELLED";

export type MatchResult = "MATCHED" | "PRICE_VARIANCE" | "QTY_VARIANCE" | "BOTH_VARIANCE" | "UNMATCHED";
export type ApprovalAction = "SUBMIT" | "APPROVE" | "REJECT" | "SEND" | "CANCEL";

export interface POLine {
  lineId: string;
  sku: string;
  productName: string;
  orderedQty: number;
  receivedQty?: number;
  invoicedQty?: number;
  unitPrice: number;           // PO agreed price
  receivedUnitPrice?: number;  // GRN recorded price
  invoicedUnitPrice?: number;  // Vendor invoice price
  lineTotal: number;           // orderedQty × unitPrice
  hsn?: string;
  gstRate?: number;
}

export interface PurchaseOrder {
  poId: string;
  poNo: string;
  vendorId: string;
  vendorName: string;
  branchCode: string;
  lines: POLine[];
  totalValue: number;
  taxTotal: number;
  grandTotal: number;
  status: POStatus;
  requestedBy: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  deliveryDate?: string;      // Expected delivery ISO date
  createdAt: string;
  updatedAt: string;
  auditTrail: POAuditEntry[];
}

export interface POAuditEntry {
  auditId: string;
  action: ApprovalAction | string;
  fromStatus: POStatus;
  toStatus: POStatus;
  performedBy: string;
  timestamp: string;
  note?: string;
}

export interface GoodsReceiptNote {
  grnId: string;
  grnNo: string;
  poId: string;
  vendorId: string;
  receivedBy: string;
  receivedAt: string;
  lines: Array<{ lineId: string; receivedQty: number; receivedUnitPrice: number; batchNo?: string }>;
}

export interface VendorInvoice {
  invoiceId: string;
  invoiceNo: string;
  poId: string;
  vendorId: string;
  invoiceDate: string;
  lines: Array<{ lineId: string; invoicedQty: number; invoicedUnitPrice: number }>;
  invoiceTotal: number;
}

export interface ThreeWayMatchLine {
  lineId: string;
  sku: string;
  productName: string;
  // PO values
  poQty: number;
  poUnitPrice: number;
  // GRN values
  grnQty: number;
  grnUnitPrice: number;
  // Invoice values
  invQty: number;
  invUnitPrice: number;
  // Variances
  qtyVariance: number;         // grnQty − invQty
  priceVariance: number;       // invUnitPrice − poUnitPrice
  qtyVariancePct: number;      // % of poQty
  priceVariancePct: number;    // % of poUnitPrice
  // Result
  matchResult: MatchResult;
  withinTolerance: boolean;
}

export interface ThreeWayMatchReport {
  poId: string;
  poNo: string;
  vendorName: string;
  matchedAt: string;
  overallResult: MatchResult;
  lines: ThreeWayMatchLine[];
  totalPOValue: number;
  totalGRNValue: number;
  totalInvoiceValue: number;
  totalPriceVariance: number;
  totalQtyVariance: number;
  requiresDispute: boolean;
}

export const THREE_WAY_CONFIG = {
  qtyTolerancePct: 2,      // ±2% qty variance is acceptable
  priceTolerancePct: 1,    // ±1% unit price variance is acceptable
};

export class ThreeWayMatchEngine {
  private static auditId = () => `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  private static poCounter = 1;

  /** Create a new purchase order in DRAFT */
  public static createPO(params: {
    vendorId: string;
    vendorName: string;
    branchCode: string;
    lines: Omit<POLine, "lineId" | "lineTotal">[];
    requestedBy: string;
    deliveryDate?: string;
  }): PurchaseOrder {
    const now = new Date().toISOString();
    const lines: POLine[] = params.lines.map((l, i) => ({
      ...l,
      lineId: `LINE-${i + 1}`,
      lineTotal: Math.round(l.orderedQty * l.unitPrice * 100) / 100,
    }));

    const totalValue = lines.reduce((s, l) => s + l.lineTotal, 0);
    const taxTotal = lines.reduce((s, l) => s + Math.round(l.lineTotal * ((l.gstRate ?? 0) / 100) * 100) / 100, 0);
    const grandTotal = Math.round((totalValue + taxTotal) * 100) / 100;
    const poNo = `PO-${now.slice(0, 10).replace(/-/g, "")}-${String(this.poCounter++).padStart(4, "0")}`;

    return {
      poId: `POID-${Date.now()}`,
      poNo,
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      branchCode: params.branchCode,
      lines,
      totalValue,
      taxTotal,
      grandTotal,
      status: "DRAFT",
      requestedBy: params.requestedBy,
      deliveryDate: params.deliveryDate,
      createdAt: now,
      updatedAt: now,
      auditTrail: [{
        auditId: this.auditId(),
        action: "SUBMIT",
        fromStatus: "DRAFT",
        toStatus: "DRAFT",
        performedBy: params.requestedBy,
        timestamp: now,
        note: "PO created in DRAFT",
      }],
    };
  }

  /** Generic status transition */
  private static transition(
    po: PurchaseOrder,
    toStatus: POStatus,
    action: ApprovalAction | string,
    performedBy: string,
    note?: string,
    extras: Partial<PurchaseOrder> = {}
  ): PurchaseOrder {
    const now = new Date().toISOString();
    const entry: POAuditEntry = {
      auditId: this.auditId(),
      action,
      fromStatus: po.status,
      toStatus,
      performedBy,
      timestamp: now,
      note,
    };
    return { ...po, ...extras, status: toStatus, updatedAt: now, auditTrail: [...po.auditTrail, entry] };
  }

  public static submitForApproval(po: PurchaseOrder, submittedBy: string): PurchaseOrder {
    return this.transition(po, "PENDING_APPROVAL", "SUBMIT", submittedBy, `Submitted by ${submittedBy}`);
  }

  public static approve(po: PurchaseOrder, approvedBy: string, note?: string): PurchaseOrder {
    return this.transition(po, "APPROVED", "APPROVE", approvedBy, note ?? `Approved by ${approvedBy}`, { approvedBy });
  }

  public static reject(po: PurchaseOrder, rejectedBy: string, reason: string): PurchaseOrder {
    return this.transition(po, "CANCELLED", "REJECT", rejectedBy, reason, { rejectedBy, rejectionReason: reason });
  }

  public static markSent(po: PurchaseOrder, sentBy: string): PurchaseOrder {
    return this.transition(po, "SENT", "SEND", sentBy, `PO sent to vendor ${po.vendorName}`);
  }

  /** Apply a GRN to the PO — updates received quantities on lines */
  public static applyGRN(po: PurchaseOrder, grn: GoodsReceiptNote): PurchaseOrder {
    const lines = po.lines.map((l) => {
      const grnLine = grn.lines.find((gl) => gl.lineId === l.lineId);
      if (!grnLine) return l;
      return { ...l, receivedQty: grnLine.receivedQty, receivedUnitPrice: grnLine.receivedUnitPrice };
    });
    const allReceived = lines.every((l) => (l.receivedQty ?? 0) >= l.orderedQty);
    const toStatus: POStatus = allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
    return this.transition(
      { ...po, lines },
      toStatus,
      "GRN_APPLIED",
      grn.receivedBy,
      `GRN ${grn.grnNo} applied — ${allReceived ? "fully" : "partially"} received`,
      { lines }
    );
  }

  /** Apply a vendor invoice to the PO — updates invoiced quantities on lines */
  public static applyInvoice(po: PurchaseOrder, invoice: VendorInvoice): PurchaseOrder {
    const lines = po.lines.map((l) => {
      const invLine = invoice.lines.find((il) => il.lineId === l.lineId);
      if (!invLine) return l;
      return { ...l, invoicedQty: invLine.invoicedQty, invoicedUnitPrice: invLine.invoicedUnitPrice };
    });
    return this.transition(
      { ...po, lines },
      "INVOICED",
      "INVOICE_APPLIED",
      "SYSTEM",
      `Invoice ${invoice.invoiceNo} applied`,
      { lines }
    );
  }

  /** Run 3-way match on a fully invoiced PO */
  public static runThreeWayMatch(po: PurchaseOrder): ThreeWayMatchReport {
    const now = new Date().toISOString();
    const { qtyTolerancePct, priceTolerancePct } = THREE_WAY_CONFIG;

    const matchLines: ThreeWayMatchLine[] = po.lines.map((l) => {
      const grnQty       = l.receivedQty ?? 0;
      const grnUnitPrice = l.receivedUnitPrice ?? l.unitPrice;
      const invQty       = l.invoicedQty ?? 0;
      const invUnitPrice = l.invoicedUnitPrice ?? l.unitPrice;

      const qtyVariance       = grnQty - invQty;
      const priceVariance     = invUnitPrice - l.unitPrice;
      const qtyVariancePct    = l.orderedQty > 0 ? Math.round(Math.abs(qtyVariance / l.orderedQty) * 10000) / 100 : 0;
      const priceVariancePct  = l.unitPrice > 0 ? Math.round(Math.abs(priceVariance / l.unitPrice) * 10000) / 100 : 0;

      const qtyOk   = qtyVariancePct <= qtyTolerancePct;
      const priceOk = priceVariancePct <= priceTolerancePct;

      let matchResult: MatchResult;
      if (qtyOk && priceOk)       matchResult = "MATCHED";
      else if (!qtyOk && !priceOk) matchResult = "BOTH_VARIANCE";
      else if (!priceOk)           matchResult = "PRICE_VARIANCE";
      else                         matchResult = "QTY_VARIANCE";

      return {
        lineId: l.lineId, sku: l.sku, productName: l.productName,
        poQty: l.orderedQty, poUnitPrice: l.unitPrice,
        grnQty, grnUnitPrice, invQty, invUnitPrice,
        qtyVariance, priceVariance, qtyVariancePct, priceVariancePct,
        matchResult, withinTolerance: qtyOk && priceOk,
      };
    });

    const hasVariance    = matchLines.some((l) => l.matchResult !== "MATCHED");
    const overallResult  = hasVariance
      ? (matchLines.some((l) => l.matchResult === "BOTH_VARIANCE") ? "BOTH_VARIANCE"
        : matchLines.some((l) => l.matchResult === "PRICE_VARIANCE") ? "PRICE_VARIANCE"
        : "QTY_VARIANCE")
      : "MATCHED";

    const totalPOValue      = po.lines.reduce((s, l) => s + l.lineTotal, 0);
    const totalGRNValue     = matchLines.reduce((s, l) => s + l.grnQty * l.grnUnitPrice, 0);
    const totalInvoiceValue = matchLines.reduce((s, l) => s + l.invQty * l.invUnitPrice, 0);
    const totalPriceVar     = matchLines.reduce((s, l) => s + Math.abs(l.priceVariance * l.invQty), 0);
    const totalQtyVar       = matchLines.reduce((s, l) => s + Math.abs(l.qtyVariance), 0);

    return {
      poId: po.poId, poNo: po.poNo, vendorName: po.vendorName,
      matchedAt: now, overallResult, lines: matchLines,
      totalPOValue: Math.round(totalPOValue * 100) / 100,
      totalGRNValue: Math.round(totalGRNValue * 100) / 100,
      totalInvoiceValue: Math.round(totalInvoiceValue * 100) / 100,
      totalPriceVariance: Math.round(totalPriceVar * 100) / 100,
      totalQtyVariance: totalQtyVar,
      requiresDispute: hasVariance,
    };
  }

  /** Close a matched PO or flag as DISPUTED */
  public static closeOrDispute(po: PurchaseOrder, report: ThreeWayMatchReport, closedBy: string): PurchaseOrder {
    if (report.requiresDispute) {
      return this.transition(po, "DISPUTED", "DISPUTE", closedBy, `3-way match failed: ${report.overallResult}`);
    }
    return this.transition(po, "CLOSED", "CLOSE", closedBy, "3-way match passed — PO closed");
  }
}

export default ThreeWayMatchEngine;
