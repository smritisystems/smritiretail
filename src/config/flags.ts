/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.1
 * Created      : 2026-07-09
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
/**
 * @deprecated [DEPRECATED / FROZEN - ADR-045 / Express Fully Retired]
 * Express has been completely decommissioned from SMRITI Retail OS.
 * All application modules communicate solely with FastAPI + Postgres via src/lib/apiFetchV1.ts.
 * These flags are retained as immutable frozen booleans strictly for backward compatibility.
 */
export const FLAGS = {
  // ── Additional modules (Express unmounted v3.20.0, FastAPI only) ──────────
  // Owner: Jawahar Ramkripal Mallah, Removal Version: v3.21.0, Removal Date: 2026-09-01
  USE_FASTAPI_INVENTORY:   true,
  USE_FASTAPI_REPORTS:     true,
  USE_FASTAPI_BARCODE:     true,
  USE_FASTAPI_CUSTOMERS:   true,
  USE_FASTAPI_NUMBERING:   true,
  USE_FASTAPI_TERMS:       true,
  USE_FASTAPI_EXCHANGE:    true,
  USE_FASTAPI_USERS:       true,
  USE_FASTAPI_SYSTEM:      true,
  USE_FASTAPI_MASTERS:     true,
  USE_FASTAPI_ATTRIBUTES:  true,
  USE_FASTAPI_ROLES:       true,
};
