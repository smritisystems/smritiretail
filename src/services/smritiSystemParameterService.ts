/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.41.0
 * Created      : 2026-09-14
 * Modified     : 2026-09-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { apiFetchV1 } from "../lib/apiFetchV1";

export interface SystemParameterDefinition {
  id: string;
  uuid?: string;
  param_code: string;
  canonical_code?: string | null; // SMRITI.DOMAIN.FEATURE dot-notation key (ADR-042)
  category: string;
  category_name: string;
  description: string;
  data_type: "Boolean" | "Integer" | "Text" | "Decimal" | "Date";
  mutability: "Fixed" | "Installation" | "One Time" | "Variable" | "Hidden";
  profile_type: "RETAIL" | "DISTRIBUTOR" | "COMMON";
  effective_value: any;
  scope_level: "GLOBAL" | "COMPANY" | "BRANCH" | "TERMINAL";
  terminal_id: string;
  is_locked: boolean;
  val_boolean?: boolean | null;
  val_integer?: number | null;
  val_text?: string | null;
  val_decimal?: number | null;
  val_date?: string | null;
}

export interface ParametersMapResponse {
  values: Record<string, any>;
  definitions: Record<string, SystemParameterDefinition>;
  count: number;
}

class SmritiSystemParameterService {
  /** Primary cache: param_code -> effective_value (legacy Shoper 9 keys) */
  private cache: Map<string, any> = new Map();
  /** Definitions cache: param_code -> full definition */
  private definitions: Map<string, SystemParameterDefinition> = new Map();
  /**
   * Canonical alias map: canonical_code (SMRITI.*) -> param_code
   * Enables dual-key resolution without duplicating cache entries.
   */
  private canonicalAlias: Map<string, string> = new Map();
  private isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;

  /**
   * Loads parameters into in-memory cache for synchronous 0ms access.
   */
  public async load(forceRefresh: boolean = false): Promise<void> {
    if (this.isLoaded && !forceRefresh) {
      return;
    }

    if (this.loadPromise && !forceRefresh) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        const res = await apiFetchV1<ParametersMapResponse>("/system-parameters/map");
        if (res && res.values) {
          this.cache.clear();
          this.definitions.clear();
          this.canonicalAlias.clear();

          Object.entries(res.values).forEach(([code, val]) => {
            this.cache.set(code, val);
          });

          if (res.definitions) {
            Object.entries(res.definitions).forEach(([code, def]) => {
              this.definitions.set(code, def);
              // Build canonical alias: SMRITI.DOMAIN.FEATURE -> param_code
              if (def.canonical_code) {
                this.canonicalAlias.set(def.canonical_code, code);
              }
            });
          }
          this.isLoaded = true;
        }
      } catch (err) {
        // In offline / fallback scenarios, preserve existing cache
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Resolves a key to the underlying param_code used in the primary cache.
   * Accepts both SMRITI.* canonical keys and legacy Shoper 9 param_code values.
   * @internal
   */
  private _resolveKey(key: string): string {
    if (key.startsWith("SMRITI.")) {
      return this.canonicalAlias.get(key) ?? key;
    }
    return key;
  }

  /**
   * Synchronous Boolean parameter accessor with fallback.
   */
  public getBoolean(paramCode: string, defaultValue: boolean = false): boolean {
    const key = this._resolveKey(paramCode);
    if (!this.cache.has(key)) {
      return defaultValue;
    }
    const val = this.cache.get(key);
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0;
    if (typeof val === "string") {
      const lower = val.trim().toLowerCase();
      return lower === "true" || lower === "1" || lower === "yes" || lower === "t";
    }
    return Boolean(val);
  }

  /**
   * Synchronous Numeric parameter accessor with fallback.
   */
  public getNumber(paramCode: string, defaultValue: number = 0): number {
    const key = this._resolveKey(paramCode);
    if (!this.cache.has(key)) {
      return defaultValue;
    }
    const val = this.cache.get(key);
    const num = Number(val);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Synchronous String parameter accessor with fallback.
   */
  public getString(paramCode: string, defaultValue: string = ""): string {
    const key = this._resolveKey(paramCode);
    if (!this.cache.has(key)) {
      return defaultValue;
    }
    const val = this.cache.get(key);
    return val !== null && val !== undefined ? String(val) : defaultValue;
  }

  /**
   * Synchronous generic value accessor.
   */
  public getValue<T>(paramCode: string, defaultValue?: T): T {
    const key = this._resolveKey(paramCode);
    if (!this.cache.has(key)) {
      return defaultValue as T;
    }
    return this.cache.get(key) as T;
  }

  /**
   * Returns complete definition for a parameter code.
   * Accepts both SMRITI.* canonical keys and legacy param_code values.
   */
  public getDefinition(paramCode: string): SystemParameterDefinition | undefined {
    const key = this._resolveKey(paramCode);
    return this.definitions.get(key);
  }

  /**
   * Returns all loaded parameter definitions.
   */
  public getAllDefinitions(): SystemParameterDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Checks if parameters are loaded.
   */
  public isReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Fetch live list of parameters with filters from backend.
   */
  public async listParameters(
    category?: string,
    profileType?: string,
    search?: string
  ): Promise<SystemParameterDefinition[]> {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    if (profileType) params.append("profile_type", profileType);
    if (search) params.append("search", search);

    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiFetchV1<SystemParameterDefinition[]>(`/system-parameters${query}`);
  }

  /**
   * Updates a single parameter on the backend and updates cache.
   */
  public async updateParameter(
    paramCode: string,
    value: any,
    terminalId: string = "COMMON",
    branchId?: string,
    scopeLevel: string = "COMPANY"
  ): Promise<SystemParameterDefinition> {
    const updated = await apiFetchV1<SystemParameterDefinition>(`/system-parameters/${paramCode}`, {
      method: "PUT",
      body: JSON.stringify({
        value,
        terminal_id: terminalId,
        branch_id: branchId,
        scope_level: scopeLevel,
      }),
    });

    this.cache.set(paramCode, updated.effective_value);
    this.definitions.set(paramCode, updated);
    return updated;
  }

  /**
   * Batch updates parameters on the backend.
   */
  public async saveBatch(
    items: Array<{
      param_code: string;
      value: any;
      terminal_id?: string;
      branch_id?: string;
      scope_level?: string;
    }>
  ): Promise<{ status: string; count: number }> {
    const res = await apiFetchV1<{ status: string; count: number }>("/system-parameters/save-batch", {
      method: "POST",
      body: JSON.stringify({ items }),
    });

    // Refresh cache after batch update
    await this.load(true);
    return res;
  }

  /**
   * Seeds parameters for a given profile (RETAIL or DISTRIBUTOR).
   */
  public async seedProfile(
    profile: "RETAIL" | "DISTRIBUTOR",
    overwriteExisting: boolean = false
  ): Promise<{ status: string; profile: string; seeded_count: number }> {
    const res = await apiFetchV1<{ status: string; profile: string; seeded_count: number }>(
      "/system-parameters/seed-profile",
      {
        method: "POST",
        body: JSON.stringify({
          profile,
          overwrite_existing: overwriteExisting,
        }),
      }
    );

    // Refresh cache after seeding
    await this.load(true);
    return res;
  }
}

export const smritiSystemParameterService = new SmritiSystemParameterService();
