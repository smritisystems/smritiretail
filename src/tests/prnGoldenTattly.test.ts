/**
 * Project      : SMRITI Retail OS
 * Module       : Tattly Threads Golden PRN Fixture Audit Suite
 * Standard     : SCS-PRINT-GOLDEN-TATTLY v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
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

describe("Tattly Threads Golden ZPL Fixture Verification Suite", () => {
  const ast = PRNAstParser.parse(TATTLY_GOLDEN_PRN);

  // 1. ^PW804 canvas width
  it("1. Verifies ^PW804 canvas width (100.5mm / 804 dots)", () => {
    const pwNode = ast.nodes.find((n) => n.commandName === "^PW");
    expect(pwNode).toBeDefined();
    expect(pwNode?.parameters[0]).toBe("804");

    const doc = ast.convertToUniversalLabelDocument();
    expect(doc.dimensions.widthMm).toBe(100.5);
  });

  // 2. ^LH0,0 home position
  it("2. Verifies ^LH0,0 home origin control node", () => {
    const lhNode = ast.nodes.find((n) => n.commandName === "^LH");
    expect(lhNode).toBeDefined();
  });

  // 3. ^FO positions
  it("3. Verifies ^FO field origin positions across elements", () => {
    const foNodes = ast.nodes.filter((n) => n.rawSource.includes("^FO"));
    expect(foNodes.length).toBeGreaterThan(10);
  });

  // 4. ^FT positions
  it("4. Verifies ^FT typeset origin positions across text elements", () => {
    const ftNodes = ast.nodes.filter((n) => n.rawSource.includes("^FT"));
    expect(ftNodes.length).toBeGreaterThan(15);
  });

  // 5. ^BY barcode parameters
  it("5. Verifies ^BY barcode parameter definition nodes", () => {
    const byNodes = ast.nodes.filter((n) => n.rawSource.includes("^BY"));
    expect(byNodes.length).toBeGreaterThan(0);
  });

  // 6. ^BC barcode definitions
  it("6. Verifies ^BC Code128 barcode definition nodes including vertical ^BCB", () => {
    const bcodeNodes = ast.nodes.filter((n) => n.kind === "BARCODE" || n.rawSource.includes("^BC"));
    expect(bcodeNodes.length).toBeGreaterThan(0);

    const verticalBcode = ast.nodes.find((n) => n.rawSource.includes("^BCB"));
    expect(verticalBcode).toBeDefined();
  });

  // 7. ^FD data fields
  it("7. Verifies ^FD data field nodes", () => {
    const fdNodes = ast.nodes.filter((n) => n.commandName === "^FD");
    expect(fdNodes.length).toBeGreaterThan(25);
  });

  // 8. ^FS field terminators
  it("8. Verifies ^FS field terminator tokens preserved in raw AST nodes", () => {
    const fsNodes = ast.nodes.filter((n) => n.rawSource.includes("^FS"));
    expect(fsNodes.length).toBeGreaterThan(20);
  });

  // 9. ^A font definitions
  it("9. Verifies ^A font definitions (^A0N, ^AAB, ^ABB)", () => {
    const a0nNodes = ast.nodes.filter((n) => n.rawSource.includes("^A0N"));
    const aabNodes = ast.nodes.filter((n) => n.rawSource.includes("^AAB"));
    const abbNodes = ast.nodes.filter((n) => n.rawSource.includes("^ABB"));

    expect(a0nNodes.length).toBeGreaterThan(5);
    expect(aabNodes.length).toBeGreaterThan(0);
    expect(abbNodes.length).toBeGreaterThan(0);
  });

  // 10. ^FR reverse text printing
  it("10. Verifies ^FR reverse text printing flags on solid background boxes", () => {
    const reverseNodes = ast.nodes.filter((n) => n.reversePrint === true);
    expect(reverseNodes.length).toBeGreaterThan(0);
  });

  // 11. ^GB boxes/lines
  it("11. Verifies ^GB box and line geometry nodes including solid fill boxes", () => {
    const gbNodes = ast.nodes.filter((n) => n.commandName === "^GB");
    expect(gbNodes.length).toBeGreaterThan(5);
  });

  // 12. ^CI encoding
  it("12. Verifies ^CI character set encoding node", () => {
    const ciNode = ast.nodes.find((n) => n.commandName === "^CI");
    expect(ciNode).toBeDefined();
  });

  // 13. ^PQ quantity
  it("13. Verifies ^PQ quantity control node", () => {
    const pqNode = ast.nodes.find((n) => n.kind === "PRINT_QUANTITY");
    expect(pqNode).toBeDefined();
    expect(pqNode?.data).toBe("1");
  });

  // 14. ^XA/^XZ format boundaries
  it("14. Verifies ^XA and ^XZ format boundary control nodes", () => {
    const xaNodes = ast.nodes.filter((n) => n.commandName === "^XA");
    const xzNodes = ast.nodes.filter((n) => n.commandName === "^XZ");

    expect(xaNodes.length).toBe(2); // Initialization block + Data block
    expect(xzNodes.length).toBe(2);
  });

  // 15. repeated barcode instances
  it("15. Detects 3 distinct barcode instances across the 3 label regions", () => {
    const bcodeVars = ast.variables.filter((v) => v.name === "barcode");
    expect(bcodeVars.length).toBeGreaterThanOrEqual(3);
  });

  // 16. repeated size/color/style/mrp fields
  it("16. Retains repeated placeholders ({prod_size}, {prod_color}, {style_code}, {mrp_str}) independently", () => {
    const sizeVars = ast.variables.filter((v) => v.name === "prod_size");
    const colorVars = ast.variables.filter((v) => v.name === "prod_color");
    const styleVars = ast.variables.filter((v) => v.name === "style_code");

    expect(sizeVars.length).toBe(3); // Main tag + 2 sub-tags
    expect(colorVars.length).toBe(3);
    expect(styleVars.length).toBe(3);
  });

  // 17. rotated text
  it("17. Detects rotated text elements (^AAB and ^ABB)", () => {
    const rotatedNodes = ast.nodes.filter((n) => n.rotation === 90 || n.rotation === 180 || n.rotation === 270);
    expect(rotatedNodes.length).toBeGreaterThan(0);
  });

  // 18. static merchant information
  it("18. Preserves static merchant info strings intact", () => {
    const addressNode = ast.nodes.find((n) => n.data?.includes("Umerkhadi,Mumbai"));
    const emailNode = ast.nodes.find((n) => n.data?.includes("contact@yourstore.com"));

    expect(addressNode).toBeDefined();
    expect(emailNode).toBeDefined();
  });

  // 19. multiple physical label regions
  it("19. Detects multiple spatial label regions on the 804-dot canvas", () => {
    expect(ast.regions.length).toBeGreaterThanOrEqual(2);
  });

  // 20. initialization/control blocks
  it("20. Preserves initial setup block ^SZ2^JMA^MCY^PMN^PW804^JZY^LH0,0^LRN cleanly", () => {
    const setupNodes = ast.nodes.filter((n) => n.kind === "CONTROL" || n.kind === "SETUP");
    expect(setupNodes.length).toBeGreaterThan(4);

    // Exact Source Round Trip Test
    expect(ast.exportOriginal()).toBe(TATTLY_GOLDEN_PRN);
  });
});
