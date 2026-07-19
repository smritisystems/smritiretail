/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { isValidGSTIN, isValidPIN, isValidMobile, isValidEmail } from "../utils/validators";
import { formatDate, formatDateTime, formatCurrency } from "../utils/formatters";

describe("Validators and Formatters Tests", () => {
  describe("Validators", () => {
    it("should validate GSTIN formats correctly", () => {
      // Valid GSTIN examples
      expect(isValidGSTIN("09AAACS1234A1Z1")).toBe(true);
      expect(isValidGSTIN("27AAACS1234A1Z1")).toBe(true);
      // Case insensitive check
      expect(isValidGSTIN("09aaacs1234a1z1")).toBe(true);
      // Invalid GSTIN examples
      expect(isValidGSTIN("1234")).toBe(false);
      expect(isValidGSTIN("09AAACS1234A1Y1")).toBe(false); // Second to last digit must be Z
    });

    it("should validate Pincodes correctly", () => {
      // Valid PIN
      expect(isValidPIN("273209")).toBe(true);
      expect(isValidPIN("400050")).toBe(true);
      // Invalid PIN
      expect(isValidPIN("012345")).toBe(false); // Starts with 0
      expect(isValidPIN("12345")).toBe(false);  // 5 digits
      expect(isValidPIN("1234567")).toBe(false); // 7 digits
      expect(isValidPIN("abc123")).toBe(false);  // Alphanumeric
    });

    it("should validate Indian Mobile numbers correctly", () => {
      // Valid mobile numbers
      expect(isValidMobile("9324117007")).toBe(true);
      expect(isValidMobile("9876543210")).toBe(true);
      expect(isValidMobile("6201234567")).toBe(true);
      // Invalid mobile numbers
      expect(isValidMobile("1234567890")).toBe(false); // Starts with 1
      expect(isValidMobile("98765")).toBe(false);      // Short
      expect(isValidMobile("98765432101")).toBe(false); // Long
    });

    it("should validate email addresses correctly", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("USER@EXAMPLE.COM")).toBe(true);
      expect(isValidEmail("user.name+tag@example.co.in")).toBe(true);
      expect(isValidEmail("invalid-email")).toBe(false);
      expect(isValidEmail("user@.com")).toBe(false);
      expect(isValidEmail("user@example")).toBe(false);
    });
  });

  describe("Formatters", () => {
    it("should format dates correctly", () => {
      const dateStr = "2026-07-12";
      expect(formatDate(dateStr)).toContain("Jul");
      expect(formatDateTime(dateStr)).toContain("Jul");
      expect(formatDate(null)).toBe("-");
    });

    it("should format currency correctly in INR format", () => {
      expect(formatCurrency(150000)).toContain("1,50,000.00");
      expect(formatCurrency("abc")).toBe("₹0.00");
      expect(formatCurrency(null)).toBe("₹0.00");
    });
  });
});
