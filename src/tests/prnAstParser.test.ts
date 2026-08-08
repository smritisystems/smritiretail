/**
 * Project      : SMRITI Retail OS
 * Module       : Lossless Multi-PRN AST Engine Unit Tests
 * Standard     : SCS-PRINT-AST-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { PRNAstTokenizer } from "../core/printing/prn_engine/PRNAstTokenizer.ts";
import { PRNAstParser } from "../core/printing/prn_engine/PRNAstParser.ts";
import { PrinterLanguageDetector } from "../core/printing/prn_engine/PrinterLanguageDetector.ts";
import { UniversalPrintTemplate } from "../core/printing/models/UniversalPrintTemplate.ts";

describe("Lossless Multi-PRN AST Engine Test Suite (Phase B)", () => {
  // 1. ZPL detection
  it("1. Detects ZPL script signature accurately", () => {
    const res = PrinterLanguageDetector.detect("^XA^FO50,50^A0N,36,36^FDTEST^FS^XZ");
    expect(res.language).toBe("ZPL");
    expect(res.confidence).toBeGreaterThan(0.7);
  });

  // 2. TSPL detection
  it("2. Detects TSPL script signature accurately", () => {
    const res = PrinterLanguageDetector.detect("SIZE 50 mm, 25 mm\nGAP 3 mm, 0 mm\nCLS\nTEXT 50,50,\"0\",0,1,1,\"TEST\"\nPRINT 1,1");
    expect(res.language).toBe("TSPL");
  });

  // 3. EPL detection
  it("3. Detects EPL script signature accurately", () => {
    const res = PrinterLanguageDetector.detect("N\nA50,50,0,3,1,1,N,\"EPL TEST\"\nP1\n");
    expect(res.language).toBe("EPL");
  });

  // 4. CPCL detection
  it("4. Detects CPCL script signature accurately", () => {
    const res = PrinterLanguageDetector.detect("! 0 200 200 400 1\nTEXT 7 0 50 50 CPCL TEST\nPRINT\n");
    expect(res.language).toBe("CPCL");
  });

  // 5. ESC/POS detection
  it("5. Detects ESC/POS binary script signature accurately", () => {
    const res = PrinterLanguageDetector.detect("\x1B\x40RECEIPT TEST\n\x1D\x56\x00");
    expect(res.language).toBe("ESC_POS");
  });

  // 6. Tattly PRN parsing
  it("6. Parses Tattly ZPL PRN into structured AST without dropping nodes", () => {
    const tattlyPrn = `^XA\n^SZ2^JMA^MCY^PMN^PW804^JZY^LH0,0^LRN\n^XZ\n^XA\n^FO706,47^BY3^BCB,50,N,N^FD{barcode}^FS\n^PQ1,0,1,Y\n^XZ`;
    const ast = PRNAstParser.parse(tattlyPrn);

    expect(ast.language).toBe("ZPL");
    expect(ast.nodes.length).toBeGreaterThan(5);
    expect(ast.diagnostics.errors.length).toBe(0);
  });

  // 7. ^XA/^XZ
  it("7. Parses ^XA and ^XZ format boundary control nodes", () => {
    const ast = PRNAstParser.parse("^XA^XZ");
    const xaNode = ast.nodes.find((n) => n.commandName === "^XA");
    const xzNode = ast.nodes.find((n) => n.commandName === "^XZ");

    expect(xaNode).toBeDefined();
    expect(xzNode).toBeDefined();
    expect(xaNode?.kind).toBe("CONTROL");
  });

  // 8. ^FO
  it("8. Parses ^FO field origin positions and converts to mm coordinates", () => {
    const ast = PRNAstParser.parse("^XA^FO80,160^FDTEST^FS^XZ");
    const fdNode = ast.nodes.find((n) => n.commandName === "^FD");

    expect(fdNode).toBeDefined();
    expect(fdNode?.x).toBe(10); // 80 dots / 8 = 10mm
    expect(fdNode?.y).toBe(20); // 160 dots / 8 = 20mm
  });

  // 9. ^FT
  it("9. Parses ^FT field typeset origin positions", () => {
    const ast = PRNAstParser.parse("^XA^FT345,53^FDTEST^FS^XZ");
    const fdNode = ast.nodes.find((n) => n.commandName === "^FD");

    expect(fdNode).toBeDefined();
    expect(fdNode?.x).toBe(43.1); // 345 dots / 8 = 43.1mm
  });

  // 10. ^FD/^FS
  it("10. Parses ^FD field data and ^FS field terminators", () => {
    const ast = PRNAstParser.parse("^XA^FDHEADER TEXT^FS^XZ");
    const fdNode = ast.nodes.find((n) => n.commandName === "^FD");

    expect(fdNode?.data).toBe("HEADER TEXT");
  });

  // 11. ^BC
  it("11. Parses ^BC Code128 barcode definition nodes", () => {
    const ast = PRNAstParser.parse("^XA^FO50,50^BY2^BCN,60,Y,N,N^FD890123^FS^XZ");
    const bcodeNode = ast.nodes.find((n) => n.kind === "BARCODE");

    expect(bcodeNode).toBeDefined();
    expect(bcodeNode?.data).toBe("890123");
  });

  // 12. ^BY
  it("12. Parses ^BY barcode parameter nodes", () => {
    const tokens = PRNAstTokenizer.tokenize("^XA^BY3,2,50^XZ");
    const byTok = tokens.tokens.find((t) => t.commandName === "^BY");

    expect(byTok).toBeDefined();
    expect(byTok?.parameters[0]).toBe("3");
    expect(byTok?.parameters[2]).toBe("50");
  });

  // 13. ^A
  it("13. Parses ^A font definitions and orientation flags", () => {
    const ast = PRNAstParser.parse("^XA^A0N,34,46^FDTEXT^FS^XZ");
    const fdNode = ast.nodes.find((n) => n.commandName === "^FD");

    expect(fdNode?.font).toBe("0");
    expect(fdNode?.fontSizePt).toBe(11); // 34 dots / 3 = ~11pt
  });

  // 14. ^FR
  it("14. Parses ^FR reverse print flags", () => {
    const ast = PRNAstParser.parse("^XA^FO615,135^GB76,80,76^FS^FT615,198^A0N,79,77^FR^FDSIZE^FS^XZ");
    const fdNode = ast.nodes.find((n) => n.data === "SIZE");

    expect(fdNode?.reversePrint).toBe(true);
  });

  // 15. ^GB
  it("15. Parses ^GB boxes, solid fills, and lines", () => {
    const ast = PRNAstParser.parse("^XA^FO615,135^GB76,80,76^FS^FO329,128^GB337,0,3^FS^XZ");
    const boxNode = ast.nodes.find((n) => n.kind === "BOX");
    const lineNode = ast.nodes.find((n) => n.kind === "LINE");

    expect(boxNode).toBeDefined();
    expect(boxNode?.reversePrint).toBe(true); // Solid fill 76,80,76
    expect(lineNode).toBeDefined();
  });

  // 16. ^PQ
  it("16. Parses ^PQ print quantity control nodes", () => {
    const ast = PRNAstParser.parse("^XA^PQ5,0,1,Y^XZ");
    const pqNode = ast.nodes.find((n) => n.kind === "PRINT_QUANTITY");

    expect(pqNode).toBeDefined();
    expect(pqNode?.data).toBe("5");
  });

  // 17. repeated placeholders
  it("17. Retains every instance of repeated placeholders without collapsing them", () => {
    const ast = PRNAstParser.parse("^XA^FD{barcode}^FS^FD{barcode}^FS^FD{barcode}^FS^XZ");
    const bcodeVars = ast.variables.filter((v) => v.name === "barcode");

    expect(bcodeVars.length).toBe(3);
    expect(ast.nodes.filter((n) => n.data === "{barcode}").length).toBe(3);
  });

  // 18. static text
  it("18. Preserves static merchant text without mistaking it for dynamic variables", () => {
    const ast = PRNAstParser.parse("^XA^FD81,Umerkhadi,Mumbai,400003^FS^XZ");
    const fdNode = ast.nodes.find((n) => n.commandName === "^FD");

    expect(fdNode?.data).toBe("81,Umerkhadi,Mumbai,400003");
    expect(fdNode?.placeholders?.length).toBe(0);
  });

  // 19. variable extraction
  it("19. Extracts placeholder variables with tag, name, and offset", () => {
    const ast = PRNAstParser.parse("^XA^FD{brand}^FS^FD{style_code}^FS^XZ");

    expect(ast.variables.length).toBe(2);
    expect(ast.variables[0].name).toBe("brand");
    expect(ast.variables[0].tag).toBe("{brand}");
    expect(ast.variables[1].name).toBe("style_code");
    expect(ast.variables[1].tag).toBe("{style_code}");
  });

  // 20. RAW_COMMAND preservation
  it("20. Preserves unrecognized printer commands as RAW_COMMAND nodes", () => {
    const ast = PRNAstParser.parse("^XA^CUSTOM_VENDOR_CMD_123^XZ");
    const rawNode = ast.nodes.find((n) => n.kind === "RAW_COMMAND");

    expect(rawNode).toBeDefined();
    expect(rawNode?.rawSource).toBe("^CUSTOM_VENDOR_CMD_123");
  });

  // 21. source offsets
  it("21. Preserves source offset indices for every parsed node", () => {
    const ast = PRNAstParser.parse("^XA^PW804^XZ");
    const pwNode = ast.nodes.find((n) => n.commandName === "^PW");

    expect(pwNode?.offset).toBe(3);
  });

  // 22. command ordering
  it("22. Preserves strict sequential command order in AST nodes", () => {
    const ast = PRNAstParser.parse("^XA^PW804^FO10,10^FDTEST^FS^XZ");

    for (let i = 0; i < ast.nodes.length; i++) {
      expect(ast.nodes[i].order).toBe(i + 1);
    }
  });

  // 23. multiple regions
  it("23. Detects spatial label region clusters across elements", () => {
    const ast = PRNAstParser.parse("^XA^FO10,10^FDLEFT^FS^FO50,10^FDRIGHT^FS^XZ");

    expect(ast.regions.length).toBeGreaterThan(0);
  });

  // 24. malformed command handling
  it("24. Handles malformed command syntax gracefully producing diagnostics instead of throwing", () => {
    const ast = PRNAstParser.parse("^XA^FO10^FDUNTERMINATED_FD_WITHOUT_FS^XZ");

    expect(ast.nodes.length).toBeGreaterThan(0);
    expect(ast.diagnostics).toBeDefined();
  });

  // 25. unknown command handling
  it("25. Handles unknown vendor commands cleanly in fallback RAW_COMMAND node", () => {
    const ast = PRNAstParser.parse("^XA^UNKNOWN_CMD^XZ");
    const rawNodes = ast.nodes.filter((n) => n.kind === "RAW_COMMAND");

    expect(rawNodes.length).toBe(1);
    expect(ast.diagnostics.rawNodeCount).toBe(1);
  });

  // 26. empty PRN handling
  it("26. Handles empty PRN string gracefully returning empty AST document", () => {
    const ast = PRNAstParser.parse("");

    expect(ast.nodes.length).toBe(0);
    expect(ast.diagnostics.warnings.length).toBeGreaterThan(0);
  });

  // 27. large PRN handling
  it("27. Parses large PRN script deterministically within performance bounds", () => {
    const largePrn = "^XA\n" + "^FO10,10^FDTEST^FS\n".repeat(200) + "^XZ";
    const start = performance.now();
    const ast = PRNAstParser.parse(largePrn);
    const duration = performance.now() - start;

    expect(ast.nodes.length).toBeGreaterThan(200);
    expect(duration).toBeLessThan(200); // Must parse 200 elements in < 200ms
  });

  // 28. exact source preservation
  it("28. Reconstructs exact raw source string using exportOriginal()", () => {
    const original = "^XA\n^PW804\n^FO50,50^FDEXACT_TEST^FS\n^XZ";
    const ast = PRNAstParser.parse(original);

    expect(ast.exportOriginal()).toBe(original);
  });

  // 29. semantic AST conversion
  it("29. Converts PRNAstDocument to valid UniversalLabelDocument canvas model", () => {
    const ast = PRNAstParser.parse("^XA^PW804^FO50,50^FDSEMANTIC_TEST^FS^XZ");
    const doc = ast.convertToUniversalLabelDocument();

    expect(doc.dimensions.widthMm).toBe(100.5); // 804 / 8 = 100.5mm
    expect(doc.elements.length).toBeGreaterThan(0);
  });

  // 30. UniversalPrintTemplate integration
  it("30. Integrates importPRN pipeline returning UniversalPrintTemplate with populated mappings and document", () => {
    const prn = "^XA^PW804^FO50,50^FD{barcode}^FS^FO50,100^FD{style_code}^FS^XZ";
    const tmpl = PRNAstParser.importPRN(prn, { templateName: "Import Test Template" });

    expect(tmpl).toBeInstanceOf(UniversalPrintTemplate);
    expect(tmpl.metadata.name).toBe("Import Test Template");
    expect(tmpl.fieldMappings.has("{barcode}")).toBe(true);
    expect(tmpl.fieldMappings.has("{style_code}")).toBe(true);
    expect(tmpl.source.originalContent).toBe(prn);
  });
});
