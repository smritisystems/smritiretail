/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.117.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Stock Expiry & Batch Tracking Engine
 *
 * Manages batch/lot-level inventory with expiry lifecycle:
 *   Registration : `registerBatch()` — batch, lot, MFG/EXP dates, qty
 *   FEFO Picking : `fefoAllocation()` — First-Expired-First-Out allocation plan
 *   Alerts       : `nearExpiryBatches()` — configurable day-threshold
 *   Quarantine   : `quarantineBatch()` / `releaseFromQuarantine()` — freeze stock
 *   Expiry       : `expireBatch()` / `expireBatch()` — auto-mark EXPIRED
 *   Report       : `batchReport()` — per-SKU batch summary with aging
 */

export type BatchStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "QUARANTINED"
  | "EXPIRED"
  | "DEPLETED"
  | "RECALLED";

export type PickingStrategy = "FEFO" | "FIFO" | "LIFO";

export interface StockBatch {
  batchId:       string;
  batchNo:       string;
  lotNo?:        string;
  sku:           string;
  productName:   string;
  branchCode:    string;
  supplierId?:   string;
  mfgDate:       string;   // ISO date string
  expiryDate:    string;   // ISO date string
  receivedQty:   number;
  availableQty:  number;
  reservedQty:   number;
  quarantinedQty: number;
  unitCost:      number;
  status:        BatchStatus;
  quarantineReason?: string;
  createdAt:     string;
  updatedAt:     string;
}

export interface AllocationLine {
  batchId:      string;
  batchNo:      string;
  expiryDate:   string;
  allocatedQty: number;
  availableQty: number;   // Before allocation
  daysToExpiry: number;
}

export interface AllocationResult {
  sku:           string;
  requestedQty:  number;
  fulfilledQty:  number;
  shortfallQty:  number;
  lines:         AllocationLine[];
  fullyFulfilled: boolean;
}

export interface BatchAuditEntry {
  auditId:     string;
  batchId:     string;
  action:      string;
  performedBy: string;
  timestamp:   string;
  note?:       string;
  qtyBefore?:  number;
  qtyAfter?:   number;
}

export class StockExpiryEngine {
  private static counter = 1;
  private static auditCounter = 1;

  private static daysToExpiry(expiryDate: string, asOf: Date = new Date()): number {
    return Math.floor((new Date(expiryDate).getTime() - asOf.getTime()) / 86400000);
  }

  private static auditId = () => `BAUD-${this.auditCounter++}`;

  /** Register a new batch/lot */
  public static registerBatch(params: {
    batchNo:      string;
    lotNo?:       string;
    sku:          string;
    productName:  string;
    branchCode:   string;
    supplierId?:  string;
    mfgDate:      string;
    expiryDate:   string;
    receivedQty:  number;
    unitCost:     number;
  }): StockBatch {
    const now = new Date().toISOString();
    return {
      batchId:       `BATCH-${this.counter++}`,
      batchNo:       params.batchNo,
      lotNo:         params.lotNo,
      sku:           params.sku,
      productName:   params.productName,
      branchCode:    params.branchCode,
      supplierId:    params.supplierId,
      mfgDate:       params.mfgDate,
      expiryDate:    params.expiryDate,
      receivedQty:   params.receivedQty,
      availableQty:  params.receivedQty,
      reservedQty:   0,
      quarantinedQty: 0,
      unitCost:      params.unitCost,
      status:        "AVAILABLE",
      createdAt:     now,
      updatedAt:     now,
    };
  }

  /**
   * FEFO allocation across batches for a given SKU.
   * Sorts available batches by expiryDate ASC, allocates greedily.
   */
  public static fefoAllocation(
    batches:      StockBatch[],
    sku:          string,
    requestedQty: number,
    asOf:         Date = new Date()
  ): AllocationResult {
    const eligible = batches
      .filter((b) =>
        b.sku === b.sku &&
        b.sku === sku &&
        b.status === "AVAILABLE" &&
        b.availableQty > 0 &&
        new Date(b.expiryDate) > asOf
      )
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    const lines: AllocationLine[] = [];
    let remaining = requestedQty;

    for (const batch of eligible) {
      if (remaining <= 0) break;
      const allocate = Math.min(remaining, batch.availableQty);
      lines.push({
        batchId:      batch.batchId,
        batchNo:      batch.batchNo,
        expiryDate:   batch.expiryDate,
        allocatedQty: allocate,
        availableQty: batch.availableQty,
        daysToExpiry: this.daysToExpiry(batch.expiryDate, asOf),
      });
      remaining -= allocate;
    }

    const fulfilledQty  = requestedQty - remaining;
    return {
      sku,
      requestedQty,
      fulfilledQty,
      shortfallQty: remaining,
      lines,
      fullyFulfilled: remaining === 0,
    };
  }

  /** Deduct allocated qty from batches (applies allocation result) */
  public static deductAllocation(
    batches: StockBatch[],
    result:  AllocationResult
  ): StockBatch[] {
    const deductions = new Map(result.lines.map((l) => [l.batchId, l.allocatedQty]));
    return batches.map((b) => {
      const deduct = deductions.get(b.batchId);
      if (!deduct) return b;
      const newQty  = b.availableQty - deduct;
      const status: BatchStatus = newQty === 0 ? "DEPLETED" : "AVAILABLE";
      return { ...b, availableQty: newQty, status, updatedAt: new Date().toISOString() };
    });
  }

  /** Return batches expiring within `thresholdDays` */
  public static nearExpiryBatches(
    batches:       StockBatch[],
    thresholdDays: number = 30,
    asOf:          Date   = new Date()
  ): Array<StockBatch & { daysToExpiry: number }> {
    return batches
      .filter((b) =>
        b.status === "AVAILABLE" &&
        b.availableQty > 0 &&
        this.daysToExpiry(b.expiryDate, asOf) <= thresholdDays &&
        this.daysToExpiry(b.expiryDate, asOf) >= 0
      )
      .map((b) => ({ ...b, daysToExpiry: this.daysToExpiry(b.expiryDate, asOf) }))
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  }

  /** Quarantine a batch — moves qty to quarantinedQty */
  public static quarantineBatch(
    batch:  StockBatch,
    reason: string,
    qty:    number,
    by:     string
  ): StockBatch {
    if (batch.availableQty < qty) throw new Error(`Insufficient available qty to quarantine (have ${batch.availableQty}, requested ${qty})`);
    return {
      ...batch,
      availableQty:   batch.availableQty - qty,
      quarantinedQty: batch.quarantinedQty + qty,
      status:         "QUARANTINED",
      quarantineReason: reason,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Release quarantined qty back to available */
  public static releaseFromQuarantine(
    batch: StockBatch,
    qty:   number,
    by:    string
  ): StockBatch {
    if (batch.quarantinedQty < qty) throw new Error(`Insufficient quarantined qty to release (have ${batch.quarantinedQty}, requested ${qty})`);
    const newQuarantined = batch.quarantinedQty - qty;
    return {
      ...batch,
      availableQty:    batch.availableQty + qty,
      quarantinedQty:  newQuarantined,
      status:          newQuarantined === 0 ? "AVAILABLE" : "QUARANTINED",
      quarantineReason: newQuarantined === 0 ? undefined : batch.quarantineReason,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Mark batch EXPIRED if past expiryDate — idempotent */
  public static expireIfDue(batch: StockBatch, asOf: Date = new Date()): StockBatch {
    if (batch.status === "EXPIRED" || batch.status === "DEPLETED" || batch.status === "RECALLED") return batch;
    if (new Date(batch.expiryDate) >= asOf) return batch;
    return { ...batch, status: "EXPIRED", updatedAt: new Date().toISOString() };
  }

  public static expireBatch(batches: StockBatch[], asOf: Date = new Date()): StockBatch[] {
    return batches.map((b) => this.expireIfDue(b, asOf));
  }

  /** Per-SKU batch summary report */
  public static batchReport(
    batches: StockBatch[],
    asOf:    Date = new Date()
  ): Array<{
    sku:           string;
    productName:   string;
    totalBatches:  number;
    totalAvailable: number;
    totalExpired:  number;
    totalQuarantined: number;
    nearExpiry30d: number;   // qty near expiry
    batches:       Array<StockBatch & { daysToExpiry: number }>;
  }> {
    const bySkuMap = new Map<string, StockBatch[]>();
    for (const b of batches) {
      const arr = bySkuMap.get(b.sku) ?? [];
      arr.push(b);
      bySkuMap.set(b.sku, arr);
    }
    return Array.from(bySkuMap.entries()).map(([sku, skuBatches]) => {
      const totalAvailable   = skuBatches.filter((b) => b.status === "AVAILABLE").reduce((s, b) => s + b.availableQty, 0);
      const totalExpired     = skuBatches.filter((b) => b.status === "EXPIRED").reduce((s, b) => s + b.availableQty, 0);
      const totalQuarantined = skuBatches.reduce((s, b) => s + b.quarantinedQty, 0);
      const near30            = this.nearExpiryBatches(skuBatches, 30, asOf).reduce((s, b) => s + b.availableQty, 0);
      return {
        sku,
        productName:      skuBatches[0].productName,
        totalBatches:     skuBatches.length,
        totalAvailable,
        totalExpired,
        totalQuarantined,
        nearExpiry30d:    near30,
        batches:          skuBatches.map((b) => ({ ...b, daysToExpiry: this.daysToExpiry(b.expiryDate, asOf) })),
      };
    });
  }
}

export default StockExpiryEngine;
