/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 4.0.0
 * * Created    : 2026-09-12
 * * Modified   : 2026-09-12
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { apiFetchV1 } from "../lib/apiFetchV1.ts";

const GOVERNED_LOOKUP_TYPES = [
  "brand",
  "style_article",
  "size",
  "color",
  "category",
  "subcategory",
  "vendor_code"
] as const;

type LookupType = typeof GOVERNED_LOOKUP_TYPES[number];

const FIELD_LOOKUP_MAP: Record<LookupType, string[]> = {
  brand: ["brand"],
  style_article: ["style", "styleCode", "style_code"],
  size: ["size"],
  color: ["shade", "color", "colour"],
  category: ["category"],
  subcategory: ["subCategory", "subcategory", "sub_category"],
  vendor_code: ["vendorCode", "vendor_code"]
};

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

export async function validateItemMasterLookupOptions(
  rows: Record<string, unknown>[]
): Promise<string[]> {
  const valuesByType = new Map<LookupType, Set<string>>();

  await Promise.all(GOVERNED_LOOKUP_TYPES.map(async (typeCode) => {
    const values = await apiFetchV1(`/masters/lookup/${typeCode}/values?activeOnly=true`);
    const options = Array.isArray(values) ? values : [];
    valuesByType.set(typeCode, new Set(options.flatMap((value: any) => [value.code, value.name].map(normalize))));
  }));

  const errors: string[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    for (const typeCode of GOVERNED_LOOKUP_TYPES) {
      const fieldValue = FIELD_LOOKUP_MAP[typeCode]
        .map((field) => row[field])
        .find((value) => normalize(value));
      const normalizedValue = normalize(fieldValue);
      if (normalizedValue && !valuesByType.get(typeCode)?.has(normalizedValue)) {
        errors.push(`Row #${rowIndex + 1}: ${typeCode} option "${String(fieldValue)}" is not active in System Lookups.`);
      }
    }
  }
  return errors;
}