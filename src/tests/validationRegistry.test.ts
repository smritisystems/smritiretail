/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Validation Registry (UFR-004) Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & UFR v1.0 Standard Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { ValidationRegistry, type ValidatorDefinition } from "../kernel/upr/forms/ValidationRegistry.js";

describe("Universal Validation Registry (UFR-004 Validation Core)", () => {
  beforeEach(() => {
    ValidationRegistry.clear();
  });

  it("should seed default validators (required, min, max, email, gst, pan, mobile)", () => {
    const validators = SPK.validation.getValidators();
    expect(validators.length).toBeGreaterThanOrEqual(7);

    const ids = validators.map((v) => v.id);
    expect(ids).toContain("required");
    expect(ids).toContain("email");
    expect(ids).toContain("gst");
    expect(ids).toContain("pan");
    expect(ids).toContain("mobile");
  });

  it("should correctly validate GSTIN number formats", () => {
    const validGst = "27AAAAA0000A1Z5";
    const invalidGst = "INVALID_GST_123";

    const validRes = SPK.validation.validateField("gst", {
      fieldId: "gstin",
      fieldLabel: "GSTIN",
      value: validGst
    });
    expect(validRes).toBeNull();

    const invalidRes = SPK.validation.validateField("gst", {
      fieldId: "gstin",
      fieldLabel: "GSTIN",
      value: invalidGst
    });
    expect(invalidRes).toContain("valid 15-character GSTIN");
  });

  it("should correctly validate PAN number formats", () => {
    const validPan = "ABCDE1234F";
    const invalidPan = "12345ABCDE";

    const validRes = SPK.validation.validateField("pan", {
      fieldId: "pan_no",
      fieldLabel: "PAN Number",
      value: validPan
    });
    expect(validRes).toBeNull();

    const invalidRes = SPK.validation.validateField("pan", {
      fieldId: "pan_no",
      fieldLabel: "PAN Number",
      value: invalidPan
    });
    expect(invalidRes).toContain("valid 10-character PAN number");
  });

  it("should allow dynamic registration of custom domain validators", () => {
    const customValidator: ValidatorDefinition = {
      id: "hsn_format",
      name: "HSN Code Format",
      validate: ({ fieldLabel, value }) => {
        if (value && !/^\d{4,8}$/.test(String(value))) {
          return `${fieldLabel} must be 4 to 8 numeric digits.`;
        }
        return null;
      }
    };

    SPK.validation.registerValidator(customValidator);

    const result = SPK.validation.validateField("hsn_format", {
      fieldId: "hsn",
      fieldLabel: "HSN Code",
      value: "ABC"
    });
    expect(result).toContain("4 to 8 numeric digits");
  });
});
