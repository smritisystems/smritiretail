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
import { formatIndianNumber } from "../utils/indianFormat.js";

describe("formatIndianNumber Utility Tests", () => {
  it("should format standard lakhs correctly", () => {
    expect(formatIndianNumber(150000)).toBe("1,50,000.00");
    expect(formatIndianNumber("150000")).toBe("1,50,000.00");
  });

  it("should format crores correctly", () => {
    expect(formatIndianNumber(1024500.5)).toBe("10,24,500.50");
    expect(formatIndianNumber(12345678.9)).toBe("1,23,45,678.90");
  });

  it("should handle single and double digit integers correctly", () => {
    expect(formatIndianNumber(5)).toBe("5.00");
    expect(formatIndianNumber(45)).toBe("45.00");
    expect(formatIndianNumber(999)).toBe("999.00");
  });

  it("should handle negative values correctly", () => {
    expect(formatIndianNumber(-150000.5)).toBe("-1,50,000.50");
    expect(formatIndianNumber("-12345678")).toBe("-1,23,45,678.00");
  });

  it("should handle invalid inputs gracefully", () => {
    expect(formatIndianNumber("")).toBe("0.00");
    expect(formatIndianNumber(null as any)).toBe("0.00");
    expect(formatIndianNumber(undefined as any)).toBe("0.00");
    expect(formatIndianNumber("not-a-number")).toBe("0.00");
  });
});
