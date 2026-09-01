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
 * 
 * In Docker Compose (dev/preview): Uses relative /api/v1 path which is proxied to smriti-api:8000 by Vite.
 * Locally (dev): Uses relative /api/v1 path which is proxied to localhost:8000 by Vite.
 * Production: Should be configured via FASTAPI_BASE_URL env var.
 * 
 * The browser cannot access server-side DATABASE_URL, so we use relative paths
 * that rely on the Vite proxy configured in vite.config.ts.
 */
export const FASTAPI_BASE_URL: string =
  process.env.FASTAPI_BASE_URL ||
  "/api/v1";
