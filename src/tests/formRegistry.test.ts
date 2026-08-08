/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Form Registry (UFR) Unit Tests (UFR-001 & UFR-002)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & UFR v1.0 Standard Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { FormRegistry, type FormDefinition } from "../kernel/upr/forms/FormRegistry.js";
import { EntityRegistry, type EntityMetadata } from "../kernel/upr/forms/EntityRegistry.js";

describe("Universal Form Registry (UFR & UEDF Metadata Core)", () => {
  beforeEach(() => {
    FormRegistry.clear();
    EntityRegistry.clear();
  });

  it("should seed default entity metadata (product, customer)", () => {
    const entities = SPK.entities.getEntities();
    expect(entities.length).toBeGreaterThanOrEqual(2);

    const productEntity = SPK.entities.getEntity("product");
    expect(productEntity).toBeDefined();
    expect(productEntity?.name).toBe("Product Item Master");
    expect(productEntity?.fields.map((f) => f.id)).toContain("sku");
  });

  it("should seed default form metadata (item-master-form, customer-master-form)", () => {
    const forms = SPK.forms.getForms();
    expect(forms.length).toBeGreaterThanOrEqual(2);

    const itemForm = SPK.forms.getForm("item-master-form");
    expect(itemForm).toBeDefined();
    expect(itemForm?.entityId).toBe("product");
    expect(itemForm?.sections).toHaveLength(2);
  });

  it("should execute UFR validation engine and return errors for missing required fields", () => {
    const emptyValues = { sku: "", name: "" };
    const result = SPK.forms.validateForm("item-master-form", emptyValues);

    expect(result.isValid).toBe(false);
    expect(result.errors.sku).toBeDefined();
    expect(result.errors.name).toBeDefined();

    const validValues = { sku: "SKU-9900", name: "Premium Polo Shirt", mrpi: 999, rsp: 899 };
    const validResult = SPK.forms.validateForm("item-master-form", validValues);
    expect(validResult.isValid).toBe(true);
    expect(Object.keys(validResult.errors)).toHaveLength(0);
  });

  it("should support dynamic registration of plugin forms via SPK.forms and SPK.sdk", () => {
    const customPluginForm: FormDefinition = {
      id: "jewellery-rates-form",
      title: "Gold & Metal Rates Form",
      entityId: "metal_rate",
      domainId: "jewellery",
      version: "1.0.0",
      sections: [
        {
          id: "rates",
          title: "Metal Rate Configuration",
          fields: [
            { id: "gold_24k", label: "Gold 24K Rate (₹/g)", type: "currency", required: true, gridSpan: 6 },
            { id: "silver_999", label: "Silver Rate (₹/g)", type: "currency", required: true, gridSpan: 6 }
          ]
        }
      ]
    };

    SPK.sdk.registerForm(customPluginForm);

    const registered = SPK.forms.getForm("jewellery-rates-form");
    expect(registered).toBeDefined();
    expect(registered?.title).toBe("Gold & Metal Rates Form");
  });

  it("should resolve dynamic field controls from FieldRegistry (UFR-003)", () => {
    const types = SPK.fields.getRegisteredTypes();
    expect(types).toContain("text");
    expect(types).toContain("number");
    expect(types).toContain("select");
    expect(types).toContain("barcode");
    expect(types).toContain("checkbox");

    const textControl = SPK.fields.getFieldControl("text");
    expect(textControl).toBeDefined();

    // Fallback to text control for unregistered type
    const fallbackControl = SPK.fields.getFieldControl("unknown_type_xyz");
    expect(fallbackControl).toBe(textControl);
  });
});
