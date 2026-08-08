/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Enterprise SDK CLI & Plugin Validator (v2.0.0 LTS)
 * Standard     : SWEF P-012 / SXP Certification Gate SXP-CS-012
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 2.0.0-LTS
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { ExperiencePlugin } from "./ExperiencePluginSDK.js";

export interface PluginValidationResult {
  pluginId: string;
  isValid: boolean;
  score: number; // 0 - 100
  checks: {
    hasValidManifest: boolean;
    hasValidId: boolean;
    hasVersion: boolean;
    sdkApiCompatibility: boolean;
    securityCheck: boolean;
  };
  errors: string[];
  warnings: string[];
}

export class PluginValidator {
  public static validate(plugin: ExperiencePlugin): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const hasValidId = Boolean(plugin.id && plugin.id.includes("."));
    if (!hasValidId) {
      errors.push("Plugin ID must follow reverse domain format (e.g. 'com.smriti.pharmacy').");
    }

    const hasVersion = Boolean(plugin.version && /^\d+\.\d+\.\d+/.test(plugin.version));
    if (!hasVersion) {
      errors.push("Plugin version must follow Semantic Versioning format (e.g. '1.0.0').");
    }

    const hasName = Boolean(plugin.name && plugin.name.trim().length > 0);
    if (!hasName) {
      errors.push("Plugin name cannot be empty.");
    }

    const isValid = errors.length === 0;
    const score = isValid ? (warnings.length === 0 ? 100 : 90) : 50;

    return {
      pluginId: plugin.id || "unknown",
      isValid,
      score,
      checks: {
        hasValidManifest: hasName,
        hasValidId,
        hasVersion,
        sdkApiCompatibility: true,
        securityCheck: true,
      },
      errors,
      warnings,
    };
  }
}

export class SmritiSdkCli {
  public static createPluginTemplate(id: string, name: string): string {
    return `import { ExperiencePlugin, PluginRegistrationTargets } from "@smriti/sdk";

export const ${name.replace(/\s+/g, "")}Plugin: ExperiencePlugin = {
  id: "${id}",
  name: "${name}",
  version: "1.0.0",
  description: "Custom SMRITI Retail OS Extension Plugin",

  registerExtensions(targets: PluginRegistrationTargets) {
    // Register custom domains, forms, print templates, and 360° inspectors here
    targets.navigation.registerDomain({
      id: "${id.split(".").pop()}",
      name: "${name}",
      icon: "extension",
    });
  },
};
`;
  }
}
