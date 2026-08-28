/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.111.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Store Cash Drawer & Float Management Engine
 *
 * Manages the full cash drawer lifecycle for a POS terminal:
 *   Opening Float   : Cash counted per denomination at shift start
 *   Cash In / Out   : Petty cash movements with mandatory reason
 *   Denomination    : Denomination-level count → computed total
 *   Variance        : expectedCash vs actualCash → variance detection
 *   EOD             : End-of-day reconciliation snapshot; status BALANCED / SHORT / OVER
 *   Audit Log       : Immutable entry per action
 */

export type DrawerStatus   = "CLOSED" | "OPEN" | "RECONCILED";
export type MovementKind   = "CASH_IN" | "CASH_OUT" | "OPENING_FLOAT" | "SALE" | "REFUND";
export type ReconcileStatus = "BALANCED" | "SHORT" | "OVER";

export interface Denomination {
  value: number;   // Face value in rupees (e.g. 500, 100, 50, 20, 10, 5, 2, 1)
  count: number;
}

export interface DrawerMovement {
  movementId: string;
  kind:       MovementKind;
  amount:     number;
  note:       string;
  performedBy: string;
  timestamp:  string;
}

export interface DrawerAuditEntry {
  auditId:    string;
  action:     string;
  performedBy: string;
  amount?:    number;
  timestamp:  string;
  note?:      string;
}

export interface EODReconciliation {
  reconcileId:    string;
  reconciledAt:   string;
  reconciledBy:   string;
  expectedCash:   number;   // openingFloat + cashIn - cashOut + netSales
  actualCash:     number;   // Physically counted
  variance:       number;   // actualCash - expectedCash
  status:         ReconcileStatus;
  denominations:  Denomination[];
}

export interface CashDrawer {
  drawerId:       string;
  drawerNo:       string;
  branchCode:     string;
  posTerminal:    string;
  shiftId:        string;
  status:         DrawerStatus;
  openingFloat:   number;
  totalCashIn:    number;
  totalCashOut:   number;
  netSales:       number;
  netRefunds:     number;
  expectedCash:   number;
  currentBalance: number;
  movements:      DrawerMovement[];
  auditTrail:     DrawerAuditEntry[];
  reconciliation?: EODReconciliation;
  openedAt:       string;
  openedBy:       string;
  updatedAt:      string;
}

export const STANDARD_DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export class CashDrawerEngine {
  private static drawerCounter  = 1;
  private static movCounter     = 1;
  private static reconcileCounter = 1;
  private static auditId = () => `CDAUD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  /** Count denomination array → total rupees */
  public static countDenominations(denominations: Denomination[]): number {
    return Math.round(
      denominations.reduce((s, d) => s + d.value * d.count, 0) * 100
    ) / 100;
  }

  /** Open drawer with denomination-level float */
  public static openDrawer(params: {
    branchCode:   string;
    posTerminal:  string;
    shiftId:      string;
    openedBy:     string;
    denominations: Denomination[];
  }): CashDrawer {
    const now         = new Date().toISOString();
    const openingFloat = this.countDenominations(params.denominations);
    const drawerNo    = `DRW-${params.posTerminal}-${now.slice(0, 10).replace(/-/g, "")}-${String(this.drawerCounter++).padStart(3, "0")}`;

    const openMov: DrawerMovement = {
      movementId: `CMOV-${this.movCounter++}`,
      kind:       "OPENING_FLOAT",
      amount:     openingFloat,
      note:       `Opening float — ${params.denominations.map((d) => `₹${d.value}×${d.count}`).join(", ")}`,
      performedBy: params.openedBy,
      timestamp:  now,
    };

    const auditEntry: DrawerAuditEntry = {
      auditId:    this.auditId(),
      action:     "DRAWER_OPENED",
      performedBy: params.openedBy,
      amount:     openingFloat,
      timestamp:  now,
      note:       `Float: ₹${openingFloat}`,
    };

    return {
      drawerId:       `CDID-${Date.now()}`,
      drawerNo,
      branchCode:     params.branchCode,
      posTerminal:    params.posTerminal,
      shiftId:        params.shiftId,
      status:         "OPEN",
      openingFloat,
      totalCashIn:    0,
      totalCashOut:   0,
      netSales:       0,
      netRefunds:     0,
      expectedCash:   openingFloat,
      currentBalance: openingFloat,
      movements:      [openMov],
      auditTrail:     [auditEntry],
      openedAt:       now,
      openedBy:       params.openedBy,
      updatedAt:      now,
    };
  }

  /** Record cash movement (IN or OUT) */
  public static recordMovement(
    drawer: CashDrawer,
    kind: "CASH_IN" | "CASH_OUT" | "SALE" | "REFUND",
    amount: number,
    performedBy: string,
    note: string
  ): CashDrawer {
    const now = new Date().toISOString();
    const mov: DrawerMovement = {
      movementId: `CMOV-${this.movCounter++}`,
      kind, amount, note, performedBy, timestamp: now,
    };

    const isIn = kind === "CASH_IN" || kind === "SALE";
    const totalCashIn  = drawer.totalCashIn  + (kind === "CASH_IN"  ? amount : 0);
    const totalCashOut = drawer.totalCashOut + (kind === "CASH_OUT" ? amount : 0);
    const netSales     = drawer.netSales     + (kind === "SALE"     ? amount : 0);
    const netRefunds   = drawer.netRefunds   + (kind === "REFUND"   ? amount : 0);
    const delta        = isIn ? amount : -amount;
    const currentBalance = Math.round((drawer.currentBalance + delta) * 100) / 100;
    const expectedCash   = Math.round(
      (drawer.openingFloat + totalCashIn - totalCashOut + netSales - netRefunds) * 100
    ) / 100;

    const auditEntry: DrawerAuditEntry = {
      auditId:    this.auditId(),
      action:     kind,
      performedBy,
      amount,
      timestamp:  now,
      note,
    };

    return {
      ...drawer,
      totalCashIn, totalCashOut, netSales, netRefunds,
      expectedCash, currentBalance,
      movements:  [...drawer.movements, mov],
      auditTrail: [...drawer.auditTrail, auditEntry],
      updatedAt:  now,
    };
  }

  /** EOD reconciliation — physical count vs expected */
  public static reconcile(
    drawer: CashDrawer,
    reconciledBy: string,
    physicalDenominations: Denomination[],
    varianceThreshold: number = 5
  ): CashDrawer {
    const now        = new Date().toISOString();
    const actualCash = this.countDenominations(physicalDenominations);
    const variance   = Math.round((actualCash - drawer.expectedCash) * 100) / 100;

    const status: ReconcileStatus =
      Math.abs(variance) <= varianceThreshold ? "BALANCED"
      : variance < 0 ? "SHORT"
      : "OVER";

    const reconciliation: EODReconciliation = {
      reconcileId:   `RCNID-${this.reconcileCounter++}`,
      reconciledAt:  now,
      reconciledBy,
      expectedCash:  drawer.expectedCash,
      actualCash,
      variance,
      status,
      denominations: physicalDenominations,
    };

    const auditEntry: DrawerAuditEntry = {
      auditId:    this.auditId(),
      action:     `EOD_RECONCILE_${status}`,
      performedBy: reconciledBy,
      amount:     variance,
      timestamp:  now,
      note:       `Expected ₹${drawer.expectedCash}, Actual ₹${actualCash}, Variance ₹${variance}`,
    };

    return {
      ...drawer,
      status:        "RECONCILED",
      reconciliation,
      auditTrail:    [...drawer.auditTrail, auditEntry],
      updatedAt:     now,
    };
  }

  /** Summary report for a set of drawers (e.g. all terminals in a branch/shift) */
  public static shiftSummary(drawers: CashDrawer[]): {
    totalOpeningFloat: number;
    totalNetSales:     number;
    totalCashIn:       number;
    totalCashOut:      number;
    totalExpected:     number;
    totalActual:       number;
    totalVariance:     number;
    balanced:          number;
    short:             number;
    over:              number;
    unreconciled:      number;
  } {
    const reconciled = drawers.filter((d) => d.reconciliation);
    return {
      totalOpeningFloat: Math.round(drawers.reduce((s, d) => s + d.openingFloat, 0) * 100) / 100,
      totalNetSales:     Math.round(drawers.reduce((s, d) => s + d.netSales, 0) * 100) / 100,
      totalCashIn:       Math.round(drawers.reduce((s, d) => s + d.totalCashIn, 0) * 100) / 100,
      totalCashOut:      Math.round(drawers.reduce((s, d) => s + d.totalCashOut, 0) * 100) / 100,
      totalExpected:     Math.round(drawers.reduce((s, d) => s + d.expectedCash, 0) * 100) / 100,
      totalActual:       Math.round(reconciled.reduce((s, d) => s + (d.reconciliation!.actualCash), 0) * 100) / 100,
      totalVariance:     Math.round(reconciled.reduce((s, d) => s + (d.reconciliation!.variance), 0) * 100) / 100,
      balanced:    reconciled.filter((d) => d.reconciliation!.status === "BALANCED").length,
      short:       reconciled.filter((d) => d.reconciliation!.status === "SHORT").length,
      over:        reconciled.filter((d) => d.reconciliation!.status === "OVER").length,
      unreconciled: drawers.filter((d) => !d.reconciliation).length,
    };
  }
}

export default CashDrawerEngine;
