/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.0
 * Created      : 2026-07-12
 * Modified     : 2026-08-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * Universal client fetch helper for FastAPI Core API (/api/v1/*)
 * Automatically attaches Authorization Bearer JWT and X-Company-Code multi-tenant routing header.
 */
export async function apiFetchV1(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token");
  const companyCode = localStorage.getItem("smriti_company_code") || "001";
  const companyId = localStorage.getItem("smriti_company_id") || "COMP-001";

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (companyCode && !headers.has("X-Company-Code")) {
    headers.set("X-Company-Code", companyCode);
  }
  if (companyId && !headers.has("X-Company-ID")) {
    headers.set("X-Company-ID", companyId);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Sanitize endpoint string — remove any embedded docker hostname prefixes (e.g. python-core:8000, smriti-api:8000)
  let cleanEndpoint = endpoint
    .replace(/https?:\/\/python-core:8000/gi, "")
    .replace(/https?:\/\/smriti-api:8000/gi, "")
    .replace(/https?:\/\/localhost:8000/gi, "")
    .replace(/https?:\/\/127\.0\.0\.1:8000/gi, "");

  if (cleanEndpoint.startsWith("/api/v1")) {
    cleanEndpoint = cleanEndpoint.replace(/^\/api\/v1/, "");
  }

  const url = `/api/v1${cleanEndpoint.startsWith('/') ? cleanEndpoint : '/' + cleanEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: "Upstream python-core communication failed." };
    }
    
    // HREP Compliant error structure fallback
    const errMsg = errorData.detail || errorData.message || `API request failed with status ${response.status}`;
    throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/plain")) {
    return response.text();
  }

  return response.json();
}

export function isLocalMockToken(): boolean {
  const token = localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token");
  return !token || token.startsWith("MOCK_");
}

