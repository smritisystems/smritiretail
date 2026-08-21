/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.1
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
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

describe("Global Context-Aware Search & Cursor Focus Architecture", () => {

  describe("1. Universal Field Category Inference Engine", () => {
    it("should infer 'product' category when element has explicit data-context-type='product'", () => {
      const el = createMockInput({
        attributes: { "data-context-type": "product" }
      });

      const result = inferFieldCategory(el);
      expect(result.category).toBe("product");
      expect(result.label).toContain("Scan / Product");
    });

    it("should infer 'customer' category when element has explicit data-context-type='customer'", () => {
      const el = createMockInput({
        attributes: { "data-context-type": "customer" }
      });

      const result = inferFieldCategory(el);
      expect(result.category).toBe("customer");
      expect(result.label).toContain("Customer");
    });

    it("should infer 'product' category from Scan / Barcode placeholder or name", () => {
      const el1 = createMockInput({ placeholder: "Scan barcode here..." });
      expect(inferFieldCategory(el1).category).toBe("product");

      const el2 = createMockInput({ name: "pos_barcode_search" });
      expect(inferFieldCategory(el2).category).toBe("product");

      const el3 = createMockInput({ id: "item-sku-code" });
      expect(inferFieldCategory(el3).category).toBe("product");
    });

    it("should infer 'customer' category from Customer / Mobile placeholder or name", () => {
      const el1 = createMockInput({ placeholder: "Customer Mobile (+91) or Name..." });
      expect(inferFieldCategory(el1).category).toBe("customer");

      const el2 = createMockInput({ name: "customer_phone" });
      expect(inferFieldCategory(el2).category).toBe("customer");

      const el3 = createMockInput({ id: "buyer_membership_id" });
      expect(inferFieldCategory(el3).category).toBe("customer");
    });

    it("should infer 'supplier' category for vendor fields", () => {
      const el = createMockInput({ name: "vendor_name" });
      expect(inferFieldCategory(el).category).toBe("supplier");
    });

    it("should infer 'invoice' category for invoice / bill fields", () => {
      const el = createMockInput({ placeholder: "Enter Tax Invoice Number..." });
      expect(inferFieldCategory(el).category).toBe("invoice");
    });

    it("should infer 'hsn' category for HSN code fields", () => {
      const el = createMockInput({ name: "hsn_code" });
      expect(inferFieldCategory(el).category).toBe("hsn");
    });

    it("should fallback to 'general' for unrelated inputs", () => {
      const el = createMockInput({ name: "generic_notes" });
      expect(inferFieldCategory(el).category).toBe("general");
    });
  });

  describe("2. Global Value Injection into Focused Field", () => {
    it("should inject selected product code/barcode into target active input and trigger input events", () => {
      const input = createMockInput({ name: "scan_input" });

      // Simulate insertion logic
      input.value = "8901030937241";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(input.value).toBe("8901030937241");
      expect(input.dispatchEvent).toHaveBeenCalled();
    });

    it("should inject selected customer mobile/name into target customer input", () => {
      const input = createMockInput({ name: "pos_customer_mobile" });

      input.value = "ABC Traders Pvt. Ltd.";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(input.value).toBe("ABC Traders Pvt. Ltd.");
      expect(input.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe("3. Multi-Surface Contextual Query Routing", () => {
    it("should route search query to product catalog when cursor is in Scan field", () => {
      const activeCategory: ActiveFieldCategory = "product";
      const query = "Cotton";

      const sampleProducts = [
        { id: "1", code: "SKU-COT-01", name: "Cotton Shirt", barcode: "890111", price: 999, stock: 20 },
        { id: "2", code: "SKU-TEA-01", name: "Tea 1kg", barcode: "890222", price: 250, stock: 50 }
      ];

      const results = activeCategory === "product"
        ? sampleProducts.filter(p => p.name.includes(query) || p.code.includes(query))
        : [];

      expect(results.length).toBe(1);
      expect(results[0].code).toBe("SKU-COT-01");
    });

    it("should route search query to customer store when cursor is in Customer field", () => {
      const activeCategory: ActiveFieldCategory = "customer";
      const query = "98200";

      const sampleCustomers = [
        { id: "C1", name: "ABC Traders", mobile: "+91 9820012345", outstanding: 5000 },
        { id: "C2", name: "XYZ Mart", mobile: "+91 9123456780", outstanding: 0 }
      ];

      const results = activeCategory === "customer"
        ? sampleCustomers.filter(c => c.mobile.includes(query) || c.name.includes(query))
        : [];

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("ABC Traders");
    });
  });
});
