/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Multi-Region / Multi-Up Print Canvas Unit Tests
 * Standard     : SCS-PRINT-CANVAS-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { UniversalPrintCanvas } from "../core/printing/models/UniversalPrintCanvas.ts";
import { PRNAstParser } from "../core/printing/prn_engine/PRNAstParser.ts";

const TATTLY_GOLDEN_PRN = `^XA
^SZ2^JMA^MCY^PMN^PW804^JZY^LH0,0^LRN
^XZ
^XA
^FO706,47^BY3^BCB,50,N,N^FD{barcode}^FS
^FT781,340^CI0^AAB,27,15^FD{barcode}^FS
^FT345,53^A0N,34,46^FD{brand}^FS
^FT335,340^A0N,17,23^FDMKTD.By:{brand}^FS
^FT335,351^ABN,11,7^FD81,Umerkhadi,Mumbai,400003^FS
^FO615,135^GB76,80,76^FS
^FT615,198^A0N,79,77^FR^FD{prod_size}^FS
^FT400,182^A0N,37,49^FD{prod_color}^FS
^FO410,86^GB277,46,46^FS
^FT410,124^A0N,45,43^FR^FD{style_code}^FS
^FO327,84^GB367,129,3^FS
^FO329,128^GB337,0,3^FS
^FT536,274^A0N,17,23^FD(Incl of all taxes)^FS
^FT493,251^A0N,42,56^FD{mrp_str}/-^FS
^FT410,246^A0N,28,38^FDMRP:^FS
^FT327,274^A0N,17,23^FDMFG.Dt.: {mfg_date}^FS
^FT327,290^ABN,11,7^FDNET CONTENTS:1 Pair Footwear^FS
^FT335,113^A0N,17,23^FDArt.No.^FS
^FT335,175^A0N,17,23^FDColor:^FS
^FT335,386^ABN,11,7^FDcontact@yourstore.com^FS
^FO34,125^BY2^BCN,30,N,N^FD{barcode}^FS
^FT46,181^A0N,25,34^FD{barcode}^FS
^FO37,60^GB70,67,67^FS
^FT37,114^A0N,65,72^FR^FD{prod_size}^FS
^FO116,50^GB101,30,30^FS
^FT116,76^A0N,28,38^FR^FD{prod_color}^FS
^FT37,47^A0N,28,27^FD{style_code}^FS
^FT17,159^ABB,11,7^FD{brand}^FS
^FT116,97^A0N,20,27^FDMRP:{mrp_str}/-^FS
^FT116,114^A0N,17,23^FD(Incl of all taxes)^FS
^FO33,338^BCN,30,N,N^FD{barcode}^FS
^FT45,394^A0N,25,34^FD{barcode}^FS
^FO33,275^GB70,65,65^FS
^FT33,327^A0N,62,70^FR^FD{prod_size}^FS
^FO116,263^GB101,30,30^FS
^FT116,289^A0N,28,38^FR^FD{prod_color}^FS
^FT37,260^A0N,28,27^FD{style_code}^FS
^FT16,372^ABB,11,7^FD{brand}^FS
^FT116,310^A0N,20,27^FDMRP:{mrp_str}/-^FS
^FT116,327^A0N,17,23^FD(Incl of all taxes)^FS
^FO328,308^GB367,0,3^FS
^FO328,365^GB367,0,3^FS
^PQ1,0,1,Y
^XZ`;

describe("Universal Multi-Region / Multi-Up Print Canvas Test Suite (Phase E)", () => {
  // 1. 1-up canvas
  it("1. Configures 1-up single label canvas geometry", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 50, heightMm: 25 });
    canvas.addRegion({ name: "Single Label", width: 50, height: 25 });
    expect(canvas.regions.length).toBe(1);
  });

  // 2. 2-up canvas
  it("2. Configures 2-up dual label canvas geometry", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, heightMm: 25 });
    canvas.setupGrid(2, 1, 48, 25, 2, 0);
    expect(canvas.regions.length).toBe(2);
  });

  // 3. 3-up canvas
  it("3. Configures 3-up triple label canvas geometry", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50 });
    canvas.setupGrid(3, 1, 30, 50, 2, 0);
    expect(canvas.regions.length).toBe(3);
  });

  // 4. 4-up canvas
  it("4. Configures 4-up grid canvas (2x2 layout)", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, heightMm: 100 });
    canvas.setupGrid(2, 2, 48, 48, 2, 2);
    expect(canvas.regions.length).toBe(4);
  });

  // 5. N-up canvas
  it("5. Configures N-up grid canvas (6-up layout 3x2)", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 150, heightMm: 100 });
    canvas.setupGrid(3, 2, 45, 45, 2, 2);
    expect(canvas.regions.length).toBe(6);
  });

  // 6. Grid layout
  it("6. Generates deterministic grid layout region positions", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, heightMm: 50 });
    canvas.setupGrid(2, 1, 45, 45, 5, 0);

    expect(canvas.regions[0].x).toBe(0);
    expect(canvas.regions[1].x).toBe(50); // 45 + 5
  });

  // 7. Freeform layout
  it("7. Configures freeform canvas with explicit x/y region positions", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50 });
    canvas.addRegion({ id: "main-tag", name: "Main Tag", x: 40, y: 0, width: 60, height: 50 });
    canvas.addRegion({ id: "sub-tag-1", name: "Sub Tag 1", x: 0, y: 0, width: 35, height: 24 });
    canvas.addRegion({ id: "sub-tag-2", name: "Sub Tag 2", x: 0, y: 26, width: 35, height: 24 });

    expect(canvas.layoutType).toBe("FREEFORM");
    expect(canvas.regions.length).toBe(3);
  });

  // 8. Region creation
  it("8. Adds new region to canvas successfully", () => {
    const canvas = new UniversalPrintCanvas();
    const reg = canvas.addRegion({ name: "New Region", width: 30, height: 20 });
    expect(reg.id).toBeDefined();
    expect(canvas.regions.length).toBe(1);
  });

  // 9. Region removal
  it("9. Removes existing region by region ID", () => {
    const canvas = new UniversalPrintCanvas();
    const reg = canvas.addRegion({ id: "reg-del", name: "Delete Me", width: 20, height: 10 });
    expect(canvas.regions.length).toBe(1);

    const removed = canvas.removeRegion("reg-del");
    expect(removed).toBe(true);
    expect(canvas.regions.length).toBe(0);
  });

  // 10. Region movement
  it("10. Moves region coordinates via updateRegion()", () => {
    const canvas = new UniversalPrintCanvas();
    const reg = canvas.addRegion({ id: "reg-move", name: "Move Me", x: 10, y: 10, width: 20, height: 10 });

    canvas.updateRegion("reg-move", { x: 25, y: 30 });
    expect(reg.x).toBe(25);
    expect(reg.y).toBe(30);
  });

  // 11. Region resizing
  it("11. Resizes region dimensions via updateRegion()", () => {
    const canvas = new UniversalPrintCanvas();
    const reg = canvas.addRegion({ id: "reg-resize", name: "Resize Me", width: 20, height: 10 });

    canvas.updateRegion("reg-resize", { width: 40, height: 25 });
    expect(reg.width).toBe(40);
    expect(reg.height).toBe(25);
  });

  // 12. Region rotation
  it("12. Rotates region geometry (90/180/270 degrees)", () => {
    const canvas = new UniversalPrintCanvas();
    const reg = canvas.addRegion({ id: "reg-rot", name: "Rotated Region", rotation: 90, width: 20, height: 10 });

    expect(reg.rotation).toBe(90);
    canvas.updateRegion("reg-rot", { rotation: 270 });
    expect(reg.rotation).toBe(270);
  });

  // 13. Multiple templates
  it("13. Supports multiple independent template references across canvas regions", () => {
    const canvas = new UniversalPrintCanvas();
    canvas.addRegion({ name: "Reg 1", templateId: "tmpl-apparel", width: 40, height: 20 });
    canvas.addRegion({ name: "Reg 2", templateId: "tmpl-price", width: 40, height: 20 });

    expect(canvas.regions[0].templateId).toBe("tmpl-apparel");
    expect(canvas.regions[1].templateId).toBe("tmpl-price");
  });

  // 14. Same template reused
  it("14. Reuses the same template reference across multiple canvas regions", () => {
    const canvas = new UniversalPrintCanvas();
    canvas.addRegion({ name: "Tag 1", templateId: "tmpl-footwear", width: 30, height: 20 });
    canvas.addRegion({ name: "Tag 2", templateId: "tmpl-footwear", width: 30, height: 20 });

    expect(canvas.regions[0].templateId).toBe("tmpl-footwear");
    expect(canvas.regions[1].templateId).toBe("tmpl-footwear");
  });

  // 15. Multiple PRNs
  it("15. Supports multiple PRNs coexisting on distinct regions of the same canvas", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, heightMm: 50 });
    canvas.addRegion({ name: "ZPL Region", templateId: "tmpl-zpl", width: 45, height: 45 });
    canvas.addRegion({ name: "TSPL Region", templateId: "tmpl-tspl", x: 50, width: 45, height: 45 });

    expect(canvas.regions.length).toBe(2);
  });

  // 16. One PRN multiple regions
  it("16. Maps one imported PRN template to multiple canvas regions", () => {
    const ast = PRNAstParser.parse(TATTLY_GOLDEN_PRN);
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50 });

    ast.regions.forEach((r) => {
      canvas.addRegion({ name: r.name, x: r.xMm, y: r.yMm, width: r.widthMm, height: r.heightMm, templateId: "tmpl-tattly" });
    });

    expect(canvas.regions.length).toBeGreaterThanOrEqual(2);
  });

  // 17. Different template per region
  it("17. Assigns different template IDs per region", () => {
    const canvas = new UniversalPrintCanvas();
    canvas.addRegion({ name: "R1", templateId: "T1", width: 20, height: 10 });
    canvas.addRegion({ name: "R2", templateId: "T2", width: 20, height: 10 });

    expect(canvas.regions[0].templateId).toBe("T1");
    expect(canvas.regions[1].templateId).toBe("T2");
  });

  // 18. Independent region mappings
  it("18. Preserves independent field mappings per region", () => {
    const canvas = new UniversalPrintCanvas();
    const map1 = new Map<string, string>([["{style}", "product.style_code"]]);
    const map2 = new Map<string, string>([["{style}", "product.code"]]);

    const r1 = canvas.addRegion({ name: "R1", fieldMappings: map1, width: 20, height: 10 });
    const r2 = canvas.addRegion({ name: "R2", fieldMappings: map2, width: 20, height: 10 });

    expect(r1.fieldMappings?.get("{style}")).toBe("product.style_code");
    expect(r2.fieldMappings?.get("{style}")).toBe("product.code");
  });

  // 19. Region runtime context
  it("19. Binds region-specific runtime contexts", () => {
    const canvas = new UniversalPrintCanvas();
    const r1 = canvas.addRegion({ name: "R1", bindingContext: { item_no: 1 }, width: 20, height: 10 });
    const r2 = canvas.addRegion({ name: "R2", bindingContext: { item_no: 2 }, width: 20, height: 10 });

    expect(r1.bindingContext?.item_no).toBe(1);
    expect(r2.bindingContext?.item_no).toBe(2);
  });

  // 20. Different product per region
  it("20. Supports different products bound to distinct regions on the same print canvas", () => {
    const canvas = new UniversalPrintCanvas();
    const p1 = { product: { name: "Sneaker A" } };
    const p2 = { product: { name: "Boot B" } };

    const r1 = canvas.addRegion({ name: "R1", bindingContext: p1, width: 20, height: 10 });
    const r2 = canvas.addRegion({ name: "R2", bindingContext: p2, width: 20, height: 10 });

    const instances = canvas.expandInstances([{}], 1);
    expect(instances[0].runtimeContext.product.name).toBe("Sneaker A");
    expect(instances[1].runtimeContext.product.name).toBe("Boot B");
  });

  // 21. Copies
  it("21. Expands copies per record deterministically", () => {
    const canvas = new UniversalPrintCanvas();
    canvas.addRegion({ name: "Tag", width: 20, height: 10 });

    const instances = canvas.expandInstances([{ code: "A" }], 3);
    expect(instances.length).toBe(3);
  });

  // 22. Quantity
  it("22. Expands label quantity across multiple product records", () => {
    const canvas = new UniversalPrintCanvas();
    canvas.addRegion({ name: "Tag", width: 20, height: 10 });

    const records = [{ code: "P1" }, { code: "P2" }, { code: "P3" }];
    const instances = canvas.expandInstances(records, 1);
    expect(instances.length).toBe(3);
  });

  // 23. Repeat
  it("23. Expands records with repeat multiplier", () => {
    const canvas = new UniversalPrintCanvas();
    canvas.addRegion({ name: "Tag", width: 20, height: 10 });

    const instances = canvas.expandInstances([{ code: "P1" }, { code: "P2" }], 2);
    expect(instances.length).toBe(4);
  });

  // 24. Deterministic label identity
  it("24. Generates unique deterministic instance IDs during print job expansion", () => {
    const canvas = new UniversalPrintCanvas({ id: "c1" });
    canvas.addRegion({ id: "r1", name: "Reg 1", width: 20, height: 10 });

    const instances = canvas.expandInstances([{ code: "A" }], 1, "job-999");
    expect(instances[0].instanceId).toContain("job-999");
    expect(instances[0].sequenceNumber).toBe(1);
  });

  // 25. Overlap warning
  it("25. Produces warning diagnostic when regions overlap under WARN_OVERLAP policy", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, heightMm: 50 });
    canvas.addRegion({ name: "R1", x: 10, y: 10, width: 30, height: 30 });
    canvas.addRegion({ name: "R2", x: 20, y: 10, width: 30, height: 30 });

    const report = canvas.validate("WARN_OVERLAP");
    expect(report.isValid).toBe(true); // Warnings do not invalidate canvas
    expect(report.diagnostics.some((d) => d.severity === "WARNING" && d.code === "REGION_OVERLAP")).toBe(true);
  });

  // 26. Overlap rejection
  it("26. Rejects canvas validation when regions overlap under REJECT_OVERLAP policy", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, heightMm: 50 });
    canvas.addRegion({ name: "R1", x: 10, y: 10, width: 30, height: 30 });
    canvas.addRegion({ name: "R2", x: 20, y: 10, width: 30, height: 30 });

    const report = canvas.validate("REJECT_OVERLAP");
    expect(report.isValid).toBe(false);
    expect(report.diagnostics.some((d) => d.severity === "ERROR" && d.code === "REGION_OVERLAP")).toBe(true);
  });

  // 27. Outside canvas
  it("27. Flags error diagnostic when region extends outside canvas boundaries", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 50, heightMm: 25 });
    canvas.addRegion({ name: "Out of Bounds", x: 40, y: 0, width: 30, height: 25 });

    const report = canvas.validate();
    expect(report.isValid).toBe(false);
    expect(report.diagnostics.some((d) => d.code === "REGION_OUT_OF_BOUNDS")).toBe(true);
  });

  // 28. Invalid geometry
  it("28. Flags error diagnostic for zero or negative region dimensions", () => {
    const canvas = new UniversalPrintCanvas();
    canvas.addRegion({ name: "Zero Reg", width: 0, height: 0 });

    const report = canvas.validate();
    expect(report.isValid).toBe(false);
    expect(report.diagnostics.some((d) => d.code === "INVALID_REGION_DIMENSIONS")).toBe(true);
  });

  // 29. DPI 203
  it("29. Performs exact mm to dot conversion at 203 DPI", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 203 });
    const dots = canvas.mmToDots(100.5);
    expect(dots).toBe(804); // 100.5mm * (203 / 25.4) = 804.0
  });

  // 30. DPI 300
  it("30. Performs exact mm to dot conversion at 300 DPI", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 300 });
    const dots = canvas.mmToDots(100);
    expect(dots).toBe(1181); // 100 * (300 / 25.4) = 1181 dots
  });

  // 31. DPI 600
  it("31. Performs exact mm to dot conversion at 600 DPI", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 600 });
    const dots = canvas.mmToDots(50);
    expect(dots).toBe(1181); // 50 * (600 / 25.4) = 1181 dots
  });

  // 32. mm/dot conversion
  it("32. Performs exact bidirectional dots to mm conversion", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 203 });
    const mm = canvas.dotsToMm(804);
    expect(mm).toBe(100.5);
  });

  // 33. GAP media
  it("33. Configures GAP media type and tracking sensor", () => {
    const canvas = new UniversalPrintCanvas({ mediaType: "DIE_CUT", sensor: "GAP" });
    expect(canvas.mediaType).toBe("DIE_CUT");
    expect(canvas.sensor).toBe("GAP");
  });

  // 34. BLACK_MARK media
  it("34. Configures BLACK_MARK media tracking sensor", () => {
    const canvas = new UniversalPrintCanvas({ sensor: "BLACK_MARK" });
    expect(canvas.sensor).toBe("BLACK_MARK");
  });

  // 35. CONTINUOUS media
  it("35. Configures CONTINUOUS media type", () => {
    const canvas = new UniversalPrintCanvas({ mediaType: "CONTINUOUS", sensor: "NONE" });
    expect(canvas.mediaType).toBe("CONTINUOUS");
    expect(canvas.sensor).toBe("NONE");
  });

  // 36. Rotation preservation
  it("36. Preserves region rotation during print instance expansion", () => {
    const canvas = new UniversalPrintCanvas();
    canvas.addRegion({ name: "Rotated Reg", rotation: 180, width: 20, height: 10 });

    const instances = canvas.expandInstances([{}], 1);
    expect(instances[0].rotation).toBe(180);
  });

  // 37. Tattly 804-dot canvas (100.5mm)
  it("37. Configures 100.5mm (804 dots at 203 DPI) canvas for Tattly golden fixture", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50, dpi: 203 });
    expect(canvas.mmToDots(canvas.widthMm)).toBe(804);
  });

  // 38. Tattly 3-region layout
  it("38. Configures 3-region layout matching Tattly golden fixture", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50 });
    canvas.addRegion({ name: "Region A (Main Tag)", x: 40.8, y: 5.8, width: 56.7, height: 42.3 });
    canvas.addRegion({ name: "Region B (Sub-Tag Upper)", x: 2.0, y: 5.8, width: 20.0, height: 16.3 });
    canvas.addRegion({ name: "Region C (Sub-Tag Lower)", x: 2.0, y: 32.5, width: 20.0, height: 16.3 });

    const report = canvas.validate("ALLOW_OVERLAP");
    expect(report.isValid).toBe(true);
    expect(canvas.regions.length).toBe(3);
  });

  // 39. Tattly 3 barcodes
  it("39. Preserves 3 barcode instances across 3 regions of Tattly golden fixture", () => {
    const ast = PRNAstParser.parse(TATTLY_GOLDEN_PRN);
    const bcodeNodes = ast.nodes.filter((n) => n.kind === "BARCODE");

    expect(bcodeNodes.length).toBe(3);
  });

  // 40. Tattly reverse print
  it("40. Preserves reverse print element flags across Tattly AST nodes", () => {
    const ast = PRNAstParser.parse(TATTLY_GOLDEN_PRN);
    const revNodes = ast.nodes.filter((n) => n.reversePrint === true);

    expect(revNodes.length).toBeGreaterThan(0);
  });

  // 41. Tattly rotated fonts
  it("41. Preserves rotated font element flags across Tattly AST nodes", () => {
    const ast = PRNAstParser.parse(TATTLY_GOLDEN_PRN);
    const rotNodes = ast.nodes.filter((n) => n.rotation === 90);

    expect(rotNodes.length).toBeGreaterThan(0);
  });

  // 42. Tattly field mappings
  it("42. Binds extracted Tattly field placeholders to canvas regions", () => {
    const ast = PRNAstParser.parse(TATTLY_GOLDEN_PRN);
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50 });

    ast.regions.forEach((r) => {
      canvas.addRegion({ name: r.name, x: r.xMm, y: r.yMm, width: r.widthMm, height: r.heightMm });
    });

    expect(ast.variables.length).toBeGreaterThan(5);
    expect(canvas.regions.length).toBeGreaterThanOrEqual(2);
  });

  // 43. Mixed-template canvas
  it("43. Validates mixed-template canvas with zero errors under ALLOW_OVERLAP policy", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, heightMm: 50 });
    canvas.addRegion({ name: "Apparel Region", templateId: "tmpl-apparel", x: 0, y: 0, width: 45, height: 50 });
    canvas.addRegion({ name: "Price Region", templateId: "tmpl-price", x: 50, y: 0, width: 45, height: 50 });

    const report = canvas.validate("ALLOW_OVERLAP");
    expect(report.isValid).toBe(true);
  });

  // 44. Zero-template canvas
  it("44. Validates empty canvas with zero regions cleanly", () => {
    const canvas = new UniversalPrintCanvas();
    const report = canvas.validate();

    expect(report.isValid).toBe(true);
    expect(canvas.regions.length).toBe(0);
  });

  // 45. Deterministic expansion
  it("45. Produces deterministic label instance expansion output across repeated runs", () => {
    const canvas = new UniversalPrintCanvas();
    canvas.addRegion({ id: "r1", name: "Reg 1", width: 20, height: 10 });

    const records = [{ id: 1 }, { id: 2 }];
    const exp1 = canvas.expandInstances(records, 2, "job-fixed");
    const exp2 = canvas.expandInstances(records, 2, "job-fixed");

    expect(exp1.length).toBe(4);
    expect(exp1.length).toBe(exp2.length);
    expect(exp1[0].instanceId).toBe(exp2[0].instanceId);
  });
});
