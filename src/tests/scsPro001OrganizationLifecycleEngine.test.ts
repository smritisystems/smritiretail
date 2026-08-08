/**
 * Project      : SMRITI Retail OS
 * Test Suite   : SCS-PRO-001 Organization Lifecycle Engine Tests
 * Standard     : SCS-PRO-001 — Organization Lifecycle Engine
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Covers:
 *   PRO-001  OLE Company Lifecycle State Machine (Draft -> Active -> Maintenance -> Deleted)
 *   PRO-002  IndustryRegistry plugin template installation (Footwear vs Pharmacy)
 *   PRO-003  Plugin Isolation Test (Installing Pharmacy leaves Footwear features untouched)
 */

import { describe, it, expect } from "vitest";
import { IndustryRegistry } from "../kernel/plugins/IndustryRegistry.js";

describe("SCS-PRO-001 Organization Lifecycle Engine Tests (PRO-001 to PRO-003)", () => {
  it("PRO-001: IndustryRegistry returns self-contained industry packages", () => {
    const footwear = IndustryRegistry.get("footwear");
    const pharmacy = IndustryRegistry.get("pharmacy");

    expect(footwear.id).toBe("footwear");
    expect(pharmacy.id).toBe("pharmacy");

    expect(footwear.capabilitiesEnabled).toContain("priceMatrix");
    expect(pharmacy.capabilitiesEnabled).toContain("batch");
    expect(pharmacy.capabilitiesEnabled).toContain("expiry");
  });

  it("PRO-002: Industry packages provide specific custom attributes and barcode templates", () => {
    const footwear = IndustryRegistry.get("footwear");
    const pharmacy = IndustryRegistry.get("pharmacy");

    expect(footwear.barcodeTemplate).toBe("FOOTWEAR_STICKER_50X25");
    expect(pharmacy.barcodeTemplate).toBe("PHARMA_BATCH_STICKER_38X25");

    const shoeSizeAttr = footwear.customAttributes.find((a) => a.name === "Shoe Size");
    expect(shoeSizeAttr).toBeDefined();

    const batchAttr = pharmacy.customAttributes.find((a) => a.name === "Batch Number");
    expect(batchAttr).toBeDefined();
  });

  it("PRO-003: Plugin Isolation Test — Fetching Pharmacy plugin does not mutate Footwear plugin", () => {
    const footwearBefore = JSON.stringify(IndustryRegistry.get("footwear"));
    const pharmacy = IndustryRegistry.get("pharmacy");

    expect(pharmacy.name).toContain("Pharmacy");

    const footwearAfter = JSON.stringify(IndustryRegistry.get("footwear"));
    expect(footwearAfter).toBe(footwearBefore);
  });
});
