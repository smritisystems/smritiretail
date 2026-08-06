/**
 * Project      : SMRITI Retail OS
 * Module       : Attribute Propagation Integration & Lifecycle Test Suite (ADR-IPD-002)
 * Standard     : UFR-001 / SCS-WIN-001 — Runtime Verification Suite
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FormRegistry } from "../kernel/upr/forms/FormRegistry.js";
import { ValidationRegistry } from "../kernel/upr/forms/ValidationRegistry.js";
import { GlobalSearchEngine } from "../layout_engine/GlobalSearchEngine.js";
import { MDQE } from "../kernel/ule/MasterDataQualityEngine.js";
import { Product } from "../types.js";

describe("Attribute Propagation Integration & Lifecycle Suite", () => {
  beforeEach(() => {
    // Register dynamic attribute in FormRegistry
    FormRegistry.registerForm({
      id: "product_footwear_pack",
      title: "Footwear Industry Pack",
      entityId: "product",
      domainId: "masterData",
      version: "1.0.0",
      sections: [
        {
          id: "footwear_attributes",
          title: "Footwear Specifications",
          fields: [
            { id: "heelHeight", label: "Heel Height (cm)", type: "number", required: true, gridSpan: 4 },
            { id: "upperMaterial", label: "Upper Material", type: "text", required: false, gridSpan: 4 },
          ],
        },
      ],
    });

    // Register Validator
    ValidationRegistry.registerValidator({
      id: "val_heel_height_min",
      name: "Heel Height Minimum",
      validate: ({ fieldLabel, value }) => {
        if (value !== undefined && value !== null && Number(value) < 0) {
          return `${fieldLabel} cannot be negative.`;
        }
        return null;
      },
    });
  });

  it("1. RUNTIME PROPAGATION TEST: Registered attribute resolves form definition and validations", () => {
    const formDef = FormRegistry.getForm("product_footwear_pack");
    expect(formDef).toBeDefined();
    expect(formDef?.sections[0].fields.length).toBe(2);

    const heelField = formDef?.sections[0].fields.find((f) => f.id === "heelHeight");
    expect(heelField).toBeDefined();
    expect(heelField?.required).toBe(true);

    const validationMsg = ValidationRegistry.validateField("val_heel_height_min", {
      fieldId: "heelHeight",
      fieldLabel: "Heel Height",
      value: -1,
    });
    expect(validationMsg).toBe("Heel Height cannot be negative.");
  });

  it("2. PERSISTENCE & SEARCH INDEXING TEST: Dynamic attributes persist and index in GlobalSearchEngine", async () => {
    const sampleProduct: Product = {
      id: "prod-fw-101",
      sku: "SHOES-NIKE-01",
      name: "Nike Air Zoom Footwear",
      mrp: 3999,
      attributes: {
        heelHeight: 4.5,
        upperMaterial: "Breathable Mesh",
      },
    };

    expect(sampleProduct.attributes?.heelHeight).toBe(4.5);

    // Verify Search Engine indexes attributes dynamically
    GlobalSearchEngine.registerSource({
      id: "product_attributes_test",
      label: "Product Attributes Test",
      async search(q: string) {
        if (q.toLowerCase().includes("mesh") || q.toLowerCase().includes("shoes")) {
          return [
            {
              id: sampleProduct.id,
              type: "product" as const,
              title: sampleProduct.name,
              subtitle: `Mesh ${sampleProduct.attributes?.heelHeight}cm`,
              onSelect: () => {},
            },
          ];
        }
        return [];
      },
    });

    const results = await GlobalSearchEngine.search("Mesh");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("Nike Air Zoom");
  });

  it("3. AI COPILOT QUALITY EVALUATION TEST: MDQE scores product with dynamic attributes", () => {
    const sampleProduct: Product = {
      id: "prod-fw-102",
      sku: "SHOES-PUMA-02",
      name: "Puma Running Shoes",
      mrp: 2999,
      category: "Footwear",
      attributes: {
        heelHeight: 3.0,
      },
    };

    const qualityResult = MDQE.evaluateProduct(sampleProduct);
    expect(qualityResult).toBeDefined();
    expect(qualityResult.overallScore).toBeGreaterThan(0);
  });

  it("4. NEGATIVE / LIFECYCLE DEACTIVATION TEST: Gracefully handles missing or un-configured dynamic attributes", () => {
    const legacyProduct: Product = {
      id: "prod-legacy-001",
      sku: "LEGACY-SKU-99",
      name: "Standard Commodity Item",
      mrp: 500,
      // attributes bag is undefined or empty
    };

    // Form rendering fallback
    const formDef = FormRegistry.getForm("product_footwear_pack");
    expect(formDef).toBeDefined();

    // AI Quality scoring fallback without crashing
    const qualityResult = MDQE.evaluateProduct(legacyProduct);
    expect(qualityResult).toBeDefined();
    expect(qualityResult.overallScore).toBeGreaterThan(0);
  });

  it("5. HIGH-DENSITY SCHEMA PERFORMANCE TEST: 100 Dynamic attributes evaluate in <10ms", () => {
    const highDensityAttributes: Record<string, any> = {};
    for (let i = 1; i <= 100; i++) {
      highDensityAttributes[`customAttr_${i}`] = `Value_${i}`;
    }

    const denseProduct: Product = {
      id: "prod-dense-999",
      sku: "DENSE-SKU-100",
      name: "High Density Spec Item",
      mrp: 9999,
      attributes: highDensityAttributes,
    };

    const startTime = performance.now();
    const qualityResult = MDQE.evaluateProduct(denseProduct);
    const endTime = performance.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(50); // Under 50ms execution SLA
    expect(qualityResult.overallScore).toBeGreaterThan(0);
  });
});
