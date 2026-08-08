/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Search & Filter Registry (SUSF v1.0)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & SUSF-001 (Universal Search)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import {
  ISearchProvider,
  SearchManifest,
  ISearchQuery,
  ISearchResult,
  SavedViewDefinition
} from "../../public/ISearchService.js";

export class SearchRegistryService {
  private providers: Map<string, ISearchProvider> = new Map();
  private savedViews: Map<string, SavedViewDefinition[]> = new Map();
  private searchHistory: Array<{ query: string; moduleId: string; timestamp: number }> = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    // Built-in search views
  }

  /**
   * Register a Search Provider for a business domain module (Item, Customer, Supplier, etc.)
   */
  public registerProvider(provider: ISearchProvider): void {
    const key = provider.id.toLowerCase();
    this.providers.set(key, provider);
    if (provider.manifest.defaultSavedViews) {
      this.savedViews.set(key, [...provider.manifest.defaultSavedViews]);
    }
    this.emitChange();
  }

  /**
   * Resolve registered provider by module ID
   */
  public getProvider(moduleId: string): ISearchProvider | undefined {
    return this.providers.get(moduleId.toLowerCase());
  }

  /**
   * Get metadata manifest for a module
   */
  public getManifest(moduleId: string): SearchManifest | undefined {
    const provider = this.getProvider(moduleId);
    return provider?.manifest;
  }

  /**
   * Execute search across registered search provider
   */
  public async executeSearch<T = any>(query: ISearchQuery): Promise<ISearchResult<T>> {
    const moduleId = query.moduleId || "item-master";
    const provider = this.getProvider(moduleId);

    const startTime = performance.now();

    if (query.query) {
      this.recordHistory(query.query, moduleId);
    }

    if (!provider) {
      return {
        items: [],
        totalCount: 0,
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    }

    const res = await provider.search(query);
    return {
      ...res,
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  /**
   * Saved views management for module
   */
  public getSavedViews(moduleId: string): SavedViewDefinition[] {
    return this.savedViews.get(moduleId.toLowerCase()) || [];
  }

  public saveView(moduleId: string, view: SavedViewDefinition): void {
    const key = moduleId.toLowerCase();
    const existing = this.savedViews.get(key) || [];
    const updated = [...existing.filter((v) => v.id !== view.id), view];
    this.savedViews.set(key, updated);
    this.emitChange();
  }

  /**
   * Search history tracking
   */
  private recordHistory(query: string, moduleId: string): void {
    this.searchHistory = [
      { query, moduleId, timestamp: Date.now() },
      ...this.searchHistory.filter((h) => h.query !== query).slice(0, 24),
    ];
  }

  public getHistory(moduleId?: string): Array<{ query: string; moduleId: string; timestamp: number }> {
    if (!moduleId) return this.searchHistory;
    return this.searchHistory.filter((h) => h.moduleId.toLowerCase() === moduleId.toLowerCase());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public clear(): void {
    this.providers.clear();
    this.savedViews.clear();
    this.searchHistory = [];
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const SearchRegistry = new SearchRegistryService();
