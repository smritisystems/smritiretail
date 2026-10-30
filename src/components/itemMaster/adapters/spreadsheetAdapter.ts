/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.47.2
 * Created      : 2026-09-29
 * Modified     : 2026-09-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal Adapter
 */

export interface SpreadsheetRowPayload {
  [key: string]: any;
}

export interface ExistingProductReference {
  id?: string;
  code?: string;
  sku?: string;
  barcode?: string;
  [key: string]: any;
}

export interface SanitizeResult {
  payload: Record<string, any>;
  hasImmutableChangeAttempt: boolean;
  attemptedField?: string;
}

export const IMMUTABLE_FIELDS = new Set(["code", "sku", "barcode"]);

export const SYSTEM_FIELDS = new Set([
  "id",
  "_id",
  "tenant_id",
  "company_id",
  "branch_id",
  "created_at",
  "updated_at",
  "deleted_at",
]);

/**
 * Checks if a given field name is considered immutable after creation.
 */
export function isImmutableField(fieldName: string): boolean {
  return IMMUTABLE_FIELDS.has(fieldName.toLowerCase());
}

/**
 * Sanitizes a spreadsheet row payload for a PUT update.
 *
 * Requirements:
 * 1. Strip system fields: id, _id, tenant_id, company_id, branch_id, created_at, updated_at, deleted_at.
 * 2. For immutable fields (code, sku, barcode):
 *    - If the value matches the original persisted product, STRIP it from the payload
 *      so that the backend does not raise an unnecessary 409 Conflict.
 *    - If the operator modified the value in the spreadsheet cell, RETAIN it in the payload
 *      so that the backend authoritative immutability validator triggers HTTP 409 Conflict.
 *    - Do NOT silently modify immutable values.
 */
export function sanitizeSpreadsheetPutPayload(
  rawPayload: SpreadsheetRowPayload,
  original?: ExistingProductReference | null
): SanitizeResult {
  const sanitized: Record<string, any> = {};
  let hasImmutableChangeAttempt = false;
  let attemptedField: string | undefined;

  for (const [key, value] of Object.entries(rawPayload)) {
    // Strip system metadata fields
    if (SYSTEM_FIELDS.has(key)) {
      continue;
    }

    if (key === "code") {
      const origCode = (original?.code || "").trim().toUpperCase();
      const newCode = String(value ?? "").trim().toUpperCase();
      if (origCode && newCode && origCode !== newCode) {
        // Attempted to change code: pass through so backend 409 triggers
        sanitized[key] = value;
        hasImmutableChangeAttempt = true;
        attemptedField = "code";
      }
      // Unchanged code is stripped to satisfy backend exclude_unset/immutability check
      continue;
    }

    if (key === "barcode") {
      const origBc = (original?.barcode || "").trim().toUpperCase();
      const newBc = String(value ?? "").trim().toUpperCase();
      if (origBc && newBc && origBc !== newBc) {
        // Attempted to change barcode: pass through so backend 409 triggers
        sanitized[key] = value;
        hasImmutableChangeAttempt = true;
        attemptedField = "barcode";
      }
      // Unchanged barcode is stripped
      continue;
    }

    if (key === "sku") {
      const origSku = (original?.sku || original?.code || "").trim().toUpperCase();
      const newSku = String(value ?? "").trim().toUpperCase();
      if (origSku && newSku && origSku !== newSku) {
        // Attempted to change sku: pass through so backend 409 triggers
        sanitized[key] = value;
        hasImmutableChangeAttempt = true;
        attemptedField = "sku";
      }
      // Unchanged sku is stripped
      continue;
    }

    sanitized[key] = value;
  }

  return {
    payload: sanitized,
    hasImmutableChangeAttempt,
    attemptedField,
  };
}
