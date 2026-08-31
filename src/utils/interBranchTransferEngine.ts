/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.118.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Inter-Branch Stock Transfer Engine
 *
 * Manages stock movement between branches with full audit trail:
 *   Creation    : `createTransfer()` — source branch, destination branch, line items
 *   Dispatch    : `dispatch()` — sets IN_TRANSIT, locks source qty
 *   Receipt     : `receive()` — records received qty per line, detects variance
 *   Variance    : line-level variance = dispatchedQty - receivedQty
 *   Completion  : `complete()` — settles after partial/full receipt
 *   Cancellation: `cancel()` — only from DRAFT or APPROVED
 *   Status flow : DRAFT → APPROVED → IN_TRANSIT → RECEIVED → COMPLETED / CANCELLED
 */

export type TransferStatus =
  | "DRAFT"
  | "APPROVED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "COMPLETED"
  | "CANCELLED";

export interface TransferLine {
  lineId:       string;
  sku:          string;
  productName:  string;
  requestedQty: number;
  dispatchedQty: number;    // Set on dispatch
  receivedQty:   number;    // Set on receive
  variance:      number;    // dispatchedQty - receivedQty
  unitCost:      number;
  batchRef?:     string;    // Optional batch/lot reference
}

export interface TransferAuditEntry {
  auditId:     string;
  action:      string;
  performedBy: string;
  timestamp:   string;
  note?:       string;
}

export interface StockTransferOrder {
  transferId:    string;
  transferNo:    string;
  fromBranch:    string;
  toBranch:      string;
  status:        TransferStatus;
  lines:         TransferLine[];
  totalLines:    number;
  totalRequestedQty: number;
  totalDispatchedQty: number;
  totalReceivedQty:   number;
  totalVarianceQty:   number;
  hasVariance:        boolean;
  dispatchedAt?:  string;
  receivedAt?:    string;
  completedAt?:   string;
  cancelledAt?:   string;
  cancelReason?:  string;
  auditTrail:     TransferAuditEntry[];
  createdAt:      string;
  createdBy:      string;
  updatedAt:      string;
}

export class InterBranchTransferEngine {
  private static counter      = 1;
  private static lineCounter  = 1;
  private static auditCounter = 1;
  private static auditId      = () => `TAUD-${this.auditCounter++}`;

  private static totals(lines: TransferLine[]): {
    totalRequestedQty: number;
    totalDispatchedQty: number;
    totalReceivedQty:   number;
    totalVarianceQty:   number;
    hasVariance:        boolean;
  } {
    const totalRequestedQty  = lines.reduce((s, l) => s + l.requestedQty, 0);
    const totalDispatchedQty = lines.reduce((s, l) => s + l.dispatchedQty, 0);
    const totalReceivedQty   = lines.reduce((s, l) => s + l.receivedQty, 0);
    const totalVarianceQty   = lines.reduce((s, l) => s + Math.abs(l.variance), 0);
    return { totalRequestedQty, totalDispatchedQty, totalReceivedQty, totalVarianceQty, hasVariance: totalVarianceQty > 0 };
  }

  public static createTransfer(params: {
    fromBranch: string;
    toBranch:   string;
    createdBy:  string;
    lines: Array<{
      sku:         string;
      productName: string;
      requestedQty: number;
      unitCost:    number;
      batchRef?:   string;
    }>;
  }): StockTransferOrder {
    const now = new Date().toISOString();
    const transferNo = `STO-${params.fromBranch}-${now.slice(0, 10).replace(/-/g, "")}-${String(this.counter++).padStart(4, "0")}`;

    const lines: TransferLine[] = params.lines.map((l) => ({
      lineId:       `TLINE-${this.lineCounter++}`,
      sku:          l.sku,
      productName:  l.productName,
      requestedQty: l.requestedQty,
      dispatchedQty: 0,
      receivedQty:   0,
      variance:      0,
      unitCost:      l.unitCost,
      batchRef:      l.batchRef,
    }));

    const audit: TransferAuditEntry = {
      auditId: this.auditId(), action: "TRANSFER_CREATED",
      performedBy: params.createdBy, timestamp: now,
      note: `${lines.length} line(s) from ${params.fromBranch} → ${params.toBranch}`,
    };

    return {
      transferId: `STOID-${Date.now()}`,
      transferNo,
      fromBranch: params.fromBranch,
      toBranch:   params.toBranch,
      status:     "DRAFT",
      lines,
      totalLines: lines.length,
      ...this.totals(lines),
      auditTrail: [audit],
      createdAt: now, createdBy: params.createdBy, updatedAt: now,
    };
  }

  /** Approve transfer — validates before dispatch */
  public static approve(order: StockTransferOrder, approvedBy: string): StockTransferOrder {
    if (order.status !== "DRAFT") throw new Error(`Cannot approve — status is ${order.status}`);
    const now = new Date().toISOString();
    const audit: TransferAuditEntry = {
      auditId: this.auditId(), action: "APPROVED",
      performedBy: approvedBy, timestamp: now,
      note: `Approved for dispatch — ${order.totalLines} line(s)`,
    };
    return { ...order, status: "APPROVED", auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }

  /** Dispatch — records actual dispatched qty per line; sets IN_TRANSIT */
  public static dispatch(
    order:       StockTransferOrder,
    dispatchedBy: string,
    lineQtys:    Record<string, number>  // lineId → dispatchedQty
  ): StockTransferOrder {
    if (order.status !== "APPROVED") throw new Error(`Cannot dispatch — status is ${order.status}`);
    const now   = new Date().toISOString();
    const lines = order.lines.map((l) => {
      const dQty = lineQtys[l.lineId] ?? l.requestedQty;
      return { ...l, dispatchedQty: dQty, variance: dQty - l.receivedQty };
    });
    const totals = this.totals(lines);
    const audit: TransferAuditEntry = {
      auditId: this.auditId(), action: "DISPATCHED",
      performedBy: dispatchedBy, timestamp: now,
      note: `Dispatched ${totals.totalDispatchedQty} units`,
    };
    return {
      ...order, status: "IN_TRANSIT", lines, ...totals,
      dispatchedAt: now, auditTrail: [...order.auditTrail, audit], updatedAt: now,
    };
  }

  /** Receive — records received qty per line; computes variance; sets RECEIVED */
  public static receive(
    order:      StockTransferOrder,
    receivedBy: string,
    lineQtys:   Record<string, number>  // lineId → receivedQty
  ): StockTransferOrder {
    if (order.status !== "IN_TRANSIT") throw new Error(`Cannot receive — status is ${order.status}`);
    const now   = new Date().toISOString();
    const lines = order.lines.map((l) => {
      const rQty = lineQtys[l.lineId] ?? l.dispatchedQty;
      return { ...l, receivedQty: rQty, variance: l.dispatchedQty - rQty };
    });
    const totals = this.totals(lines);
    const audit: TransferAuditEntry = {
      auditId: this.auditId(), action: "RECEIVED",
      performedBy: receivedBy, timestamp: now,
      note: `Received ${totals.totalReceivedQty} units${totals.hasVariance ? ` — variance ${totals.totalVarianceQty} units` : " — no variance"}`,
    };
    return {
      ...order, status: "RECEIVED", lines, ...totals,
      receivedAt: now, auditTrail: [...order.auditTrail, audit], updatedAt: now,
    };
  }

  /** Complete transfer after receipt review */
  public static complete(order: StockTransferOrder, completedBy: string): StockTransferOrder {
    if (order.status !== "RECEIVED") throw new Error(`Cannot complete — status is ${order.status}`);
    const now = new Date().toISOString();
    const audit: TransferAuditEntry = {
      auditId: this.auditId(), action: "COMPLETED",
      performedBy: completedBy, timestamp: now,
      note: `Transfer settled${order.hasVariance ? ` with variance ${order.totalVarianceQty} units` : " — clean"}`,
    };
    return { ...order, status: "COMPLETED", completedAt: now, auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }

  /** Cancel — only from DRAFT or APPROVED */
  public static cancel(order: StockTransferOrder, cancelledBy: string, reason: string): StockTransferOrder {
    if (!["DRAFT", "APPROVED"].includes(order.status)) throw new Error(`Cannot cancel — status is ${order.status}`);
    const now = new Date().toISOString();
    const audit: TransferAuditEntry = {
      auditId: this.auditId(), action: "CANCELLED",
      performedBy: cancelledBy, timestamp: now, note: reason,
    };
    return { ...order, status: "CANCELLED", cancelledAt: now, cancelReason: reason, auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }

  /** Summary across a list of transfer orders */
  public static transferSummary(orders: StockTransferOrder[]): {
    byStatus:      Record<TransferStatus, number>;
    withVariance:  number;
    totalInTransit: number;
    totalCompleted: number;
  } {
    const byStatus = {} as Record<TransferStatus, number>;
    let withVariance = 0, totalInTransit = 0, totalCompleted = 0;
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      if (o.hasVariance) withVariance++;
      if (o.status === "IN_TRANSIT") totalInTransit += o.totalDispatchedQty;
      if (o.status === "COMPLETED")  totalCompleted += o.totalReceivedQty;
    }
    return { byStatus, withVariance, totalInTransit, totalCompleted };
  }
}

export default InterBranchTransferEngine;
