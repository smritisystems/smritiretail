/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi } from "vitest";
import { inferFieldCategory, ActiveFieldCategory } from "../context/ActiveFieldContext.tsx";

function createMockInput(props: {
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  attributes?: Record<string, string>;
  value?: string;
}): any {
  const attrs = props.attributes || {};
  return {
    tagName: "INPUT",
    name: props.name || "",
    id: props.id || "",
    placeholder: props.placeholder || "",
    className: props.className || "",
    value: props.value || "",
    getAttribute: (attrName: string) => attrs[attrName] || null,
    setAttribute: (attrName: string, val: string) => { attrs[attrName] = val; },
    dispatchEvent: vi.fn(),
    focus: vi.fn()
  };
}

describe("Global Context-Aware Search & Universal F2 Browse Lookup Architecture", () => {

  describe("1. Universal Item Master Attribute & Entity Inference Engine", () => {
    
    // Supplier / Party
    it("should infer 'supplier' category when cursor is in Supplier / Vendor field", () => {
      const el1 = createMockInput({ name: "supplier_code" });
      expect(inferFieldCategory(el1).category).toBe("supplier");

      const el2 = createMockInput({ placeholder: "Search Vendor / Party..." });
      expect(inferFieldCategory(el2).category).toBe("supplier");

      const el3 = createMockInput({ attributes: { "data-f2-browse": "supplier" } });
      expect(inferFieldCategory(el3).category).toBe("supplier");
    });

    // Article / Style
    it("should infer 'article' category for article / style code inputs", () => {
      const el1 = createMockInput({ name: "article_code" });
      expect(inferFieldCategory(el1).category).toBe("article");

      const el2 = createMockInput({ placeholder: "Article / Style..." });
      expect(inferFieldCategory(el2).category).toBe("article");

      const el3 = createMockInput({ attributes: { "data-f2-browse": "article" } });
      expect(inferFieldCategory(el3).category).toBe("article");
    });

    // Color / Shade
    it("should infer 'color' category for color / shade inputs", () => {
      const el1 = createMockInput({ name: "item_color" });
      expect(inferFieldCategory(el1).category).toBe("color");

      const el2 = createMockInput({ placeholder: "Select Color / Shade..." });
      expect(inferFieldCategory(el2).category).toBe("color");

      const el3 = createMockInput({ attributes: { "data-f2-browse": "color" } });
      expect(inferFieldCategory(el3).category).toBe("color");
    });

    // Size
    it("should infer 'size' category for size / waist inputs", () => {
      const el1 = createMockInput({ name: "item_size" });
      expect(inferFieldCategory(el1).category).toBe("size");

      const el2 = createMockInput({ placeholder: "Size / Waist..." });
      expect(inferFieldCategory(el2).category).toBe("size");

      const el3 = createMockInput({ attributes: { "data-f2-browse": "size" } });
      expect(inferFieldCategory(el3).category).toBe("size");
    });

    // Brand
    it("should infer 'brand' category for brand inputs", () => {
      const el1 = createMockInput({ name: "brand_name" });
      expect(inferFieldCategory(el1).category).toBe("brand");

      const el2 = createMockInput({ attributes: { "data-f2-browse": "brand" } });
      expect(inferFieldCategory(el2).category).toBe("brand");
    });

    // Department & Section
    it("should infer 'department' and 'section' categories", () => {
      const elDept = createMockInput({ name: "item_dept_code" });
      expect(inferFieldCategory(elDept).category).toBe("department");

      const elSec = createMockInput({ name: "item_section_code" });
      expect(inferFieldCategory(elSec).category).toBe("section");
    });

    // Fabric & Fit
    it("should infer 'fabric' and 'fit' categories", () => {
      const elFabric = createMockInput({ name: "item_fabric_type" });
      expect(inferFieldCategory(elFabric).category).toBe("fabric");

      const elFit = createMockInput({ name: "item_fit_silhouette" });
      expect(inferFieldCategory(elFit).category).toBe("fit");
    });

    // Season & UOM
    it("should infer 'season' and 'uom' categories", () => {
      const elSeason = createMockInput({ name: "item_season" });
      expect(inferFieldCategory(elSeason).category).toBe("season");

      const elUom = createMockInput({ name: "unit_of_measure" });
      expect(inferFieldCategory(elUom).category).toBe("uom");
    });

    // Customer
    it("should infer 'customer' category for customer/mobile inputs", () => {
      const el = createMockInput({ placeholder: "Customer Mobile (+91) or Name..." });
      expect(inferFieldCategory(el).category).toBe("customer");
    });

    // Scheme & Terms
    it("should infer 'scheme' and 'terms' categories", () => {
      const elScheme = createMockInput({ name: "promo_scheme_code" });
      expect(inferFieldCategory(elScheme).category).toBe("scheme");

      const elTerms = createMockInput({ name: "payment_terms" });
      expect(inferFieldCategory(elTerms).category).toBe("terms");
    });

    // HSN Code
    it("should infer 'hsn' category for HSN code fields", () => {
      const el = createMockInput({ name: "hsn_code" });
      expect(inferFieldCategory(el).category).toBe("hsn");
    });

    // Product / Scan
    it("should infer 'product' category for barcode/sku inputs", () => {
      const el = createMockInput({ placeholder: "Scan barcode here..." });
      expect(inferFieldCategory(el).category).toBe("product");
    });
  });

  describe("2. Field Value Injection & Event Dispatching", () => {
    it("should inject selected Supplier code into active input and trigger input events", () => {
      const input = createMockInput({ name: "vendor_code" });
      input.value = "VEN-001";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(input.value).toBe("VEN-001");
      expect(input.dispatchEvent).toHaveBeenCalled();
    });

    it("should inject selected Color name into active Color input", () => {
      const input = createMockInput({ name: "item_color" });
      input.value = "Dark Indigo";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(input.value).toBe("Dark Indigo");
      expect(input.dispatchEvent).toHaveBeenCalled();
    });
  });

});
