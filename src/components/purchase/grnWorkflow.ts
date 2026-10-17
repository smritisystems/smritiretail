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
 * Capability    : @SmritiCapability("PURCHASE", "GRN_WORKFLOW_ENGINE")
 * Target UI    : SMRITI GRN Studio — Authoritative 5-Step Procurement Inward State Machine
 */

export type GrnWorkflowStepId =
  | "PO_DETAILS"
  | "RECEIVE_VERIFY"
  | "COMMERCIALS"
  | "COSTS_FREIGHT"
  | "REVIEW_POST";

export interface GrnWorkflowStepDefinition {
  id: GrnWorkflowStepId;
  label: string;
  order: number;
}

export const GRN_WORKFLOW_STEPS: GrnWorkflowStepDefinition[] = [
  { id: "PO_DETAILS", label: "PO & Details", order: 1 },
  { id: "RECEIVE_VERIFY", label: "Receive & Verify", order: 2 },
  { id: "COMMERCIALS", label: "Commercials", order: 3 },
  { id: "COSTS_FREIGHT", label: "Costs & Freight", order: 4 },
  { id: "REVIEW_POST", label: "Review & Post", order: 5 },
];

export function getWorkflowStepIndex(step: GrnWorkflowStepId): number {
  return GRN_WORKFLOW_STEPS.findIndex((item) => item.id === step);
}

export function getNextWorkflowStep(step: GrnWorkflowStepId): GrnWorkflowStepId {
  const index = getWorkflowStepIndex(step);
  if (index === -1 || index >= GRN_WORKFLOW_STEPS.length - 1) {
    return step;
  }
  return GRN_WORKFLOW_STEPS[index + 1].id;
}

export function getPreviousWorkflowStep(step: GrnWorkflowStepId): GrnWorkflowStepId {
  const index = getWorkflowStepIndex(step);
  if (index <= 0) {
    return step;
  }
  return GRN_WORKFLOW_STEPS[index - 1].id;
}

export function canNavigateToStep(targetStep: GrnWorkflowStepId, currentStep: GrnWorkflowStepId): boolean {
  const currentIndex = getWorkflowStepIndex(currentStep);
  const targetIndex = getWorkflowStepIndex(targetStep);

  if (currentIndex === -1 || targetIndex === -1) {
    return false;
  }

  return targetIndex <= currentIndex + 1;
}

export interface WorkflowValidationInput {
  supplierId?: string;
  grnLines?: Array<{
    quantity_received?: number;
    quantity_damaged?: number;
    acceptedQty?: number;
  }>;
  validationErrors?: string[];
  manualUnbalanced?: boolean;
}

export function validateWorkflowStep(
  step: GrnWorkflowStepId,
  values: WorkflowValidationInput = {}
): string[] {
  switch (step) {
    case "PO_DETAILS": {
      if (!values.supplierId || !String(values.supplierId).trim()) {
        return ["Supplier is required."];
      }
      return [];
    }
    case "RECEIVE_VERIFY": {
      const errors: string[] = [];
      const lines = values.grnLines ?? [];

      lines.forEach((line, index) => {
        const received = Number(line.quantity_received ?? 0);
        const damaged = Number(line.quantity_damaged ?? 0);
        const accepted = Number(line.acceptedQty ?? received - damaged);

        if (received < 0) {
          errors.push(`Received quantity for line ${index + 1} cannot be negative.`);
        }
        if (damaged < 0) {
          errors.push(`Damaged quantity for line ${index + 1} cannot be negative.`);
        }
        if (accepted < 0) {
          errors.push("Accepted quantity cannot be negative.");
        }
      });

      return errors;
    }
    case "COMMERCIALS": {
      return values.grnLines && values.grnLines.length === 0 ? ["At least one inward line is required to continue."] : [];
    }
    case "COSTS_FREIGHT": {
      return values.manualUnbalanced ? ["Manual allocation is unbalanced and must be corrected before proceeding."] : [];
    }
    case "REVIEW_POST": {
      return values.validationErrors ?? [];
    }
    default:
      return [];
  }
}
