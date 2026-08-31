/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.109.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Consignment Stock Engine
 *
 * Tracks vendor-owned stock held at a retailer's location:
 *   Consignment Plan : ACTIVE → SETTLED / EXPIRED / CANCELLED
 *   Movements        : RECEIVED, SOLD, RETURNED, ADJUSTED
 *   Settlement       : Sale-or-return — sold qty billed to retailer;
 *                      unsold qty returned to vendor
 *   Aging            : Days-on-floor per batch; configurable aging bands
 *                      (Fresh / Normal / Ageing / Critical)
 *   Return Schedule  : Engine computes which items are due for return
 *                      based on agreed consignment term (days)
 */

export type ConsignmentStatus    = "ACTIVE" | "SETTLED" | "EXPIRED" | "CANCELLED";
export type MovementType         = "RECEIVED" | "SOLD" | "RETURNED" | "ADJUSTED";
export type AgingBand            = "FRESH" | "NORMAL" | "AGEING" | "CRITICAL";

export interface AgingConfig {
  freshDays:    number;   // 0 – freshDays → FRESH
  normalDays:   number;   // freshDays – normalDays → NORMAL
  ageingDays:   number;   // normalDays – ageingDays → AGEING
                          // > ageingDays → CRITICAL
}

export const DEFAULT_AGING_CONFIG: AgingConfig = {
  freshDays:  14,
  normalDays: 30,
  ageingDays: 60,
};

export interface ConsignmentLine {
  lineId:        string;
  sku:           string;
  productName:   string;
  vendorCost:    number;          // Cost per unit (billed on sale)
  receivedQty:   number;
  soldQty:       number;
  returnedQty:   number;
  adjustedQty:   number;         // Positive = added, negative = written off
  onHandQty:     number;         // receivedQty + adjustedQty - soldQty - returnedQty
  billedQty:     number;         // = soldQty
  billedAmt:     number;         // billedQty × vendorCost
  returnDueQty:  number;         // onHandQty that should be returned
}

export interface ConsignmentMovement {
  movementId:   string;
  lineId:       string;
  sku:          string;
  type:         MovementType;
  qty:          number;
  unitCost:     number;
  totalAmt:     number;
  performedBy:  string;
  timestamp:    string;
  note?:        string;
}

export interface AgingItem {
  sku:           string;
  productName:   string;
  onHandQty:     number;
  receivedDate:  string;
  daysOnFloor:   number;
  agingBand:     AgingBand;
  vendorCost:    number;
  exposedValue:  number;    // onHandQty × vendorCost
  returnDue:     boolean;
}

export interface ConsignmentSettlement {
  settlementId:  string;
  settledAt:     string;
  totalReceived: number;
  totalSold:     number;
  totalReturned: number;
  totalBilledAmt: number;
  totalReturnQty: number;
  lines: Array<{
    sku: string; productName: string;
    receivedQty: number; soldQty: number;
    returnedQty: number; billedAmt: number;
  }>;
}

export interface ConsignmentPlan {
  planId:        string;
  planNo:        string;
  vendorId:      string;
  vendorName:    string;
  branchCode:    string;
  termDays:      number;          // Agreed consignment period (days)
  startDate:     string;
  endDate:       string;          // startDate + termDays
  status:        ConsignmentStatus;
  lines:         ConsignmentLine[];
  movements:     ConsignmentMovement[];
  settlement?:   ConsignmentSettlement;
  totalReceived: number;
  totalSold:     number;
  totalReturned: number;
  totalBilledAmt: number;
  daysElapsed:   number;
  daysRemaining: number;
  createdAt:     string;
  updatedAt:     string;
}

export class ConsignmentEngine {
  private static planCounter  = 1;
  private static movCounter   = 1;
  private static settlCounter = 1;

  public static createPlan(params: {
    vendorId:    string;
    vendorName:  string;
    branchCode:  string;
    termDays:    number;
    startDate:   string;
    lines: Array<{ sku: string; productName: string; vendorCost: number; receivedQty: number }>;
  }): ConsignmentPlan {
    const now     = new Date().toISOString();
    const planNo  = `CSGN-${params.startDate.replace(/-/g, "")}-${String(this.planCounter++).padStart(4, "0")}`;
    const endDate = new Date(
      new Date(params.startDate).getTime() + params.termDays * 86400000
    ).toISOString().slice(0, 10);

    const lines: ConsignmentLine[] = params.lines.map((l, i) => ({
      lineId:       `CSL-${i + 1}`,
      sku:          l.sku,
      productName:  l.productName,
      vendorCost:   l.vendorCost,
      receivedQty:  l.receivedQty,
      soldQty:      0,
      returnedQty:  0,
      adjustedQty:  0,
      onHandQty:    l.receivedQty,
      billedQty:    0,
      billedAmt:    0,
      returnDueQty: 0,
    }));

    const movements: ConsignmentMovement[] = params.lines.map((l, i) => ({
      movementId:  `MOV-${this.movCounter++}`,
      lineId:      `CSL-${i + 1}`,
      sku:         l.sku,
      type:        "RECEIVED",
      qty:         l.receivedQty,
      unitCost:    l.vendorCost,
      totalAmt:    Math.round(l.receivedQty * l.vendorCost * 100) / 100,
      performedBy: "SYSTEM",
      timestamp:   now,
      note:        "Initial consignment receipt",
    }));

    return {
      planId: `CSGNID-${Date.now()}`,
      planNo,
      vendorId:    params.vendorId,
      vendorName:  params.vendorName,
      branchCode:  params.branchCode,
      termDays:    params.termDays,
      startDate:   params.startDate,
      endDate,
      status:      "ACTIVE",
      lines,
      movements,
      totalReceived:  params.lines.reduce((s, l) => s + l.receivedQty, 0),
      totalSold:      0,
      totalReturned:  0,
      totalBilledAmt: 0,
      daysElapsed:    0,
      daysRemaining:  params.termDays,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Record sales against consignment lines */
  public static recordSales(
    plan: ConsignmentPlan,
    sales: Array<{ sku: string; qty: number; performedBy: string }>,
    asOf: Date = new Date()
  ): ConsignmentPlan {
    const now    = asOf.toISOString();
    const newMov: ConsignmentMovement[] = [];

    const lines = plan.lines.map((l) => {
      const sale = sales.find((s) => s.sku === l.sku);
      if (!sale) return l;
      const qty         = Math.min(sale.qty, l.onHandQty);
      const soldQty     = l.soldQty + qty;
      const onHandQty   = l.onHandQty - qty;
      const billedQty   = soldQty;
      const billedAmt   = Math.round(billedQty * l.vendorCost * 100) / 100;
      newMov.push({
        movementId: `MOV-${this.movCounter++}`, lineId: l.lineId, sku: l.sku,
        type: "SOLD", qty, unitCost: l.vendorCost,
        totalAmt: Math.round(qty * l.vendorCost * 100) / 100,
        performedBy: sale.performedBy, timestamp: now,
      });
      return { ...l, soldQty, onHandQty, billedQty, billedAmt };
    });

    return this.recalc({ ...plan, lines, movements: [...plan.movements, ...newMov], updatedAt: now }, asOf);
  }

  /** Return unsold stock to vendor */
  public static recordReturn(
    plan: ConsignmentPlan,
    returns: Array<{ sku: string; qty: number; performedBy: string }>,
    asOf: Date = new Date()
  ): ConsignmentPlan {
    const now    = asOf.toISOString();
    const newMov: ConsignmentMovement[] = [];

    const lines = plan.lines.map((l) => {
      const ret = returns.find((r) => r.sku === l.sku);
      if (!ret) return l;
      const qty         = Math.min(ret.qty, l.onHandQty);
      const returnedQty = l.returnedQty + qty;
      const onHandQty   = l.onHandQty - qty;
      newMov.push({
        movementId: `MOV-${this.movCounter++}`, lineId: l.lineId, sku: l.sku,
        type: "RETURNED", qty, unitCost: l.vendorCost,
        totalAmt: Math.round(qty * l.vendorCost * 100) / 100,
        performedBy: ret.performedBy, timestamp: now,
      });
      return { ...l, returnedQty, onHandQty };
    });

    return this.recalc({ ...plan, lines, movements: [...plan.movements, ...newMov], updatedAt: now }, asOf);
  }

  private static recalc(plan: ConsignmentPlan, asOf: Date): ConsignmentPlan {
    const startMs   = new Date(plan.startDate).getTime();
    const asOfMs    = asOf.getTime();
    const daysElapsed   = Math.max(0, Math.floor((asOfMs - startMs) / 86400000));
    const daysRemaining = Math.max(0, plan.termDays - daysElapsed);

    const lines = plan.lines.map((l) => ({
      ...l,
      returnDueQty: l.onHandQty,
    }));

    return {
      ...plan,
      lines,
      daysElapsed,
      daysRemaining,
      totalSold:      lines.reduce((s, l) => s + l.soldQty, 0),
      totalReturned:  lines.reduce((s, l) => s + l.returnedQty, 0),
      totalBilledAmt: Math.round(lines.reduce((s, l) => s + l.billedAmt, 0) * 100) / 100,
    };
  }

  /** Compute aging for all on-hand lines as of a date */
  public static getAgingReport(
    plan: ConsignmentPlan,
    asOf: Date,
    cfg: AgingConfig = DEFAULT_AGING_CONFIG
  ): AgingItem[] {
    const startMs = new Date(plan.startDate).getTime();
    const asOfMs  = asOf.getTime();
    const daysOnFloor = Math.max(0, Math.floor((asOfMs - startMs) / 86400000));

    const band = (d: number): AgingBand =>
      d <= cfg.freshDays  ? "FRESH"
      : d <= cfg.normalDays ? "NORMAL"
      : d <= cfg.ageingDays ? "AGEING"
      : "CRITICAL";

    return plan.lines
      .filter((l) => l.onHandQty > 0)
      .map((l) => ({
        sku:          l.sku,
        productName:  l.productName,
        onHandQty:    l.onHandQty,
        receivedDate: plan.startDate,
        daysOnFloor,
        agingBand:    band(daysOnFloor),
        vendorCost:   l.vendorCost,
        exposedValue: Math.round(l.onHandQty * l.vendorCost * 100) / 100,
        returnDue:    daysOnFloor >= plan.termDays,
      }));
  }

  /** Return schedule: lines whose daysOnFloor ≥ termDays */
  public static getReturnSchedule(plan: ConsignmentPlan, asOf: Date): AgingItem[] {
    return this.getAgingReport(plan, asOf).filter((i) => i.returnDue);
  }

  /** Settle plan — bill sold qty, schedule return for on-hand qty */
  public static settle(plan: ConsignmentPlan, settledBy: string, asOf: Date = new Date()): ConsignmentPlan {
    const now = asOf.toISOString();
    const settlement: ConsignmentSettlement = {
      settlementId:   `STLID-${this.settlCounter++}`,
      settledAt:      now,
      totalReceived:  plan.totalReceived,
      totalSold:      plan.totalSold,
      totalReturned:  plan.totalReturned,
      totalBilledAmt: plan.totalBilledAmt,
      totalReturnQty: plan.lines.reduce((s, l) => s + l.onHandQty, 0),
      lines: plan.lines.map((l) => ({
        sku: l.sku, productName: l.productName,
        receivedQty: l.receivedQty, soldQty: l.soldQty,
        returnedQty: l.returnedQty, billedAmt: l.billedAmt,
      })),
    };
    return { ...plan, status: "SETTLED", settlement, updatedAt: now };
  }
}

export default ConsignmentEngine;
