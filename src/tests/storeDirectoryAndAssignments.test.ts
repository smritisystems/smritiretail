/*
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, expect, it } from "vitest";

export interface StoreDirectoryEntry {
  id: string;
  canonical_id: string;
  store_code: string;
  store_name: string;
  store_type: "INTERNAL_BRANCH" | "CUSTOMER_STORE";
  host_id: string;
  host_name: string;
  city: string;
  state: string;
  status: string;
  store_manager?: { id: string; name: string; phone?: string; effective_from: string } | null;
  primary_representative?: { id: string; name: string; phone?: string; effective_from: string } | null;
  assigned_staff_count: number;
  verified_present_today_count: number;
  psv_active: boolean;
}

export const createCollisionSafeStoreIdentity = (
  storeType: "INTERNAL_BRANCH" | "CUSTOMER_STORE",
  canonicalId: string
): string => {
  return `${storeType}:${canonicalId}`;
};

export const parseCollisionSafeStoreIdentity = (
  compositeId: string
): { storeType: "INTERNAL_BRANCH" | "CUSTOMER_STORE" | "UNKNOWN"; canonicalId: string } => {
  if (compositeId.startsWith("INTERNAL_BRANCH:")) {
    return { storeType: "INTERNAL_BRANCH", canonicalId: compositeId.slice("INTERNAL_BRANCH:".length) };
  }
  if (compositeId.startsWith("CUSTOMER_STORE:")) {
    return { storeType: "CUSTOMER_STORE", canonicalId: compositeId.slice("CUSTOMER_STORE:".length) };
  }
  return { storeType: "UNKNOWN", canonicalId: compositeId };
};

export const resolveAttendanceStatus = (
  hasRecord: boolean,
  recordStatus?: string,
  checkOutAt?: string | null
): "PRESENT" | "NOT_LOGGED" | "ABSENT" => {
  if (!hasRecord) return "NOT_LOGGED"; // Strict rule: Never infer absence or presence!
  if (recordStatus === "PRESENT" && !checkOutAt) return "PRESENT";
  if (recordStatus === "ABSENT") return "ABSENT";
  return "NOT_LOGGED";
};

export const validateMultiStorePlacement = (params: {
  staffUserId: string;
  targetStoreId: string;
  targetRole: string;
  existingPlacements: Array<{ staffUserId: string; storeId: string; role: string; status: string }>;
}): { valid: boolean; errorTitle?: string; errorMessage?: string } => {
  const activePlacements = params.existingPlacements.filter(p => p.status === "ACTIVE");

  // 1. Same user at same store check
  const duplicate = activePlacements.find(
    p => p.staffUserId === params.staffUserId && p.storeId === params.targetStoreId
  );
  if (duplicate) {
    return {
      valid: false,
      errorTitle: "Duplicate Placement",
      errorMessage: "This staff member is already assigned to this store.",
    };
  }

  // 2. Conflicting Store Manager check
  if (params.targetRole === "STORE_MANAGER") {
    const existingManager = activePlacements.find(
      p => p.storeId === params.targetStoreId && p.role === "STORE_MANAGER"
    );
    if (existingManager) {
      return {
        valid: false,
        errorTitle: "Store Manager Exists",
        errorMessage: "This store already has an active Store Manager.",
      };
    }
  }

  // 3. Conflicting Primary Representative check
  if (params.targetRole === "PRIMARY_REPRESENTATIVE") {
    const existingRep = activePlacements.find(
      p => p.storeId === params.targetStoreId && p.role === "PRIMARY_REPRESENTATIVE"
    );
    if (existingRep) {
      return {
        valid: false,
        errorTitle: "Primary Representative Exists",
        errorMessage: "This partner store already has an active Primary Representative.",
      };
    }
  }

  // Multi-store allowed for sales reps and roaming staff!
  return { valid: true };
};

describe("Store Directory & Staff Placement Governance", () => {
  it("generates collision-safe composite identities for matching store codes", () => {
    // Both branch and partner store have store code "1888"
    const branchId = createCollisionSafeStoreIdentity("INTERNAL_BRANCH", "br-101");
    const partnerId = createCollisionSafeStoreIdentity("CUSTOMER_STORE", "cdl-505");

    expect(branchId).toBe("INTERNAL_BRANCH:br-101");
    expect(partnerId).toBe("CUSTOMER_STORE:cdl-505");
    expect(branchId).not.toBe(partnerId);

    const parsedBranch = parseCollisionSafeStoreIdentity(branchId);
    expect(parsedBranch.storeType).toBe("INTERNAL_BRANCH");
    expect(parsedBranch.canonicalId).toBe("br-101");

    const parsedPartner = parseCollisionSafeStoreIdentity(partnerId);
    expect(parsedPartner.storeType).toBe("CUSTOMER_STORE");
    expect(parsedPartner.canonicalId).toBe("cdl-505");
  });

  it("strictly enforces attendance semantics: missing attendance is NOT_LOGGED, never absent or present", () => {
    // Case 1: No attendance record logged today
    expect(resolveAttendanceStatus(false)).toBe("NOT_LOGGED");

    // Case 2: Clocked in with active check-in
    expect(resolveAttendanceStatus(true, "PRESENT", null)).toBe("PRESENT");

    // Case 3: Checked out already
    expect(resolveAttendanceStatus(true, "PRESENT", "2026-10-18T18:00:00Z")).toBe("NOT_LOGGED");

    // Case 4: Explicit leave / confirmed absence
    expect(resolveAttendanceStatus(true, "ABSENT", null)).toBe("ABSENT");
  });

  it("permits a single staff member to be assigned to multiple stores when roles are non-conflicting", () => {
    const existing = [
      { staffUserId: "usr-roam-1", storeId: "INTERNAL_BRANCH:br-01", role: "SALES_REPRESENTATIVE", status: "ACTIVE" },
    ];

    // Assigning to second store as SALES_REPRESENTATIVE
    const result = validateMultiStorePlacement({
      staffUserId: "usr-roam-1",
      targetStoreId: "CUSTOMER_STORE:cdl-02",
      targetRole: "SALES_REPRESENTATIVE",
      existingPlacements: existing,
    });

    expect(result.valid).toBe(true);
  });

  it("rejects assigning the same staff member to the same store location twice", () => {
    const existing = [
      { staffUserId: "usr-1", storeId: "INTERNAL_BRANCH:br-01", role: "SALES_REPRESENTATIVE", status: "ACTIVE" },
    ];

    const result = validateMultiStorePlacement({
      staffUserId: "usr-1",
      targetStoreId: "INTERNAL_BRANCH:br-01",
      targetRole: "BACKUP_REPRESENTATIVE",
      existingPlacements: existing,
    });

    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe("Duplicate Placement");
  });

  it("rejects assigning a second Store Manager to a store with an active manager", () => {
    const existing = [
      { staffUserId: "usr-mgr-1", storeId: "INTERNAL_BRANCH:br-01", role: "STORE_MANAGER", status: "ACTIVE" },
    ];

    const result = validateMultiStorePlacement({
      staffUserId: "usr-candidate-2",
      targetStoreId: "INTERNAL_BRANCH:br-01",
      targetRole: "STORE_MANAGER",
      existingPlacements: existing,
    });

    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe("Store Manager Exists");
  });

  it("rejects assigning a second Primary Representative to a partner store with an active primary rep", () => {
    const existing = [
      { staffUserId: "usr-rep-1", storeId: "CUSTOMER_STORE:cdl-01", role: "PRIMARY_REPRESENTATIVE", status: "ACTIVE" },
    ];

    const result = validateMultiStorePlacement({
      staffUserId: "usr-candidate-2",
      targetStoreId: "CUSTOMER_STORE:cdl-01",
      targetRole: "PRIMARY_REPRESENTATIVE",
      existingPlacements: existing,
    });

    expect(result.valid).toBe(false);
    expect(result.errorTitle).toBe("Primary Representative Exists");
  });

  it("calculates atomic transfer dates: expires prior placement the day before effective_from", () => {
    const transferEffectiveFrom = "2026-11-01";
    const priorEffectiveFrom = "2026-01-01";

    const calcExpiry = (newStart: string): string => {
      const d = new Date(newStart);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    };

    const priorEffectiveTo = calcExpiry(transferEffectiveFrom);
    expect(priorEffectiveTo).toBe("2026-10-31");
    expect(new Date(priorEffectiveTo).getTime()).toBeGreaterThan(new Date(priorEffectiveFrom).getTime());
    expect(new Date(priorEffectiveTo).getTime()).toBeLessThan(new Date(transferEffectiveFrom).getTime());
  });

  it("resolves Customer 360 servicing store badge and primary rep correctly", () => {
    interface CustomerServicingStoreInfo {
      storeCode: string;
      storeName: string;
      storeType: "INTERNAL_BRANCH" | "CUSTOMER_STORE";
      primaryRepName?: string;
    }

    const resolveServicingStore = (customer: {
      storeCode?: string;
      deliveryLocations?: Array<{ storeCode: string; locationName: string; primaryRepName?: string }>;
    }): CustomerServicingStoreInfo | null => {
      if (!customer.storeCode && (!customer.deliveryLocations || customer.deliveryLocations.length === 0)) {
        return null;
      }
      const primaryLoc = customer.deliveryLocations?.find(l => l.storeCode === customer.storeCode) || customer.deliveryLocations?.[0];
      return {
        storeCode: primaryLoc ? primaryLoc.storeCode : customer.storeCode || "",
        storeName: primaryLoc ? primaryLoc.locationName : `Store ${customer.storeCode}`,
        storeType: "CUSTOMER_STORE",
        primaryRepName: primaryLoc?.primaryRepName || "Unassigned",
      };
    };

    const res = resolveServicingStore({
      storeCode: "1888",
      deliveryLocations: [
        { storeCode: "1888", locationName: "Reliance Retail 1888", primaryRepName: "Vikram Malhotra" }
      ]
    });

    expect(res).not.toBeNull();
    expect(res?.storeCode).toBe("1888");
    expect(res?.storeName).toBe("Reliance Retail 1888");
    expect(res?.primaryRepName).toBe("Vikram Malhotra");
  });

  it("determines PSV consignment transparency eligibility based on stock model and store assignment", () => {
    const isPsvEligible = (stockModel: string, psvActive: boolean): boolean => {
      return psvActive && (stockModel === "CONSIGNMENT" || stockModel === "STOCK_ON_APPROVAL");
    };

    expect(isPsvEligible("CONSIGNMENT", true)).toBe(true);
    expect(isPsvEligible("STOCK_ON_APPROVAL", true)).toBe(true);
    expect(isPsvEligible("OUTRIGHT_SALE", true)).toBe(false);
    expect(isPsvEligible("CONSIGNMENT", false)).toBe(false);
  });
});
