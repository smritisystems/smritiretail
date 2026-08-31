/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.108.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Price Override Approval Engine
 *
 * Manager-authorized price exceptions on individual line items:
 *   Deviation Matrix : Configurable percentage bands mapped to authority levels
 *                      (CASHIER, SUPERVISOR, MANAGER, GM, DIRECTOR)
 *   Workflow         : PENDING → APPROVED / REJECTED / AUTO_APPROVED / EXPIRED
 *   Auto-Approve     : Deviations ≤ autoApproveLimitPct are approved instantly
 *   Audit Log        : Immutable entry per request; every approval/rejection
 *                      records approver identity, timestamp, and reason
 */

export type OverrideStatus = "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPROVED" | "EXPIRED" | "CANCELLED";
export type AuthorityLevel  = "CASHIER" | "SUPERVISOR" | "MANAGER" | "GM" | "DIRECTOR";

export interface DeviationRule {
  fromPct: number;       // Inclusive lower bound
  toPct:   number;       // Exclusive upper bound (Infinity for top tier)
  requiredAuthority: AuthorityLevel;
}

export interface PriceOverrideConfig {
  autoApproveLimitPct: number;     // Deviations below this are auto-approved
  expiryMinutes:       number;     // Pending requests expire after N minutes
  deviationMatrix:     DeviationRule[];
}

export const DEFAULT_OVERRIDE_CONFIG: PriceOverrideConfig = {
  autoApproveLimitPct: 2,
  expiryMinutes: 10,
  deviationMatrix: [
    { fromPct: 0,    toPct: 2,        requiredAuthority: "CASHIER"    },
    { fromPct: 2,    toPct: 5,        requiredAuthority: "SUPERVISOR" },
    { fromPct: 5,    toPct: 10,       requiredAuthority: "MANAGER"    },
    { fromPct: 10,   toPct: 20,       requiredAuthority: "GM"         },
    { fromPct: 20,   toPct: Infinity, requiredAuthority: "DIRECTOR"   },
  ],
};

export interface OverrideAuditEntry {
  auditId:     string;
  action:      "REQUESTED" | "AUTO_APPROVED" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
  performedBy: string;
  authority?:  AuthorityLevel;
  timestamp:   string;
  reason?:     string;
}

export interface PriceOverrideRequest {
  requestId:         string;
  requestNo:         string;
  branchCode:        string;
  posTerminal:       string;
  sku:               string;
  productName:       string;
  standardPrice:     number;
  requestedPrice:    number;
  deviationAmt:      number;
  deviationPct:      number;       // abs((standardPrice - requestedPrice) / standardPrice × 100)
  requiredAuthority: AuthorityLevel;
  requestedBy:       string;
  approvedBy?:       string;
  status:            OverrideStatus;
  reason?:           string;
  expiresAt:         string;
  createdAt:         string;
  updatedAt:         string;
  auditTrail:        OverrideAuditEntry[];
}

export class PriceOverrideEngine {
  private static reqCounter = 1;
  private static auditId    = () => `OVA-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  /** Determine required authority from deviation % using the matrix */
  public static resolveAuthority(
    deviationPct: number,
    matrix: DeviationRule[]
  ): AuthorityLevel {
    const rule = matrix.find(
      (r) => deviationPct >= r.fromPct && deviationPct < r.toPct
    );
    return rule?.requiredAuthority ?? "DIRECTOR";
  }

  /** Create and optionally auto-approve a price override request */
  public static createRequest(params: {
    branchCode:     string;
    posTerminal:    string;
    sku:            string;
    productName:    string;
    standardPrice:  number;
    requestedPrice: number;
    requestedBy:    string;
    config?:        PriceOverrideConfig;
  }): PriceOverrideRequest {
    const cfg          = params.config ?? DEFAULT_OVERRIDE_CONFIG;
    const now          = new Date();
    const nowISO       = now.toISOString();
    const expiresAt    = new Date(now.getTime() + cfg.expiryMinutes * 60000).toISOString();
    const requestNo    = `OVR-${nowISO.slice(0, 10).replace(/-/g, "")}-${String(this.reqCounter++).padStart(5, "0")}`;

    const deviationAmt = Math.round((params.standardPrice - params.requestedPrice) * 100) / 100;
    const deviationPct = Math.round(
      (Math.abs(params.standardPrice - params.requestedPrice) / params.standardPrice) * 10000
    ) / 100;
    const requiredAuthority = this.resolveAuthority(deviationPct, cfg.deviationMatrix);
    const isAutoApprove     = deviationPct <= cfg.autoApproveLimitPct;

    const status: OverrideStatus = isAutoApprove ? "AUTO_APPROVED" : "PENDING";

    const auditTrail: OverrideAuditEntry[] = [
      {
        auditId: this.auditId(),
        action: "REQUESTED",
        performedBy: params.requestedBy,
        timestamp: nowISO,
        reason: `Standard: ₹${params.standardPrice}, Requested: ₹${params.requestedPrice}, Deviation: ${deviationPct}%`,
      },
    ];

    if (isAutoApprove) {
      auditTrail.push({
        auditId: this.auditId(),
        action: "AUTO_APPROVED",
        performedBy: "SYSTEM",
        authority: "CASHIER",
        timestamp: nowISO,
        reason: `Deviation ${deviationPct}% ≤ auto-approve limit ${cfg.autoApproveLimitPct}%`,
      });
    }

    return {
      requestId: `OVRID-${Date.now()}`,
      requestNo,
      branchCode:     params.branchCode,
      posTerminal:    params.posTerminal,
      sku:            params.sku,
      productName:    params.productName,
      standardPrice:  params.standardPrice,
      requestedPrice: params.requestedPrice,
      deviationAmt,
      deviationPct,
      requiredAuthority,
      requestedBy: params.requestedBy,
      status,
      expiresAt,
      createdAt:  nowISO,
      updatedAt:  nowISO,
      auditTrail,
    };
  }

  /** Approve — enforces that approver authority ≥ required */
  public static approve(
    req: PriceOverrideRequest,
    approvedBy: string,
    approverAuthority: AuthorityLevel,
    reason?: string
  ): PriceOverrideRequest {
    const AUTHORITY_RANK: Record<AuthorityLevel, number> = {
      CASHIER: 1, SUPERVISOR: 2, MANAGER: 3, GM: 4, DIRECTOR: 5,
    };
    if (AUTHORITY_RANK[approverAuthority] < AUTHORITY_RANK[req.requiredAuthority]) {
      throw new Error(
        `Insufficient authority: ${approverAuthority} cannot approve — requires ${req.requiredAuthority}`
      );
    }
    const now = new Date().toISOString();
    const entry: OverrideAuditEntry = {
      auditId: this.auditId(),
      action: "APPROVED",
      performedBy: approvedBy,
      authority: approverAuthority,
      timestamp: now,
      reason,
    };
    return {
      ...req,
      status: "APPROVED",
      approvedBy,
      reason,
      updatedAt: now,
      auditTrail: [...req.auditTrail, entry],
    };
  }

  /** Reject with mandatory reason */
  public static reject(
    req: PriceOverrideRequest,
    rejectedBy: string,
    reason: string
  ): PriceOverrideRequest {
    const now = new Date().toISOString();
    const entry: OverrideAuditEntry = {
      auditId: this.auditId(),
      action: "REJECTED",
      performedBy: rejectedBy,
      timestamp: now,
      reason,
    };
    return {
      ...req,
      status: "REJECTED",
      approvedBy: rejectedBy,
      reason,
      updatedAt: now,
      auditTrail: [...req.auditTrail, entry],
    };
  }

  /** Expire pending requests past their expiresAt time */
  public static expireIfDue(req: PriceOverrideRequest, asOf: Date = new Date()): PriceOverrideRequest {
    if (req.status !== "PENDING") return req;
    if (asOf < new Date(req.expiresAt)) return req;
    const now = asOf.toISOString();
    const entry: OverrideAuditEntry = {
      auditId: this.auditId(),
      action: "EXPIRED",
      performedBy: "SYSTEM",
      timestamp: now,
      reason: `Pending request expired after ${DEFAULT_OVERRIDE_CONFIG.expiryMinutes} minutes`,
    };
    return { ...req, status: "EXPIRED", updatedAt: now, auditTrail: [...req.auditTrail, entry] };
  }

  /** Batch expire all eligible pending requests */
  public static expireBatch(requests: PriceOverrideRequest[], asOf: Date = new Date()): PriceOverrideRequest[] {
    return requests.map((r) => this.expireIfDue(r, asOf));
  }

  /** Audit report for a branch/period */
  public static auditReport(requests: PriceOverrideRequest[]): {
    total: number;
    autoApproved: number;
    approved: number;
    rejected: number;
    expired: number;
    pending: number;
    avgDeviationPct: number;
    totalDeviationAmt: number;
  } {
    const byStatus = (s: OverrideStatus) => requests.filter((r) => r.status === s).length;
    const avgDev   = requests.length > 0
      ? Math.round((requests.reduce((a, r) => a + r.deviationPct, 0) / requests.length) * 100) / 100
      : 0;
    const totalAmt = Math.round(requests.reduce((a, r) => a + Math.abs(r.deviationAmt), 0) * 100) / 100;

    return {
      total:            requests.length,
      autoApproved:     byStatus("AUTO_APPROVED"),
      approved:         byStatus("APPROVED"),
      rejected:         byStatus("REJECTED"),
      expired:          byStatus("EXPIRED"),
      pending:          byStatus("PENDING"),
      avgDeviationPct:  avgDev,
      totalDeviationAmt: totalAmt,
    };
  }
}

export default PriceOverrideEngine;
