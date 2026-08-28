/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.104.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import ComplaintCRMEngine, { SLA_MATRIX } from "../utils/complaintCRMEngine";

describe("ComplaintCRMEngine — Customer Complaint & After-Sales CRM Engine", () => {
  const AS_OF_OPEN  = new Date("2026-08-28T09:00:00.000Z");
  const AS_OF_2H    = new Date("2026-08-28T11:00:00.000Z");
  const AS_OF_50H   = new Date("2026-08-30T11:00:00.000Z");  // 50h after open — breaches HIGH resolution SLA (48h)

  function makeHighComplaint() {
    return ComplaintCRMEngine.openComplaint({
      customerId: "C-001", customerName: "Priya Sharma", customerPhone: "9876543210",
      branchCode: "BR-MUM-01", category: "PRODUCT_QUALITY", priority: "HIGH",
      subject: "Defective stitching on jacket",
      description: "Jacket purchased on 2026-08-25 has defective stitching on the left sleeve.",
      relatedInvoiceNo: "INV-2026-0841",
      openedAt: AS_OF_OPEN.toISOString(),
    });
  }

  // ─── Test 1: Complaint lifecycle — assign → respond → resolve → close with CSAT ──
  it("completes full lifecycle: open → assign → first response → resolve → close with CSAT", () => {
    let c = makeHighComplaint();
    expect(c.status).toBe("OPEN");
    expect(c.firstResponseSLABreached).toBe(false);

    c = ComplaintCRMEngine.assign(c, "AGT-01", "Ramesh Verma", "SUPERVISOR-01");
    expect(c.status).toBe("ASSIGNED");
    expect(c.assignedAgentId).toBe("AGT-01");
    expect(c.notes).toHaveLength(1);

    // First response within SLA (2h elapsed, HIGH SLA = 4h)
    c = ComplaintCRMEngine.recordFirstResponse(c, "AGT-01", "We have logged your complaint and are investigating.", AS_OF_2H);
    expect(c.status).toBe("IN_PROGRESS");
    expect(c.firstResponseAt).toBeDefined();
    expect(c.firstResponseSLABreached).toBe(false);  // 2h < 4h HIGH SLA

    c = ComplaintCRMEngine.resolve(c, { summary: "Replacement jacket dispatched.", rootCause: "Manufacturing defect — batch recalled.", resolvedBy: "AGT-01", asOf: AS_OF_50H });
    expect(c.status).toBe("RESOLVED");
    expect(c.resolutionSLABreached).toBe(true);      // 50h > 48h HIGH resolution SLA
    expect(c.resolutionSummary).toContain("Replacement");

    c = ComplaintCRMEngine.close(c, 4, "Fast resolution, appreciated!", "AGT-01");
    expect(c.status).toBe("CLOSED");
    expect(c.csatScore).toBe(4);
    expect(c.csatComment).toContain("appreciated");
  });

  // ─── Test 2: SLA breach detection and CRITICAL auto-escalation ──────────
  it("detects SLA breaches and auto-escalates CRITICAL complaints after 2× first-response SLA", () => {
    const criticalSLA = SLA_MATRIX["CRITICAL"];  // firstResponseHours: 1

    let c = ComplaintCRMEngine.openComplaint({
      customerId: "C-002", customerName: "Arjun Mehta",
      branchCode: "BR-DEL-01", category: "BILLING_ERROR", priority: "CRITICAL",
      subject: "Overcharged by ₹5,000",
      description: "Invoice shows ₹5,000 more than the agreed price.",
      openedAt: AS_OF_OPEN.toISOString(),
    });

    // Check SLA at 3h elapsed (3 × 1h firstResponse SLA → 2h auto-escalation threshold crossed)
    const AS_OF_3H = new Date("2026-08-28T12:00:00.000Z");
    c = ComplaintCRMEngine.checkSLABreaches(c, AS_OF_3H);

    expect(c.firstResponseSLABreached).toBe(true);   // 3h > 1h CRITICAL SLA
    expect(c.isEscalated).toBe(true);                // 3h > 2 × 1h = auto-escalate
    expect(c.escalationReason).toContain("Auto-escalated");

    expect(criticalSLA.firstResponseHours).toBe(1);
    expect(criticalSLA.resolutionHours).toBe(8);
  });

  // ─── Test 3: Reopen flow ──────────────────────────────────────────────────
  it("reopens a closed complaint, increments reopenCount, clears resolution fields", () => {
    let c = makeHighComplaint();
    c = ComplaintCRMEngine.assign(c, "AGT-01", "Ramesh Verma", "SUP-01");
    c = ComplaintCRMEngine.recordFirstResponse(c, "AGT-01", "Investigating.", AS_OF_2H);
    c = ComplaintCRMEngine.resolve(c, { summary: "Fixed.", resolvedBy: "AGT-01", asOf: AS_OF_2H });
    c = ComplaintCRMEngine.close(c, 3, undefined, "AGT-01");
    expect(c.status).toBe("CLOSED");
    expect(c.csatScore).toBe(3);

    c = ComplaintCRMEngine.reopen(c, "Issue persists — jacket still defective.", "C-001");
    expect(c.status).toBe("REOPENED");
    expect(c.reopenCount).toBe(1);
    expect(c.csatScore).toBeUndefined();
    expect(c.resolvedAt).toBeUndefined();
  });

  // ─── Test 4: CSAT report aggregation ─────────────────────────────────────
  it("computes CSAT report with correct averages, breach rates, and category breakdown", () => {
    const complaints = [
      makeHighComplaint(),
      makeHighComplaint(),
      ComplaintCRMEngine.openComplaint({ customerId: "C-003", customerName: "Kavya", branchCode: "BR-MUM-01", category: "BILLING_ERROR", priority: "MEDIUM", subject: "Billing", description: "Excess charge.", openedAt: AS_OF_OPEN.toISOString() }),
    ];

    // Close first two with CSAT
    let c1 = ComplaintCRMEngine.assign(complaints[0], "AGT-01", "A1", "SUP");
    c1 = ComplaintCRMEngine.recordFirstResponse(c1, "AGT-01", "Noted.", AS_OF_2H);
    c1 = ComplaintCRMEngine.resolve(c1, { summary: "Resolved", resolvedBy: "AGT-01", asOf: AS_OF_2H });
    c1 = ComplaintCRMEngine.close(c1, 5, "Excellent!", "AGT-01");

    let c2 = ComplaintCRMEngine.assign(complaints[1], "AGT-02", "A2", "SUP");
    c2 = ComplaintCRMEngine.recordFirstResponse(c2, "AGT-02", "Noted.", AS_OF_2H);
    c2 = ComplaintCRMEngine.resolve(c2, { summary: "Resolved", resolvedBy: "AGT-02", asOf: AS_OF_50H }); // breach
    c2 = ComplaintCRMEngine.close(c2, 3, "Delayed but resolved.", "AGT-02");

    const report = ComplaintCRMEngine.computeCSATReport([c1, c2, complaints[2]], { branchCode: "BR-MUM-01" });

    expect(report.totalComplaints).toBe(3);
    expect(report.closedComplaints).toBe(2);
    expect(report.csatResponses).toBe(2);
    expect(report.avgCSATScore).toBe(4);              // (5+3)/2
    expect(report.csatDistribution[5]).toBe(1);
    expect(report.csatDistribution[3]).toBe(1);
    // breach rate = breached / totalComplaints = 1/3 = 33.33% (engine divides over all complaints, not just closed)
    expect(report.slaResolutionBreachRate).toBeCloseTo(33.33, 0);
    expect(report.byCategory["PRODUCT_QUALITY"]).toBe(2);
    expect(report.byCategory["BILLING_ERROR"]).toBe(1);
  });
});
