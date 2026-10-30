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

export type IndianCommercialZone = "North" | "South" | "East" | "West" | "Central" | "North East";

export const INDIAN_ZONES: IndianCommercialZone[] = [
  "North",
  "South",
  "East",
  "West",
  "Central",
  "North East",
];

export const INDIAN_STATE_TO_ZONE: Record<string, IndianCommercialZone> = {
  // West
  "Maharashtra": "West",
  "Gujarat": "West",
  "Goa": "West",
  "Dadra & Nagar Haveli": "West",
  "Daman & Diu": "West",
  "Dadra and Nagar Haveli and Daman and Diu": "West",

  // North
  "Delhi": "North",
  "New Delhi": "North",
  "Punjab": "North",
  "Haryana": "North",
  "Rajasthan": "North",
  "Uttar Pradesh": "North",
  "Uttarakhand": "North",
  "Himachal Pradesh": "North",
  "Jammu & Kashmir": "North",
  "Jammu and Kashmir": "North",
  "Ladakh": "North",
  "Chandigarh": "North",

  // South
  "Tamil Nadu": "South",
  "Karnataka": "South",
  "Kerala": "South",
  "Andhra Pradesh": "South",
  "Andhra Pradesh (New)": "South",
  "Telangana": "South",
  "Puducherry": "South",
  "Lakshadweep": "South",

  // East
  "West Bengal": "East",
  "Bihar": "East",
  "Jharkhand": "East",
  "Odisha": "East",
  "Orissa": "East",
  "Andaman & Nicobar Islands": "East",
  "Andaman and Nicobar Islands": "East",

  // Central
  "Madhya Pradesh": "Central",
  "Chhattisgarh": "Central",

  // North East
  "Assam": "North East",
  "Meghalaya": "North East",
  "Manipur": "North East",
  "Mizoram": "North East",
  "Nagaland": "North East",
  "Tripura": "North East",
  "Arunachal Pradesh": "North East",
  "Sikkim": "North East",
};

export const INDIAN_STATE_CODE_TO_ZONE: Record<string, IndianCommercialZone> = {
  // West
  "MH": "West", "27": "West",
  "GJ": "West", "24": "West",
  "GA": "West", "30": "West",
  "DN": "West", "DD": "West", "26": "West",

  // North
  "DL": "North", "07": "North",
  "PB": "North", "03": "North",
  "HR": "North", "06": "North",
  "RJ": "North", "08": "North",
  "UP": "North", "09": "North",
  "UK": "North", "UA": "North", "05": "North",
  "HP": "North", "02": "North",
  "JK": "North", "01": "North",
  "LA": "North", "38": "North",
  "CH": "North", "04": "North",

  // South
  "TN": "South", "33": "South",
  "KA": "South", "29": "South",
  "KL": "South", "32": "South",
  "AP": "South", "37": "South",
  "TS": "South", "TG": "South", "36": "South",
  "PY": "South", "34": "South",
  "LD": "South", "31": "South",

  // East
  "WB": "East", "19": "East",
  "BR": "East", "10": "East",
  "JH": "East", "20": "East",
  "OD": "East", "OR": "East", "21": "East",
  "AN": "East", "35": "East",

  // Central
  "MP": "Central", "23": "Central",
  "CG": "Central", "CT": "Central", "22": "Central",

  // North East
  "AS": "North East", "18": "North East",
  "ML": "North East", "17": "North East",
  "MN": "North East", "14": "North East",
  "MZ": "North East", "15": "North East",
  "NL": "North East", "13": "North East",
  "TR": "North East", "16": "North East",
  "AR": "North East", "12": "North East",
  "SK": "North East", "11": "North East",
};

/**
 * Resolves commercial zone from Indian state name or state code.
 */
export function resolveZoneFromState(stateNameOrCode?: string): IndianCommercialZone | "" {
  if (!stateNameOrCode) return "";
  const trimmed = stateNameOrCode.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();

  if (INDIAN_STATE_CODE_TO_ZONE[upper]) {
    return INDIAN_STATE_CODE_TO_ZONE[upper];
  }

  if (INDIAN_STATE_TO_ZONE[trimmed]) {
    return INDIAN_STATE_TO_ZONE[trimmed];
  }

  const found = Object.entries(INDIAN_STATE_TO_ZONE).find(([name]) =>
    name.toLowerCase() === trimmed.toLowerCase()
  );
  if (found) {
    return found[1];
  }

  const partial = Object.entries(INDIAN_STATE_TO_ZONE).find(([name]) =>
    name.toLowerCase().includes(trimmed.toLowerCase()) || trimmed.toLowerCase().includes(name.toLowerCase())
  );
  return partial ? partial[1] : "";
}
