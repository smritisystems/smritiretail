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
import { validateCustomerProfile } from "../services/customerValidation.ts";
import { scoreLead, filterLeads } from "../services/crmService.ts";
import { calculatePointsEarned, determineTier } from "../services/loyaltyService.ts";
import { Customer } from "../types.ts";

describe("Domain Decoupling - Customer validation, CRM, and Loyalty Services", () => {
  describe("Customer Validation Service", () => {
    const existingCustomers: Customer[] = [];

    it("should fail validation when name is empty", () => {
      const result = validateCustomerProfile({ name: "  " }, existingCustomers);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Customer Name is required.");
    });

    it("should fail validation on invalid 10-digit mobile phone numbers", () => {
      const result = validateCustomerProfile({ name: "Test User", mobile: "12345" }, existingCustomers);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Mobile number must be a valid 10-digit numeric value.");
    });

    it("should fail validation on invalid email formats", () => {
      const result = validateCustomerProfile({ name: "Test User", email: "invalid-email" }, existingCustomers);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Email address format is invalid.");
    });

    it("should fail validation on invalid GSTIN formats", () => {
      const result = validateCustomerProfile({ name: "Test User", gstNumber: "123GST456" }, existingCustomers);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("GSTIN format is invalid. Must match standard 15-character structure.");
    });

    it("should pass validation with valid data", () => {
      const result = validateCustomerProfile(
        {
          name: "Jawahar Mallah",
          mobile: "9820012345",
          email: "support@smritibooks.com",
          gstNumber: "27AAAAA1111A1Z0"
        },
        existingCustomers
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("CRM Lead & Conversion Service", () => {
    it("should score lead correctly based on referral source", () => {
      const lead = {
        id: "LD-01",
        name: "Vikram Malhotra",
        email: "vikram@outlook.com",
        phone: "9820012345",
        source: "Referral",
        status: "New",
        date: "2026-07-13"
      };
      const score = scoreLead(lead);
      // base 50 + Referral 20 + endsWith .com (5) + starts with 9 (5) = 80
      expect(score).toBe(80);
    });

    it("should filter leads correctly based on search queries", () => {
      const leads = [
        { id: "LD-01", name: "Vikram Malhotra", email: "vikram@outlook.com", phone: "9820012345", source: "Website", status: "New", date: "2026-07-13" },
        { id: "LD-02", name: "Ananya Sen", email: "ananya@gmail.com", phone: "9870098765", source: "Referral", status: "New", date: "2026-07-13" }
      ];
      const filtered = filterLeads(leads, "Ananya");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("LD-02");
    });
  });

  describe("Loyalty Reward and Wallet Service", () => {
    it("should calculate point earnings correctly", () => {
      expect(calculatePointsEarned(1000, 1.5)).toBe(1500);
      expect(calculatePointsEarned(0, 2)).toBe(0);
    });

    it("should determine customer levels and tiers based on yearly spend limits", () => {
      expect(determineTier(10000)).toBe("Silver");
      expect(determineTier(30000)).toBe("Gold");
      expect(determineTier(80000)).toBe("Platinum");
    });
  });
});
