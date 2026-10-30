/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.60.0
 * Created      : 2026-10-03
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { parseBarcodeDelimitedText } from "../components/BarcodeManagementTab.tsx";

describe("Barcode Management Intake Parser (parseBarcodeDelimitedText)", () => {
  it("returns empty array for empty or whitespace text", () => {
    expect(parseBarcodeDelimitedText("")).toEqual([]);
    expect(parseBarcodeDelimitedText("   \n\t\r\n  ")).toEqual([]);
  });

  it("parses canonical CSV with explicit 'barcode' and 'sku' headers", () => {
    const csv = `barcode,sku\n8901234567890,SKU-TSHIRT-BLK-M\n8901234567891,SKU-TSHIRT-BLK-L`;
    const result = parseBarcodeDelimitedText(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      barcode: "8901234567890",
      sku: "SKU-TSHIRT-BLK-M",
      state: "READY",
    });
    expect(result[1]).toEqual({
      barcode: "8901234567891",
      sku: "SKU-TSHIRT-BLK-L",
      state: "READY",
    });
  });

  it("handles flexible header aliases (e.g. Barcode No, Item Code, EAN-13, Variant SKU)", () => {
    const tsv = `Barcode No\tItem Code\n8909990001\tJEANS-SLIM-32\n8909990002\tJEANS-SLIM-34`;
    const result = parseBarcodeDelimitedText(tsv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      barcode: "8909990001",
      sku: "JEANS-SLIM-32",
      state: "READY",
    });
    expect(result[1]).toEqual({
      barcode: "8909990002",
      sku: "JEANS-SLIM-34",
      state: "READY",
    });
  });

  it("handles headerless single-column barcode pastes", () => {
    const rawBarcodes = `8901111111111\n8902222222222\n8903333333333`;
    const result = parseBarcodeDelimitedText(rawBarcodes);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      barcode: "8901111111111",
      sku: "",
      state: "READY",
    });
    expect(result[1]).toEqual({
      barcode: "8902222222222",
      sku: "",
      state: "READY",
    });
    expect(result[2]).toEqual({
      barcode: "8903333333333",
      sku: "",
      state: "READY",
    });
  });

  it("handles headerless two-column barcode + SKU pastes", () => {
    const rawData = `8905555555555\tSHIRT-BLUE-XL\n8906666666666\tSHIRT-BLUE-XXL`;
    const result = parseBarcodeDelimitedText(rawData);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      barcode: "8905555555555",
      sku: "SHIRT-BLUE-XL",
      state: "READY",
    });
    expect(result[1]).toEqual({
      barcode: "8906666666666",
      sku: "SHIRT-BLUE-XXL",
      state: "READY",
    });
  });

  it("skips completely blank rows and trims trailing/leading spaces", () => {
    const csv = `Barcode,SKU\n  8907777777777  ,  KURTA-WHT-L  \n\n   \n8908888888888,`;
    const result = parseBarcodeDelimitedText(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      barcode: "8907777777777",
      sku: "KURTA-WHT-L",
      state: "READY",
    });
    expect(result[1]).toEqual({
      barcode: "8908888888888",
      sku: "",
      state: "READY",
    });
  });

  it("handles RFC 4180 quoted values containing spaces or commas", () => {
    const csv = `Barcode,SKU\n"8901234567890","SHIRT, COTTON, M"\n"8901234567891","SHIRT, LINEN, L"`;
    const result = parseBarcodeDelimitedText(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      barcode: "8901234567890",
      sku: "SHIRT, COTTON, M",
      state: "READY",
    });
    expect(result[1]).toEqual({
      barcode: "8901234567891",
      sku: "SHIRT, LINEN, L",
      state: "READY",
    });
  });
});
