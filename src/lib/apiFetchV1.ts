/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.22.0
 * Created      : 2026-07-12
 * Modified     : 2026-08-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * Universal client fetch helper for FastAPI Core API (/api/v1/*)
 * Automatically attaches Authorization Bearer JWT and X-Company-Code & X-Branch-Code multi-tenant routing headers.
 * Includes one-shot silent token refresh on 401 to prevent session disruption during retail shifts.
 */

// Guard flag: prevents concurrent silent refresh storms if multiple requests 401 simultaneously
let _refreshingToken = false;
let _refreshWaiters: Array<(newToken: string | null) => void> = [];

async function _attemptSilentRefresh(): Promise<string | null> {
  // If a refresh is already in-flight, queue up and wait for it
  if (_refreshingToken) {
    return new Promise((resolve) => { _refreshWaiters.push(resolve); });
  }

  _refreshingToken = true;
  const refreshToken = localStorage.getItem("smriti_refresh_token");
  if (!refreshToken) {
    _refreshingToken = false;
    _refreshWaiters.forEach(r => r(null));
    _refreshWaiters = [];
    return null;
  }

  try {
    const refreshRes = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (refreshRes.ok) {
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        localStorage.setItem("smriti_jwt_token", refreshData.access_token);
        if (refreshData.refresh_token) {
          localStorage.setItem("smriti_refresh_token", refreshData.refresh_token);
        }
        _refreshWaiters.forEach(r => r(refreshData.access_token));
        _refreshWaiters = [];
        _refreshingToken = false;
        return refreshData.access_token;
      }
    }
  } catch {
    // Network failure during refresh
  }

  // Refresh failed — clear all auth state
  localStorage.removeItem("smriti_jwt_token");
  localStorage.removeItem("smriti_session_token");
  localStorage.removeItem("smriti_refresh_token");
  localStorage.removeItem("smriti_company_id");
  localStorage.removeItem("smriti_company_code");
  localStorage.removeItem("smriti_branch_id");
  _refreshWaiters.forEach(r => r(null));
  _refreshWaiters = [];
  _refreshingToken = false;
  return null;
}

function _buildHeaders(token: string | null, companyCode: string, companyId: string, options: RequestInit): Headers {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (companyCode && !headers.has("X-Company-Code")) headers.set("X-Company-Code", companyCode);
  if (companyId && !headers.has("X-Company-ID")) headers.set("X-Company-ID", companyId);
  const branchId = localStorage.getItem("smriti_branch_id") || "MAIN";
  if (branchId && !headers.has("X-Branch-ID")) headers.set("X-Branch-ID", branchId);
  if (branchId && !headers.has("X-Branch-Code")) headers.set("X-Branch-Code", branchId);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function apiFetchV1<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token");
  const companyCode = localStorage.getItem("smriti_company_code") || "001";
  const companyId = localStorage.getItem("smriti_company_id") || "COMP-001";

  // Sanitize endpoint string — remove any embedded docker hostname prefixes
  let cleanEndpoint = endpoint
    .replace(/https?:\/\/python-core(:[0-9]+)?/gi, "")
    .replace(/https?:\/\/smriti-api(:[0-9]+)?/gi, "")
    .replace(/https?:\/\/localhost(:[0-9]+)?/gi, "")
    .replace(/https?:\/\/127\.0\.0\.1(:[0-9]+)?/gi, "");

  if (cleanEndpoint.startsWith("/api/v1")) {
    cleanEndpoint = cleanEndpoint.replace(/^\/api\/v1/, "");
  }

  const baseUrl = typeof window !== "undefined" && window.location?.origin 
    ? "" 
    : (process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000");
  const url = `${baseUrl}/api/v1${cleanEndpoint.startsWith('/') ? cleanEndpoint : '/' + cleanEndpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: _buildHeaders(token, companyCode, companyId, options)
    });
  } catch (networkError: any) {
    console.error(`[apiFetchV1 Network Error] Target URL "${url}" unreachable:`, networkError);
    throw new Error("SMRITI Backend API Server is unreachable. Please ensure the FastAPI service (python-core:8000 / localhost:8000) is running.");
  }

  // ── Silent Token Refresh on 401 ──────────────────────────────────────────────
  // One-shot: attempt to silently refresh the access token, then retry the request.
  // If refresh fails too, clear auth storage so the app cleanly routes to login.
  if (response.status === 401) {
    const newToken = await _attemptSilentRefresh();
    if (newToken) {
      // Retry original request with the fresh token
      try {
        const retryResponse = await fetch(url, {
          ...options,
          headers: _buildHeaders(newToken, companyCode, companyId, options)
        });
        if (retryResponse.ok) {
          if (retryResponse.status === 204 || retryResponse.headers.get("content-length") === "0") return null as unknown as T;
          const ct = retryResponse.headers.get("content-type") || "";
          if (ct.includes("text/plain") || ct.includes("text/html")) return (await retryResponse.text()) as unknown as T;
          if (ct.includes("application/pdf") || ct.includes("application/octet-stream")) return (await retryResponse.blob()) as unknown as T;
          return (await retryResponse.json()) as unknown as T;
        }
        // Retry failed after refresh — fall through to throw
      } catch { /* fall through */ }
    }
    // Refresh unavailable or retry failed
    throw new Error("Token is invalid or has expired. Please log in again.");
  }
  // ────────────────────────────────────────────────────────────────────────────

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: "Upstream python-core communication failed." };
    }
    const errMsg = errorData.detail || errorData.message || `API request failed with status ${response.status}`;
    throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null as unknown as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/plain")) {
    return (await response.text()) as unknown as T;
  }
  if (contentType.includes("text/html")) {
    return (await response.text()) as unknown as T;
  }
  if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
    return (await response.blob()) as unknown as T;
  }

  return (await response.json()) as unknown as T;
}

export function isLocalMockToken(): boolean {
  const token = localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token");
  return !token || token.startsWith("MOCK_");
}
