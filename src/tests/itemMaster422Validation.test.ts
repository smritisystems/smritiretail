/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.1.0
 * Created      : 2026-10-04
 * Modified     : 2026-10-04
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Frontend Vitest tests for Item Master 422 centralized validation mapper.
 *
 * Tests verify:
 * 1. parseItemMaster422Response correctly processes structured 422 body.
 * 2. Every required field produces a human-readable, non-technical message.
 * 3. Nested field errors (variant.size, pricing.mrp) parse correctly.
 * 4. Duplicate SKU / Barcode messages are preserved correctly.
 * 5. Multiple simultaneous errors all appear.
 * 6. Unknown fields produce a safe fallback message.
 * 7. FIELD_TO_ELEMENT_ID covers all required footwear fields.
 * 8. ItemMasterValidationError is a typed Error subclass.
 * 9. buildValidationSummary produces correct count text.
 * 10. _sanitizeLegacyMessage strips forbidden technical strings.
 */

import { describe, it, expect } from "vitest";
import {
  parseItemMaster422Response,
  ItemMasterValidationError,
  FIELD_TO_ELEMENT_ID,
  buildValidationSummary,
  focusFirstError,
  type FieldValidationError,
  type ItemMaster422Body,
} from "../services/itemMasterValidationMapper";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_TERMS = [
  "pydantic", "fastapi", "sqlalchemy", "traceback", "exception",
  "422 unprocessable", "unprocessable entity", "validation error",
  "value_error", "type_error",
];

function isHumanReadable(msg: string): boolean {
  const lower = msg.toLowerCase();
  return !FORBIDDEN_TERMS.some((t) => lower.includes(t));
}

function buildStructured422(fields: FieldValidationError[], summary?: string): ItemMaster422Body {
  const count = fields.length;
  return {
    error: {
      code: "ITEM_MASTER_VALIDATION_ERROR",
      message: summary ?? `Please correct ${count} field${count !== 1 ? "s" : ""} before saving.`,
      status: 422,
      fields,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Missing required fields — one field at a time
// ─────────────────────────────────────────────────────────────────────────────

describe("Missing required fields", () => {

  it("Missing SKU / Item Code — parses field key and human-readable message", () => {
    const body = buildStructured422([
      { field: "code", message: "SKU / Item Code is required.", section: "Basic Information" }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.isStructured).toBe(true);
    expect(result.fieldErrors["code"]).toBe("SKU / Item Code is required.");
    expect(isHumanReadable(result.fieldErrors["code"])).toBe(true);
    expect(result.fieldOrder[0]).toBe("code");
  });

  it("Missing Brand — message mentions 'Brand'", () => {
    const body = buildStructured422([
      { field: "brand", message: "Please select a Brand.", section: "Basic Information" }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.fieldErrors["brand"]).toContain("Brand");
    expect(isHumanReadable(result.fieldErrors["brand"])).toBe(true);
  });

  it("Missing Category — message mentions 'Category'", () => {
    const body = buildStructured422([
      { field: "category", message: "Please select a Category.", section: "Basic Information" }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.fieldErrors["category"]).toContain("Category");
    expect(isHumanReadable(result.fieldErrors["category"])).toBe(true);
  });

  it("Missing Product Name — message mentions 'Product Name'", () => {
    const body = buildStructured422([
      { field: "name", message: "Product Name is required.", section: "Basic Information" }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.fieldErrors["name"]).toContain("Product Name");
    expect(isHumanReadable(result.fieldErrors["name"])).toBe(true);
  });

  it("Missing Article/Design/Style/Model — message mentions key terms", () => {
    const body = buildStructured422([
      { field: "style_code", message: "Article / Design / Style / Model is required.", section: "Basic Information" }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["style_code"];
    expect(msg).toBeDefined();
    expect(msg).toMatch(/Article|Design|Style|Model/);
    expect(isHumanReadable(msg)).toBe(true);
  });

  it("Missing Colour / Shade — message mentions 'Colour' or 'Shade'", () => {
    const body = buildStructured422([
      { field: "color", message: "Please enter a Colour / Shade.", section: "Variant" }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["color"];
    expect(msg).toMatch(/Colour|Color|Shade/);
    expect(isHumanReadable(msg)).toBe(true);
  });

  it("Missing Size System — message mentions 'Size System'", () => {
    const body = buildStructured422([
      { field: "size_system", message: "Please select a Size System.", section: "Variant" }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["size_system"];
    expect(msg).toContain("Size System");
    expect(isHumanReadable(msg)).toBe(true);
  });

  it("Missing Size — message mentions 'Size'", () => {
    const body = buildStructured422([
      { field: "size", message: "Size is required.", section: "Variant" }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["size"];
    expect(msg).toContain("Size");
    expect(isHumanReadable(msg)).toBe(true);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 2: HSN Code validation
// ─────────────────────────────────────────────────────────────────────────────

describe("HSN Code validation", () => {

  it("Missing HSN — human-readable message returned", () => {
    const body = buildStructured422([
      { field: "hsn_code", message: "HSN Code is required.", section: "Classification" }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.fieldErrors["hsn_code"]).toContain("HSN");
    expect(isHumanReadable(result.fieldErrors["hsn_code"])).toBe(true);
  });

  it("Invalid HSN format — '6 or 8 digit' appears in message", () => {
    const body = buildStructured422([
      { field: "hsn_code", message: "HSN Code must contain a valid 6 or 8 digit value.", section: "Classification" }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["hsn_code"];
    expect(msg).toContain("6 or 8 digit");
    expect(isHumanReadable(msg)).toBe(true);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Price / MRP / GST validation
// ─────────────────────────────────────────────────────────────────────────────

describe("Retail Price and GST validation", () => {

  it("Invalid Retail Price — 'greater than 0' message", () => {
    const body = buildStructured422([
      { field: "mrp", message: "Retail Price must be greater than 0.", section: "Pricing" }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["mrp"];
    expect(msg).toContain("greater than 0");
    expect(isHumanReadable(msg)).toBe(true);
  });

  it("Invalid GST — mentions 'GST' in message", () => {
    const body = buildStructured422([
      { field: "gst_percentage", message: "Please enter a valid GST rate.", section: "Tax" }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["gst_percentage"];
    expect(msg).toContain("GST");
    expect(isHumanReadable(msg)).toBe(true);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Duplicate SKU / Barcode
// ─────────────────────────────────────────────────────────────────────────────

describe("Duplicate values", () => {

  it("Duplicate SKU — message includes SKU value and 'already exists'", () => {
    const skuValue = "FT00123BLK08";
    const body = buildStructured422([
      {
        field: "code",
        message: `SKU / Item Code '${skuValue}' already exists. Please use a unique SKU.`,
        section: "Basic Information",
      }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["code"];
    expect(msg).toContain(skuValue);
    expect(msg).toContain("already exists");
    expect(msg).toContain("unique SKU");
    expect(isHumanReadable(msg)).toBe(true);
  });

  it("Duplicate Barcode — message includes barcode value and 'already assigned'", () => {
    const barcodeValue = "8901234567890";
    const body = buildStructured422([
      {
        field: "barcode",
        message: `Barcode '${barcodeValue}' is already assigned to another product.`,
        section: "Barcode",
      }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["barcode"];
    expect(msg).toContain(barcodeValue);
    expect(msg).toContain("already assigned");
    expect(isHumanReadable(msg)).toBe(true);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Multiple simultaneous validation errors
// ─────────────────────────────────────────────────────────────────────────────

describe("Multiple simultaneous validation errors", () => {

  it("All errors appear in fieldErrors map", () => {
    const body = buildStructured422([
      { field: "code",     message: "SKU / Item Code is required.",  section: "Basic Information" },
      { field: "name",     message: "Product Name is required.",     section: "Basic Information" },
      { field: "brand",    message: "Please select a Brand.",        section: "Basic Information" },
      { field: "category", message: "Please select a Category.",     section: "Basic Information" },
      { field: "mrp",      message: "Retail Price must be greater than 0.", section: "Pricing" },
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.fieldCount).toBe(5);
    expect(Object.keys(result.fieldErrors)).toHaveLength(5);
    expect(result.fieldOrder).toHaveLength(5);
    // Summary must say "5 fields"
    expect(result.summary).toContain("5");
    expect(result.summary).toContain("field");
    // All messages must be human-readable
    for (const [key, msg] of Object.entries(result.fieldErrors)) {
      expect(isHumanReadable(msg)).toBe(true);
    }
  });

  it("fieldOrder preserves backend-reported order", () => {
    const body = buildStructured422([
      { field: "code",     message: "SKU / Item Code is required." },
      { field: "brand",    message: "Please select a Brand." },
      { field: "category", message: "Please select a Category." },
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.fieldOrder).toEqual(["code", "brand", "category"]);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 6: Nested field validation
// ─────────────────────────────────────────────────────────────────────────────

describe("Nested field validation (dot-notation)", () => {

  it("variant.color dot-notation preserved", () => {
    const body = buildStructured422([
      { field: "variant.color", message: "Please enter a Colour / Shade.", section: "Variant" }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.fieldErrors["variant.color"]).toContain("Colour");
    expect(isHumanReadable(result.fieldErrors["variant.color"])).toBe(true);
  });

  it("variant.size dot-notation preserved", () => {
    const body = buildStructured422([
      { field: "variant.size", message: "Size is required.", section: "Variant" }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.fieldErrors["variant.size"]).toContain("Size");
  });

  it("pricing.retail_price dot-notation preserved", () => {
    const body = buildStructured422([
      { field: "pricing.retail_price", message: "Retail Price must be greater than 0.", section: "Pricing" }
    ]);
    const result = parseItemMaster422Response(body);
    const msg = result.fieldErrors["pricing.retail_price"];
    expect(msg).toContain("Retail Price");
    expect(isHumanReadable(msg)).toBe(true);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 7: Unknown field handling
// ─────────────────────────────────────────────────────────────────────────────

describe("422 response with unknown field", () => {

  it("Unknown field is accepted without throwing, message is safe", () => {
    const body = buildStructured422([
      {
        field: "some_unknown_internal_field",
        message: "Please check and correct this value.",
      }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.isStructured).toBe(true);
    const msg = result.fieldErrors["some_unknown_internal_field"];
    expect(msg).toBeDefined();
    expect(isHumanReadable(msg)).toBe(true);
  });

  it("Raw pydantic-style message in unknown field is sanitized", () => {
    // Simulate a backend that leaks a pydantic message — should be caught
    const legacyBody = {
      error: {
        explanation:
          "The input data provided was invalid. Details: body -> some_field: value_error.missing",
        error_code: "SMRITI-VAL-001",
      },
    };
    const result = parseItemMaster422Response(legacyBody);
    // Not structured, but message must not contain technical terms
    expect(result.isStructured).toBe(false);
    // The _sanitizeLegacyMessage function should catch the value_error term
    expect(result.summary).not.toContain("value_error");
    expect(isHumanReadable(result.summary)).toBe(true);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 8: FIELD_TO_ELEMENT_ID coverage
// ─────────────────────────────────────────────────────────────────────────────

describe("FIELD_TO_ELEMENT_ID coverage", () => {

  const REQUIRED_FOOTWEAR_FIELDS = [
    "code", "sku", "name", "brand", "category", "gender", "product_type",
    "color", "size", "hsn_code", "mrp", "price", "gst_percentage", "barcode",
    "status", "variant.color", "variant.size",
  ];

  for (const field of REQUIRED_FOOTWEAR_FIELDS) {
    it(`Field '${field}' has a registered element ID`, () => {
      expect(FIELD_TO_ELEMENT_ID[field]).toBeDefined();
      expect(FIELD_TO_ELEMENT_ID[field]).toMatch(/^im-field-/);
    });
  }

  it("Color chip group maps to im-field-color (not barcode)", () => {
    expect(FIELD_TO_ELEMENT_ID["color"]).toBe("im-field-color");
    expect(FIELD_TO_ELEMENT_ID["colour"]).toBe("im-field-color");
    expect(FIELD_TO_ELEMENT_ID["variant.color"]).toBe("im-field-color");
    expect(FIELD_TO_ELEMENT_ID["color"]).not.toBe("im-field-barcode");
  });

  it("Size chip group maps to im-field-size (not barcode)", () => {
    expect(FIELD_TO_ELEMENT_ID["size"]).toBe("im-field-size");
    expect(FIELD_TO_ELEMENT_ID["variant.size"]).toBe("im-field-size");
    expect(FIELD_TO_ELEMENT_ID["size_system"]).toBe("im-field-size");
    expect(FIELD_TO_ELEMENT_ID["size"]).not.toBe("im-field-barcode");
  });

  it("Barcode maps only to im-field-barcode", () => {
    expect(FIELD_TO_ELEMENT_ID["barcode"]).toBe("im-field-barcode");
  });

  it("Color and Size do NOT share the same element ID", () => {
    expect(FIELD_TO_ELEMENT_ID["color"]).not.toBe(FIELD_TO_ELEMENT_ID["size"]);
  });

  it("Color, Size, and Barcode all have distinct element IDs", () => {
    const colorId = FIELD_TO_ELEMENT_ID["color"];
    const sizeId  = FIELD_TO_ELEMENT_ID["size"];
    const barcodeId = FIELD_TO_ELEMENT_ID["barcode"];
    expect(colorId).not.toBe(sizeId);
    expect(colorId).not.toBe(barcodeId);
    expect(sizeId).not.toBe(barcodeId);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 9: ItemMasterValidationError class
// ─────────────────────────────────────────────────────────────────────────────

describe("ItemMasterValidationError class", () => {

  it("Is instanceof Error", () => {
    const body = buildStructured422([
      { field: "code", message: "SKU / Item Code is required." }
    ]);
    const result = parseItemMaster422Response(body);
    const err = new ItemMasterValidationError(result);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof ItemMasterValidationError).toBe(true);
  });

  it("Has correct name property", () => {
    const body = buildStructured422([
      { field: "code", message: "SKU / Item Code is required." }
    ]);
    const result = parseItemMaster422Response(body);
    const err = new ItemMasterValidationError(result);
    expect(err.name).toBe("ItemMasterValidationError");
  });

  it("Preserves validation result", () => {
    const body = buildStructured422([
      { field: "brand", message: "Please select a Brand.", section: "Basic Information" }
    ]);
    const result = parseItemMaster422Response(body);
    const err = new ItemMasterValidationError(result);
    expect(err.validation.fieldErrors["brand"]).toBe("Please select a Brand.");
    expect(err.validation.fieldCount).toBe(1);
  });

  it("Message is summary string (not raw JSON)", () => {
    const body = buildStructured422([
      { field: "code", message: "SKU / Item Code is required." },
      { field: "name", message: "Product Name is required." },
    ]);
    const result = parseItemMaster422Response(body);
    const err = new ItemMasterValidationError(result);
    expect(err.message).toContain("2");
    expect(err.message).toContain("field");
    expect(isHumanReadable(err.message)).toBe(true);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 10: buildValidationSummary utility
// ─────────────────────────────────────────────────────────────────────────────

describe("buildValidationSummary utility", () => {

  it("1 field → singular 'field'", () => {
    expect(buildValidationSummary(1)).toBe("Please correct 1 field before saving.");
  });

  it("3 fields → plural 'fields'", () => {
    expect(buildValidationSummary(3)).toBe("Please correct 3 fields before saving.");
  });

  it("0 fields → fallback message", () => {
    const msg = buildValidationSummary(0);
    expect(msg).toContain("highlighted fields");
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 11: Non-structured (legacy) body handling
// ─────────────────────────────────────────────────────────────────────────────

describe("Legacy/unknown response body handling", () => {

  it("null body → isStructured false, safe summary", () => {
    const result = parseItemMaster422Response(null);
    expect(result.isStructured).toBe(false);
    expect(isHumanReadable(result.summary)).toBe(true);
  });

  it("Empty object → isStructured false, safe summary", () => {
    const result = parseItemMaster422Response({});
    expect(result.isStructured).toBe(false);
    expect(isHumanReadable(result.summary)).toBe(true);
  });

  it("Plain string body → isStructured false", () => {
    const result = parseItemMaster422Response("some error string");
    expect(result.isStructured).toBe(false);
  });

  it("Legacy SMRITI HREP body → extracts explanation, sanitizes", () => {
    const body = {
      detail: "The input data was invalid.",
      error: { explanation: "One or more inputs did not meet the business requirements." },
    };
    const result = parseItemMaster422Response(body);
    expect(result.isStructured).toBe(false);
    expect(result.summary).toBeTruthy();
    expect(isHumanReadable(result.summary)).toBe(true);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Group 12: Dynamic Attribute 422 — frontend contract verification
// These tests verify that when the backend sends a dynamic-attr 422 response
// (already converted by the backend mapper), the frontend parser handles it
// identically to a Pydantic 422 — same structured contract, human-readable.
// ─────────────────────────────────────────────────────────────────────────────

describe("Dynamic attribute 422 — frontend contract", () => {

  it("Style required (dynamic attr) — parsed as style_code field, human-readable", () => {
    const body = buildStructured422([
      {
        field: "style_code",
        message: "Article / Design / Style / Model is required. Please enter the Article or Style code.",
        section: "Basic Information",
      }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.isStructured).toBe(true);
    const msg = result.fieldErrors["style_code"];
    expect(msg).toContain("Article");
    expect(isHumanReadable(msg)).toBe(true);
  });

  it("Color invalid (dynamic attr) — maps to im-field-color", () => {
    const body = buildStructured422([
      {
        field: "color",
        message: "Colour / Shade contains an invalid value. Please select from the approved list.",
        section: "Variant",
      }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.isStructured).toBe(true);
    const msg = result.fieldErrors["color"];
    expect(msg).toContain("Colour");
    expect(isHumanReadable(msg)).toBe(true);
    expect(FIELD_TO_ELEMENT_ID["color"]).toBe("im-field-color");
  });

  it("Size required (dynamic attr) — maps to im-field-size", () => {
    const body = buildStructured422([
      {
        field: "size",
        message: "Size is required. Please select a size from the size chart.",
        section: "Variant",
      }
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.isStructured).toBe(true);
    const msg = result.fieldErrors["size"];
    expect(msg).toContain("Size");
    expect(isHumanReadable(msg)).toBe(true);
    expect(FIELD_TO_ELEMENT_ID["size"]).toBe("im-field-size");
  });

  it("Dynamic attr and Pydantic errors can coexist in same response", () => {
    const body = buildStructured422([
      { field: "code",       message: "SKU / Item Code is required.",       section: "Basic Information" },
      { field: "style_code", message: "Article / Design / Style / Model is required. Please enter the Article or Style code.", section: "Basic Information" },
      { field: "size",       message: "Size is required. Please select a size from the size chart.", section: "Variant" },
    ]);
    const result = parseItemMaster422Response(body);
    expect(result.isStructured).toBe(true);
    expect(result.fieldCount).toBe(3);
    expect(isHumanReadable(result.fieldErrors["code"])).toBe(true);
    expect(isHumanReadable(result.fieldErrors["style_code"])).toBe(true);
    expect(isHumanReadable(result.fieldErrors["size"])).toBe(true);
    // Summary mentions total count
    expect(result.summary).toContain("3");
  });
});
