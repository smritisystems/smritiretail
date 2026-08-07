/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.15.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * Universal client fetch helper for FastAPI Core API (/api/v1/*)
 */
export async function apiFetchV1<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== 'undefined'
    ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token"))
    : null;
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("traceparent")) {
    const traceId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const spanId = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    headers.set("traceparent", `00-${traceId}-${spanId}-01`);
  }

  let path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
  if (!path.startsWith("/api/v1") && !path.startsWith("http://") && !path.startsWith("https://")) {
    path = `/api/v1${path}`;
  }

  const baseUrl = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost:8000";

  const fullUrl = path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${baseUrl}${path}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/login") && typeof localStorage !== 'undefined') {
      localStorage.removeItem("smriti_jwt_token");
      localStorage.removeItem("smriti_session_token");
    }
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

  const contentLength = response.headers?.get ? response.headers.get("content-length") : (response.headers as any)?.[ "content-length" ];
  if (response.status === 204 || contentLength === "0") {
    return null as unknown as T;
  }

  const contentType = (response.headers?.get ? response.headers.get("content-type") : (response.headers as any)?.[ "content-type" ]) || "";
  if (contentType.includes("text/plain")) {
    return (await response.text()) as unknown as T;
  }

  return (await response.json()) as unknown as T;
}
