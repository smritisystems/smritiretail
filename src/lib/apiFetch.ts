/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.20.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { apiFetchV1 } from "./apiFetchV1.js";
export { apiFetchV1 } from "./apiFetchV1.js";

/**
 * Universal client fetch helper for Express API (/api/*)
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const jwtToken = localStorage.getItem("smriti_jwt_token");
  const sessionToken = localStorage.getItem("smriti_session_token");

  const headers = new Headers(options.headers || {});
  if (jwtToken) {
    headers.set("Authorization", `Bearer ${jwtToken}`);
  } else if (sessionToken) {
    headers.set("x-session-token", sessionToken);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: "Network communication failed. Please try again." };
    }
    
    // HREP Compliant error structure fallback
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Record UI-driven audit actions (views, prints, exports) to system logs
 */
export async function recordAuditAction(actionType: string, tableName: string, recordId: string, reason: string): Promise<void> {
  try {
    await apiFetchV1("/audit-logs", {
      method: "POST",
      body: JSON.stringify({ actionType, tableName, recordId, reason })
    });
  } catch (err) {
    console.error("[Audit Logger] Failed to record audit action:", err);
  }
}
