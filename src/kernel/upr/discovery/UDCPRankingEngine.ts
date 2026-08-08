/**
 * Project      : SMRITI Retail OS
 * Module       : UDCP — Pluggable Relevance Ranking Engine
 * Standard     : UDCP-001, UDCP-006 (FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * Pluggable relevance scoring architecture (Refinement #3).
 * Decouples ranking logic from the kernel engine.
 *
 * Scoring Hierarchy (RetailRankingStrategy):
 *   - Exact Barcode Match     100
 *   - Exact SKU / Code Match   95
 *   - Title Starts With        90
 *   - Title Includes           85
 *   - Subtitle / Tag Match     70
 *   - Fuzzy Match              50
 */

import type { DiscoveryResult, DiscoveryContext } from "./UDCPSchema.js";

export interface IRankingStrategy {
  name: string;
  score(result: DiscoveryResult, queryTerms: string[], context?: DiscoveryContext): number;
}

class RetailRankingStrategy implements IRankingStrategy {
  name = "RetailRankingStrategy";

  score(result: DiscoveryResult, queryTerms: string[], _context?: DiscoveryContext): number {
    if (queryTerms.length === 0) return result.score || 50;

    const query = queryTerms.join(" ").toLowerCase();
    const title = result.title.toLowerCase();
    const subtitle = result.subtitle?.toLowerCase() ?? "";
    const badge = result.badge?.toLowerCase() ?? "";
    const code = result.entityId?.toLowerCase() ?? "";

    // Exact Barcode / Code Match -> 100
    if (code === query || (result.entityType === "product" && code.includes(query))) {
      return 100;
    }

    // Exact SKU / Title Match -> 95
    if (title === query) {
      return 95;
    }

    // Title Starts With -> 90
    if (title.startsWith(query)) {
      return 90;
    }

    // Title Includes -> 85
    if (title.includes(query)) {
      return 85;
    }

    // Subtitle / Badge Match -> 70
    if (subtitle.includes(query) || badge.includes(query)) {
      return 70;
    }

    // Partial term matches -> 50
    const matchedTermCount = queryTerms.filter(
      (t) => title.includes(t) || subtitle.includes(t) || code.includes(t)
    ).length;

    if (matchedTermCount > 0) {
      return Math.min(65, 40 + matchedTermCount * 10);
    }

    return 30; // Default baseline
  }
}

class UDCPRankingEngineService {
  private static instance: UDCPRankingEngineService | null = null;
  private activeStrategy: IRankingStrategy = new RetailRankingStrategy();
  private strategies: Map<string, IRankingStrategy> = new Map();

  private constructor() {
    this.registerStrategy(this.activeStrategy);
  }

  public static getInstance(): UDCPRankingEngineService {
    if (!UDCPRankingEngineService.instance) {
      UDCPRankingEngineService.instance = new UDCPRankingEngineService();
    }
    return UDCPRankingEngineService.instance;
  }

  public registerStrategy(strategy: IRankingStrategy): void {
    this.strategies.set(strategy.name.toLowerCase(), strategy);
  }

  public setStrategy(name: string): boolean {
    const s = this.strategies.get(name.toLowerCase());
    if (s) {
      this.activeStrategy = s;
      return true;
    }
    return false;
  }

  /** Rank and sort array of DiscoveryResults descending by calculated score */
  public rank(results: DiscoveryResult[], queryTerms: string[], context?: DiscoveryContext): DiscoveryResult[] {
    const scored = results.map((r) => {
      const calculatedScore = this.activeStrategy.score(r, queryTerms, context);
      return { ...r, score: calculatedScore };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  public getActiveStrategyName(): string {
    return this.activeStrategy.name;
  }
}

export const UDCPRankingEngine = UDCPRankingEngineService.getInstance();
export { UDCPRankingEngineService, RetailRankingStrategy };
