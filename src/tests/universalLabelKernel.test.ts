/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel Test Suite
 * Standard     : SCS-PRINT-KERNEL-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { UniversalLabelDocument } from "../core/printing/models/UniversalLabelDocument.ts";
import { UniversalFieldRegistry } from "../core/printing/fields/UniversalFieldRegistry.ts";
import { LabelFieldBindingEngine } from "../core/printing/fields/LabelFieldBindingEngine.ts";
import { PrinterLanguageDetector } from "../core/printing/prn_engine/PrinterLanguageDetector.ts";
import { PRNParser } from "../core/printing/prn_engine/PRNParser.ts";
import { PRNRenderer } from "../core/printing/prn_engine/PRNRenderer.ts";
import { PrinterProfile } from "../core/printing/models/PrinterProfile.ts";
import { PrinterCapabilityEngine } from "../core/printing/discovery/PrinterCapabilityEngine.ts";
import { UniversalPrintOrchestrator } from "../core/printing/orchestrator/UniversalPrintOrchestrator.ts";

describe("SMRITI Universal Printing Kernel Test Suite v1.0", () => {
  // 1. UniversalLabelDocument serialization
  it("1. UniversalLabelDocument serializes to JSON and deserializes identically", () => {
    const doc = new UniversalLabelDocument({
      metadata: { id: "doc-101", name: "Test Label Layout", version: "1.0.0", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" },
      dimensions: { widthMm: 50, heightMm: 25, dpi: 203, columns: 1, gapMm: 3, orientation: "PORTRAIT" },
      elements: [
        { id: "el-1", type: "TEXT", x: 5, y: 5, width: 40, height: 5, rotation: 0, visible: true, zIndex: 1, binding: { expression: "{{product.brand}}" } },
        { id: "el-2", type: "BARCODE", x: 5, y: 12, width: 40, height: 10, rotation: 0, visible: true, zIndex: 2, symbology: "EAN13", binding: { expression: "{{barcode.value}}" } },
      ],
    });

    const json = doc.toJSON();
    expect(json.metadata.id).toBe("doc-101");
    expect(json.elements.length).toBe(2);

    const doc2 = UniversalLabelDocument.fromJSON(json);
    expect(doc2.metadata.name).toBe("Test Label Layout");
    expect(doc2.elements.length).toBe(2);
    expect(doc2.dimensions.widthMm).toBe(50);
  });

  // 2. Canonical field resolution
  it("2. Resolves canonical fields accurately", () => {
    expect(UniversalFieldRegistry.resolveCanonicalPath("product.brand")).toBe("product.brand");
    expect(UniversalFieldRegistry.resolveCanonicalPath("pricing.mrp")).toBe("pricing.mrp");
  });

  // 3. Aliases
  it("3. Resolves field aliases to canonical field paths", () => {
    expect(UniversalFieldRegistry.resolveCanonicalPath("Brand Name")).toBe("product.brand");
    expect(UniversalFieldRegistry.resolveCanonicalPath("Manufacturer")).toBe("product.brand");
    expect(UniversalFieldRegistry.resolveCanonicalPath("Selling Price")).toBe("pricing.price");
    expect(UniversalFieldRegistry.resolveCanonicalPath("buy_cost")).toBe("pricing.cost_price");
  });

  // 4. Duplicate canonical fields
  it("4. Prevents duplicate canonical fields by resolving multiple aliases to one single authority", () => {
    const alias1 = UniversalFieldRegistry.resolveCanonicalPath("Brand");
    const alias2 = UniversalFieldRegistry.resolveCanonicalPath("Brand Name");
    const alias3 = UniversalFieldRegistry.resolveCanonicalPath("Manufacturer");

    expect(alias1).toBe("product.brand");
    expect(alias2).toBe("product.brand");
    expect(alias3).toBe("product.brand");
  });

  // 5. Binding resolution
  it("5. Resolves field bindings and whitelisted formatters", () => {
    const dataContext = {
      product: { brand: "NIKE", style_code: "AIR-MAX-90" },
      pricing: { mrp: 7999.5 },
    };

    const res1 = LabelFieldBindingEngine.evaluateExpression("{{product.brand}} - {{product.style_code}}", dataContext);
    expect(res1.value).toBe("NIKE - AIR-MAX-90");

    const res2 = LabelFieldBindingEngine.evaluateExpression("{{pricing.mrp | currency}}", dataContext);
    expect(res2.value).toBe("₹7999.50");
  });

  // 6. Invalid binding rejection
  it("6. Flags missing or invalid binding keys deterministically", () => {
    const dataContext = { product: { brand: "PUMA" } };
    const res = LabelFieldBindingEngine.evaluateExpression("{{product.non_existent_key}}", dataContext);

    expect(res.missingKeys).toContain("product.non_existent_key");
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.value).toBe("");
  });

  // 7. ZPL detection
  it("7. Detects Zebra ZPL II script signature", () => {
    const zpl = "^XA^FO50,50^A0N,36,36^FDSMRITI^FS^XZ";
    const res = PrinterLanguageDetector.detect(zpl);

    expect(res.language).toBe("ZPL");
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
    expect(res.ambiguous).toBe(false);
  });

  // 8. TSPL detection
  it("8. Detects TSC TSPL script signature", () => {
    const tspl = "SIZE 50 mm, 25 mm\nGAP 3 mm, 0 mm\nCLS\nTEXT 50,50,\"0\",0,1,1,\"SMRITI\"\nPRINT 1,1";
    const res = PrinterLanguageDetector.detect(tspl);

    expect(res.language).toBe("TSPL");
    expect(res.confidence).toBeGreaterThanOrEqual(0.7);
    expect(res.ambiguous).toBe(false);
  });

  // 9. EPL detection
  it("9. Detects Eltron EPL script signature", () => {
    const epl = "N\nA50,50,0,3,1,1,N,\"EPL TEST\"\nP1\n";
    const res = PrinterLanguageDetector.detect(epl);

    expect(res.language).toBe("EPL");
    expect(res.confidence).toBeGreaterThanOrEqual(0.6);
  });

  // 10. CPCL detection
  it("10. Detects Mobile CPCL script signature", () => {
    const cpcl = "! 0 200 200 400 1\nTEXT 7 0 50 50 CPCL TEST\nPRINT\n";
    const res = PrinterLanguageDetector.detect(cpcl);

    expect(res.language).toBe("CPCL");
    expect(res.confidence).toBeGreaterThanOrEqual(0.6);
  });

  // 11. ESC/POS detection
  it("11. Detects ESC/POS binary thermal receipt signature", () => {
    const escpos = "\x1B\x40ESC/POS TEST RECEIPT\n\x1D\x56\x00";
    const res = PrinterLanguageDetector.detect(escpos);

    expect(res.language).toBe("ESC_POS");
    expect(res.confidence).toBeGreaterThanOrEqual(0.6);
  });

  // 12. Ambiguous language handling
  it("12. Correctly flags ambiguous language inputs", () => {
    const ambiguousContent = "PRINT TEST";
    const res = PrinterLanguageDetector.detect(ambiguousContent);

    expect(res.ambiguous).toBe(true);
  });

  // 13. RAW fallback
  it("13. Falls back to RAW when content signature is unknown or unsupported", () => {
    const unknownData = "RANDOM_UNRECOGNIZED_PRINTER_COMMAND_STREAM_12345";
    const res = PrinterLanguageDetector.detect(unknownData);

    expect(res.language).toBe("RAW");
    expect(res.confidence).toBeLessThan(0.5);
  });

  // 14. Capability validation
  it("14. Validates document against printer capabilities", () => {
    const doc = new UniversalLabelDocument({
      dimensions: { widthMm: 120, heightMm: 50, dpi: 300, columns: 1, gapMm: 3, orientation: "PORTRAIT" },
    });

    const printer = new PrinterProfile({
      id: "p1",
      name: "Desktop Thermal 203DPI",
      dpi: 203,
      media: {
        maxWidthMm: 108,
        maxHeightMm: 300,
        defaultDpi: 203,
        supportedDpis: [203],
        supportsCutter: false,
        supportsPeeler: false,
        supportsBlackMark: true,
        supportsGapSensor: true,
      },
    });

    const check = PrinterCapabilityEngine.validateCapability(doc, printer);
    expect(check.status).toBe("UNSUPPORTED");
    expect(check.unsupportedFeatures[0]).toContain("exceeds printer max media width");
  });

  // 15. Unsupported element detection
  it("15. Flags unsupported element requirements in document", () => {
    const doc = new UniversalLabelDocument({
      elements: [{ id: "el-qr", type: "QR", x: 5, y: 5, width: 20, height: 20, rotation: 0, visible: true, zIndex: 1 }],
    });

    const printer = new PrinterProfile({
      id: "p2",
      name: "Basic 1D Barcode Printer",
      capabilities: {
        supportsBarcode1D: true,
        supportsQRCode: false,
        supportsDataMatrix: false,
        supportsGS1: false,
        supportsRasterImages: false,
        supportsVectorGraphics: false,
        supportsScalableFonts: false,
        supportsRotation: false,
        supportsStatusQuery: false,
        supportsCalibration: false,
        supportsRawPrinting: true,
      },
    });

    const check = PrinterCapabilityEngine.validateCapability(doc, printer);
    expect(check.status).toBe("UNSUPPORTED");
    expect(check.unsupportedFeatures[0]).toContain("does not support hardware QR code");
  });

  // 16. Renderer output
  it("16. Renders UniversalLabelDocument to valid target ZPL script", () => {
    const doc = new UniversalLabelDocument({
      dimensions: { widthMm: 50, heightMm: 25, dpi: 203, columns: 1, gapMm: 3, orientation: "PORTRAIT" },
      elements: [
        { id: "e1", type: "TEXT", x: 5, y: 5, width: 40, height: 5, rotation: 0, visible: true, zIndex: 1, staticText: "SMRITI RETAIL" },
        { id: "e2", type: "BARCODE", x: 5, y: 12, width: 40, height: 10, rotation: 0, visible: true, zIndex: 2, staticText: "8901234567890" },
      ],
    });

    const renderRes = PRNRenderer.render(doc, { language: "ZPL", copies: 2 });
    expect(renderRes.status).toBe("SUCCESS");
    expect(renderRes.rawStream).toContain("^XA");
    expect(renderRes.rawStream).toContain("^XZ");
    expect(renderRes.rawStream).toContain("^FD8901234567890^FS");
    expect(renderRes.rawStream).toContain("^PQ2,0,1,Y");
  });

  // 17. Round-trip preservation of RAW_COMMAND
  it("17. Preserves unparsed commands in RAW_COMMAND element during round-trip parse & render", () => {
    const originalRaw = "^XA\n^SPECIAL_CUSTOM_VENDOR_TAG_99\n^XZ";
    const parseRes = PRNParser.parse(originalRaw);

    expect(parseRes.document.elements.length).toBeGreaterThan(0);
    const rawEl = parseRes.document.elements.find((e) => e.type === "RAW_COMMAND");
    expect(rawEl).toBeDefined();

    const renderRes = PRNRenderer.render(parseRes.document, { language: "ZPL" });
    expect(renderRes.rawStream).toContain("^SPECIAL_CUSTOM_VENDOR_TAG_99");
  });
});
