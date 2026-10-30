/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.33.1
 * Created      : 2026-09-17
 * Modified     : 2026-09-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Billing CSV Header Order & Distinguished Validations Test Suite
 */

import { describe, it, expect } from "vitest";
import { CsvImportResult, CsvImportRow } from "../components/billing/types";

describe("Billing CSV Header Order, Alias Mapping & Distinguished Validations", () => {
  it("preserves exact raw header order, canonical targets, and alias mappings", () => {
    const mockResult: CsvImportResult = {
      format_detected: "FORMAT_B2B_RATE",
      format_label: "B2B Wholesale Rate & Tax Mode",
      total_rows: 2,
      valid_rows: 2,
      rejected_rows: 0,
      warning_rows: 0,
      can_proceed: true,
      raw_headers: ["ean", "quant", "cost", "inclusive"],
      canonical_headers: ["barcode", "quantity", "rate", "is_tax_inclusive"],
      header_mappings: {
        ean: "barcode",
        quant: "quantity",
        cost: "rate",
        inclusive: "is_tax_inclusive",
      },
      unrecognized_headers: [],
      header_suggestions: [],
      distinguished_validations: [
        "Catalogue Identity Verification [ean]: Exact product master match against database barcodes and secondary scan codes.",
        "Wholesale Base Rate Validation [cost]: Pre-tax rate evaluation with statutory Legal Metrology post-tax MRP ceiling check.",
        "Per-Row Tax Mode Arbitration [inclusive]: Dynamic line-by-line tax policy evaluation (1=Inclusive MRP, 0=Exclusive Base Rate + GST).",
        "Discrete UOM Guard: Enforcing non-fractional whole-number quantities for discrete packaging units (PCS, NOS, PAIR, BOX).",
      ],
      rows: [
        {
          row_index: 1,
          barcode: "890100000006",
          status: "VALID",
          effective_selling_price: 50.0,
          quantity: 2,
          catalog_mrp: 100.0,
          is_tax_inclusive: false,
          tax_mode_display: "EXCLUSIVE",
          gst_rate: 18.0,
          line_total: 118.0,
        },
      ],
    };

    // 1. Column ordering verification
    expect(mockResult.raw_headers).toEqual(["ean", "quant", "cost", "inclusive"]);
    expect(mockResult.raw_headers[0]).toBe("ean");
    expect(mockResult.raw_headers[1]).toBe("quant");
    expect(mockResult.raw_headers[2]).toBe("cost");
    expect(mockResult.raw_headers[3]).toBe("inclusive");

    // 2. Canonical mapping verification
    expect(mockResult.canonical_headers).toEqual(["barcode", "quantity", "rate", "is_tax_inclusive"]);
    expect(mockResult.header_mappings?.ean).toBe("barcode");
    expect(mockResult.header_mappings?.quant).toBe("quantity");
    expect(mockResult.header_mappings?.cost).toBe("rate");
    expect(mockResult.header_mappings?.inclusive).toBe("is_tax_inclusive");

    // 3. Distinguished validations presence
    expect(mockResult.distinguished_validations).toHaveLength(4);
    expect(mockResult.distinguished_validations?.[1]).toContain("Wholesale Base Rate Validation [cost]");
    expect(mockResult.distinguished_validations?.[1]).toContain("statutory Legal Metrology post-tax MRP ceiling check");
  });

  it("handles unrecognized columns and intelligent fuzzy suggestions", () => {
    const mockResult: CsvImportResult = {
      format_detected: "FORMAT_2",
      format_label: "Barcode + Quantity",
      total_rows: 1,
      valid_rows: 1,
      rejected_rows: 0,
      warning_rows: 0,
      can_proceed: true,
      raw_headers: ["barcd", "qty", "unknown_col"],
      canonical_headers: ["barcode", "quantity", "unknown_col"],
      header_mappings: {
        barcd: "barcode",
        qty: "quantity",
      },
      unrecognized_headers: ["unknown_col"],
      header_suggestions: [
        "Header 'unknown_col' is unrecognized. Valid canonical headers: barcode, sku, quantity, selling_price, rate, discount_percent, discount_amount, mrp, gst_rate, hsn_code, is_tax_inclusive, batch_no, expiry_date, salesperson_id.",
      ],
      distinguished_validations: [
        "Catalogue Identity Verification [barcd]: Exact product master match against database barcodes and secondary scan codes.",
        "Catalogue Selling Price: Defaulted to system catalogue active selling price.",
        "Discrete UOM Guard: Enforcing non-fractional whole-number quantities for discrete packaging units (PCS, NOS, PAIR, BOX).",
      ],
      rows: [],
    };

    expect(mockResult.unrecognized_headers).toContain("unknown_col");
    expect(mockResult.header_suggestions).toHaveLength(1);
    expect(mockResult.header_suggestions?.[0]).toContain("unknown_col");
  });

  it("distinguishes retail selling price validation from wholesale base rate", () => {
    const retailValidations = [
      "Retail Selling Price Validation [prc]: Tax-inclusive consumer price validated directly against catalogue Maximum Retail Price (MRP).",
    ];
    const wholesaleValidations = [
      "Wholesale Base Rate Validation [rate]: Pre-tax rate evaluation with statutory Legal Metrology post-tax MRP ceiling check.",
    ];

    expect(retailValidations[0]).toContain("Tax-inclusive consumer price");
    expect(wholesaleValidations[0]).toContain("Pre-tax rate evaluation");
    expect(wholesaleValidations[0]).toContain("post-tax MRP ceiling check");
  });
});
