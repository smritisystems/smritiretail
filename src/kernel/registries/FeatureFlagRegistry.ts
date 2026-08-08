/**
 * Project      : SMRITI Retail OS
 * Module       : FeatureFlagRegistry (SCS-WSC-001 Standard)
 * Description  : Tenant/Company-scoped feature enablement registry. Determines
 *                whether a specific tenant/company has activated a platform capability.
 * Standard     : SCS-WSC-001 — SMRITI Workspace Context & Resolver
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { CapabilityRegistry } from "./CapabilityRegistry.js";

class FeatureFlagRegistryService {
  private activeFlags = new Map<string, boolean>();

  public isEnabled(flagKey: string): boolean {
    // Feature is enabled if platform supports capability AND flag is enabled
    if (!CapabilityRegistry.has(flagKey)) {
      return false;
    }
    return this.activeFlags.get(flagKey) ?? true; // Default to true if capability is supported
  }

  public setFlag(flagKey: string, enabled: boolean): void {
    this.activeFlags.set(flagKey, enabled);
  }

  public setFlags(flags: Record<string, boolean>): void {
    Object.entries(flags).forEach(([key, val]) => {
      this.setFlag(key, val);
    });
  }

  public getActiveFlags(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    this.activeFlags.forEach((val, key) => {
      result[key] = val;
    });
    return result;
  }
}

export const FeatureFlagRegistry = new FeatureFlagRegistryService();
