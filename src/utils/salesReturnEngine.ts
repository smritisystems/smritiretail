/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.120.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Sales Return & Exchange Engine
 *
 * Manages customer return and exchange flows post-sale:
 *   Return Order : `createReturn()` — line-level qty, reason, restock decision
 *   Exchange     : `createExchange()` — return lines + exchange lines, price diff
 *   Restock      : RESALEABLE | DAMAGED | DISPOSE per line
 *   Refund       : ORIGINAL_METHOD | STORE_CREDIT | EXCHANGE_CREDIT
 *   Status flow  : DRAFT → APPROVED → REFUNDED/EXCHANGED | REJECTED
 *   Audit        : Append-only per order
 */

export type ReturnLineReason  = "DEFECTIVE" | "WRONG_ITEM" | "SIZE_ISSUE" | "CHANGE_OF_MIND" | "DAMAGED_IN_TRANSIT" | "OTHER";
export type RestockDecision   = "RESALEABLE" | "DAMAGED" | "DISPOSE";
export type RefundMethod      = "ORIGINAL_METHOD" | "STORE_CREDIT" | "EXCHANGE_CREDIT";
export type ReturnOrderStatus = "DRAFT" | "APPROVED" | "REFUNDED" | "EXCHANGED" | "REJECTED";
export type ReturnOrderType   = "RETURN" | "EXCHANGE";

export interface ReturnLine {
  lineId:         string;
  sku:            string;
  productName:    string;
  returnQty:      number;
  unitPrice:      number;
  totalReturnAmt: number;
  reason:         ReturnLineReason;
  restockDecision: RestockDecision;
  reasonNote?:    string;
}

export interface ExchangeLine {
  lineId:      string;
  sku:         string;
  productName: string;
  exchangeQty: number;
  unitPrice:   number;
  totalExchangeAmt: number;
}

export interface ReturnAuditEntry {
  auditId:     string;
  action:      string;
  performedBy: string;
  timestamp:   string;
  note?:       string;
}

export interface SalesReturnOrder {
  returnId:       string;
  returnNo:       string;
  orderType:      ReturnOrderType;
  originalSaleRef: string;
  customerId?:    string;
  branchCode:     string;
  status:         ReturnOrderStatus;
  returnLines:    ReturnLine[];
  exchangeLines:  ExchangeLine[];
  totalReturnAmt:   number;
  totalExchangeAmt: number;
  priceDifference:  number;       // exchangeAmt - returnAmt; positive = customer pays extra
  refundMethod:   RefundMethod;
  refundAmt:      number;         // Actual cash/credit refunded (0 for EXCHANGE_CREDIT)
  taxAdj:         number;         // Tax adjustment on return
  rejectionReason?: string;
  auditTrail:     ReturnAuditEntry[];
  createdAt:      string;
  createdBy:      string;
  updatedAt:      string;
}

export class SalesReturnEngine {
  private static counter      = 1;
  private static lineCounter  = 1;
  private static auditCounter = 1;
  private static auditId      = () => `RAUD-${this.auditCounter++}`;

  private static sumLines(lines: ReturnLine[])   { return Math.round(lines.reduce((s, l) => s + l.totalReturnAmt, 0) * 100) / 100; }
  private static sumExchange(lines: ExchangeLine[]){ return Math.round(lines.reduce((s, l) => s + l.totalExchangeAmt, 0) * 100) / 100; }

  /** Create a pure return order */
  public static createReturn(params: {
    originalSaleRef: string;
    branchCode:      string;
    createdBy:       string;
    customerId?:     string;
    refundMethod:    RefundMethod;
    taxAdj?:         number;
    lines: Array<{
      sku:            string;
      productName:    string;
      returnQty:      number;
      unitPrice:      number;
      reason:         ReturnLineReason;
      restockDecision: RestockDecision;
      reasonNote?:    string;
    }>;
  }): SalesReturnOrder {
    const now      = new Date().toISOString();
    const returnNo = `RET-${params.branchCode}-${now.slice(0, 10).replace(/-/g, "")}-${String(this.counter++).padStart(4, "0")}`;

    const returnLines: ReturnLine[] = params.lines.map((l) => ({
      lineId:         `RLINE-${this.lineCounter++}`,
      sku:            l.sku,
      productName:    l.productName,
      returnQty:      l.returnQty,
      unitPrice:      l.unitPrice,
      totalReturnAmt: Math.round(l.unitPrice * l.returnQty * 100) / 100,
      reason:         l.reason,
      restockDecision: l.restockDecision,
      reasonNote:     l.reasonNote,
    }));

    const totalReturnAmt = this.sumLines(returnLines);
    const audit: ReturnAuditEntry = {
      auditId: this.auditId(), action: "RETURN_CREATED",
      performedBy: params.createdBy, timestamp: now,
      note: `${returnLines.length} line(s), total return ₹${totalReturnAmt} via ${params.refundMethod}`,
    };

    return {
      returnId: `RETID-${Date.now()}`, returnNo,
      orderType: "RETURN",
      originalSaleRef: params.originalSaleRef,
      customerId: params.customerId,
      branchCode: params.branchCode,
      status: "DRAFT",
      returnLines,
      exchangeLines: [],
      totalReturnAmt,
      totalExchangeAmt: 0,
      priceDifference:  -totalReturnAmt,  // Net negative for pure return
      refundMethod: params.refundMethod,
      refundAmt: params.refundMethod === "EXCHANGE_CREDIT" ? 0 : totalReturnAmt,
      taxAdj: params.taxAdj ?? 0,
      auditTrail: [audit],
      createdAt: now, createdBy: params.createdBy, updatedAt: now,
    };
  }

  /** Create an exchange order — return old items, receive new */
  public static createExchange(params: {
    originalSaleRef: string;
    branchCode:      string;
    createdBy:       string;
    customerId?:     string;
    taxAdj?:         number;
    returnLines: Array<{
      sku: string; productName: string; returnQty: number; unitPrice: number;
      reason: ReturnLineReason; restockDecision: RestockDecision; reasonNote?: string;
    }>;
    exchangeLines: Array<{
      sku: string; productName: string; exchangeQty: number; unitPrice: number;
    }>;
  }): SalesReturnOrder {
    const now      = new Date().toISOString();
    const returnNo = `EXC-${params.branchCode}-${now.slice(0, 10).replace(/-/g, "")}-${String(this.counter++).padStart(4, "0")}`;

    const returnLines: ReturnLine[] = params.returnLines.map((l) => ({
      lineId:         `RLINE-${this.lineCounter++}`,
      sku:            l.sku,
      productName:    l.productName,
      returnQty:      l.returnQty,
      unitPrice:      l.unitPrice,
      totalReturnAmt: Math.round(l.unitPrice * l.returnQty * 100) / 100,
      reason:         l.reason,
      restockDecision: l.restockDecision,
      reasonNote:     l.reasonNote,
    }));

    const exchangeLines: ExchangeLine[] = params.exchangeLines.map((l) => ({
      lineId:           `ELINE-${this.lineCounter++}`,
      sku:              l.sku,
      productName:      l.productName,
      exchangeQty:      l.exchangeQty,
      unitPrice:        l.unitPrice,
      totalExchangeAmt: Math.round(l.unitPrice * l.exchangeQty * 100) / 100,
    }));

    const totalReturnAmt   = this.sumLines(returnLines);
    const totalExchangeAmt = this.sumExchange(exchangeLines);
    const priceDifference  = Math.round((totalExchangeAmt - totalReturnAmt) * 100) / 100;
    // Refund: if returnAmt > exchangeAmt, customer gets credit back; else 0 (they pay the diff)
    const refundAmt = priceDifference < 0 ? Math.abs(priceDifference) : 0;
    const refundMethod: RefundMethod = priceDifference >= 0 ? "EXCHANGE_CREDIT" : "STORE_CREDIT";

    const audit: ReturnAuditEntry = {
      auditId: this.auditId(), action: "EXCHANGE_CREATED",
      performedBy: params.createdBy, timestamp: now,
      note: `Return ₹${totalReturnAmt} / Exchange ₹${totalExchangeAmt} / Diff ₹${priceDifference}`,
    };

    return {
      returnId: `EXCID-${Date.now()}`, returnNo,
      orderType: "EXCHANGE",
      originalSaleRef: params.originalSaleRef,
      customerId: params.customerId,
      branchCode: params.branchCode,
      status: "DRAFT",
      returnLines, exchangeLines,
      totalReturnAmt, totalExchangeAmt, priceDifference,
      refundMethod, refundAmt,
      taxAdj: params.taxAdj ?? 0,
      auditTrail: [audit],
      createdAt: now, createdBy: params.createdBy, updatedAt: now,
    };
  }

  /** Approve — triggers refund/exchange processing */
  public static approve(order: SalesReturnOrder, approvedBy: string): SalesReturnOrder {
    if (order.status !== "DRAFT") throw new Error(`Cannot approve — status is ${order.status}`);
    const now    = new Date().toISOString();
    const status: ReturnOrderStatus = order.orderType === "EXCHANGE" ? "EXCHANGED" : "REFUNDED";
    const audit: ReturnAuditEntry = {
      auditId: this.auditId(), action: "APPROVED",
      performedBy: approvedBy, timestamp: now,
      note: `${status} — ${order.refundMethod}${order.refundAmt > 0 ? ` ₹${order.refundAmt}` : ""}`,
    };
    return { ...order, status, auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }

  /** Reject return/exchange */
  public static reject(order: SalesReturnOrder, rejectedBy: string, reason: string): SalesReturnOrder {
    if (order.status !== "DRAFT") throw new Error(`Cannot reject — status is ${order.status}`);
    const now = new Date().toISOString();
    const audit: ReturnAuditEntry = {
      auditId: this.auditId(), action: "REJECTED",
      performedBy: rejectedBy, timestamp: now, note: reason,
    };
    return { ...order, status: "REJECTED", rejectionReason: reason, auditTrail: [...order.auditTrail, audit], updatedAt: now };
  }

  /** Return summary across a set of orders */
  public static returnSummary(orders: SalesReturnOrder[]): {
    totalReturnOrders:   number;
    totalExchangeOrders: number;
    totalRefundedAmt:    number;
    totalResaleableQty:  number;
    totalDamagedQty:     number;
    totalDisposeQty:     number;
    byStatus:            Record<ReturnOrderStatus, number>;
  } {
    const byStatus = {} as Record<ReturnOrderStatus, number>;
    let totalRefundedAmt = 0, totalResaleableQty = 0, totalDamagedQty = 0, totalDisposeQty = 0;
    let totalReturnOrders = 0, totalExchangeOrders = 0;

    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      if (o.status === "REFUNDED" || o.status === "EXCHANGED") totalRefundedAmt += o.refundAmt;
      for (const l of o.returnLines) {
        if (l.restockDecision === "RESALEABLE") totalResaleableQty += l.returnQty;
        if (l.restockDecision === "DAMAGED")    totalDamagedQty    += l.returnQty;
        if (l.restockDecision === "DISPOSE")    totalDisposeQty    += l.returnQty;
      }
      if (o.orderType === "RETURN")    totalReturnOrders++;
      if (o.orderType === "EXCHANGE")  totalExchangeOrders++;
    }
    return {
      totalReturnOrders, totalExchangeOrders,
      totalRefundedAmt: Math.round(totalRefundedAmt * 100) / 100,
      totalResaleableQty, totalDamagedQty, totalDisposeQty, byStatus,
    };
  }
}

export default SalesReturnEngine;
