/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Experience Engine & Profile Resolver
 */

import { SAWFExperienceMode, SAWFWorkspaceProfile } from "../types/sawf.ts";

export class ExperienceEngine {
  static resolveProfileDefaultMode(role?: string): SAWFExperienceMode {
    if (!role) return "simple";

    const normalized = role.toLowerCase();

    if (normalized.includes("pos") || normalized.includes("cashier") || normalized.includes("clerk")) {
      return "simple";
    }
    if (normalized.includes("sales") || normalized.includes("executive") || normalized.includes("store manager")) {
      return "standard";
    }
    if (normalized.includes("accountant") || normalized.includes("finance") || normalized.includes("admin") || normalized.includes("super")) {
      return "enterprise";
    }

    return "standard";
  }

  static getProfileFromRole(role?: string): SAWFWorkspaceProfile {
    if (!role) return "sales_exec";

    const normalized = role.toLowerCase();
    if (normalized.includes("cashier") || normalized.includes("pos")) return "cashier";
    if (normalized.includes("sales")) return "sales_exec";
    if (normalized.includes("store manager") || normalized.includes("manager")) return "store_manager";
    if (normalized.includes("accountant") || normalized.includes("finance")) return "accountant";
    if (normalized.includes("admin") || normalized.includes("super")) return "admin";

    return "custom";
  }
}
