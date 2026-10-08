/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.0
 * Created      : 2026-10-08
 * Modified     : 2026-10-08
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Core System Lookups & Master Directory Standard
 */

import { describe, it, expect } from "vitest";
import { GRID_PROFILES } from "../services/gridInput/gridProfiles.ts";
import {
  STANDARD_LOOKUP_PRESETS,
  getLookupRecommendations,
  getMissingRecommendations,
} from "../components/global/master/lookupStandardPresets.ts";

describe("System Lookups & Core Master Directory Import & Recommendation Suite", () => {
  it("registers LOOKUP_VALUE profile with correct configuration in GRID_PROFILES", () => {
    const profile = GRID_PROFILES["LOOKUP_VALUE"];
    expect(profile).toBeDefined();
    expect(profile.profileId).toBe("LOOKUP_VALUE");
    expect(profile.requireProductResolution).toBe(false);
    expect(profile.atomicTransactionSafety).toBe(true);
    expect(profile.supportedImportModes).toContain("APPEND");
    expect(profile.supportedImportModes).toContain("MERGE");
    expect(profile.defaultImportMode).toBe("APPEND");

    // Check allowed fields
    const fieldKeys = profile.allowedFields.map((f) => f.key);
    expect(fieldKeys).toContain("code");
    expect(fieldKeys).toContain("name");
    expect(fieldKeys).toContain("description");
    expect(fieldKeys).toContain("active");
    expect(fieldKeys).toContain("vendorCode");
    expect(fieldKeys).toContain("values");

    // Code & Name should be required
    const codeField = profile.allowedFields.find((f) => f.key === "code");
    const nameField = profile.allowedFields.find((f) => f.key === "name");
    expect(codeField?.required).toBe(true);
    expect(nameField?.required).toBe(true);
  });

  it("provides comprehensive standard presets for retail and ERP lookup types", () => {
    const expectedTypes = [
      "department",
      "designation",
      "bank",
      "payment_mode",
      "expense_category",
      "currency",
      "gst_rate",
      "uom",
      "gender",
      "category",
      "subcategory",
      "product_type",
      "color",
      "size",
      "heel_type",
      "upper_material",
      "outsole_material",
      "collection_type",
      "size_group",
      "color_group",
      "po_cancel_reason",
      "po_cross_vendor_reason",
    ];

    for (const typeCode of expectedTypes) {
      const presets = getLookupRecommendations(typeCode);
      expect(presets.length, `Preset count for ${typeCode}`).toBeGreaterThan(0);
      for (const p of presets) {
        expect(p.code).toBeDefined();
        expect(p.code.trim().length).toBeGreaterThan(0);
        expect(p.name).toBeDefined();
        expect(p.name.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("getLookupRecommendations is case-insensitive and trims whitespace", () => {
    const fromUpper = getLookupRecommendations("GST_RATE");
    const fromLower = getLookupRecommendations("gst_rate");
    const fromSpaced = getLookupRecommendations(" gst_rate  ");

    expect(fromUpper.length).toBeGreaterThan(0);
    expect(fromUpper).toEqual(fromLower);
    expect(fromUpper).toEqual(fromSpaced);
  });

  it("getMissingRecommendations accurately filters out already registered items", () => {
    const allGst = getLookupRecommendations("gst_rate");
    expect(allGst.length).toBeGreaterThan(0);

    // Simulate existing items: GST_0 and GST_18
    const existing = [
      { code: "GST_0", name: "0% GST (Exempted)" },
      { code: "GST_18", name: "18% GST (Standard Services & Merchandise)" },
    ];

    const missing = getMissingRecommendations("gst_rate", existing);
    expect(missing.length).toBe(allGst.length - 2);

    const missingCodes = missing.map((m) => m.code);
    expect(missingCodes).not.toContain("GST_0");
    expect(missingCodes).not.toContain("GST_18");
    expect(missingCodes).toContain("GST_5");
    expect(missingCodes).toContain("GST_12");
  });

  it("correctly handles color_group and size_group array values in presets", () => {
    const colorGroups = getLookupRecommendations("color_group");
    expect(colorGroups.length).toBeGreaterThan(0);

    const monochrome = colorGroups.find((g) => g.code === "MONOCHROME");
    expect(monochrome).toBeDefined();
    expect(monochrome?.values).toContain("BLACK");
    expect(monochrome?.values).toContain("WHITE");
    expect(monochrome?.data?.dimension).toBe("color");

    const sizeGroups = getLookupRecommendations("size_group");
    expect(sizeGroups.length).toBeGreaterThan(0);

    const menShoes = sizeGroups.find((g) => g.code === "MEN_FOOTWEAR_UK_6_10");
    expect(menShoes).toBeDefined();
    expect(menShoes?.values).toContain("UK-6");
    expect(menShoes?.values).toContain("UK-10");
    expect(menShoes?.data?.dimension).toBe("size");
  });
});
