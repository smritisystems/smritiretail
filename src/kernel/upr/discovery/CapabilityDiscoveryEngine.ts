/**
 * Project      : SMRITI Retail OS v6.5
 * Module       : Capability Discovery Engine (CDE / Rule 15 / PBC-001 Standard)
 * Description  : Platform Capability Graph Matcher & Duplicate Risk Analysis
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { SPK } from "../../SPK.js";

export interface CapabilityDiscoveryRequest {
  query: string;                           // Requirement description (e.g., "Purchase Return")
  targetDomain?: string;                   // Optional target domain filter
  requiredCapabilities?: string[];        // Specific feature tags needed
}

export interface CapabilityMatchResult {
  capabilityQuery: string;
  matchedDomainId: string;
  matchedModuleName: string;
  capabilityMatchPercent: number;          // Overall similarity match (e.g. 92%)
  existingAssetsCount: number;             // Total existing platform assets found
  reusableComponentsCount: number;         // Count of directly reusable components
  missingComponentsCount: number;          // Estimated new components needed
  duplicateRisk: "HIGH" | "MEDIUM" | "LOW" | "CLEAN";
  recommendedAction: "REUSE" | "EXTEND" | "MERGE" | "CREATE NEW";
  reusableAssetList: string[];
  missingAssetList: string[];
  guidanceQuote: string;
}

export class CapabilityDiscoveryEngine {
  /**
   * Analyzes a proposed requirement query against the UPR platform graph
   * to calculate match similarity, reuse potential, and duplicate risks.
   */
  public analyzeCapability(req: CapabilityDiscoveryRequest): CapabilityMatchResult {
    const q = req.query.trim().toLowerCase();
    const domains = SPK.navigation.getDomains();
    let bestMatchDomain = "sales";
    let bestMatchModule = "Sales Invoice";
    let matchScore = 0;
    let existingAssets: string[] = [];

    // Scan registered UPR modules for keywords & capabilities
    for (const d of domains) {
      for (const m of d.modules || []) {
        let score = 0;
        const titleLower = m.title.toLowerCase();
        const idLower = m.id.toLowerCase();
        const packageLower = (m.packageId || "").toLowerCase();

        if (q.includes(idLower) || idLower.includes(q)) score += 60;
        if (titleLower.split(" ").some(w => q.includes(w) && w.length > 3)) score += 30;
        if (packageLower.includes(q)) score += 20;

        if (score > matchScore) {
          matchScore = score;
          bestMatchDomain = d.id;
          bestMatchModule = m.title;
          existingAssets = [
            `Module: ${m.title} (${m.id})`,
            `Route: ${m.route || "/admin/" + m.id}`,
            `Workspace: ${m.workspaceId || m.id}`,
            `Permission: ${m.permission || d.id + "." + m.id + ".view"}`,
            `Package: ${m.packageId || "smriti.platform." + m.id}`
          ];
        }
      }
    }

    // Default calculations if exact match score is low
    const finalMatchPercent = matchScore > 0 ? Math.min(98, matchScore + 25) : 35;
    const totalAssets = existingAssets.length || 10;
    const reusableCount = Math.round(totalAssets * (finalMatchPercent / 100));
    const missingCount = Math.max(1, totalAssets - reusableCount);

    let action: "REUSE" | "EXTEND" | "MERGE" | "CREATE NEW" = "CREATE NEW";
    let risk: "HIGH" | "MEDIUM" | "LOW" | "CLEAN" = "CLEAN";

    if (finalMatchPercent >= 90) {
      action = "REUSE";
      risk = "HIGH";
    } else if (finalMatchPercent >= 70) {
      action = "EXTEND";
      risk = "HIGH";
    } else if (finalMatchPercent >= 50) {
      action = "MERGE";
      risk = "MEDIUM";
    }

    return {
      capabilityQuery: req.query,
      matchedDomainId: bestMatchDomain,
      matchedModuleName: bestMatchModule,
      capabilityMatchPercent: finalMatchPercent,
      existingAssetsCount: totalAssets,
      reusableComponentsCount: reusableCount,
      missingComponentsCount: missingCount,
      duplicateRisk: risk,
      recommendedAction: action,
      reusableAssetList: existingAssets,
      missingAssetList: [`${req.query} Custom Rules`, `${req.query} Specialized Form`],
      guidanceQuote: `The platform already contains ${finalMatchPercent}% of what you need. Reuse these ${reusableCount} components and only build the remaining ${missingCount} assets.`
    };
  }
}
