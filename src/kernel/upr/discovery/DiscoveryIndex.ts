/**
 * Project      : SMRITI Retail OS
 * Module       : UDCP — Discovery Index Engine (Sub-10ms Query Execution)
 * Standard     : UDCP-001, UDCP-006 (FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * Fast tokenized in-memory index.
 * Decouples index construction from provider execution.
 * Sub-10ms query execution across pre-indexed records.
 */

import type { DiscoveryResult } from "./UDCPSchema.js";

interface IndexedToken {
  term: string;
  resultId: string;
}

class DiscoveryIndexService {
  private static instance: DiscoveryIndexService | null = null;
  private resultsMap: Map<string, DiscoveryResult> = new Map();
  private tokenMap: Map<string, Set<string>> = new Map(); // token -> Set<resultId>
  private categoryMap: Map<string, Set<string>> = new Map(); // provider -> Set<resultId>

  private constructor() {}

  public static getInstance(): DiscoveryIndexService {
    if (!DiscoveryIndexService.instance) {
      DiscoveryIndexService.instance = new DiscoveryIndexService();
    }
    return DiscoveryIndexService.instance;
  }

  /** Tokenize text into search terms */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  /** Add or update a result in the index */
  public add(result: DiscoveryResult): void {
    this.resultsMap.set(result.id, Object.freeze({ ...result }));

    // Index title & subtitle terms
    const terms = [
      ...this.tokenize(result.title),
      ...(result.subtitle ? this.tokenize(result.subtitle) : []),
      ...(result.badge ? this.tokenize(result.badge) : []),
      ...(result.entityType ? [result.entityType.toLowerCase()] : []),
      ...(result.entityId ? [result.entityId.toLowerCase()] : []),
    ];

    terms.forEach((term) => {
      if (!this.tokenMap.has(term)) {
        this.tokenMap.set(term, new Set());
      }
      this.tokenMap.get(term)!.add(result.id);
    });

    // Category mapping
    if (!this.categoryMap.has(result.provider)) {
      this.categoryMap.set(result.provider, new Set());
    }
    this.categoryMap.get(result.provider)!.add(result.id);
  }

  /** Bulk add records to index */
  public addBulk(results: DiscoveryResult[]): void {
    results.forEach((r) => this.add(r));
  }

  /** Query index — returns candidate DiscoveryResults */
  public search(query: string, limit = 50): DiscoveryResult[] {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) {
      return Array.from(this.resultsMap.values()).slice(0, limit);
    }

    const candidateCounts = new Map<string, number>();

    tokens.forEach((token) => {
      // Prefix matching token search
      this.tokenMap.forEach((resultIds, indexedToken) => {
        if (indexedToken.startsWith(token)) {
          resultIds.forEach((id) => {
            candidateCounts.set(id, (candidateCounts.get(id) || 0) + 1);
          });
        }
      });
    });

    // Sort by match count descending
    const sortedIds = Array.from(candidateCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    return sortedIds
      .map((id) => this.resultsMap.get(id)!)
      .filter(Boolean)
      .slice(0, limit);
  }

  public remove(id: string): void {
    this.resultsMap.delete(id);
    this.tokenMap.forEach((set) => set.delete(id));
  }

  public clear(): void {
    this.resultsMap.clear();
    this.tokenMap.clear();
    this.categoryMap.clear();
  }

  public size(): number {
    return this.resultsMap.size;
  }
}

export const DiscoveryIndex = DiscoveryIndexService.getInstance();
export { DiscoveryIndexService };
