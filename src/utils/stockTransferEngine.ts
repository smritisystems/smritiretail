/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.97.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Multi-Branch Stock Transfer & Inter-Branch Requisition Engine
 *
 * Manages the full lifecycle of inter-branch stock movements:
 *   - Requisition: requesting branch raises a stock requirement
 *   - Approval: fulfilling branch approves and reserves stock
 *   - Dispatch: goods dispatched with logistics reference
 *   - In-Transit tracking: intermediate status with expected arrival
 *   - Receiving confirmation: QC check, accepted / short / rejected qty
 *   - Audit trail per transition
 */

export type TransferStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "STOCK_RESERVED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "REJECTED"
  | "CANCELLED";

export type TransferType = "INTER_BRANCH" | "WAREHOUSE_TO_BRANCH" | "BRANCH_TO_WAREHOUSE";

export interface TransferLine {
  lineId: string;
  sku: string;
  productName: string;
  requestedQty: number;
  approvedQty?: number;
  dispatchedQty?: number;
  receivedQty?: number;
  shortQty?: number;
  unitCost: number;
  transferValue?: number;
}

export interface StockTransferOrder {
  transferId: string;
  transferType: TransferType;
  fromBranch: string;
  toBranch: string;
  lines: TransferLine[];
  totalTransferValue: number;
  status: TransferStatus;
  logisticsRef?: string;        // Courier / vehicle reference
  expectedArrival?: string;     // ISO date
  requestedBy: string;
  approvedBy?: string;
  dispatchedBy?: string;
  receivedBy?: string;
  createdAt: string;
  updatedAt: string;
  auditTrail: TransferAuditEntry[];
  receivingNotes?: string;
}

export interface TransferAuditEntry {
  auditId: string;
  fromStatus: TransferStatus;
  toStatus: TransferStatus;
  performedBy: string;
  timestamp: string;
  note?: string;
}

export interface TransferMetrics {
  totalTransfers: number;
  inTransit: number;
  pendingApproval: number;
  received: number;
  totalValueInTransit: number;
  avgTransitDays: number;
  shortReceiptRate: number;     // % of transfers with short qty
}

export class StockTransferEngine {
  private static auditId = (): string => `AUD-${Date.now()}`;
  private static transferId = (): string => `STO-${Date.now().toString().slice(-9)}`;

  /** Create a draft requisition */
  public static createRequisition(params: {
    transferType: TransferType;
    fromBranch: string;
    toBranch: string;
    lines: Omit<TransferLine, "lineId" | "transferValue">[];
    requestedBy: string;
  }): StockTransferOrder {
    const now = new Date().toISOString();
    const lines: TransferLine[] = params.lines.map((l, i) => ({
      ...l,
      lineId: `LINE-${i + 1}`,
      transferValue: Math.round(l.requestedQty * l.unitCost * 100) / 100,
    }));
    const totalTransferValue = lines.reduce((s, l) => s + (l.transferValue ?? 0), 0);

    const entry: TransferAuditEntry = {
      auditId: this.auditId(),
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      performedBy: params.requestedBy,
      timestamp: now,
      note: `Requisition submitted by ${params.requestedBy}`,
    };

    return {
      transferId: this.transferId(),
      transferType: params.transferType,
      fromBranch: params.fromBranch,
      toBranch: params.toBranch,
      lines,
      totalTransferValue,
      status: "SUBMITTED",
      requestedBy: params.requestedBy,
      createdAt: now,
      updatedAt: now,
      auditTrail: [entry],
    };
  }

  /** Generic status transition with audit */
  public static transition(
    order: StockTransferOrder,
    toStatus: TransferStatus,
    performedBy: string,
    note?: string,
    extras: Partial<StockTransferOrder> = {}
  ): StockTransferOrder {
    const now = new Date().toISOString();
    const entry: TransferAuditEntry = {
      auditId: this.auditId(),
      fromStatus: order.status,
      toStatus,
      performedBy,
      timestamp: now,
      note,
    };
    return {
      ...order,
      ...extras,
      status: toStatus,
      updatedAt: now,
      auditTrail: [...order.auditTrail, entry],
    };
  }

  /** Approve requisition with per-line approved qty */
  public static approve(
    order: StockTransferOrder,
    approvedLines: { lineId: string; approvedQty: number }[],
    approvedBy: string
  ): StockTransferOrder {
    const lines = order.lines.map((l) => {
      const approved = approvedLines.find((a) => a.lineId === l.lineId);
      const approvedQty = approved?.approvedQty ?? l.requestedQty;
      return { ...l, approvedQty, transferValue: Math.round(approvedQty * l.unitCost * 100) / 100 };
    });
    const totalTransferValue = lines.reduce((s, l) => s + (l.transferValue ?? 0), 0);
    return this.transition(
      { ...order, lines, totalTransferValue },
      "APPROVED",
      approvedBy,
      `Approved by ${approvedBy}`
    );
  }

  /** Dispatch the order */
  public static dispatch(
    order: StockTransferOrder,
    params: { logisticsRef: string; dispatchedBy: string; expectedArrival: string; dispatchedLines: { lineId: string; dispatchedQty: number }[] }
  ): StockTransferOrder {
    const lines = order.lines.map((l) => {
      const d = params.dispatchedLines.find((dl) => dl.lineId === l.lineId);
      return { ...l, dispatchedQty: d?.dispatchedQty ?? l.approvedQty ?? l.requestedQty };
    });
    return this.transition(
      { ...order, lines },
      "DISPATCHED",
      params.dispatchedBy,
      `Dispatched via ${params.logisticsRef}`,
      { logisticsRef: params.logisticsRef, expectedArrival: params.expectedArrival, dispatchedBy: params.dispatchedBy }
    );
  }

  /** Confirm receipt with per-line received/short qty */
  public static receive(
    order: StockTransferOrder,
    params: { receivedBy: string; receivingNotes?: string; receivedLines: { lineId: string; receivedQty: number }[] }
  ): StockTransferOrder {
    const lines = order.lines.map((l) => {
      const r = params.receivedLines.find((rl) => rl.lineId === l.lineId);
      const receivedQty = r?.receivedQty ?? 0;
      const shortQty = Math.max(0, (l.dispatchedQty ?? l.approvedQty ?? l.requestedQty) - receivedQty);
      return { ...l, receivedQty, shortQty };
    });
    const hasShort = lines.some((l) => (l.shortQty ?? 0) > 0);
    const toStatus: TransferStatus = hasShort ? "PARTIALLY_RECEIVED" : "RECEIVED";

    return this.transition(
      { ...order, lines },
      toStatus,
      params.receivedBy,
      params.receivingNotes ?? `Received by ${params.receivedBy}${hasShort ? " — short receipt detected" : ""}`,
      { receivedBy: params.receivedBy, receivingNotes: params.receivingNotes }
    );
  }

  /** Compute metrics across all transfer orders */
  public static computeMetrics(orders: StockTransferOrder[]): TransferMetrics {
    let inTransit = 0, pendingApproval = 0, received = 0, totalValueInTransit = 0;
    let totalTransitMs = 0, transitCount = 0;
    let shortReceiptCount = 0;

    for (const o of orders) {
      if (o.status === "DISPATCHED" || o.status === "IN_TRANSIT") { inTransit++; totalValueInTransit += o.totalTransferValue; }
      if (o.status === "SUBMITTED" || o.status === "APPROVED") pendingApproval++;
      if (o.status === "RECEIVED" || o.status === "PARTIALLY_RECEIVED") {
        received++;
        if (o.status === "PARTIALLY_RECEIVED") shortReceiptCount++;
        const dispatched = o.auditTrail.find((a) => a.toStatus === "DISPATCHED");
        const receivedAudit = o.auditTrail.find((a) => a.toStatus === "RECEIVED" || a.toStatus === "PARTIALLY_RECEIVED");
        if (dispatched && receivedAudit) {
          totalTransitMs += new Date(receivedAudit.timestamp).getTime() - new Date(dispatched.timestamp).getTime();
          transitCount++;
        }
      }
    }

    return {
      totalTransfers: orders.length,
      inTransit,
      pendingApproval,
      received,
      totalValueInTransit,
      avgTransitDays: transitCount > 0 ? Math.round(totalTransitMs / transitCount / 86400000 * 10) / 10 : 0,
      shortReceiptRate: received > 0 ? Math.round((shortReceiptCount / received) * 100) : 0,
    };
  }
}

export default StockTransferEngine;
