/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.47.2
 * Created      : 2026-09-29
 * Modified     : 2026-09-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { 
  sanitizeSpreadsheetPutPayload, 
  isImmutableField,
  IMMUTABLE_FIELDS,
  SYSTEM_FIELDS
} from "../components/itemMaster/adapters/spreadsheetAdapter.ts";

describe("SpreadsheetPayloadAdapter — P0 Immutability & System Field Sanitization", () => {
  it("should recognize code, sku, and barcode as immutable fields", () => {
    expect(isImmutableField("code")).toBe(true);
    expect(isImmutableField("sku")).toBe(true);
    expect(isImmutableField("barcode")).toBe(true);
    expect(isImmutableField("name")).toBe(false);
    expect(isImmutableField("mrp")).toBe(false);
  });

  it("should strip system fields (id, _id, tenant_id, company_id, branch_id) from PUT payload", () => {
    const raw = {
      id: "prod-123",
      _id: "prod-123",
      tenant_id: "ten-001",
      company_id: "COMP-001",
      branch_id: "BR-MAIN",
      name: "Running Shoe",
      mrp: 999.0,
      price: 899.0,
      gst_percentage: 12,
    };

    const original = {
      id: "prod-123",
      code: "ART-001",
      barcode: "8901234567890",
      name: "Old Running Shoe",
    };

    const { payload, hasImmutableChangeAttempt } = sanitizeSpreadsheetPutPayload(raw, original);

    expect(payload.id).toBeUndefined();
    expect(payload._id).toBeUndefined();
    expect(payload.tenant_id).toBeUndefined();
    expect(payload.company_id).toBeUndefined();
    expect(payload.branch_id).toBeUndefined();
    expect(payload.name).toBe("Running Shoe");
    expect(payload.mrp).toBe(999.0);
    expect(hasImmutableChangeAttempt).toBe(false);
  });

  it("should strip unchanged code and barcode from PUT payload to prevent backend 409", () => {
    const raw = {
      code: "ART-001",
      barcode: "8901234567890",
      name: "Updated Shoe Name",
      mrp: 1299.0,
    };

    const original = {
      id: "prod-123",
      code: "ART-001",
      barcode: "8901234567890",
    };

    const { payload, hasImmutableChangeAttempt } = sanitizeSpreadsheetPutPayload(raw, original);

    expect(payload.code).toBeUndefined();
    expect(payload.barcode).toBeUndefined();
    expect(payload.name).toBe("Updated Shoe Name");
    expect(payload.mrp).toBe(1299.0);
    expect(hasImmutableChangeAttempt).toBe(false);
  });

  it("should retain code in PUT payload when operator modified it in spreadsheet cell so backend triggers 409", () => {
    const raw = {
      code: "ART-NEW-MODIFIED",
      barcode: "8901234567890",
      name: "Shoe Name",
    };

    const original = {
      id: "prod-123",
      code: "ART-ORIGINAL",
      barcode: "8901234567890",
    };

    const { payload, hasImmutableChangeAttempt, attemptedField } = sanitizeSpreadsheetPutPayload(raw, original);

    expect(payload.code).toBe("ART-NEW-MODIFIED");
    expect(payload.barcode).toBeUndefined(); // Barcode was unchanged, so stripped
    expect(hasImmutableChangeAttempt).toBe(true);
    expect(attemptedField).toBe("code");
  });

  it("should retain barcode in PUT payload when operator modified it in cell", () => {
    const raw = {
      code: "ART-001",
      barcode: "9999999999999",
      name: "Shoe Name",
    };

    const original = {
      id: "prod-123",
      code: "ART-001",
      barcode: "8901234567890",
    };

    const { payload, hasImmutableChangeAttempt, attemptedField } = sanitizeSpreadsheetPutPayload(raw, original);

    expect(payload.code).toBeUndefined();
    expect(payload.barcode).toBe("9999999999999");
    expect(hasImmutableChangeAttempt).toBe(true);
    expect(attemptedField).toBe("barcode");
  });
});
