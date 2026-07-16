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
 */

import { describe, it, expect } from "vitest";
import { getGstRateByHsn, HSN_GST_MASTER } from "../utils/hsnMaster.js";

describe("getGstRateByHsn Utility Tests", () => {
  it("should match GST rates for standard HSN prefixes correctly", () => {
    // Spices (09) -> 5.0%
    expect(getGstRateByHsn("09042211")).toBe(5.0);
    // Apparel (61/62) -> 12.0%
    expect(getGstRateByHsn("62034200")).toBe(12.0);
    // Electronics (85) -> 18.0%
    expect(getGstRateByHsn("85171300")).toBe(18.0);
    // Luxury transport (87) -> 28.0%
    expect(getGstRateByHsn("87032391")).toBe(28.0);
  });

  it("should fall back to standard 18% for unmatched HSN codes", () => {
    expect(getGstRateByHsn("12345678")).toBe(18.0);
    expect(getGstRateByHsn("unknown")).toBe(18.0);
  });

  it("should handle empty or null values gracefully by returning 18%", () => {
    expect(getGstRateByHsn("")).toBe(18.0);
    expect(getGstRateByHsn(null)).toBe(18.0);
    expect(getGstRateByHsn(undefined)).toBe(18.0);
  });

  it("should expose HSN_GST_MASTER lookup table with correct configuration", () => {
    expect(Array.isArray(HSN_GST_MASTER)).toBe(true);
    expect(HSN_GST_MASTER.length).toBeGreaterThan(5);
  });
});
