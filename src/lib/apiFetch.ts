/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-07-12
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { apiFetchV1, recordAuditAction } from "./apiFetchV1.js";
export { apiFetchV1, recordAuditAction } from "./apiFetchV1.js";

/**
 * Universal client fetch helper — forwards requests to FastAPI Backend (/api/v1/*)
 * @deprecated All first-party code must import `apiFetchV1` directly from `src/lib/apiFetchV1.ts`.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const normalizedEndpoint = endpoint.startsWith("/api/v1") 
    ? endpoint.replace(/^\/api\/v1/, "") 
    : endpoint.startsWith("/api") 
    ? endpoint.replace(/^\/api/, "") 
    : endpoint;

  return apiFetchV1(normalizedEndpoint, options);
}

