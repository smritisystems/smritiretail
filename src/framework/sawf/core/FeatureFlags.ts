/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Feature Flags System
 */

export interface SAWFFeatureFlags {
  enterpriseMode: boolean;
  accountingPanel: boolean;
  compliancePanel: boolean;
  commandPalette: boolean;
  aiAssistant: boolean;
  offlineSync: boolean;
  autosave: boolean;
}

export const defaultFeatureFlags: SAWFFeatureFlags = {
  enterpriseMode: true,
  accountingPanel: true,
  compliancePanel: true,
  commandPalette: true,
  aiAssistant: true,
  offlineSync: true,
  autosave: true,
};

export class FeatureFlagsService {
  private static flags: SAWFFeatureFlags = { ...defaultFeatureFlags };

  static getFlags(): SAWFFeatureFlags {
    return { ...this.flags };
  }

  static isEnabled(flagName: keyof SAWFFeatureFlags): boolean {
    return !!this.flags[flagName];
  }
}
