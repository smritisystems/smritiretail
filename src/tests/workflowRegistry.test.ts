/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Workflow Registry (UWR Phase 4 Core) Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & UWR Standard v1.0 Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { createPlatformContext } from "../kernel/context/PlatformContext.js";
import { WorkflowRegistry, type WorkflowDefinition } from "../kernel/upr/workflow/WorkflowRegistry.js";

describe("Universal Workflow Registry (UWR Phase 4 Core)", () => {
  beforeEach(() => {
    WorkflowRegistry.clear();
  });

  it("should seed default workflows (wf.purchase_order)", () => {
    const workflows = SPK.workflow.getWorkflows();
    expect(workflows.length).toBeGreaterThanOrEqual(1);

    const poWf = SPK.workflow.getWorkflow("wf.purchase_order");
    expect(poWf).toBeDefined();
    expect(poWf?.initialState).toBe("draft");
    expect(poWf?.states).toContain("approved");
  });

  it("should execute valid workflow state transitions", () => {
    const context = createPlatformContext({ userRole: "sysadmin" });

    const result = SPK.workflow.executeTransition("wf.purchase_order", "draft", "submit", context);
    expect(result.success).toBe(true);
    expect(result.previousState).toBe("draft");
    expect(result.newState).toBe("submitted");
  });

  it("should enforce role restrictions during workflow state transitions", () => {
    const cashierCtx = createPlatformContext({ userRole: "cashier" });

    // Cashier attempting to approve PO requiring store_manager role
    const deniedResult = SPK.workflow.executeTransition("wf.purchase_order", "submitted", "approve", cashierCtx);
    expect(deniedResult.success).toBe(false);
    expect(deniedResult.reason).toContain("cannot execute transition");

    const managerCtx = createPlatformContext({ userRole: "store_manager" });

    // Manager approving PO
    const approvedResult = SPK.workflow.executeTransition("wf.purchase_order", "submitted", "approve", managerCtx);
    expect(approvedResult.success).toBe(true);
    expect(approvedResult.newState).toBe("approved");
  });

  it("should support dynamic registration of plugin workflows", () => {
    const customWf: WorkflowDefinition = {
      id: "wf.discount_approval",
      entityId: "sales_invoice",
      name: "Line Item Discount Approval Workflow",
      initialState: "pending_approval",
      states: ["pending_approval", "approved", "rejected"],
      transitions: [
        { id: "approve", name: "Approve Discount", fromState: "pending_approval", toState: "approved", requiredRole: "store_manager" },
        { id: "reject", name: "Reject Discount", fromState: "pending_approval", toState: "rejected", requiredRole: "store_manager" }
      ]
    };

    SPK.workflow.registerWorkflow(customWf);

    const managerCtx = createPlatformContext({ userRole: "store_manager" });
    const result = SPK.workflow.executeTransition("wf.discount_approval", "pending_approval", "approve", managerCtx);

    expect(result.success).toBe(true);
    expect(result.newState).toBe("approved");
  });
});
