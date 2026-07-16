/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";

// Local helper to mirror the getFullImageUrl URL resolver logic in ProductImage.tsx
function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  return `/api/v1${path.startsWith("/") ? "" : "/"}${path}`;
}

describe("SMRITI Product Image Framework (SPIF) Helpers", () => {
  describe("URL Resolution Helper", () => {
    it("should return an empty string if no path is provided", () => {
      expect(getFullImageUrl()).toBe("");
      expect(getFullImageUrl(undefined)).toBe("");
    });

    it("should preserve absolute HTTP and HTTPS URLs", () => {
      const httpUrl = "http://example.com/images/prod1.jpg";
      const httpsUrl = "https://example.com/images/prod1.jpg";
      expect(getFullImageUrl(httpUrl)).toBe(httpUrl);
      expect(getFullImageUrl(httpsUrl)).toBe(httpsUrl);
    });

    it("should preserve data URI schemes (base64 inline images)", () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      expect(getFullImageUrl(dataUri)).toBe(dataUri);
    });

    it("should prepend the api v1 routing namespace prefix on relative paths", () => {
      const relativePathWithSlash = "/products/images/spif-123.webp";
      const relativePathNoSlash = "products/images/spif-123.webp";
      expect(getFullImageUrl(relativePathWithSlash)).toBe("/api/v1/products/images/spif-123.webp");
      expect(getFullImageUrl(relativePathNoSlash)).toBe("/api/v1/products/images/spif-123.webp");
    });
  });
});
