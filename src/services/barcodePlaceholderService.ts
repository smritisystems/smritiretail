/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.0
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { apiFetchV1 } from "../lib/apiFetchV1";

export interface PlaceholderBarcodePolicy {
  prefix_default: string;
  prefix_allowed_any: boolean;
  allow_no_prefix: boolean;
}

export const DEFAULT_BARCODE_POLICY: PlaceholderBarcodePolicy = {
  prefix_default: "S",
  prefix_allowed_any: true,
  allow_no_prefix: true,
};

/**
 * Standard suggested prefix presets for provisional/placeholder barcodes.
 */
export const BARCODE_PREFIX_PRESETS = [
  { label: "S (System Default)", value: "S" },
  { label: "GEN (Generic)", value: "GEN" },
  { label: "SKU", value: "SKU" },
  { label: "SMRITI", value: "SMRITI" },
  { label: "VX (Variant)", value: "VX" },
  { label: "BRC (Barcode)", value: "BRC" },
  { label: "None (Bare Token)", value: "" },
] as const;

/**
 * Client-side synchronous fallback generator implementing the canonical placeholder barcode contract.
 *
 * Behavior:
 * - prefix = "S" -> emit 'S' + 12 uppercase hex characters (e.g. S8A7F3D1B2C4)
 * - prefix = "GEN" -> emit 'GEN' + 12 uppercase hex characters (e.g. GEN8A7F3D1B2)
 * - prefix = "" or null with allowNoPrefix=true -> emit bare 12 uppercase hex characters
 * - prefix = "" or null with allowNoPrefix=false -> falls back to 'S' + 12 hex characters
 * - sanitizes prefix to uppercase alphanumeric, hyphens, and underscores only
 */
export function generatePlaceholderBarcode(
  prefix: string | null = "S",
  allowNoPrefix: boolean = true
): string {
  const rawToken = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join("");

  if (prefix === null || prefix === undefined || (typeof prefix === "string" && !prefix.trim())) {
    if (allowNoPrefix) {
      return rawToken;
    }
    return `S${rawToken}`;
  }

  const cleanPfx = String(prefix).trim().replace(/[^A-Za-z0-9_-]/g, "").toUpperCase();
  if (!cleanPfx) {
    return allowNoPrefix ? rawToken : `S${rawToken}`;
  }
  return `${cleanPfx}${rawToken}`;
}

/**
 * Fetches an authoritative service-governed placeholder barcode from the backend FastAPI service.
 * Falls back safely to generatePlaceholderBarcode if offline or if the backend request fails.
 */
export async function fetchAuthoritativePlaceholderBarcode(
  prefix: string = "S",
  allowNoPrefix: boolean = true
): Promise<string> {
  try {
    const params = new URLSearchParams();
    if (prefix !== undefined && prefix !== null) {
      params.append("prefix", prefix);
    }
    params.append("allow_no_prefix", String(allowNoPrefix));

    const res = await apiFetchV1(`/barcodes/placeholder?${params.toString()}`);
    if (res?.barcode) {
      return res.barcode;
    }
  } catch (err) {
    console.warn("Authoritative barcode fetch fallback to local policy generator:", err);
  }
  return generatePlaceholderBarcode(prefix, allowNoPrefix);
}
