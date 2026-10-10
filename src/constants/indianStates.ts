/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-12
 * Modified     : 2026-10-09
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export interface IndianState {
  code: string; // GST state code (2 digits)
  name: string;
}

// In-memory cache populated exclusively from PostgreSQL states_ref via API
let _canonicalStateCache: IndianState[] | null = null;

/**
 * Authoritatively resolves Indian states and GST state codes directly from canonical states_ref.
 * Fails with SMRITI-REF-001 if states_ref cannot be reached.
 * No static or hardcoded fallback dictionaries are permitted.
 */
export async function fetchCanonicalIndianStates(): Promise<IndianState[]> {
  if (_canonicalStateCache && _canonicalStateCache.length > 0) {
    return _canonicalStateCache;
  }
  const { apiFetchV1 } = await import("../lib/apiFetchV1");
  const records = await apiFetchV1<any[]>("/control/reference/states?country_code=IN");
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("SMRITI-REF-001: Canonical states_ref reference data is empty or unavailable.");
  }
  const canonicalList: IndianState[] = records
    .map((r) => ({
      code: String(r.gst_state_code || r.state_code || "").padStart(2, "0"),
      name: String(r.name || ""),
    }))
    .filter((s) => s.code && s.name);

  if (canonicalList.length === 0) {
    throw new Error("SMRITI-REF-001: No valid states resolved from canonical states_ref.");
  }

  _canonicalStateCache = canonicalList;
  return canonicalList;
}

/**
 * Reset runtime reference cache (used by tests or on tenant/store switch).
 */
export function resetCanonicalStatesCache(): void {
  _canonicalStateCache = null;
}
