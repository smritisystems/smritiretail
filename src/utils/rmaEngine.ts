/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.91.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type RMAStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "IN_TRANSIT"
  | "RECEIVED_AT_WAREHOUSE"
  | "QUALITY_INSPECTION"
  | "CREDIT_NOTE_ISSUED"
  | "REFUND_PROCESSED"
  | "REJECTED"
  | "CLOSED";

export type RMAReturnReason =
  | "DEFECTIVE_PRODUCT"
  | "WRONG_ITEM_SHIPPED"
  | "SIZE_COLOR_MISMATCH"
  | "CUSTOMER_CHANGED_MIND"
  | "DUPLICATE_ORDER"
  | "DAMAGED_IN_TRANSIT"
  | "QUALITY_BELOW_EXPECTATION"
  | "SUPPLIER_OVERSHIPMENT";

export type RMAResolutionType = "REFUND" | "EXCHANGE" | "STORE_CREDIT" | "SUPPLIER_CREDIT_NOTE" | "SCRAP";

export interface RMARequest {
  rmaNumber: string;
  originalSalesVoucher?: string;   // For customer returns
  originalPONumber?: string;       // For supplier returns
  type: "CUSTOMER_RETURN" | "SUPPLIER_RETURN";
  customerId?: string;
  supplierId?: string;
  items: RMALineItem[];
  reason: RMAReturnReason;
  resolution: RMAResolutionType;
  status: RMAStatus;
  initiatedAt: string;
  approvedAt?: string;
  receivedAt?: string;
  closedAt?: string;
  creditNoteNumber?: string;
  refundAmount?: number;
  storeCreditAmount?: number;
  restockingFee?: number;           // % deducted from refund if CUSTOMER_CHANGED_MIND
  notes?: string;
  auditTrail: RMAAuditEntry[];
}

export interface RMALineItem {
  lineId: string;
  sku: string;
  productName: string;
  returnQty: number;
  originalUnitPrice: number;
  returnValue: number;              // returnQty * originalUnitPrice
  condition: "AS_NEW" | "OPENED" | "DAMAGED" | "DEFECTIVE" | "SCRAP";
  restockAction: "RESTOCK" | "SCRAP" | "RETURN_TO_SUPPLIER" | "QUARANTINE";
}

export interface RMAAuditEntry {
  auditId: string;
  fromStatus: RMAStatus;
  toStatus: RMAStatus;
  performedBy: string;
  remarks: string;
  timestamp: string;
}

export interface ReverseLogisticsMetrics {
  totalRMAs: number;
  pendingApproval: number;
  inTransit: number;
  creditNotesIssued: number;
  totalReturnValue: number;
  totalCreditNoteValue: number;
  restockingFeeCollected: number;
  avgResolutionDays: number;
  byReason: Record<RMAReturnReason, number>;
  byResolution: Record<RMAResolutionType, number>;
}

export class RMAEngine {
  /** Create a new RMA request */
  public static create(params: {
    type: RMARequest["type"];
    originalSalesVoucher?: string;
    originalPONumber?: string;
    customerId?: string;
    supplierId?: string;
    items: Omit<RMALineItem, "lineId" | "returnValue">[];
    reason: RMAReturnReason;
    resolution: RMAResolutionType;
    notes?: string;
    initiatedBy: string;
  }): RMARequest {
    const now = new Date().toISOString();
    const rmaNumber = `RMA-${Date.now().toString().slice(-8)}`;

    const items: RMALineItem[] = params.items.map((item, i) => ({
      ...item,
      lineId: `LINE-${i + 1}`,
      returnValue: item.returnQty * item.originalUnitPrice,
    }));

    const auditEntry: RMAAuditEntry = {
      auditId: `AUD-${Date.now()}`,
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      performedBy: params.initiatedBy,
      remarks: `RMA created — Reason: ${params.reason}, Resolution: ${params.resolution}`,
      timestamp: now,
    };

    return {
      rmaNumber,
      originalSalesVoucher: params.originalSalesVoucher,
      originalPONumber: params.originalPONumber,
      type: params.type,
      customerId: params.customerId,
      supplierId: params.supplierId,
      items,
      reason: params.reason,
      resolution: params.resolution,
      status: "SUBMITTED",
      initiatedAt: now,
      notes: params.notes,
      auditTrail: [auditEntry],
    };
  }

  /** Transition RMA to the next status with audit entry */
  public static transition(
    rma: RMARequest,
    newStatus: RMAStatus,
    performedBy: string,
    remarks: string,
    extras?: { creditNoteNumber?: string; refundAmount?: number; storeCreditAmount?: number }
  ): RMARequest {
    const now = new Date().toISOString();
    const auditEntry: RMAAuditEntry = {
      auditId: `AUD-${Date.now()}`,
      fromStatus: rma.status,
      toStatus: newStatus,
      performedBy,
      remarks,
      timestamp: now,
    };

    const updated: RMARequest = {
      ...rma,
      status: newStatus,
      auditTrail: [...rma.auditTrail, auditEntry],
    };

    if (newStatus === "APPROVED") updated.approvedAt = now;
    if (newStatus === "RECEIVED_AT_WAREHOUSE") updated.receivedAt = now;
    if (newStatus === "CREDIT_NOTE_ISSUED") {
      updated.creditNoteNumber = extras?.creditNoteNumber;
      updated.refundAmount = extras?.refundAmount;
    }
    if (newStatus === "CLOSED") updated.closedAt = now;

    return updated;
  }

  /** Calculate refund/credit amount after restocking fee deduction */
  public static calculateRefund(rma: RMARequest, restockingFeePct: number = 0): {
    grossReturnValue: number;
    restockingFeeAmt: number;
    netRefundAmount: number;
  } {
    const gross = rma.items.reduce((s, i) => s + i.returnValue, 0);
    // Restocking fee applies only for CUSTOMER_CHANGED_MIND
    const feeApplicable = rma.reason === "CUSTOMER_CHANGED_MIND" ? restockingFeePct : 0;
    const feeAmt = Math.round((gross * feeApplicable) / 100 * 100) / 100;
    return { grossReturnValue: gross, restockingFeeAmt: feeAmt, netRefundAmount: gross - feeAmt };
  }

  /** Compute reverse logistics metrics from a list of RMAs */
  public static computeMetrics(rmas: RMARequest[]): ReverseLogisticsMetrics {
    const byReason: Record<string, number> = {};
    const byResolution: Record<string, number> = {};
    let totalReturnValue = 0;
    let totalCreditNoteValue = 0;
    let totalRestockingFee = 0;
    let totalResolutionDays = 0;
    let resolvedCount = 0;

    for (const rma of rmas) {
      byReason[rma.reason] = (byReason[rma.reason] ?? 0) + 1;
      byResolution[rma.resolution] = (byResolution[rma.resolution] ?? 0) + 1;
      totalReturnValue += rma.items.reduce((s, i) => s + i.returnValue, 0);
      if (rma.refundAmount) totalCreditNoteValue += rma.refundAmount;
      if (rma.restockingFee) totalRestockingFee += rma.restockingFee;
      if (rma.closedAt && rma.initiatedAt) {
        const days = Math.round((new Date(rma.closedAt).getTime() - new Date(rma.initiatedAt).getTime()) / (1000 * 60 * 60 * 24));
        totalResolutionDays += days;
        resolvedCount++;
      }
    }

    return {
      totalRMAs: rmas.length,
      pendingApproval: rmas.filter((r) => r.status === "SUBMITTED").length,
      inTransit: rmas.filter((r) => r.status === "IN_TRANSIT").length,
      creditNotesIssued: rmas.filter((r) => r.creditNoteNumber).length,
      totalReturnValue,
      totalCreditNoteValue,
      restockingFeeCollected: totalRestockingFee,
      avgResolutionDays: resolvedCount > 0 ? Math.round(totalResolutionDays / resolvedCount) : 0,
      byReason: byReason as Record<RMAReturnReason, number>,
      byResolution: byResolution as Record<RMAResolutionType, number>,
    };
  }
}

export default RMAEngine;
