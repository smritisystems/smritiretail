/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.105.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Inter-Store Purchase Order (IPO) Engine
 *
 * Manages branch-to-branch stock requisition and fulfillment:
 *   IPO Lifecycle   : DRAFT → SUBMITTED → APPROVED → PICKING → DISPATCHED
 *                     → AUTO_GRN → CLOSED / DISPUTED / CANCELLED
 *
 *   Auto-GRN        : On DISPATCHED confirmation, engine auto-generates a
 *                     GRN at the receiving branch with full line-level
 *                     received qty and variance flags.
 *
 *   Fulfillment     : Fulfilling branch can partially fulfill lines
 *                     (PARTIAL_FULFILLMENT) with unfulfilled qty tracked.
 */

export type IPOStatus =
  | "DRAFT" | "SUBMITTED" | "APPROVED" | "PICKING"
  | "DISPATCHED" | "AUTO_GRN" | "CLOSED" | "DISPUTED" | "CANCELLED";

export type IPOLineStatus = "PENDING" | "PICKING" | "FULFILLED" | "PARTIAL" | "CANCELLED";

export interface IPOLine {
  lineId: string;
  sku: string;
  productName: string;
  requestedQty: number;
  approvedQty: number;
  pickedQty: number;
  dispatchedQty: number;
  receivedQty: number;
  shortQty: number;
  unitCost: number;
  lineValue: number;         // dispatchedQty × unitCost
  lineStatus: IPOLineStatus;
}

export interface IPOAuditEntry {
  auditId: string;
  fromStatus: IPOStatus;
  toStatus: IPOStatus;
  performedBy: string;
  timestamp: string;
  note?: string;
}

export interface InterStorePO {
  ipoId: string;
  ipoNo: string;
  requestingBranch: string;
  fulfillingBranch: string;
  lines: IPOLine[];
  status: IPOStatus;
  requestedBy: string;
  approvedBy?: string;
  dispatchRef?: string;
  totalLines: number;
  totalRequestedQty: number;
  totalDispatchedQty: number;
  totalReceivedQty: number;
  totalValue: number;
  fulfillmentRate: number;     // totalDispatchedQty / totalRequestedQty %
  createdAt: string;
  updatedAt: string;
  auditTrail: IPOAuditEntry[];
  autoGRN?: AutoGRN;
}

export interface AutoGRN {
  grnId: string;
  grnNo: string;
  ipoId: string;
  receivingBranch: string;
  fulfillingBranch: string;
  generatedAt: string;
  lines: Array<{
    lineId: string;
    sku: string;
    productName: string;
    dispatchedQty: number;
    receivedQty: number;
    shortQty: number;
    hasVariance: boolean;
  }>;
  hasVariance: boolean;
  totalReceived: number;
  totalDispatched: number;
}

export class IPOEngine {
  private static ipoCounter = 1;
  private static grnCounter = 1;
  private static auditId = () => `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  public static createIPO(params: {
    requestingBranch: string;
    fulfillingBranch: string;
    requestedBy: string;
    lines: Array<{ sku: string; productName: string; requestedQty: number; unitCost: number }>;
  }): InterStorePO {
    const now = new Date().toISOString();
    const ipoNo = `IPO-${now.slice(0, 10).replace(/-/g, "")}-${String(this.ipoCounter++).padStart(4, "0")}`;

    const lines: IPOLine[] = params.lines.map((l, i) => ({
      lineId: `IPOL-${i + 1}`,
      sku: l.sku,
      productName: l.productName,
      requestedQty: l.requestedQty,
      approvedQty: 0,
      pickedQty: 0,
      dispatchedQty: 0,
      receivedQty: 0,
      shortQty: 0,
      unitCost: l.unitCost,
      lineValue: 0,
      lineStatus: "PENDING",
    }));

    return {
      ipoId: `IPOID-${Date.now()}`,
      ipoNo,
      requestingBranch: params.requestingBranch,
      fulfillingBranch: params.fulfillingBranch,
      lines,
      status: "DRAFT",
      requestedBy: params.requestedBy,
      totalLines: lines.length,
      totalRequestedQty: lines.reduce((s, l) => s + l.requestedQty, 0),
      totalDispatchedQty: 0,
      totalReceivedQty: 0,
      totalValue: 0,
      fulfillmentRate: 0,
      createdAt: now,
      updatedAt: now,
      auditTrail: [{ auditId: this.auditId(), fromStatus: "DRAFT", toStatus: "DRAFT", performedBy: params.requestedBy, timestamp: now, note: "IPO created" }],
    };
  }

  private static transition(
    ipo: InterStorePO,
    toStatus: IPOStatus,
    performedBy: string,
    note?: string,
    extras: Partial<InterStorePO> = {}
  ): InterStorePO {
    const now = new Date().toISOString();
    const entry: IPOAuditEntry = { auditId: this.auditId(), fromStatus: ipo.status, toStatus, performedBy, timestamp: now, note };
    return { ...ipo, ...extras, status: toStatus, updatedAt: now, auditTrail: [...ipo.auditTrail, entry] };
  }

  private static recalcTotals(ipo: InterStorePO): InterStorePO {
    const totalDispatchedQty = ipo.lines.reduce((s, l) => s + l.dispatchedQty, 0);
    const totalReceivedQty   = ipo.lines.reduce((s, l) => s + l.receivedQty, 0);
    const totalValue         = Math.round(ipo.lines.reduce((s, l) => s + l.lineValue, 0) * 100) / 100;
    const fulfillmentRate    = ipo.totalRequestedQty > 0
      ? Math.round((totalDispatchedQty / ipo.totalRequestedQty) * 10000) / 100
      : 0;
    return { ...ipo, totalDispatchedQty, totalReceivedQty, totalValue, fulfillmentRate };
  }

  public static submit(ipo: InterStorePO, submittedBy: string): InterStorePO {
    return this.transition(ipo, "SUBMITTED", submittedBy, `Submitted for approval`);
  }

  /** Approve with qty overrides per line (fulfilling branch decides available qty) */
  public static approve(
    ipo: InterStorePO,
    approvedBy: string,
    approvals: Array<{ lineId: string; approvedQty: number }>
  ): InterStorePO {
    const lines = ipo.lines.map((l) => {
      const approval = approvals.find((a) => a.lineId === l.lineId);
      const approvedQty = approval ? Math.min(approval.approvedQty, l.requestedQty) : l.requestedQty;
      return { ...l, approvedQty };
    });
    return this.transition({ ...ipo, lines }, "APPROVED", approvedBy, `Approved by ${approvedBy}`, { approvedBy });
  }

  public static startPicking(ipo: InterStorePO, pickedBy: string): InterStorePO {
    const lines = ipo.lines.map((l) => ({ ...l, lineStatus: "PICKING" as IPOLineStatus }));
    return this.transition({ ...ipo, lines }, "PICKING", pickedBy, `Picking started`);
  }

  /** Record picks per line, dispatch */
  public static dispatch(
    ipo: InterStorePO,
    dispatchRef: string,
    picks: Array<{ lineId: string; pickedQty: number }>,
    dispatchedBy: string
  ): InterStorePO {
    const lines = ipo.lines.map((l) => {
      const pick = picks.find((p) => p.lineId === l.lineId);
      const pickedQty     = pick ? Math.min(pick.pickedQty, l.approvedQty) : l.pickedQty;
      const dispatchedQty = pickedQty;
      const lineValue     = Math.round(dispatchedQty * l.unitCost * 100) / 100;
      const lineStatus: IPOLineStatus = dispatchedQty === 0 ? "CANCELLED"
        : dispatchedQty < l.requestedQty ? "PARTIAL" : "FULFILLED";
      return { ...l, pickedQty, dispatchedQty, lineValue, lineStatus };
    });
    const updated = this.recalcTotals({ ...ipo, lines });
    return this.transition(updated, "DISPATCHED", dispatchedBy, `Dispatched — Ref: ${dispatchRef}`, { dispatchRef });
  }

  /** Auto-generate GRN at receiving branch on confirmation */
  public static generateAutoGRN(
    ipo: InterStorePO,
    receivedQties: Array<{ lineId: string; receivedQty: number }>,
    receivedBy: string
  ): InterStorePO {
    const now = new Date().toISOString();
    const grnNo = `IGRN-${now.slice(0, 10).replace(/-/g, "")}-${String(this.grnCounter++).padStart(4, "0")}`;

    const lines = ipo.lines.map((l) => {
      const recv = receivedQties.find((r) => r.lineId === l.lineId);
      const receivedQty = recv ? recv.receivedQty : l.dispatchedQty; // default: full received
      const shortQty    = Math.max(0, l.dispatchedQty - receivedQty);
      return { ...l, receivedQty, shortQty };
    });

    const grnLines = lines.map((l) => ({
      lineId: l.lineId, sku: l.sku, productName: l.productName,
      dispatchedQty: l.dispatchedQty, receivedQty: l.receivedQty,
      shortQty: l.shortQty, hasVariance: l.shortQty > 0,
    }));

    const autoGRN: AutoGRN = {
      grnId:            `IGRNID-${Date.now()}`,
      grnNo,
      ipoId:            ipo.ipoId,
      receivingBranch:  ipo.requestingBranch,
      fulfillingBranch: ipo.fulfillingBranch,
      generatedAt:      now,
      lines:            grnLines,
      hasVariance:      grnLines.some((l) => l.hasVariance),
      totalReceived:    lines.reduce((s, l) => s + l.receivedQty, 0),
      totalDispatched:  lines.reduce((s, l) => s + l.dispatchedQty, 0),
    };

    const updated = this.recalcTotals({ ...ipo, lines });
    const toStatus: IPOStatus = autoGRN.hasVariance ? "DISPUTED" : "CLOSED";
    return this.transition(
      { ...updated, autoGRN },
      "AUTO_GRN",
      receivedBy,
      `Auto-GRN ${grnNo} generated — ${autoGRN.hasVariance ? "variance detected" : "fully received"}`,
      { autoGRN }
    );
  }

  public static close(ipo: InterStorePO, closedBy: string): InterStorePO {
    return this.transition(ipo, "CLOSED", closedBy, `IPO closed`);
  }
}

export default IPOEngine;
