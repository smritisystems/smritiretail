/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.50.0
 * Created      : 2026-10-10
 * Modified     : 2026-10-10
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : PRN Template Interpolation Engine Tests
 */

import { describe, it, expect } from "vitest";
import {
  interpolatePrnScript,
  compilePrnBatch,
  detectPrnProtocol,
  formatStyleForBarcodeLabel,
  BUILTIN_PRN_TEMPLATES,
  formatPrnTimestamp,
  sanitizeFilenameToken,
  generatePrnDownloadFilename
} from "../components/barcode/prnInterpolation.ts";

describe("PRN Template Interpolation Engine Suite", () => {
  const sampleItem = {
    stockNo: "000006",
    barcode: "890100000006",
    product: "Tattly Threads Footwear",
    brand: "Tattly Threads",
    style: "CH-30-K",
    colour: "Black",
    size: "37",
    mrp: 1199,
    sellingPrice: 1199,
    labelCount: 2
  };

  it("replaces bracket style tokens in ZPL scripts correctly", () => {
    const template = "^XA^FO50,50^FD{style_code}^FS^FO50,100^FD{barcode}^FS^FO50,150^FD{colour}^FS^FO50,200^FD{size}^FS^FO50,250^FD{mrp}^FS^XZ";
    const result = interpolatePrnScript(template, sampleItem);

    expect(result).toContain("^FDCH-30-K^FS");
    expect(result).toContain("^FD890100000006^FS");
    expect(result).toContain("^FDBLACK^FS");
    expect(result).toContain("^FD37^FS");
    expect(result).toContain("^FD1199^FS");
  });

  it("replaces hash style tokens in legacy scripts correctly", () => {
    const template = "^XA^FD#STYLE#^FS^FD#BARCODE#^FS^FD#COLOR#^FS^FD#SIZE#^FS^FD#MRP#^FS^XZ";
    const result = interpolatePrnScript(template, sampleItem);

    expect(result).toContain("^FDCH-30-K^FS");
    expect(result).toContain("^FD890100000006^FS");
    expect(result).toContain("^FDBLACK^FS");
    expect(result).toContain("^FD37^FS");
    expect(result).toContain("^FD1199^FS");
  });

  it("replaces static sample data in static templates without tokens", () => {
    const staticTemplate = "^XA^FO346,305^BY2^BCN,66,N,N^FD890100000006^FS^FT416,54^A0N,45,44^FR^FDCH-30-K     ^FS^FT488,175^A0N,42,56^FD1199/-^FS^XZ";
    const newItem = {
      stockNo: "000008",
      barcode: "890100000008",
      product: "Tattly Threads Footwear",
      brand: "Tattly Threads",
      style: "SND-18-V",
      colour: "Toupe",
      size: "40",
      mrp: 1499,
      sellingPrice: 1499
    };
    const result = interpolatePrnScript(staticTemplate, newItem);

    expect(result).toContain("^FD890100000008^FS");
    expect(result).toContain("^FDSND-18-V     ^FS");
    expect(result).toContain("^FD1499/-^FS");
  });

  it("compiles batch items with quantity repetition", () => {
    const template = "^XA^FD{style_code}^FS^XZ";
    const items = [
      { style: "ART-1", labelCount: 2 },
      { style: "ART-2", labelCount: 1 }
    ];
    const batch = compilePrnBatch(template, items);

    const matches1 = batch.match(/\^FDART-1\^FS/g);
    const matches2 = batch.match(/\^FDART-2\^FS/g);
    expect(matches1).toHaveLength(2);
    expect(matches2).toHaveLength(1);
  });

  it("detects protocol correctly for ZPL, DPL, and TSPL scripts", () => {
    expect(detectPrnProtocol("^XA^FDTest^FS^XZ")).toBe("ZPL");
    expect(detectPrnProtocol("\x02L\nD11\n191100000200020Brand\nE")).toBe("DPL");
    expect(detectPrnProtocol("SIZE 100 mm, 50 mm\nCLS\nTEXT 50,50,\"3\",0,1,1,\"Test\"\nPRINT 1")).toBe("TSPL");
    expect(detectPrnProtocol("")).toBe("ZPL");
  });

  it("interpolates the built-in footwear 100x50.7mm master template accurately", () => {
    const template = BUILTIN_PRN_TEMPLATES["Tattly Threads Footwear — 100x50.7mm"];
    expect(template).toBeDefined();
    const result = interpolatePrnScript(template, sampleItem);

    expect(result).toContain("^FDCH-30-K");
    expect(result).toContain("^FD890100000006^FS");
    expect(result).toContain("^FDBLACK^FS");
    expect(result).toContain("^FD37^FS");
    expect(result).toContain("^FD1199/-^FS");
    expect(result).toContain("^FT390,399"); // Audited non-overlap baseline
  });

  it("formats Article / Style code with Vendor Code per client governance", () => {
    // Single-letter vendors retain trailing dash (e.g. 'CH-01' + 'A' -> 'CH-01-A-')
    expect(formatStyleForBarcodeLabel("CH-01", "A")).toBe("CH-01-A-");
    expect(formatStyleForBarcodeLabel(",CH-01", "A")).toBe("CH-01-A-");
    expect(formatStyleForBarcodeLabel("CH-01", "V-00A")).toBe("CH-01-A-");
    expect(formatStyleForBarcodeLabel("CH-01-A", "A")).toBe("CH-01-A-");
    expect(formatStyleForBarcodeLabel("CH-41", "V")).toBe("CH-41-V-");

    // In-house vendor 'TT' (or multi-letter) formats without trailing dash: ('CH-501', 'TT') -> 'CH-501-TT'
    expect(formatStyleForBarcodeLabel("CH-501", "TT")).toBe("CH-501-TT");
    expect(formatStyleForBarcodeLabel("CH-501-TT", "TT")).toBe("CH-501-TT");
    expect(formatStyleForBarcodeLabel("CH-501-TT-", "TT")).toBe("CH-501-TT");

    // Without vendor code
    expect(formatStyleForBarcodeLabel("CH-01", "")).toBe("CH-01");
  });

  it("replaces {style_code} with Style + Vendor Code on barcode label when vendorCode is provided", () => {
    const template = "^XA^FO50,50^FD{style_code}^FS^XZ";
    const itemWithVendor = {
      ...sampleItem,
      style: "CH-01",
      vendorCode: "A"
    };
    const result = interpolatePrnScript(template, itemWithVendor);
    expect(result).toContain("^FDCH-01-A-^FS");
  });

  it("ensures Tattly Threads Footwear PRN is registered as default and serves as universal fallback", () => {
    const masterTmpl = BUILTIN_PRN_TEMPLATES["Tattly Threads Footwear — 100x50.7mm"];
    expect(BUILTIN_PRN_TEMPLATES["TattlyThreads.prn"]).toBe(masterTmpl);
    expect(BUILTIN_PRN_TEMPLATES["lay-footwear-100x50-3stub"]).toBe(masterTmpl);
    expect(BUILTIN_PRN_TEMPLATES["default"]).toBe(masterTmpl);

    // Empty template in interpolatePrnScript defaults to Tattly Threads PRN
    const defaultInterpolated = interpolatePrnScript("", sampleItem);
    expect(defaultInterpolated).toContain("^FDCH-30-K");
    expect(defaultInterpolated).toContain("Tattly Threads");
    expect(defaultInterpolated).toContain("81,Umerkhadi,Mumbai,400003");

    // Empty template in compilePrnBatch defaults to Tattly Threads PRN
    const defaultBatch = compilePrnBatch("", [sampleItem]);
    expect(defaultBatch).toContain("^FDCH-30-K");
    expect(defaultBatch).toContain("care@tattlythreads.com");
  });

  it("formats PRN timestamps as YYYYMMDD-HHmmss", () => {
    const fixedDate = new Date(2026, 9, 13, 12, 5, 30); // 2026-10-13 12:05:30
    const ts = formatPrnTimestamp(fixedDate);
    expect(ts).toBe("20261013-120530");

    const currentTs = formatPrnTimestamp();
    expect(currentTs).toMatch(/^\d{8}-\d{6}$/);
  });

  it("sanitizes filename tokens removing illegal filesystem characters", () => {
    expect(sanitizeFilenameToken("CH/30/K")).toBe("CH-30-K");
    expect(sanitizeFilenameToken("Tattly: Threads & Co")).toBe("Tattly-Threads-&-Co");
    expect(sanitizeFilenameToken("   STYLE--01  ")).toBe("STYLE-01");
    expect(sanitizeFilenameToken("", "FALLBACK")).toBe("FALLBACK");
    expect(sanitizeFilenameToken(undefined, "DEFAULT")).toBe("DEFAULT");
  });

  it("generates canonical SMRITI-Style-Vendorcode-TimeStamp download filenames", () => {
    const fixedDate = new Date(2026, 9, 13, 12, 5, 30);

    // 1. Single item with style and vendorCode
    const singleItem = {
      style: "CH-30-K",
      vendorCode: "TATTLY",
    };
    const fn1 = generatePrnDownloadFilename(singleItem, "prn", { date: fixedDate });
    expect(fn1).toBe("SMRITI-CH-30-K-TATTLY-20261013-120530.prn");

    // 2. Uniform batch (multiple sizes of the same style and vendor)
    const uniformBatch = [
      { style: "CH-30-K", vendorCode: "TATTLY", size: "37" },
      { style: "CH-30-K", vendorCode: "TATTLY", size: "38" },
      { style: "CH-30-K", vendorCode: "TATTLY", size: "39" },
    ];
    const fn2 = generatePrnDownloadFilename(uniformBatch, "prn", { date: fixedDate });
    expect(fn2).toBe("SMRITI-CH-30-K-TATTLY-20261013-120530.prn");

    // 3. Multi-style batch
    const multiStyleBatch = [
      { style: "CH-30-K", vendorCode: "TATTLY" },
      { style: "SND-18-V", vendorCode: "TATTLY" },
    ];
    const fn3 = generatePrnDownloadFilename(multiStyleBatch, "prn", { date: fixedDate });
    expect(fn3).toBe("SMRITI-CH-30-K+1MORE-TATTLY-20261013-120530.prn");

    // 4. Empty items fallback
    const fnEmpty = generatePrnDownloadFilename([], "prn", { date: fixedDate });
    expect(fnEmpty).toBe("SMRITI-CH-30-K-TATTLY-20261013-120530.prn");

    // 5. Alternative protocols (zpl, dpl)
    const fnZpl = generatePrnDownloadFilename(singleItem, "zpl", { date: fixedDate });
    expect(fnZpl).toBe("SMRITI-CH-30-K-TATTLY-20261013-120530.zpl");

    const fnDpl = generatePrnDownloadFilename(singleItem, "dpl", { date: fixedDate });
    expect(fnDpl).toBe("SMRITI-CH-30-K-TATTLY-20261013-120530.dpl");
  });
});

