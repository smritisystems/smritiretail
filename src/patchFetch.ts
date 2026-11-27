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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { getCsrfToken } from "./lib/apiFetchV1.ts";

const originalJson = Response.prototype.json;
Response.prototype.json = async function() {
  const text = await this.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    if (text.includes("Rate exceeded")) {
      throw new Error("Rate exceeded. Please wait a moment and try again.");
    }
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
  }
};

const originalFetch = window.fetch;
const patchedFetch = function(this: any, input: RequestInfo | URL, init?: RequestInit) {
  const options = init || {};
  const request = input instanceof Request ? input : null;
  const headers = new Headers(request?.headers || {});
  new Headers(options.headers || {}).forEach((value, key) => headers.set(key, value));
  const method = (options.method || request?.method || "GET").toUpperCase();
  const requestUrl = request ? request.url : String(input);
  const isSameOrigin = new URL(requestUrl, window.location.origin).origin === window.location.origin;

  if (isSameOrigin) {
    options.credentials = "same-origin";
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
    }
  }

  options.headers = headers;
  return originalFetch.call(this, input, options);
};

try {
  window.fetch = patchedFetch;
} catch (e) {
  try {
    Object.defineProperty(window, 'fetch', {
      value: patchedFetch,
      configurable: true,
      writable: true,
      enumerable: true
    });
  } catch (err) {
    console.warn("Failed to patch window.fetch directly, using a custom global reference:", err);
  }
}

