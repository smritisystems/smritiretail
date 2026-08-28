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

/**
 * Customer Complaint & After-Sales CRM Engine
 *
 * Manages end-to-end customer complaint lifecycle:
 *   Lifecycle       : OPEN → ASSIGNED → IN_PROGRESS → PENDING_CUSTOMER
 *                     → RESOLVED → CLOSED / REOPENED / ESCALATED
 *
 *   SLA Tracking    : First Response SLA (4h), Resolution SLA (48h)
 *                     Breach detection and escalation flag
 *
 *   CSAT Scoring    : 1–5 star rating captured on CLOSED status
 *                     Agent-level and branch-level CSAT aggregation
 *
 *   Priority Matrix : LOW / MEDIUM / HIGH / CRITICAL
 *                     CRITICAL complaints auto-escalate after 2h breach
 */

export type ComplaintStatus =
  | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "PENDING_CUSTOMER"
  | "RESOLVED" | "CLOSED" | "REOPENED" | "ESCALATED" | "CANCELLED";

export type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ComplaintCategory =
  | "PRODUCT_QUALITY" | "WRONG_ITEM" | "MISSING_ITEM" | "BILLING_ERROR"
  | "STAFF_BEHAVIOUR" | "DELIVERY_DELAY" | "REFUND_NOT_RECEIVED"
  | "APP_TECHNICAL" | "EXCHANGE_REQUEST" | "OTHER";

export interface ComplaintNote {
  noteId: string;
  addedBy: string;
  content: string;
  timestamp: string;
  isInternal: boolean;  // Internal agent note vs customer-facing reply
}

export interface SLAConfig {
  firstResponseHours: number;
  resolutionHours: number;
}

export const SLA_MATRIX: Record<ComplaintPriority, SLAConfig> = {
  LOW:      { firstResponseHours: 24, resolutionHours: 120 },
  MEDIUM:   { firstResponseHours: 8,  resolutionHours: 72  },
  HIGH:     { firstResponseHours: 4,  resolutionHours: 48  },
  CRITICAL: { firstResponseHours: 1,  resolutionHours: 8   },
};

export interface Complaint {
  complaintId: string;
  ticketNo: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  branchCode: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  subject: string;
  description: string;
  status: ComplaintStatus;
  assignedAgentId?: string;
  assignedAgentName?: string;
  // SLA timestamps
  openedAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  // SLA breach
  firstResponseSLABreached: boolean;
  resolutionSLABreached: boolean;
  isEscalated: boolean;
  escalationReason?: string;
  // Resolution
  resolutionSummary?: string;
  rootCause?: string;
  // CSAT
  csatScore?: number;         // 1–5
  csatComment?: string;
  // Activity log
  notes: ComplaintNote[];
  relatedInvoiceNo?: string;
  reopenCount: number;
}

export interface CSATReport {
  branchCode?: string;
  agentId?: string;
  totalComplaints: number;
  closedComplaints: number;
  csatResponses: number;
  avgCSATScore: number;
  csatDistribution: Record<number, number>;   // { 1: N, 2: N, 3: N, 4: N, 5: N }
  slaFirstResponseBreachRate: number;
  slaResolutionBreachRate: number;
  avgResolutionHours: number;
  escalationRate: number;
  reopenRate: number;
  byCategory: Record<ComplaintCategory, number>;
}

export class ComplaintCRMEngine {
  private static ticketCounter = 1;
  private static noteId = () => `NOTE-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  public static openComplaint(params: {
    customerId: string;
    customerName: string;
    customerPhone?: string;
    branchCode: string;
    category: ComplaintCategory;
    priority: ComplaintPriority;
    subject: string;
    description: string;
    relatedInvoiceNo?: string;
    openedAt?: string;
  }): Complaint {
    const now = params.openedAt ?? new Date().toISOString();
    const ticketNo = `TKT-${now.slice(0, 10).replace(/-/g, "")}-${String(this.ticketCounter++).padStart(5, "0")}`;
    return {
      complaintId: `CMP-${Date.now()}`,
      ticketNo,
      customerId: params.customerId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      branchCode: params.branchCode,
      category: params.category,
      priority: params.priority,
      subject: params.subject,
      description: params.description,
      status: "OPEN",
      openedAt: now,
      firstResponseSLABreached: false,
      resolutionSLABreached: false,
      isEscalated: false,
      notes: [],
      relatedInvoiceNo: params.relatedInvoiceNo,
      reopenCount: 0,
    };
  }

  public static assign(complaint: Complaint, agentId: string, agentName: string, assignedBy: string): Complaint {
    const note = this.makeNote(assignedBy, `Assigned to ${agentName}`, true);
    return { ...complaint, status: "ASSIGNED", assignedAgentId: agentId, assignedAgentName: agentName, notes: [...complaint.notes, note] };
  }

  public static recordFirstResponse(complaint: Complaint, respondedBy: string, responseText: string, asOf: Date): Complaint {
    const sla = SLA_MATRIX[complaint.priority];
    const openedMs  = new Date(complaint.openedAt).getTime();
    const responseMs = asOf.getTime();
    const hoursElapsed = (responseMs - openedMs) / 3600000;
    const breached = hoursElapsed > sla.firstResponseHours;
    const note = this.makeNote(respondedBy, responseText, false);
    return {
      ...complaint,
      status: "IN_PROGRESS",
      firstResponseAt: asOf.toISOString(),
      firstResponseSLABreached: breached,
      notes: [...complaint.notes, note],
    };
  }

  public static addNote(complaint: Complaint, addedBy: string, content: string, isInternal: boolean): Complaint {
    return { ...complaint, notes: [...complaint.notes, this.makeNote(addedBy, content, isInternal)] };
  }

  public static pendingCustomer(complaint: Complaint, agentNote: string, agentId: string): Complaint {
    const note = this.makeNote(agentId, agentNote, false);
    return { ...complaint, status: "PENDING_CUSTOMER", notes: [...complaint.notes, note] };
  }

  public static resolve(complaint: Complaint, resolution: { summary: string; rootCause?: string; resolvedBy: string; asOf: Date }): Complaint {
    const sla = SLA_MATRIX[complaint.priority];
    const openedMs   = new Date(complaint.openedAt).getTime();
    const resolvedMs = resolution.asOf.getTime();
    const hoursElapsed = (resolvedMs - openedMs) / 3600000;
    const breached = hoursElapsed > sla.resolutionHours;
    const note = this.makeNote(resolution.resolvedBy, `Resolved: ${resolution.summary}`, false);
    return {
      ...complaint,
      status: "RESOLVED",
      resolutionSummary: resolution.summary,
      rootCause: resolution.rootCause,
      resolvedAt: resolution.asOf.toISOString(),
      resolutionSLABreached: breached,
      notes: [...complaint.notes, note],
    };
  }

  public static close(complaint: Complaint, csatScore: number, csatComment: string | undefined, closedBy: string): Complaint {
    const score = Math.min(5, Math.max(1, Math.round(csatScore)));
    const note  = this.makeNote(closedBy, `Closed with CSAT: ${score}/5${csatComment ? ` — "${csatComment}"` : ""}`, false);
    return {
      ...complaint,
      status: "CLOSED",
      closedAt: new Date().toISOString(),
      csatScore: score,
      csatComment,
      notes: [...complaint.notes, note],
    };
  }

  public static reopen(complaint: Complaint, reason: string, reopenedBy: string): Complaint {
    const note = this.makeNote(reopenedBy, `Reopened: ${reason}`, false);
    return {
      ...complaint,
      status: "REOPENED",
      reopenCount: complaint.reopenCount + 1,
      resolvedAt: undefined,
      closedAt: undefined,
      csatScore: undefined,
      notes: [...complaint.notes, note],
    };
  }

  public static escalate(complaint: Complaint, reason: string, escalatedBy: string): Complaint {
    const note = this.makeNote(escalatedBy, `Escalated: ${reason}`, true);
    return {
      ...complaint,
      status: "ESCALATED",
      isEscalated: true,
      escalationReason: reason,
      notes: [...complaint.notes, note],
    };
  }

  /** Check SLA breaches against a reference timestamp — mutates breach flags */
  public static checkSLABreaches(complaint: Complaint, asOf: Date): Complaint {
    const sla = SLA_MATRIX[complaint.priority];
    const openedMs = new Date(complaint.openedAt).getTime();
    const elapsedH = (asOf.getTime() - openedMs) / 3600000;

    const firstResponseBreached = complaint.firstResponseAt
      ? complaint.firstResponseSLABreached
      : elapsedH > sla.firstResponseHours;

    const resolutionBreached = complaint.resolvedAt
      ? complaint.resolutionSLABreached
      : elapsedH > sla.resolutionHours;

    const shouldEscalate = !complaint.isEscalated && complaint.priority === "CRITICAL" && elapsedH > sla.firstResponseHours * 2;

    return {
      ...complaint,
      firstResponseSLABreached: firstResponseBreached,
      resolutionSLABreached:    resolutionBreached,
      isEscalated:              shouldEscalate || complaint.isEscalated,
      escalationReason:         shouldEscalate ? "Auto-escalated: CRITICAL SLA breach" : complaint.escalationReason,
    };
  }

  /** Compute CSAT and SLA report for a set of complaints */
  public static computeCSATReport(complaints: Complaint[], filter?: { branchCode?: string; agentId?: string }): CSATReport {
    let subset = complaints;
    if (filter?.branchCode) subset = subset.filter((c) => c.branchCode === filter.branchCode);
    if (filter?.agentId)    subset = subset.filter((c) => c.assignedAgentId === filter.agentId);

    const closed   = subset.filter((c) => c.status === "CLOSED");
    const withCSAT = closed.filter((c) => c.csatScore != null);
    const avgCSAT  = withCSAT.length > 0
      ? Math.round((withCSAT.reduce((s, c) => s + (c.csatScore ?? 0), 0) / withCSAT.length) * 100) / 100
      : 0;

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    withCSAT.forEach((c) => { if (c.csatScore) dist[c.csatScore] = (dist[c.csatScore] ?? 0) + 1; });

    const avgResH = closed.length > 0
      ? Math.round((closed.reduce((s, c) => {
          if (!c.resolvedAt) return s;
          return s + (new Date(c.resolvedAt).getTime() - new Date(c.openedAt).getTime()) / 3600000;
        }, 0) / closed.length) * 10) / 10
      : 0;

    const byCategory = {} as Record<ComplaintCategory, number>;
    subset.forEach((c) => { byCategory[c.category] = (byCategory[c.category] ?? 0) + 1; });

    return {
      branchCode: filter?.branchCode,
      agentId:    filter?.agentId,
      totalComplaints:              subset.length,
      closedComplaints:             closed.length,
      csatResponses:                withCSAT.length,
      avgCSATScore:                 avgCSAT,
      csatDistribution:             dist,
      slaFirstResponseBreachRate:   subset.length > 0 ? Math.round((subset.filter((c) => c.firstResponseSLABreached).length / subset.length) * 10000) / 100 : 0,
      slaResolutionBreachRate:      subset.length > 0 ? Math.round((subset.filter((c) => c.resolutionSLABreached).length / subset.length) * 10000) / 100 : 0,
      avgResolutionHours:           avgResH,
      escalationRate:               subset.length > 0 ? Math.round((subset.filter((c) => c.isEscalated).length / subset.length) * 10000) / 100 : 0,
      reopenRate:                   subset.length > 0 ? Math.round((subset.filter((c) => c.reopenCount > 0).length / subset.length) * 10000) / 100 : 0,
      byCategory,
    };
  }

  private static makeNote(addedBy: string, content: string, isInternal: boolean): ComplaintNote {
    return { noteId: this.noteId(), addedBy, content, timestamp: new Date().toISOString(), isInternal };
  }
}

export default ComplaintCRMEngine;
