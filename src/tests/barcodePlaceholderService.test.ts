/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.0
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generatePlaceholderBarcode,
  fetchAuthoritativePlaceholderBarcode,
  DEFAULT_BARCODE_POLICY,
  BARCODE_PREFIX_PRESETS
} from "../services/barcodePlaceholderService";
import * as apiModule from "../lib/apiFetchV1";

describe("Placeholder Barcode Policy & Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("generatePlaceholderBarcode (Client Policy Generator)", () => {
    it("generates default uppercase S prefix with 12 hex characters", () => {
      const barcode = generatePlaceholderBarcode();
      expect(barcode.startsWith("S")).toBe(true);
      expect(barcode.length).toBe(13);
      const token = barcode.slice(1);
      expect(/^[0-9A-F]{12}$/.test(token)).toBe(true);
    });

    it("generates barcode with explicit configurable prefixes", () => {
      const prefixes = ["GEN", "SKU", "SMRITI", "VX", "BRC"];
      for (const pfx of prefixes) {
        const bc = generatePlaceholderBarcode(pfx);
        expect(bc.startsWith(pfx)).toBe(true);
        const token = bc.slice(pfx.length);
        expect(token.length).toBe(12);
        expect(/^[0-9A-F]{12}$/.test(token)).toBe(true);
      }
    });

    it("normalizes lowercase prefix to uppercase", () => {
      const bc = generatePlaceholderBarcode("gen");
      expect(bc.startsWith("GEN")).toBe(true);
    });

    it("sanitizes unsafe non-alphanumeric characters in prefix", () => {
      const bc = generatePlaceholderBarcode("vx!@#$");
      expect(bc.startsWith("VX")).toBe(true);
      expect(bc.length).toBe(14); // 'VX' + 12 hex chars
    });

    it("emits bare 12-char token when prefix is empty and allowNoPrefix is true", () => {
      const bareEmpty = generatePlaceholderBarcode("", true);
      expect(bareEmpty.length).toBe(12);
      expect(/^[0-9A-F]{12}$/.test(bareEmpty)).toBe(true);

      const bareNull = generatePlaceholderBarcode(null, true);
      expect(bareNull.length).toBe(12);
      expect(/^[0-9A-F]{12}$/.test(bareNull)).toBe(true);
    });

    it("falls back to canonical S prefix when prefix is empty and allowNoPrefix is false", () => {
      const fallback = generatePlaceholderBarcode("", false);
      expect(fallback.startsWith("S")).toBe(true);
      expect(fallback.length).toBe(13);
    });
  });

  describe("fetchAuthoritativePlaceholderBarcode", () => {
    it("queries the FastAPI endpoint /barcodes/placeholder with parameters", async () => {
      const spy = vi.spyOn(apiModule, "apiFetchV1").mockResolvedValueOnce({
        barcode: "GEN1A2B3C4D5E6F",
        prefix: "GEN",
        is_placeholder: true,
        policy_default: "S"
      });

      const result = await fetchAuthoritativePlaceholderBarcode("GEN", true);
      expect(result).toBe("GEN1A2B3C4D5E6F");
      expect(spy).toHaveBeenCalledWith("/barcodes/placeholder?prefix=GEN&allow_no_prefix=true");
    });

    it("falls back to local generator when backend request fails", async () => {
      vi.spyOn(apiModule, "apiFetchV1").mockRejectedValueOnce(new Error("Network Error"));

      const result = await fetchAuthoritativePlaceholderBarcode("SKU", true);
      expect(result.startsWith("SKU")).toBe(true);
      expect(result.length).toBe(15);
    });
  });

  describe("Policy Defaults & Presets", () => {
    it("has default prefix set to 'S' and allows both any prefix and no prefix", () => {
      expect(DEFAULT_BARCODE_POLICY.prefix_default).toBe("S");
      expect(DEFAULT_BARCODE_POLICY.prefix_allowed_any).toBe(true);
      expect(DEFAULT_BARCODE_POLICY.allow_no_prefix).toBe(true);
    });

    it("includes standard presets including S, GEN, SKU, SMRITI, and Bare Token", () => {
      const values = BARCODE_PREFIX_PRESETS.map(p => p.value);
      expect(values).toContain("S");
      expect(values).toContain("GEN");
      expect(values).toContain("SKU");
      expect(values).toContain("SMRITI");
      expect(values).toContain("");
    });
  });
});
