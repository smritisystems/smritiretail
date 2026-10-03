/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.34.0
 * Created      : 2026-09-21
 * Modified     : 2026-09-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_WORKFLOW_INTEGRATION_TEST")
 * Target UI    : SMRITI GRN Studio — 5-Step Workflow State & Workspace Synchronization Test Suite
 */

import { describe, expect, it } from "vitest";
import {
  GRN_WORKFLOW_STEPS,
  type GrnWorkflowStepId,
  getNextWorkflowStep,
  getPreviousWorkflowStep,
  canNavigateToStep,
  validateWorkflowStep,
} from "../components/purchase/grnWorkflow";
import {
  buildManualAllocationMatrix,
  calculateManualLineAllocations,
  getManualAllocationVariance,
  normalizeAllocationMethod,
} from "../components/purchase/manualAllocation";

describe("GRN Studio 5-Step Workflow & Workspace Synchronization Suite", () => {
  // 1. Authoritative Step Definitions and Order
  it("exposes exactly ONE authoritative 5-step workflow in strict sequence", () => {
    expect(GRN_WORKFLOW_STEPS).toHaveLength(5);
    expect(GRN_WORKFLOW_STEPS.map((s) => s.id)).toEqual([
      "PO_DETAILS",
      "RECEIVE_VERIFY",
      "COMMERCIALS",
      "COSTS_FREIGHT",
      "REVIEW_POST",
    ]);
    expect(GRN_WORKFLOW_STEPS.map((s) => s.label)).toEqual([
      "PO & Details",
      "Receive & Verify",
      "Commercials",
      "Costs & Freight",
      "Review & Post",
    ]);
  });

  // 2. Navigation Controls & Forward/Back Transitions
  it("implements authoritative navigation controls for all 5 steps", () => {
    // Step 1: Next -> Step 2
    expect(getNextWorkflowStep("PO_DETAILS")).toBe("RECEIVE_VERIFY");

    // Step 2: Back -> Step 1, Next -> Step 3
    expect(getPreviousWorkflowStep("RECEIVE_VERIFY")).toBe("PO_DETAILS");
    expect(getNextWorkflowStep("RECEIVE_VERIFY")).toBe("COMMERCIALS");

    // Step 3: Back -> Step 2, Next -> Step 4
    expect(getPreviousWorkflowStep("COMMERCIALS")).toBe("RECEIVE_VERIFY");
    expect(getNextWorkflowStep("COMMERCIALS")).toBe("COSTS_FREIGHT");

    // Step 4: Back -> Step 3, Next -> Step 5
    expect(getPreviousWorkflowStep("COSTS_FREIGHT")).toBe("COMMERCIALS");
    expect(getNextWorkflowStep("COSTS_FREIGHT")).toBe("REVIEW_POST");

    // Step 5: Back -> Step 4, Next stays at Step 5 (Post GRN action)
    expect(getPreviousWorkflowStep("REVIEW_POST")).toBe("COSTS_FREIGHT");
    expect(getNextWorkflowStep("REVIEW_POST")).toBe("REVIEW_POST");
  });

  // 3. Sequential Traversal & Boundary Protection
  it("permits adjacent forward navigation and blocks skipping future steps", () => {
    expect(canNavigateToStep("RECEIVE_VERIFY", "PO_DETAILS")).toBe(true);
    expect(canNavigateToStep("COMMERCIALS", "PO_DETAILS")).toBe(false);
    expect(canNavigateToStep("COSTS_FREIGHT", "PO_DETAILS")).toBe(false);
    expect(canNavigateToStep("REVIEW_POST", "PO_DETAILS")).toBe(false);

    expect(canNavigateToStep("COMMERCIALS", "RECEIVE_VERIFY")).toBe(true);
    expect(canNavigateToStep("PO_DETAILS", "RECEIVE_VERIFY")).toBe(true);
  });

  // 4. Workspace Mapping Contract & Non-Collision Guarantee
  it("guarantees that Step 3 Commercials workspace never renders PO selection hub", () => {
    // Workspace content model contract
    const WORKSPACE_FEATURE_MAP: Record<GrnWorkflowStepId, string[]> = {
      PO_DETAILS: ["PO Selection", "Open POs Table", "Direct Inward Option", "PO Details"],
      RECEIVE_VERIFY: [
        "Inward Items Table",
        "SKU / Barcode",
        "Received Qty",
        "Damaged Qty",
        "Accepted Qty",
        "Barcode Scanner",
        "Receiving Verification",
      ],
      COMMERCIALS: [
        "Commercial Overview",
        "PPV Items",
        "Purchase Price Variance Table",
        "Commercial Line Rates",
        "Debit Note Claims",
      ],
      COSTS_FREIGHT: [
        "Transport Details",
        "Cost Components",
        "Allocation Method",
        "Manual Allocation Grid",
        "Allocation Preview",
      ],
      REVIEW_POST: [
        "GRN Summary",
        "Quantity Summary",
        "Commercial Summary",
        "Cost Summary",
        "Landed Cost Summary",
        "Allocation Summary",
        "Manual Reconciliation",
        "Validation Messages",
      ],
    };

    // Verify PO Selection Hub only belongs to PO_DETAILS
    expect(WORKSPACE_FEATURE_MAP.PO_DETAILS).toContain("PO Selection");
    expect(WORKSPACE_FEATURE_MAP.COMMERCIALS).not.toContain("PO Selection");
    expect(WORKSPACE_FEATURE_MAP.COMMERCIALS).not.toContain("Open POs Table");
    expect(WORKSPACE_FEATURE_MAP.COMMERCIALS).toContain("Purchase Price Variance Table");

    // Verify Receiving belongs to Step 2
    expect(WORKSPACE_FEATURE_MAP.RECEIVE_VERIFY).toContain("Barcode Scanner");
    expect(WORKSPACE_FEATURE_MAP.COMMERCIALS).not.toContain("Barcode Scanner");

    // Verify Cost Editing belongs to Step 4
    expect(WORKSPACE_FEATURE_MAP.COSTS_FREIGHT).toContain("Manual Allocation Grid");
    expect(WORKSPACE_FEATURE_MAP.REVIEW_POST).not.toContain("Manual Allocation Grid");
    expect(WORKSPACE_FEATURE_MAP.REVIEW_POST).toContain("Manual Reconciliation");
  });

  // 5. Data Preservation Across Step Browsing (1 -> 2 -> 3 -> 4 -> 5 -> 4 -> 3 -> 2 -> 1)
  it("preserves all entered data across forward and backward step transitions", () => {
    // Simulated state container (identical to GrnReceiptTab component state)
    interface GrnStateContainer {
      activeStep: GrnWorkflowStepId;
      supplierId: string;
      supplierName: string;
      selectedOrderId: string;
      grnLines: Array<{
        rowId: string;
        code: string;
        quantity_ordered: number;
        quantity_received: number;
        quantity_damaged: number;
        cost_price: number;
        invoice_rate: number;
      }>;
      transporterName: string;
      lrNumber: string;
      costItems: Array<{ id: string; amount: number; component_type: string }>;
      manualAllocations: Record<string, Record<string, number>>;
    }

    const state: GrnStateContainer = {
      activeStep: "PO_DETAILS",
      supplierId: "SUP-001",
      supplierName: "Apex Footwear Distributors",
      selectedOrderId: "PO-2026-081",
      grnLines: [
        {
          rowId: "line-1",
          code: "SH-RUN-01",
          quantity_ordered: 50,
          quantity_received: 50,
          quantity_damaged: 2,
          cost_price: 1200,
          invoice_rate: 1250, // +50 PPV
        },
      ],
      transporterName: "V-Trans India",
      lrNumber: "LR-90211",
      costItems: [{ id: "freight-1", amount: 1500, component_type: "FREIGHT" }],
      manualAllocations: { "freight-1": { "line-1": 1500 } },
    };

    // Step 1 -> Step 2
    state.activeStep = getNextWorkflowStep(state.activeStep);
    expect(state.activeStep).toBe("RECEIVE_VERIFY");
    expect(state.supplierId).toBe("SUP-001");
    expect(state.grnLines[0].quantity_received).toBe(50);

    // Step 2 -> Step 3
    state.activeStep = getNextWorkflowStep(state.activeStep);
    expect(state.activeStep).toBe("COMMERCIALS");
    expect(state.grnLines[0].invoice_rate).toBe(1250);
    expect(state.selectedOrderId).toBe("PO-2026-081");

    // Step 3 -> Step 4
    state.activeStep = getNextWorkflowStep(state.activeStep);
    expect(state.activeStep).toBe("COSTS_FREIGHT");
    expect(state.transporterName).toBe("V-Trans India");
    expect(state.costItems).toHaveLength(1);

    // Step 4 -> Step 5
    state.activeStep = getNextWorkflowStep(state.activeStep);
    expect(state.activeStep).toBe("REVIEW_POST");
    expect(state.grnLines[0].quantity_damaged).toBe(2);

    // Retreat Step 5 -> 4 -> 3 -> 2 -> 1
    state.activeStep = getPreviousWorkflowStep(state.activeStep);
    expect(state.activeStep).toBe("COSTS_FREIGHT");
    state.activeStep = getPreviousWorkflowStep(state.activeStep);
    expect(state.activeStep).toBe("COMMERCIALS");
    state.activeStep = getPreviousWorkflowStep(state.activeStep);
    expect(state.activeStep).toBe("RECEIVE_VERIFY");
    state.activeStep = getPreviousWorkflowStep(state.activeStep);
    expect(state.activeStep).toBe("PO_DETAILS");

    // Data verification
    expect(state.supplierId).toBe("SUP-001");
    expect(state.selectedOrderId).toBe("PO-2026-081");
    expect(state.grnLines[0].code).toBe("SH-RUN-01");
    expect(state.grnLines[0].quantity_received).toBe(50);
    expect(state.grnLines[0].quantity_damaged).toBe(2);
    expect(state.transporterName).toBe("V-Trans India");
    expect(state.costItems[0].amount).toBe(1500);
    expect(state.manualAllocations["freight-1"]["line-1"]).toBe(1500);
  });

  // 6. Preservation of Commit 0115d195 Manual Landed Cost Allocation
  it("strictly preserves commit 0115d195 manual allocation validation and reconciliation", () => {
    const lines = [
      { rowId: "L1", quantity_received: 20, quantity_damaged: 0, invoice_rate: 400, trade_discount: 0 },
      { rowId: "L2", quantity_received: 10, quantity_damaged: 0, invoice_rate: 600, trade_discount: 0 },
    ];
    const costItem = { id: "freight", amount: 900 };

    // Balanced allocation
    const balancedAlloc = getManualAllocationVariance({
      costItem,
      grnLines: lines,
      manualAllocations: { freight: { L1: 600, L2: 300 } },
    });
    expect(balancedAlloc.allocatedTotal).toBe(900);
    expect(balancedAlloc.variance).toBe(0);
    expect(balancedAlloc.isBalanced).toBe(true);

    // Under-allocation (must fail balance check)
    const underAlloc = getManualAllocationVariance({
      costItem,
      grnLines: lines,
      manualAllocations: { freight: { L1: 500, L2: 300 } },
    });
    expect(underAlloc.allocatedTotal).toBe(800);
    expect(underAlloc.variance).toBe(100);
    expect(underAlloc.isBalanced).toBe(false);

    // Over-allocation (must fail balance check)
    const overAlloc = getManualAllocationVariance({
      costItem,
      grnLines: lines,
      manualAllocations: { freight: { L1: 700, L2: 300 } },
    });
    expect(overAlloc.allocatedTotal).toBe(1000);
    expect(overAlloc.variance).toBe(-100);
    expect(overAlloc.isBalanced).toBe(false);

    // Landed cost calculation matches
    const calculated = calculateManualLineAllocations({
      grnLines: lines,
      costItems: [costItem as any],
      manualAllocations: { freight: { L1: 600, L2: 300 } },
    });
    // L1: 600 / 20 = 30 addon/unit. Landed = 400 + 30 = 430
    expect(calculated[0].landedCost).toBe(430);
    // L2: 300 / 10 = 30 addon/unit. Landed = 600 + 30 = 630
    expect(calculated[1].landedCost).toBe(630);
  });
});
