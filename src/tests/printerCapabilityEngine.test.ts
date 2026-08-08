/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printer Capability & Compatibility Engine Unit Tests
 * Standard     : SCS-PRINT-CAPABILITY-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { PrinterCapabilityEngine } from "../core/printing/discovery/PrinterCapabilityEngine.ts";
import { UniversalLabelDocument } from "../core/printing/models/UniversalLabelDocument.ts";
import { PrinterProfile } from "../core/printing/models/PrinterProfile.ts";
import { UniversalPrintCanvas } from "../core/printing/models/UniversalPrintCanvas.ts";
import { UniversalPrintTemplate } from "../core/printing/models/UniversalPrintTemplate.ts";
import { PRNAstParser } from "../core/printing/prn_engine/PRNAstParser.ts";

const TATTLY_GOLDEN_PRN = `^XA
^PW804
^FO706,47^BY3^BCB,50,N,N^FD{barcode}^FS
^FT781,340^CI0^AAB,27,15^FD{barcode}^FS
^FT345,53^A0N,34,46^FD{brand}^FS
^FT410,124^A0N,45,43^FR^FD{style_code}^FS
^PQ1,0,1,Y
^XZ`;

describe("Universal Printer Capability & Compatibility Engine Test Suite (Phase G)", () => {
  const zplPrinter = new PrinterProfile({
    id: "p-zpl",
    name: "Zebra ZD420 ZPL",
    dpi: 203,
    capabilities: {
      supportsZPL: true,
      supportsTSPL: false,
      supportsEPL: false,
      supportsBarcode1D: true,
      supportsQRCode: true,
      supportsDataMatrix: true,
      supportsRasterImages: true,
      supportsGS1: true,
      supportsVectorGraphics: true,
      supportsScalableFonts: true,
      supportsCutters: false,
      supportsPeeler: false,
      supportsRotation: true,
      supportsStatusQuery: true,
      supportsCalibration: true,
      supportsRawPrinting: true,
    },
    media: {
      maxWidthMm: 104,
      maxHeightMm: 1000,
      defaultDpi: 203,
      supportedDpis: [203],
      supportsCutter: false,
      supportsPeeler: false,
      supportsBlackMark: true,
      supportsGapSensor: true,
      supportedSensors: ["GAP", "BLACK_MARK"],
    },
  });

  const tsplPrinter = new PrinterProfile({
    id: "p-tspl",
    name: "TSC TTP-244 TSPL",
    dpi: 203,
    capabilities: {
      supportsZPL: false,
      supportsTSPL: true,
      supportsEPL: false,
      supportsBarcode1D: true,
      supportsQRCode: true,
      supportsDataMatrix: true,
      supportsRasterImages: true,
      supportsGS1: true,
      supportsVectorGraphics: true,
      supportsScalableFonts: true,
      supportsCutters: false,
      supportsPeeler: false,
      supportsRotation: true,
      supportsStatusQuery: true,
      supportsCalibration: true,
      supportsRawPrinting: true,
    },
    media: {
      maxWidthMm: 108,
      maxHeightMm: 1000,
      defaultDpi: 203,
      supportedDpis: [203],
      supportsCutter: false,
      supportsPeeler: false,
      supportsBlackMark: true,
      supportsGapSensor: true,
      supportedSensors: ["GAP"],
    },
  });

  // 1. ZPL compatibility
  it("1. Validates ZPL template capability match on ZPL printer", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED");
  });

  // 2. TSPL compatibility
  it("2. Validates TSPL template capability match on TSPL printer", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "TSPL", originalContent: "SIZE 100 mm, 50 mm\r\n" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, tsplPrinter);
    expect(report.status).toBe("SUPPORTED");
  });

  // 3. EPL compatibility
  it("3. Validates EPL template compatibility checks", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "EPL", originalContent: "N\r\nP1\r\n" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("UNSUPPORTED"); // ZPL printer does not support EPL
  });

  // 4. CPCL compatibility
  it("4. Validates CPCL template compatibility checks", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 50 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "CPCL", originalContent: "! 0 200 200 210 1\r\n" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("UNSUPPORTED");
  });

  // 5. ESC/POS compatibility
  it("5. Validates ESC/POS template compatibility checks", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 80 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ESC_POS", originalContent: "\x1B\x40" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("UNSUPPORTED");
  });

  // 6. Language mismatch
  it("6. Marks ZPL template on TSPL-only printer as UNSUPPORTED due to language mismatch", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, tsplPrinter);
    expect(report.status).toBe("UNSUPPORTED");
    expect(report.languageMatched).toBe(false);
  });

  // 7. Unknown language
  it("7. Handles unknown language gracefully with fallback status", () => {
    const canvas = new UniversalPrintCanvas();
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "UNKNOWN_PRN" as any, originalContent: "RAW" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED");
  });

  // 8. 203 DPI
  it("8. Matches 203 DPI canvas with 203 DPI printer with zero warnings", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 203, widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.dpiMatched).toBe(true);
  });

  // 9. 300 DPI
  it("9. Matches 300 DPI canvas with 300 DPI printer", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 300, widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const p300 = new PrinterProfile({ id: "p300", name: "P300", dpi: 300 });
    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, p300);
    expect(report.dpiMatched).toBe(true);
  });

  // 10. 600 DPI
  it("10. Matches 600 DPI canvas with 600 DPI printer", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 600, widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const p600 = new PrinterProfile({ id: "p600", name: "P600", dpi: 600 });
    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, p600);
    expect(report.dpiMatched).toBe(true);
  });

  // 11. DPI warning
  it("11. Generates SUPPORTED_WITH_WARNINGS when canvas DPI differs from printer DPI", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 300, widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED_WITH_WARNINGS");
    expect(report.dpiMatched).toBe(false);
  });

  // 12. Width match
  it("12. Validates canvas width within printer media width", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.dimensionsMatched).toBe(true);
  });

  // 13. Width overflow
  it("13. Flags UNSUPPORTED error when canvas width exceeds printer max media width", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 120 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("UNSUPPORTED");
    expect(report.dimensionsMatched).toBe(false);
  });

  // 14. Height overflow
  it("14. Flags warning when canvas height exceeds nominal max height", () => {
    const canvas = new UniversalPrintCanvas({ heightMm: 1500, widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.warnings.some((w) => w.includes("exceeds nominal printer max height"))).toBe(true);
  });

  // 15. Media match
  it("15. Matches media type requirements cleanly", () => {
    const canvas = new UniversalPrintCanvas({ mediaType: "DIE_CUT", sensor: "GAP" });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED");
  });

  // 16. Media unknown
  it("16. Applies UNKNOWN DATA RULE (Unknown media = SUPPORTED_WITH_WARNINGS)", () => {
    const canvas = new UniversalPrintCanvas({ sensor: "GAP" });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const pNoSensor = new PrinterProfile({ id: "p-nosensor", name: "No Sensor Info" });
    pNoSensor.media.supportedSensors = [];

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, pNoSensor);
    expect(report.status).toBe("SUPPORTED_WITH_WARNINGS");
  });

  // 17. Sensor match
  it("17. Matches GAP tracking sensor requirement with printer capability", () => {
    const canvas = new UniversalPrintCanvas({ sensor: "GAP" });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED");
  });

  // 18. Sensor unknown
  it("18. Unknown sensor capability produces warning diagnostic without hard rejection", () => {
    const canvas = new UniversalPrintCanvas({ sensor: "BLACK_MARK" });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });
    const pGapOnly = new PrinterProfile({ id: "p-gaponly", name: "GAP Only Printer" });
    pGapOnly.media.supportedSensors = ["GAP"];

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, pGapOnly);
    expect(report.status).toBe("SUPPORTED_WITH_WARNINGS");
  });

  // 19. Barcode support
  it("19. Validates printer 1D barcode hardware capability support", () => {
    const doc = PRNAstParser.parse("^XA^FO50,50^BCN,50^FD1234^FS^XZ").convertToUniversalLabelDocument();
    const res = PrinterCapabilityEngine.validateCapability(doc, zplPrinter);
    expect(res.status).toBe("SUPPORTED");
  });

  // 20. QR support
  it("20. Validates printer QR code hardware capability support", () => {
    const doc = PRNAstParser.parse("^XA^FO50,50^BQN,2,5^FDQA,1234^FS^XZ").convertToUniversalLabelDocument();
    const res = PrinterCapabilityEngine.validateCapability(doc, zplPrinter);
    expect(res.status).toBe("SUPPORTED");
  });

  // 21. DataMatrix support
  it("21. Validates printer DataMatrix hardware capability support", () => {
    const doc = PRNAstParser.parse("^XA^FO50,50^BXN,5,200^FD1234^FS^XZ").convertToUniversalLabelDocument();
    const res = PrinterCapabilityEngine.validateCapability(doc, zplPrinter);
    expect(res.status).toBe("SUPPORTED");
  });

  // 22. RAW_COMMAND
  it("22. Checks ZPL RAW_COMMAND node compatibility against printer language support", () => {
    const ast = PRNAstParser.parse("^XA^FO50,50^FDRAW^FS^XZ");
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });
    tmpl.document = ast.convertToUniversalLabelDocument();

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(new UniversalPrintCanvas(), tmpl, tsplPrinter);
    expect(report.status).toBe("UNSUPPORTED");
  });

  // 23. Multi-region
  it("23. Validates multi-region canvas capability compatibility", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50 });
    canvas.addRegion({ name: "R1", width: 45, height: 45 });
    canvas.addRegion({ name: "R2", x: 50, width: 45, height: 45 });

    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });
    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);

    expect(report.status).toBe("SUPPORTED");
  });

  // 24. Multi-up
  it("24. Validates 3-up multi-up canvas geometry against printer max media width", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50 });
    canvas.setupGrid(3, 1, 30, 50, 2, 0);

    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });
    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);

    expect(report.status).toBe("SUPPORTED");
  });

  // 25. Rotation
  it("25. Validates 90/180/270 element rotation capability", () => {
    const doc = PRNAstParser.parse("^XA^FO50,50^A0B,30,30^FDROTATED^FS^XZ").convertToUniversalLabelDocument();
    const res = PrinterCapabilityEngine.validateCapability(doc, zplPrinter);

    expect(res.status).toBe("SUPPORTED");
  });

  // 26. Margins
  it("26. Includes margin offsets when validating overall canvas printable width", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, margins: { left: 5, right: 5, top: 0, bottom: 0 } });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED");
  });

  // 27. Gap
  it("27. Validates gap dimensions in grid layout", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100 });
    canvas.setupGrid(2, 1, 45, 40, 5, 0);

    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });
    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);

    expect(report.status).toBe("SUPPORTED");
  });

  // 28. Black mark
  it("28. Validates BLACK_MARK sensor compatibility", () => {
    const canvas = new UniversalPrintCanvas({ sensor: "BLACK_MARK" });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED");
  });

  // 29. Continuous media
  it("29. Validates CONTINUOUS media type compatibility", () => {
    const canvas = new UniversalPrintCanvas({ mediaType: "CONTINUOUS", sensor: "NONE" });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED");
  });

  // 30. Field mapping missing
  it("30. Reports missing field mappings in compatibility report checks", () => {
    const canvas = new UniversalPrintCanvas();
    const tmpl = PRNAstParser.importPRN("^XA^FD{unmapped_tag}^FS^XZ");

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.fieldMappingReport).toBeDefined();
  });

  // 31. Field mapping ambiguous
  it("31. Flags warning diagnostic when template contains ambiguous field mappings ({price})", () => {
    const canvas = new UniversalPrintCanvas();
    const tmpl = PRNAstParser.importPRN("^XA^FD{price}^FS^XZ");

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.warnings.some((w) => w.includes("ambiguous placeholders"))).toBe(true);
  });

  // 32. Formatter validation
  it("32. Validates declarative formatters cleanly during capability inspection", () => {
    const canvas = new UniversalPrintCanvas();
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^FD{brand}^FS^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED");
  });

  // 33. Unsupported element
  it("33. Reports unsupported features when document contains non-supported element types", () => {
    const doc = PRNAstParser.parse("^XA^FO50,50^BQN,2,5^FDQA,1234^FS^XZ").convertToUniversalLabelDocument();
    const pNoQR = new PrinterProfile({ id: "no-qr", name: "No QR" });
    pNoQR.capabilities.supportsQRCode = false;

    const res = PrinterCapabilityEngine.validateCapability(doc, pNoQR);
    expect(res.status).toBe("UNSUPPORTED");
  });

  // 34. Tattly golden fixture
  it("34. MANDATORY FIXTURE: Validates Tattly Threads golden fixture compatibility on 203 DPI Zebra ZD420", () => {
    const tmpl = PRNAstParser.importPRN(TATTLY_GOLDEN_PRN);
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50, dpi: 203 });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.status).toBe("SUPPORTED");
    expect(report.overallScore).toBe(100);
  });

  // 35. Deterministic result
  it("35. Produces identical deterministic compatibility reports across repeated runs", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const r1 = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    const r2 = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);

    expect(r1.status).toBe(r2.status);
    expect(r1.overallScore).toBe(r2.overallScore);
  });

  // 36. Multiple printers
  it("36. Ranks multiple candidate printers for a canvas and template", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const ranked = PrinterCapabilityEngine.rankPrintersForCanvas(canvas, tmpl, [tsplPrinter, zplPrinter]);
    expect(ranked[0].printer.id).toBe("p-zpl"); // ZPL printer ranked highest
  });

  // 37. Recommendation ordering
  it("37. Places fully supported printer at rank #1", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const ranked = PrinterCapabilityEngine.rankPrintersForCanvas(canvas, tmpl, [tsplPrinter, zplPrinter]);
    expect(ranked[0].report.status).toBe("SUPPORTED");
  });

  // 38. Unknown capability
  it("38. Handles unknown capability provenance without throwing", () => {
    const canvas = new UniversalPrintCanvas();
    const tmpl = new UniversalPrintTemplate();

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.checks.some((c) => c.category === "DPI")).toBe(true);
  });

  // 39. Hard incompatibility
  it("39. Sets overall compatibility score to 0 on hard incompatibility", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 150 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.overallScore).toBe(0);
    expect(report.status).toBe("UNSUPPORTED");
  });

  // 40. No arbitrary selection
  it("40. Returns structured compatibility reports without forcing automatic printer selection", () => {
    const canvas = new UniversalPrintCanvas();
    const tmpl = new UniversalPrintTemplate();

    const ranked = PrinterCapabilityEngine.rankPrintersForCanvas(canvas, tmpl, []);
    expect(ranked.length).toBe(0);
  });

  // 41. Capability provenance
  it("41. Populates capability provenance metadata in check details", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    const dpiCheck = report.checks.find((c) => c.category === "DPI");

    expect(dpiCheck?.provenance).toBeDefined();
    expect(dpiCheck?.provenance?.source).toBe("DEVICE");
  });

  // 42. Overlapping regions handling
  it("42. Validates overlapping canvas regions without throwing capability errors", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100 });
    canvas.addRegion({ name: "R1", x: 10, y: 10, width: 30, height: 30 });
    canvas.addRegion({ name: "R2", x: 20, y: 10, width: 30, height: 30 });

    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });
    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);

    expect(report.status).toBe("SUPPORTED");
  });

  // 43. Zero error report structure
  it("43. Generates zero-error report structure for clean matches", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.errors.length).toBe(0);
  });

  // 44. Overall compatibility score
  it("44. Calculates score 100 for clean match and 80 for warnings", () => {
    const canvasClean = new UniversalPrintCanvas({ widthMm: 100, dpi: 203 });
    const canvasWarn = new UniversalPrintCanvas({ widthMm: 100, dpi: 300 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const repClean = PrinterCapabilityEngine.validateCanvasCompatibility(canvasClean, tmpl, zplPrinter);
    const repWarn = PrinterCapabilityEngine.validateCanvasCompatibility(canvasWarn, tmpl, zplPrinter);

    expect(repClean.overallScore).toBe(100);
    expect(repWarn.overallScore).toBe(80);
  });

  // 45. Multi-PRN region language mismatch
  it("45. Rejects canvas if RAW_COMMAND content language is unsupported by printer", () => {
    const ast = PRNAstParser.parse("^XA^FO50,50^FDZPL RAW^FS^XZ");
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });
    tmpl.document = ast.convertToUniversalLabelDocument();

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(new UniversalPrintCanvas(), tmpl, tsplPrinter);
    expect(report.status).toBe("UNSUPPORTED");
  });

  // 46. Media width safety margin
  it("46. Validates exact media width boundary matches", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 104 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    expect(report.dimensionsMatched).toBe(true);
  });

  // 47. Non-destructive mapping check
  it("47. Capability check does NOT mutate template field mappings", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Immutable Mapping Test" });
    tmpl.setFieldMapping("{style}", "product.style_code");

    PrinterCapabilityEngine.validateCanvasCompatibility(new UniversalPrintCanvas(), tmpl, zplPrinter);
    expect(tmpl.fieldMappings.get("{style}")).toBe("product.style_code");
  });

  // 48. System printer conversion compatibility
  it("48. Converts legacy system printer format into capability model", () => {
    const converted = PrinterCapabilityEngine.fromSystemPrinter({ name: "Legacy System Printer" });
    expect(converted.supportsZPL).toBe(true);
  });

  // 49. Rank printers deterministically
  it("49. Produces deterministic rank ordering across repeated invocations", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const r1 = PrinterCapabilityEngine.rankPrintersForCanvas(canvas, tmpl, [tsplPrinter, zplPrinter]);
    const r2 = PrinterCapabilityEngine.rankPrintersForCanvas(canvas, tmpl, [tsplPrinter, zplPrinter]);

    expect(r1[0].printer.id).toBe(r2[0].printer.id);
  });

  // 50. Provenance source tracking
  it("50. Tracks provenance source as DRIVER for printer hardware media checks", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });

    const report = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, tmpl, zplPrinter);
    const widthCheck = report.checks.find((c) => c.name === "Max Width Check");

    expect(widthCheck?.provenance?.source).toBe("DRIVER");
  });
});
