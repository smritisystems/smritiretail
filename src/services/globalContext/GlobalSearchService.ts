/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * GlobalSearchService
 * ====================
 * Singleton service that orchestrates debounced, cached entity search across
 * all contexts defined in the FieldContextRegistry.
 *
 * Features:
 *  - 300ms debounce on every search call to prevent API flooding
 *  - In-memory result cache with 30-second TTL per (contextType + query) pair
 *  - AbortController to cancel in-flight requests when a newer query arrives
 *  - Immediate local-filter pass for instant UI feedback while API loads
 *  - Typed SearchResult wrapper with source tagging (cache / local / api)
 */

import {
  EntityContextType,
  getContextDescriptor,
} from "./fieldContext.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchResult<T = any> {
  /** The raw data record returned by the fetcher */
  data: T;
  /** Where the result came from — useful for debug badges */
  source: "cache" | "local" | "api";
  /** Index within the result set (for keyboard navigation) */
  index: number;
}

export type SearchResultCallback = (results: SearchResult[], isLoading: boolean) => void;

interface CacheEntry {
  results: any[];
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal State
// ─────────────────────────────────────────────────────────────────────────────

/** In-memory result cache: `contextType:query` → CacheEntry */
const _cache = new Map<string, CacheEntry>();

/** TTL for cache entries — 30 seconds */
const CACHE_TTL_MS = 30_000;

/** Debounce delay in milliseconds */
const DEBOUNCE_MS = 300;

/** Per-context cached raw data for instant local filtering */
const _rawDataCache = new Map<EntityContextType, { data: any[]; timestamp: number }>();
const RAW_CACHE_TTL_MS = 60_000;

/** Active abort controllers — one per context type */
const _abortControllers = new Map<EntityContextType, AbortController>();

/** Debounce timer handles — one per context type */
const _debounceTimers = new Map<EntityContextType, ReturnType<typeof setTimeout>>();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function _cacheKey(contextType: EntityContextType, query: string): string {
  return `${contextType}:${query.trim().toLowerCase()}`;
}

function _getCached(contextType: EntityContextType, query: string): any[] | null {
  const key = _cacheKey(contextType, query);
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.results;
}

function _setCached(contextType: EntityContextType, query: string, results: any[]): void {
  const key = _cacheKey(contextType, query);
  _cache.set(key, { results, timestamp: Date.now() });
}

function _wrapResults(items: any[], source: "cache" | "local" | "api"): SearchResult[] {
  return items.map((data, index) => ({ data, source, index }));
}

function _getRawData(contextType: EntityContextType): any[] | null {
  const entry = _rawDataCache.get(contextType);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > RAW_CACHE_TTL_MS) {
    _rawDataCache.delete(contextType);
    return null;
  }
  return entry.data;
}

function _setRawData(contextType: EntityContextType, data: any[]): void {
  _rawDataCache.set(contextType, { data, timestamp: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Primary search entry point.
 *
 * Behaviour:
 * 1. Immediately returns cached result if available (callback fires synchronously).
 * 2. Fires local filter on cached raw data for instant UI feedback.
 * 3. After DEBOUNCE_MS, cancels any in-flight request and fires a new one.
 * 4. On API response, updates both the result cache and raw data cache.
 * 5. Calls the provided callback with (results, isLoading) on every state change.
 *
 * @param contextType - The entity context (product, customer, supplier, …)
 * @param query       - Current search query string
 * @param callback    - Called each time results or loading state changes
 */
export function search(
  contextType: EntityContextType,
  query: string,
  callback: SearchResultCallback
): void {
  const descriptor = getContextDescriptor(contextType);
  const trimmedQuery = query.trim();

  // ── 1. Check result cache ──────────────────────────────────────────────────
  const cached = _getCached(contextType, trimmedQuery);
  if (cached) {
    callback(_wrapResults(cached, "cache"), false);
    return;
  }

  // ── 2. Instant local filter on raw data ───────────────────────────────────
  const rawData = _getRawData(contextType);
  if (rawData && descriptor.localFilter) {
    const localFiltered = descriptor.localFilter(rawData, trimmedQuery);
    callback(_wrapResults(localFiltered, "local"), true);
  } else {
    // Signal loading while we wait for debounce + API
    callback([], true);
  }

  // ── 3. Cancel any pending debounce for this context ───────────────────────
  const existingTimer = _debounceTimers.get(contextType);
  if (existingTimer != null) clearTimeout(existingTimer);

  // ── 4. Set new debounced API call ─────────────────────────────────────────
  const timer = setTimeout(async () => {
    // Abort any previous in-flight request for this context
    const existingController = _abortControllers.get(contextType);
    if (existingController) existingController.abort();

    const controller = new AbortController();
    _abortControllers.set(contextType, controller);

    try {
      const results = await descriptor.fetcher(trimmedQuery, controller.signal);

      if (controller.signal.aborted) return;

      // Update caches
      _setRawData(contextType, results);
      _setCached(contextType, trimmedQuery, results);

      callback(_wrapResults(results, "api"), false);
    } catch (err: any) {
      if (err?.name === "AbortError") return; // Cancelled intentionally
      // Return empty on error, not loading
      callback([], false);
    } finally {
      _abortControllers.delete(contextType);
      _debounceTimers.delete(contextType);
    }
  }, DEBOUNCE_MS);

  _debounceTimers.set(contextType, timer);
}

/**
 * Pre-warm the cache for a given context type (e.g. on panel open).
 * Fires an empty-query fetch so results appear instantly once the user types.
 */
export function prewarm(contextType: EntityContextType): void {
  const rawData = _getRawData(contextType);
  if (rawData) return; // Already cached

  const descriptor = getContextDescriptor(contextType);
  descriptor.fetcher("").then((data) => {
    if (Array.isArray(data)) _setRawData(contextType, data);
  }).catch(() => {});
}

/**
 * Clears the entire search cache (e.g. after a product import or bulk update).
 */
export function clearCache(): void {
  _cache.clear();
  _rawDataCache.clear();
}

/**
 * Clears cache for a specific context only.
 */
export function clearContextCache(contextType: EntityContextType): void {
  for (const key of _cache.keys()) {
    if (key.startsWith(contextType + ":")) _cache.delete(key);
  }
  _rawDataCache.delete(contextType);
}

/**
 * Cancel any pending debounced search for a given context (e.g. on unmount).
 */
export function cancelSearch(contextType: EntityContextType): void {
  const timer = _debounceTimers.get(contextType);
  if (timer != null) {
    clearTimeout(timer);
    _debounceTimers.delete(contextType);
  }
  const controller = _abortControllers.get(contextType);
  if (controller) {
    controller.abort();
    _abortControllers.delete(contextType);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook wrapper
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";

/**
 * `useGlobalSearch` — React hook that wires GlobalSearchService into component state.
 *
 * Usage:
 *   const { results, isLoading } = useGlobalSearch("product", query);
 */
export function useGlobalSearch(
  contextType: EntityContextType,
  query: string
): { results: SearchResult[]; isLoading: boolean } {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    search(contextType, query, (r, loading) => {
      if (!mountedRef.current) return;
      setResults(r);
      setIsLoading(loading);
    });

    return () => {
      cancelSearch(contextType);
    };
  }, [contextType, query]);

  return { results, isLoading };
}
