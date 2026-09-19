/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.42.0
 * Created      : 2026-08-21
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { Product } from "../../types.ts";
import type { POProductDecision } from "./POProductStatusBadge.tsx";

export type PurchaseDocumentType = "Purchase Order" | "Indent";

// ─────────────────────────────────────────────────────────────────────────────
// Approval Reason — loaded from /purchase/approval-reasons
// ─────────────────────────────────────────────────────────────────────────────
export interface POApprovalReason {
  code: string;
  label: string;
  requires_note: boolean; // true for "OTHER"
}

// ─────────────────────────────────────────────────────────────────────────────
// PO Submit Validation — result from /purchase/validate-po-submit
// ─────────────────────────────────────────────────────────────────────────────
export interface POSubmitValidationResult {
  can_submit: boolean;
  allowed_count: number;
  approval_required_count: number;
  blocked_count: number;
  stale_count: number;                                       // lines whose decision is now stale
  line_results: (POProductDecision & { line_index: number; stale?: boolean })[];
  blocked_lines: number[];
  stale_lines: number[];                                     // indices of stale lines
  policy_version: string;
  validated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor Change Re-evaluation
// ─────────────────────────────────────────────────────────────────────────────
export interface POVendorChangeResult {
  new_vendor_id: string;
  evaluated_at: string;                                      // ISO timestamp of re-evaluation
  summary: {
    assigned: number;
    cross_vendor: number;
    unassigned: number;
    restricted: number;
    blocked: number;
    approval_required: number;
  };
  decisions: (POProductDecision & { line_index: number; product_ref: string })[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PurchaseOrderHeader
// ─────────────────────────────────────────────────────────────────────────────
export interface PurchaseOrderHeader {
  documentType: PurchaseDocumentType;
  prefix: string;
  orderNumber: string;
  orderDate: string;
  supplierId: string;
  supplierName: string;
  billTo: string;
  deliveryDate: string;
  leadTimeDays: number;
  deliveryLocation: string;
  commonTaxPercent: number;
  pictureUrl?: string;
  // Commercial terms (Other Details tab)
  paymentTerms: string;
  freightCharges: string;
  specialInstructions: string;
  // Vendor policy context (loaded after vendor select — display-only)
  policyName?: string;
  vendorStatus?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PurchaseOrderLineItem
// ─────────────────────────────────────────────────────────────────────────────
export interface PurchaseOrderLineItem {
  id: string;
  sNo: number;
  stockNo: string;
  product: string;
  brand: string;
  style: string;
  shade: string;
  size: string;
  fibre: string;
  colourBase: string;
  styling: string;
  rate: number;
  orderQty: number;
  value: number; // rate * orderQty
  stockOnHand: number;
  taxPercent: number;
  taxAmount: number; // value * (taxPercent / 100)
  addOnPercent: number;
  addOnAmount: number;
  totalValue: number; // value + taxAmount + addOnAmount
  originalProduct?: Product;
  // ── Vendor policy decision fields (frontend-only — not sent to backend PO payload) ──
  vendorDecision?: POProductDecision;     // backend decision at time of add
  isReadOnly?: boolean;                    // READ_ONLY action: qty + rate disabled
  approvalReasonCode?: string;            // reason selected in POApprovalReasonDialog
  approvalReasonNote?: string;            // free-text when reason = OTHER
  decisionEvaluatedAt?: string;          // ISO timestamp — for stale detection
}

// ─────────────────────────────────────────────────────────────────────────────
// PurchaseOrderSizePivotRow
// ─────────────────────────────────────────────────────────────────────────────
export interface PurchaseOrderSizePivotRow {
  id: string;
  sNo: number;
  articleNo: string;
  product: string;
  brand: string;
  style: string;
  color: string;
  sizeQuantities: Record<string, number>; // e.g. { "36": 2, "37": 0, ... }
  totalQty: number;
  gstPercent: number; // GST % per line item
  rate: number;
  totalValue: number; // totalQty * rate
  originalProduct?: Product;
  // Vendor policy decision fields (frontend-only)
  vendorDecision?: POProductDecision;
  isReadOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PurchaseOrderSummaryTotals
// ─────────────────────────────────────────────────────────────────────────────
export interface PurchaseOrderSummaryTotals {
  totalQty: number;
  grossValue: number;
  totalTax: number;
  totalAddOn: number;
  totalValue: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PO Workflow State Machine (Spec review — point 1)
// One authoritative state that all components read from.
// ─────────────────────────────────────────────────────────────────────────────
export type POWorkflowState =
  | "NO_VENDOR"           // vendor not yet selected
  | "VENDOR_SELECTED"     // vendor selected, policies loaded
  | "PRODUCT_EVALUATING"  // a product is being evaluated by the engine
  | "PRODUCT_DECIDED"     // decision returned — awaiting user action
  | "LINE_ADDED"          // product added to grid
  | "PO_VALIDATING"       // submit gate revalidation in progress
  | "DRAFT"               // PO saved as draft
  | "PENDING_APPROVAL"    // submitted, awaiting approval
  | "APPROVED"            // approved — further edits require re-evaluation
  | "CONFIRMED";          // finalised

// ─────────────────────────────────────────────────────────────────────────────
// Per-line authoritative decision state (review — point 3)
// Every input path (F2/barcode/import/copy/edit) must set this.
// UI components consume this; they do NOT independently decide actions.
// ─────────────────────────────────────────────────────────────────────────────
export interface POLineDecisionState {
  lineId: string;                        // matches PurchaseOrderLineItem.id
  productRef: string;                    // barcode / SKU / code used for evaluation
  status: "ASSIGNED" | "CROSS_VENDOR" | "UNASSIGNED" | "RESTRICTED";
  action: "ALLOW" | "READ_ONLY" | "APPROVAL_REQUIRED" | "BLOCK";
  approvalRequired: boolean;
  explanation: string;
  decisionLogId?: string;                // backend POProductDecisionLog.id
  decisionVersion: string;               // policy_version hash at evaluation time
  evaluatedAt: string;                   // ISO timestamp
  entryPath: "BROWSE" | "BARCODE" | "SEARCH" | "MANUAL" | "IMPORT" | "COPY" | "EDIT";
  approvalReasonCode?: string;
  approvalReasonNote?: string;
  isStale?: boolean;                     // true if revalidation shows policy changed
}

// ─────────────────────────────────────────────────────────────────────────────
// PO Issues Summary (review — points 7, 8)
// Continuously computed from all POLineDecisionState entries.
// Shown in PO header and POIssuesSummary component.
// ─────────────────────────────────────────────────────────────────────────────
export interface POIssuesSummary {
  allowedCount: number;
  approvalRequiredCount: number;
  blockedCount: number;
  staleCount: number;
  totalEvaluated: number;
  hasIssues: boolean;   // true if blockedCount > 0 || staleCount > 0 || approvalRequiredCount > 0
}

/** Compute the issues summary from the current line decision map. */
export function computePOIssues(
  decisions: Record<string, POLineDecisionState>
): POIssuesSummary {
  let allowed = 0, approval = 0, blocked = 0, stale = 0;
  for (const d of Object.values(decisions)) {
    if (d.action === "ALLOW" || d.action === "READ_ONLY") allowed++;
    else if (d.action === "APPROVAL_REQUIRED") approval++;
    else if (d.action === "BLOCK") blocked++;
    if (d.isStale) stale++;
  }
  const total = allowed + approval + blocked;
  return {
    allowedCount: allowed,
    approvalRequiredCount: approval,
    blockedCount: blocked,
    staleCount: stale,
    totalEvaluated: total,
    hasIssues: blocked > 0 || stale > 0 || approval > 0,
  };
}


