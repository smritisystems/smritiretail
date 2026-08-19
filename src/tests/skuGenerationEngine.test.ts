/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { generateSkuCode } from "../services/skuGenerationEngine.ts";

describe("SKU Code Configuration Engine", () => {
  const sampleUserRow = {
    barcode: "8904551000002",
    code: "CH-01-A",
    styleCode: "CH-01-A",
    name: "BASIC",
    brand: "TATTLY THREADS",
    colour: "CREAM",
    size: "36",
    mrp: "1899",
    costPrice: "375",
    gstPercentage: "5",
    gender: "LADIES",
    vendorCode: "A",
    category: "CHAPPAL",
    subCategory: "CROSS",
  };

  it("should generate SKU using direct Barcode value in BARCODE mode", () => {
    const sku = generateSkuCode(sampleUserRow, { mode: "BARCODE" });
    expect(sku).toBe("8904551000002");
  });

  it("should generate sequential SKU in AUTO mode", () => {
    const year = new Date().getFullYear();
    const sku0 = generateSkuCode(sampleUserRow, { mode: "AUTO", prefix: "SKU", sequenceStart: 1 }, 0);
    const sku1 = generateSkuCode(sampleUserRow, { mode: "AUTO", prefix: "SKU", sequenceStart: 1 }, 1);
    
    expect(sku0).toBe(`SKU-${year}-00001`);
    expect(sku1).toBe(`SKU-${year}-00002`);
  });

  it("should generate derived attribute SKU in DERIVED mode (Style-Colour-Size)", () => {
    const sku = generateSkuCode(sampleUserRow, {
      mode: "DERIVED",
      derivedFields: ["styleCode", "colour", "size"],
      delimiter: "-",
    });
    expect(sku).toBe("CH-01-A-CREAM-36");
  });

  it("should evaluate custom token formula in FORMULA mode", () => {
    const sku = generateSkuCode(sampleUserRow, {
      mode: "FORMULA",
      formulaPattern: "{brand:3}-{styleCode}-{colour:3}-{size}",
    });
    expect(sku).toBe("TAT-CH01A-CRE-36");
  });

  it("should use original sheet code in SHEET mode", () => {
    const sku = generateSkuCode(sampleUserRow, { mode: "SHEET" });
    expect(sku).toBe("CH-01-A");
  });
});
