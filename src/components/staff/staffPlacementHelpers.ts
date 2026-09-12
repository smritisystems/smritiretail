/*
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-09-12
 * Modified     : 2026-09-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export interface PlacementSummary {
  id: string;
  effective_from: string;
  effective_to?: string;
  status: string;
}

export interface ReassignDraft {
  placementType: string;
  hostCustomerId?: string;
  hostDeliveryLocationId?: string;
  internalBranchId?: string;
  internalStoreId?: string;
  roleAtLocation?: string;
  stockModel: string;
  effectiveFrom: string;
}

export const dateAfter = (value?: string): string => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + 1));
    return date.toISOString().slice(0, 10);
  }
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const validateReassignment = (
  draft: ReassignDraft,
  activePlacement?: PlacementSummary,
): { valid: boolean; errorTitle?: string; errorMessage?: string } => {
  if (!activePlacement) {
    return {
      valid: false,
      errorTitle: "No Active Placement",
      errorMessage: "An active placement is required to perform reassignment.",
    };
  }

  if (draft.placementType === "INTERNAL_BRANCH") {
    if (!draft.internalBranchId) {
      return {
        valid: false,
        errorTitle: "Branch Required",
        errorMessage: "Select the destination internal branch.",
      };
    }
  } else {
    if (!draft.hostCustomerId || !draft.hostDeliveryLocationId) {
      return {
        valid: false,
        errorTitle: "Location Required",
        errorMessage: "Select the new customer and approved delivery location before reassignment.",
      };
    }
  }

  if (draft.effectiveFrom <= activePlacement.effective_from) {
    return {
      valid: false,
      errorTitle: "Invalid Effective Date",
      errorMessage: `Choose a date after ${activePlacement.effective_from}.`,
    };
  }

  return { valid: true };
};
