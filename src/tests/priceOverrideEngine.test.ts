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

import { describe, it, expect } from "vitest";
import PriceOverrideEngine, {
  DEFAULT_OVERRIDE_CONFIG, AuthorityLevel,
} from "../utils/priceOverrideEngine";

describe("PriceOverrideEngine — Price Override Approval Engine", () => {

  const BASE_PARAMS = {
    branchCode: "BR-MUM-01",
    posTerminal: "POS-03",
    sku: "FAB-DENIM-BLU",
    productName: "Denim Blue 1m",
    requestedBy: "CASHIER-007",
  };

  // ─── Test 1: Auto-approve ≤ 2% deviation ──────────────────────────────────
  it("auto-approves requests ≤ autoApproveLimitPct (2%) with SYSTEM authority", () => {
    const req = PriceOverrideEngine.createRequest({
      ...BASE_PARAMS,
      standardPrice:  250,
      requestedPrice: 246,   // deviation = 4/250 = 1.6% → ≤ 2% → AUTO_APPROVED
    });

    expect(req.status).toBe("AUTO_APPROVED");
    expect(req.deviationPct).toBeCloseTo(1.6, 1);
    expect(req.requiredAuthority).toBe("CASHIER");
    expect(req.auditTrail).toHaveLength(2);
    expect(req.auditTrail[1].action).toBe("AUTO_APPROVED");
    expect(req.auditTrail[1].performedBy).toBe("SYSTEM");
  });

  // ─── Test 2: Deviation resolves correct authority level ───────────────────
  it("resolves MANAGER authority for 7% deviation and PENDING status", () => {
    const req = PriceOverrideEngine.createRequest({
      ...BASE_PARAMS,
      standardPrice:  250,
      requestedPrice: 232.5,   // deviation = 17.5/250 = 7% → MANAGER
    });

    expect(req.status).toBe("PENDING");
    expect(req.deviationPct).toBeCloseTo(7, 1);
    expect(req.requiredAuthority).toBe("MANAGER");
    expect(req.auditTrail).toHaveLength(1);
    expect(req.auditTrail[0].action).toBe("REQUESTED");
  });

  // ─── Test 3: Approve — authority enforcement ──────────────────────────────
  it("approves with sufficient authority; throws on insufficient authority", () => {
    const req = PriceOverrideEngine.createRequest({
      ...BASE_PARAMS,
      standardPrice:  250,
      requestedPrice: 232.5,   // 7% → requires MANAGER
    });

    // SUPERVISOR (rank 2) trying to approve MANAGER (rank 3) → should throw
    expect(() =>
      PriceOverrideEngine.approve(req, "SUP-001", "SUPERVISOR", "Supervisor override")
    ).toThrow("Insufficient authority");

    // MANAGER (rank 3) → should succeed
    const approved = PriceOverrideEngine.approve(req, "MGR-001", "MANAGER", "Customer retention");
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedBy).toBe("MGR-001");
    expect(approved.auditTrail).toHaveLength(2);
    expect(approved.auditTrail[1].authority).toBe("MANAGER");
  });

  // ─── Test 4: Expiry, rejection, and audit report ──────────────────────────
  it("expires pending requests past expiresAt and produces correct audit report", () => {
    // Create 3 requests
    const r1 = PriceOverrideEngine.createRequest({ ...BASE_PARAMS, standardPrice: 250, requestedPrice: 246 });   // AUTO_APPROVED (1.6%)
    const r2 = PriceOverrideEngine.createRequest({ ...BASE_PARAMS, standardPrice: 250, requestedPrice: 237.5 }); // PENDING (5%)
    let r3   = PriceOverrideEngine.createRequest({ ...BASE_PARAMS, standardPrice: 250, requestedPrice: 225 });   // PENDING (10%)

    // Reject r3
    r3 = PriceOverrideEngine.reject(r3, "MGR-001", "Price too low — margin policy violated");
    expect(r3.status).toBe("REJECTED");

    // Expire r2 using a future date well past expiresAt
    const farFuture = new Date(Date.now() + 99 * 60000);
    const r2Expired = PriceOverrideEngine.expireIfDue(r2, farFuture);
    expect(r2Expired.status).toBe("EXPIRED");

    // Audit report
    const report = PriceOverrideEngine.auditReport([r1, r2Expired, r3]);
    expect(report.total).toBe(3);
    expect(report.autoApproved).toBe(1);
    expect(report.expired).toBe(1);
    expect(report.rejected).toBe(1);
    expect(report.avgDeviationPct).toBeGreaterThan(0);
    expect(report.totalDeviationAmt).toBeGreaterThan(0);
  });
});
