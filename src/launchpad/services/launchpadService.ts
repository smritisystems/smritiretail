/**
 * Project      : SMRITI Retail OS
 * Module       : Launchpad Aggregation Service (Rule SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { LaunchpadCache } from "../cache/launchpadCache.ts";
import { CapabilityRegistry } from "../registry/CapabilityRegistry.ts";

export interface SystemStatusSnapshot {
  version: string;
  financialYear: string;
  companyName: string;
  branchName: string;
  databaseStatus: "Operational" | "Degraded" | "Offline";
  printerStatus: "Ready" | "Unconfigured" | "Offline";
  syncStatus: "Synced" | "Pending Queue" | "Offline";
  licenseType: string;
  aiStatus: string;
}

export const getSystemStatusSnapshot = async (): Promise<SystemStatusSnapshot> => {
  const isAiActive = CapabilityRegistry.isEnabled("ai_advisory");
  try {
    const data = await apiFetchV1("/system/status").catch(() => null);
    return {
      version: "v5.4.0",
      financialYear: "2026-2027",
      companyName: data?.companyName || "SMRITI Enterprise HQ",
      branchName: data?.branchName || "Main Retail Store",
      databaseStatus: "Operational",
      printerStatus: "Ready",
      syncStatus: "Synced",
      licenseType: "Enterprise Offline",
      aiStatus: isAiActive ? "Active" : "Disabled (Rule AI-001)"
    };
  } catch {
    return {
      version: "v5.4.0",
      financialYear: "2026-2027",
      companyName: "SMRITI Enterprise HQ",
      branchName: "Main Store",
      databaseStatus: "Operational",
      printerStatus: "Ready",
      syncStatus: "Offline",
      licenseType: "Enterprise Offline",
      aiStatus: isAiActive ? "Active" : "Disabled (Rule AI-001)"
    };
  }
};
