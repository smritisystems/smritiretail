/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * Resolves the target base URL for the FastAPI backend service.
 * Supports environment variable override FASTAPI_BASE_URL,
 * with Docker container network detection (@db: -> http://python-core:8000)
 * and local development fallback (http://localhost:8000).
 */
export const FASTAPI_BASE_URL: string =
  process.env.FASTAPI_BASE_URL ||
  (process.env.DATABASE_URL?.includes("@db:")
    ? "http://python-core:8000"
    : "http://localhost:8000");
