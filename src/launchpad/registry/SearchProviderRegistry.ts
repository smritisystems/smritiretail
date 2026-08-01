/**
 * Project      : SMRITI Retail OS
 * Module       : Search Provider Registry (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import logger from "../../core/logging/logger.js";
import { LaunchpadSearchProvider, SearchResultItem } from "../types/launchpadTypes.ts";

class SearchProviderRegistryImpl {
  private providers: Map<string, LaunchpadSearchProvider> = new Map();

  public register(provider: LaunchpadSearchProvider): void {
    this.providers.set(provider.id, provider);
  }

  public async searchAll(query: string): Promise<SearchResultItem[]> {
    if (!query || !query.trim()) return [];
    
    const results: SearchResultItem[] = [];
    const promises = Array.from(this.providers.values()).map(p => 
      p.search(query).catch(err => {
        logger.warn(`Search provider ${p.id} failed:`, err as unknown);
        return [];
      })
    );

    const providerResults = await Promise.all(promises);
    providerResults.forEach(res => results.push(...res));
    return results;
  }
}

export const SearchProviderRegistry = new SearchProviderRegistryImpl();
