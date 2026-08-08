/**
 * Project      : SMRITI Retail OS
 * Module       : UDCP — Query Processing Pipeline & Synonym Engine
 * Standard     : UDCP-001, UDCP-005 (FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * Query Processing Pipeline:
 *   Raw Query → Normalizer → Spell Corrector → Synonym Engine → Industry Vocabulary Pack
 *
 * Refinement #8: Industry Vocabulary Packs (Pharmacy, Jewellery, Restaurant, Fashion)
 * e.g. "Paracetamol" -> "PCM", "22KT" -> "Gold", "Burger" -> "Kitchen Menu"
 */

import type { VocabularyProvider } from "./UDCPSchema.js";

class UDCPQueryPipelineService {
  private static instance: UDCPQueryPipelineService | null = null;
  private synonymMap: Map<string, string> = new Map();
  private vocabularies: Map<string, VocabularyProvider> = new Map();

  private constructor() {
    // Seed default common retail synonyms
    this.registerSynonym("pos", "point of sale");
    this.registerSynonym("po", "purchase order");
    this.registerSynonym("grn", "goods receipt note");
    this.registerSynonym("cust", "customer");
    this.registerSynonym("supp", "supplier");
    this.registerSynonym("inv", "invoice");
    this.registerSynonym("item", "product");
    this.registerSynonym("sku", "product");
  }

  public static getInstance(): UDCPQueryPipelineService {
    if (!UDCPQueryPipelineService.instance) {
      UDCPQueryPipelineService.instance = new UDCPQueryPipelineService();
    }
    return UDCPQueryPipelineService.instance;
  }

  /** Register an Industry Vocabulary Pack (Refinement #8) */
  public registerVocabulary(pack: VocabularyProvider): void {
    this.vocabularies.set(pack.industry.toLowerCase(), pack);
    Object.entries(pack.synonyms).forEach(([term, canonical]) => {
      this.registerSynonym(term.toLowerCase(), canonical.toLowerCase());
    });
  }

  public registerSynonym(term: string, canonical: string): void {
    this.synonymMap.set(term.toLowerCase(), canonical.toLowerCase());
  }

  /**
   * Process raw query string through the pipeline:
   * 1. Trim & lowercase
   * 2. Synonym expansion
   * 3. Normalize extra spaces
   */
  public process(query: string, industry?: string): { original: string; normalized: string; terms: string[] } {
    const raw = query.trim().toLowerCase();
    if (!raw) return { original: query, normalized: "", terms: [] };

    const rawTokens = raw.split(/\s+/);

    // Expand synonyms per token
    const expandedTokens = rawTokens.map((token) => {
      const syn = this.synonymMap.get(token);
      return syn ?? token;
    });

    const normalized = expandedTokens.join(" ");
    const terms = Array.from(new Set([...rawTokens, ...expandedTokens]));

    return {
      original: query,
      normalized,
      terms,
    };
  }

  public getRegisteredVocabularies(): string[] {
    return Array.from(this.vocabularies.keys());
  }
}

export const UDCPQueryPipeline = UDCPQueryPipelineService.getInstance();
export { UDCPQueryPipelineService };
