/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { numberToIndianWords } from "../utils/indianNumberWords.ts";

describe("numberToIndianWords - Canonical Indian Currency Words Formatter", () => {
  const testCases: [number, string][] = [
    [0, "Zero Rupees Only"],
    [0.0, "Zero Rupees Only"],
    [0.5, "Zero Rupees and Fifty Paisa Only"],
    [1.0, "One Rupee Only"],
    [1.5, "One Rupee and Fifty Paisa Only"],
    [2.0, "Two Rupees Only"],
    [2500.0, "Two Thousand Five Hundred Rupees Only"],
    [100000.0, "One Lakh Rupees Only"],
    [123456.78, "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Eight Paisa Only"],
    [10000000.0, "One Crore Rupees Only"],
    [10000000.5, "One Crore Rupees and Fifty Paisa Only"],
  ];

  testCases.forEach(([input, expected]) => {
    it(`correctly converts ${input} to "${expected}"`, () => {
      expect(numberToIndianWords(input)).toBe(expected);
    });
  });

  it("handles singular Rupee strictly for 1.00", () => {
    const res = numberToIndianWords(1);
    expect(res).toBe("One Rupee Only");
    expect(res).not.toContain("Rupees");
  });

  it("handles plural Rupees for 2.00", () => {
    const res = numberToIndianWords(2);
    expect(res).toBe("Two Rupees Only");
    expect(res).toContain("Rupees");
  });

  it("handles sub-rupee amounts without missing Zero Rupees", () => {
    const res = numberToIndianWords(0.5);
    expect(res).toBe("Zero Rupees and Fifty Paisa Only");
    expect(res.startsWith("Zero Rupees")).toBe(true);
  });
});
