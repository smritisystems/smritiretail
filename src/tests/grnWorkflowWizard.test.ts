/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.34.0
 * Created      : 2026-09-20
 * Modified     : 2026-09-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_WORKFLOW_TEST")
 * Target UI    : SMRITI GRN Studio — Workflow Wizard Unit Suite
 */

import { describe, expect, it } from "vitest";
import {
  GRN_WORKFLOW_STEPS,
  canNavigateToStep,
  getNextWorkflowStep,
  getPreviousWorkflowStep,
  validateWorkflowStep,
} from "../components/purchase/grnWorkflow";

describe("GRN workflow wizard", () => {
  it("starts at the first step and exposes the canonical five-step order", () => {
    expect(GRN_WORKFLOW_STEPS.map((step) => step.id)).toEqual([
      "PO_DETAILS",
      "RECEIVE_VERIFY",
      "COMMERCIALS",
      "COSTS_FREIGHT",
      "REVIEW_POST",
    ]);
    expect(GRN_WORKFLOW_STEPS[0].label).toBe("PO & Details");
  });

  it("permits forward navigation in order and blocks skipped future steps before prerequisites are met", () => {
    expect(canNavigateToStep("RECEIVE_VERIFY", "PO_DETAILS")).toBe(true);
    expect(canNavigateToStep("COMMERCIALS", "PO_DETAILS")).toBe(false);
    expect(canNavigateToStep("COSTS_FREIGHT", "COMMERCIALS")).toBe(true);
    expect(canNavigateToStep("REVIEW_POST", "COSTS_FREIGHT")).toBe(true);
  });

  it("returns the correct next and previous step transitions", () => {
    expect(getNextWorkflowStep("PO_DETAILS")).toBe("RECEIVE_VERIFY");
    expect(getNextWorkflowStep("RECEIVE_VERIFY")).toBe("COMMERCIALS");
    expect(getPreviousWorkflowStep("COMMERCIALS")).toBe("RECEIVE_VERIFY");
    expect(getPreviousWorkflowStep("PO_DETAILS")).toBe("PO_DETAILS");
  });

  it("validates step prerequisites without duplicating business rules", () => {
    expect(validateWorkflowStep("PO_DETAILS", { supplierId: "sup-1" })).toEqual([]);
    expect(validateWorkflowStep("PO_DETAILS", { supplierId: "" })).toEqual(["Supplier is required."]);
    expect(validateWorkflowStep("RECEIVE_VERIFY", { grnLines: [{ quantity_received: 3, quantity_damaged: 1 }] })).toEqual([]);
    expect(validateWorkflowStep("RECEIVE_VERIFY", { grnLines: [{ quantity_received: 1, quantity_damaged: 3 }] })).toEqual(["Accepted quantity cannot be negative."]);
  });
});
