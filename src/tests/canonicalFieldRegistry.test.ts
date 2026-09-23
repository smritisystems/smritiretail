/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.44.0
 * Created      : 2026-09-23
 * Modified     : 2026-09-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Frontend Architecture Tests — Canonical Field Registry SSOT
 */

import { describe, it, expect } from "vitest";
import {
  CANONICAL_FIELDS,
  CFOC_REGISTRY_VERSION,
  CFOC_REGISTRY_FIELDS,
  CFOC_REGISTRY_FINGERPRINT,
  getCanonicalField,
  getFieldLabel,
  getFieldPlaceholder,
  isFieldRequired,
  getFieldMaxLength,
  isFieldReadOnly,
  getEntityCanonicalFields,
} from "../services/canonicalFieldRegistry.ts";

describe("SMRITI Canonical Field Registry Frontend SSOT", () => {
  it("should export authoritative CFOC constants and valid SHA-256 fingerprint", () => {
    expect(CFOC_REGISTRY_VERSION).toBe("3.45.0");
    expect(CFOC_REGISTRY_FIELDS).toBe(132);
    expect(CFOC_REGISTRY_FINGERPRINT).toMatch(/^[a-f0-9]{64}$/);
    expect(CFOC_REGISTRY_FINGERPRINT).toBe("8f9627da3035bf38e2545720a5a46a163c1d3938d122b48171045465faae7ca8");
  });

  it("should enforce runtime immutability on CANONICAL_FIELDS (frozen)", () => {
    expect(Object.isFrozen(CANONICAL_FIELDS)).toBe(true);
    expect(() => {
      // @ts-ignore
      CANONICAL_FIELDS["customer.mobile"] = undefined;
    }).toThrow();
  });

  it("should contain all canonical fields registered", () => {
    expect(Object.keys(CANONICAL_FIELDS).length).toBe(132);
  });

  it("should resolve customer.mobile with authoritative metadata", () => {
    const field = getCanonicalField("customer.mobile");
    expect(field).toBeDefined();
    expect(field?.entityId).toBe("customer");
    expect(field?.dbTable).toBe("customers");
    expect(field?.dbColumn).toBe("mobile");
    expect(field?.required).toBe(true);
    expect(field?.validationRule).toBe("MOBILE_INDIA");
    expect(field?.label).toBe("Mobile Number");
  });

  it("should resolve product.price with authoritative metadata", () => {
    const field = getCanonicalField("product.price");
    expect(field).toBeDefined();
    expect(field?.entityId).toBe("product");
    expect(field?.dbTable).toBe("products");
    expect(field?.dbColumn).toBe("price");
    expect(field?.label).toBe("Selling Price");
  });

  it("should correctly resolve field label with fallback", () => {
    expect(getFieldLabel("customer.name", "Default")).toBe("Customer Name");
    expect(getFieldLabel("nonexistent.field", "Fallback")).toBe("Fallback");
  });

  it("should correctly resolve placeholder and validation properties", () => {
    expect(getFieldPlaceholder("customer.email")).toBe("customer@domain.com");
    expect(isFieldRequired("customer.name")).toBe(true);
    expect(getFieldMaxLength("customer.pan_number")).toBe(10);
    expect(isFieldReadOnly("customer.id")).toBe(true);
  });

  it("should return all canonical fields for a given entity", () => {
    const customerFields = getEntityCanonicalFields("customer");
    expect(customerFields.length).toBeGreaterThanOrEqual(10);
    expect(customerFields.every((f) => f.entityId === "customer")).toBe(true);

    const productFields = getEntityCanonicalFields("product");
    expect(productFields.length).toBeGreaterThanOrEqual(10);
    expect(productFields.every((f) => f.entityId === "product")).toBe(true);
  });

  it("should satisfy Field Lifecycle contract (ACTIVE by default)", () => {
    const validLifecycles = new Set(["DRAFT", "ACTIVE", "DEPRECATED", "RETIRED", "LEGACY"]);
    const allFields = Object.values(CANONICAL_FIELDS);

    allFields.forEach((f) => {
      expect(validLifecycles.has(f.lifecycle)).toBe(true);
    });

    const activeFields = allFields.filter((f) => f.lifecycle === "ACTIVE");
    expect(activeFields.length).toBeGreaterThanOrEqual(120);

    const customerMobile = getCanonicalField("customer.mobile");
    expect(customerMobile?.lifecycle).toBe("ACTIVE");
  });

  it("should enforce the Single Owner Rule and decoupled identity", () => {
    // Every field key in CANONICAL_FIELDS maps to exactly one authoritative definition
    const fieldIds = Object.keys(CANONICAL_FIELDS);
    expect(new Set(fieldIds).size).toBe(fieldIds.length);

    // customer.gst_number has alias gstin decoupled from physical column
    const gstField = getCanonicalField("customer.gst_number");
    expect(gstField).toBeDefined();
    expect(gstField?.aliases).toContain("gstin");

    // product.price has aliases sale_price, selling_price
    const priceField = getCanonicalField("product.price");
    expect(priceField).toBeDefined();
    expect(priceField?.aliases).toContain("sale_price");
  });
});

