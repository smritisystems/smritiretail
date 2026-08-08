/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : SMRITI Universal Search & Filter Framework (SUSF) v1.0
 * Standard     : SMAP Constitution v1.0 — Public Contract (Level 1 Platform Capability)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface SearchCategoryDefinition {
  id: string;
  label: string;
  icon?: string;
}

export interface FilterFieldSchema {
  key: string;
  label: string;
  type: "text" | "select" | "number_range" | "date_range" | "boolean";
  options?: Array<{ label: string; value: any }>;
  defaultValue?: any;
}

export interface SavedViewDefinition {
  id: string;
  label: string;
  icon?: string;
  isPinned?: boolean;
  filterState: Record<string, any>;
}

export interface SearchManifest {
  moduleId: string;
  title: string;
  icon: string;
  defaultSearchFields: string[];
  categories: SearchCategoryDefinition[];
  filterFields: FilterFieldSchema[];
  defaultSavedViews?: SavedViewDefinition[];
  keyboardShortcuts?: {
    universalSearch?: string; // e.g. "F2"
    quickSearch?: string;     // e.g. "Ctrl+F"
    globalSearch?: string;    // e.g. "Ctrl+Shift+F"
  };
}

export interface ISearchQuery {
  query: string;
  moduleId?: string;
  category?: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ISearchResult<T = any> {
  items: T[];
  totalCount: number;
  facets?: Record<string, number>;
  executionTimeMs: number;
}

export interface ISearchProvider<T = any> {
  id: string;
  manifest: SearchManifest;
  search(query: ISearchQuery): Promise<ISearchResult<T>>;
}
