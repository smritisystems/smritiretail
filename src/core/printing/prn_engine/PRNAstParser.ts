/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — PRN AST Parser
 * Standard     : SCS-PRINT-AST-PARSER-002 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { PRNAstTokenizer, PRNToken } from "./PRNAstTokenizer.ts";
import { DetectedPrinterLanguage } from "./PrinterLanguageDetector.ts";
import { UniversalLabelDocument, LabelElement } from "../models/UniversalLabelDocument.ts";
import { UniversalPrintTemplate } from "../models/UniversalPrintTemplate.ts";

export type PRNAstNodeKind =
  | "COMMAND"
  | "TEXT"
  | "BARCODE"
  | "QR"
  | "GRAPHIC"
  | "LINE"
  | "BOX"
  | "IMAGE"
  | "CONTROL"
  | "SETUP"
  | "PRINT_QUANTITY"
  | "RAW_COMMAND";

export interface PRNAstNode {
  id: string;
  kind: PRNAstNodeKind;
  rawSource: string;
  commandName: string;
  parameters: string[];
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  rotation: 0 | 90 | 180 | 270;
  font?: string;
  fontSizePt?: number;
  reversePrint?: boolean;
  symbology?: string;
  data?: string;
  placeholders?: string[];
  offset: number;
  order: number;
}

export interface PRNAstRegion {
  id: string;
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  nodeIds: string[];
}

export interface PRNAstVariableReference {
  name: string; // e.g. "barcode" or "style_code"
  tag: string; // e.g. "{barcode}" or "{style_code}"
  nodeId: string;
  offset: number;
}

export interface PRNAstDiagnostics {
  errors: string[];
  warnings: string[];
  unsupportedCommands: string[];
  nodeCount: number;
  rawNodeCount: number;
}

export class PRNAstDocument {
  public language: DetectedPrinterLanguage;
  public source: string;
  public nodes: PRNAstNode[];
  public regions: PRNAstRegion[];
  public variables: PRNAstVariableReference[];
  public diagnostics: PRNAstDiagnostics;
  public sourceMap: Array<{ order: number; offset: number; length: number; raw: string }>;

  constructor(init: {
    language: DetectedPrinterLanguage;
    source: string;
    nodes: PRNAstNode[];
    regions?: PRNAstRegion[];
    variables?: PRNAstVariableReference[];
    diagnostics?: Partial<PRNAstDiagnostics>;
    sourceMap?: Array<{ order: number; offset: number; length: number; raw: string }>;
  }) {
    this.language = init.language;
    this.source = init.source;
    this.nodes = init.nodes || [];
    this.regions = init.regions || [];
    this.variables = init.variables || [];
    this.sourceMap = init.sourceMap || [];

    const rawNodes = this.nodes.filter((n) => n.kind === "RAW_COMMAND");
    this.diagnostics = {
      errors: init.diagnostics?.errors || [],
      warnings: init.diagnostics?.warnings || [],
      unsupportedCommands: init.diagnostics?.unsupportedCommands || [],
      nodeCount: this.nodes.length,
      rawNodeCount: rawNodes.length,
    };
  }

  /**
   * EXACT SOURCE ROUND TRIP: Reconstructs exact raw source string from sourceMap / source.
   */
  public exportOriginal(): string {
    if (this.source) {
      return this.source;
    }
    return this.nodes.map((n) => n.rawSource).join("\n");
  }

  /**
   * SEMANTIC CONVERSION: Converts the AST nodes into a UniversalLabelDocument.
   */
  public convertToUniversalLabelDocument(): UniversalLabelDocument {
    let widthMm = 50.0;
    let heightMm = 25.0;
    let dpi = 203;

    // Check for canvas width/height in setup nodes
    for (const node of this.nodes) {
      if (node.commandName.startsWith("^PW") && node.parameters[0]) {
        const pwDots = parseInt(node.parameters[0], 10);
        if (!isNaN(pwDots) && pwDots > 0) {
          widthMm = parseFloat((pwDots / 8).toFixed(1)); // 203 DPI = 8 dots/mm
        }
      }
      if (node.commandName === "SIZE" && node.parameters[0] && node.parameters[1]) {
        widthMm = parseFloat(node.parameters[0]) || widthMm;
        heightMm = parseFloat(node.parameters[1]) || heightMm;
      }
    }

    const doc = new UniversalLabelDocument({
      metadata: {
        id: `doc-ast-${Date.now()}`,
        name: `Imported ${this.language} Canvas`,
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      dimensions: {
        widthMm,
        heightMm,
        dpi,
        columns: 1,
        gapMm: 3,
        orientation: "PORTRAIT",
      },
    });

    // Map printable AST nodes into UniversalLabelDocument elements
    const renderableKinds: PRNAstNodeKind[] = ["TEXT", "BARCODE", "QR", "BOX", "LINE", "GRAPHIC", "RAW_COMMAND"];

    for (const node of this.nodes) {
      if (!renderableKinds.includes(node.kind)) continue;

      let elementType: LabelElement["type"] = "TEXT";

      if (node.kind === "BARCODE") elementType = "BARCODE";
      else if (node.kind === "QR") elementType = "QR";
      else if (node.kind === "BOX" || node.kind === "LINE" || node.kind === "GRAPHIC") elementType = "BOX";
      else if (node.kind === "RAW_COMMAND") elementType = "RAW_COMMAND";

      const hasBinding = node.data && node.data.includes("{");

      const element: LabelElement = {
        id: node.id,
        type: elementType,
        x: node.x,
        y: node.y,
        width: node.width || 40,
        height: node.height || 8,
        rotation: node.rotation,
        visible: true,
        zIndex: node.order,
        staticText: hasBinding ? undefined : node.data,
        binding: hasBinding ? { expression: node.data || "" } : undefined,
        symbology: node.symbology,
        rawCommand: node.kind === "RAW_COMMAND" ? node.rawSource : undefined,
        formatting: {
          font: node.font,
          fontSizePt: node.fontSizePt,
          reversePrint: node.reversePrint,
          commandName: node.commandName,
        },
      };

      doc.addElement(element);
    }

    return doc;
  }
}

export class PRNAstParserService {
  public parse(rawSource: string, overrideLanguage?: DetectedPrinterLanguage): PRNAstDocument {
    if (!rawSource || rawSource.trim().length === 0) {
      return new PRNAstDocument({
        language: "RAW",
        source: "",
        nodes: [],
        diagnostics: { errors: [], warnings: ["Empty PRN source provided."], unsupportedCommands: [], nodeCount: 0, rawNodeCount: 0 },
      });
    }

    const tokenRes = PRNAstTokenizer.tokenize(rawSource, overrideLanguage);
    const lang = tokenRes.language;
    const tokens = tokenRes.tokens;

    const nodes: PRNAstNode[] = [];
    const variables: PRNAstVariableReference[] = [];
    const unsupportedCommands: string[] = [];
    const warnings: string[] = [];
    const sourceMap: Array<{ order: number; offset: number; length: number; raw: string }> = [];

    let currentX = 0; // mm
    let currentY = 0; // mm
    let currentFont = "0";
    let currentFontSize = 10;
    let currentRotation: 0 | 90 | 180 | 270 = 0;
    let currentReverse = false;
    let currentBarcodeHeight = 0; // mm
    let currentBarcodeOrientation: 0 | 90 | 180 | 270 = 0;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      sourceMap.push({ order: tok.order, offset: tok.offset, length: tok.length, raw: tok.rawContent });

      if (lang === "ZPL") {
        this.parseZplToken(
          tok,
          nodes,
          variables,
          unsupportedCommands,
          warnings,
          (x, y) => { currentX = x; currentY = y; },
          (font, size, rot, rev) => { currentFont = font; currentFontSize = size; currentRotation = rot; currentReverse = rev; },
          (bHeight, bRot) => { currentBarcodeHeight = bHeight; currentBarcodeOrientation = bRot; },
          currentX,
          currentY,
          currentFont,
          currentFontSize,
          currentRotation,
          currentReverse,
          currentBarcodeHeight,
          currentBarcodeOrientation
        );
      } else {
        // Fallback for non-ZPL languages
        const extractedVars = this.extractPlaceholders(tok.rawContent);
        const node: PRNAstNode = {
          id: `ast-${tok.order}`,
          kind: tok.type === "HEADER_START" || tok.type === "CONTROL" ? "CONTROL" : tok.type === "UNKNOWN" ? "RAW_COMMAND" : "COMMAND",
          rawSource: tok.rawContent,
          commandName: tok.commandName,
          parameters: tok.parameters,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          data: tok.rawContent,
          placeholders: extractedVars.map((v) => v.name),
          offset: tok.offset,
          order: tok.order,
        };

        nodes.push(node);
        extractedVars.forEach((v) => {
          variables.push({ name: v.name, tag: v.tag, nodeId: node.id, offset: tok.offset + v.index });
        });
      }
    }

    // Spatial region detection across parsed nodes
    const regions = this.detectSpatialRegions(nodes);

    return new PRNAstDocument({
      language: lang,
      source: rawSource,
      nodes,
      regions,
      variables,
      diagnostics: {
        errors: [],
        warnings,
        unsupportedCommands,
        nodeCount: nodes.length,
        rawNodeCount: nodes.filter((n) => n.kind === "RAW_COMMAND").length,
      },
      sourceMap,
    });
  }

  private parseZplToken(
    tok: PRNToken,
    nodes: PRNAstNode[],
    variables: PRNAstVariableReference[],
    unsupported: string[],
    warnings: string[],
    setPos: (x: number, y: number) => void,
    setFont: (font: string, size: number, rot: 0 | 90 | 180 | 270, rev: boolean) => void,
    setBarcode: (h: number, rot: 0 | 90 | 180 | 270) => void,
    curX: number,
    curY: number,
    curFont: string,
    curFontSize: number,
    curRot: 0 | 90 | 180 | 270,
    curRev: boolean,
    curBHeight: number,
    curBRot: 0 | 90 | 180 | 270
  ): void {
    const raw = tok.rawContent;

    // 1. ^FO (Field Origin) or ^FT (Field Typeset Origin)
    if (raw.startsWith("^FO") || raw.startsWith("^FT")) {
      const cmdName = raw.substring(0, 3);
      const paramStr = raw.substring(3);
      const parts = paramStr.split(",");
      const dotsX = parseInt(parts[0] || "0", 10);
      const dotsY = parseInt(parts[1] || "0", 10);

      const posX = parseFloat((dotsX / 8).toFixed(1));
      const posY = parseFloat((dotsY / 8).toFixed(1));
      setPos(posX, posY);

      nodes.push({
        id: `ast-${tok.order}`,
        kind: "SETUP",
        rawSource: raw,
        commandName: cmdName,
        parameters: parts,
        x: posX,
        y: posY,
        width: 0,
        height: 0,
        rotation: 0,
        offset: tok.offset,
        order: tok.order,
      });
      return;
    }

    // 2. ^FR (Reverse Print)
    if (raw.startsWith("^FR")) {
      setFont(curFont, curFontSize, curRot, true);
      nodes.push({
        id: `ast-${tok.order}`,
        kind: "SETUP",
        rawSource: raw,
        commandName: "^FR",
        parameters: [],
        x: curX,
        y: curY,
        width: 0,
        height: 0,
        rotation: 0,
        reversePrint: true,
        offset: tok.offset,
        order: tok.order,
      });
      return;
    }

    // 3. ^A (Font Specs, e.g. ^A0N,34,46 or ^AAB,27,15)
    if (raw.startsWith("^A")) {
      const fontMatch = raw.match(/^\^A([A-Z0-9])([NRIB])?,?(\d+)?/i);
      let fontCode = "0";
      let rotDeg: 0 | 90 | 180 | 270 = 0;
      let fontSize = 10;

      if (fontMatch) {
        fontCode = fontMatch[1];
        const rotChar = fontMatch[2] || "N";
        const hDots = parseInt(fontMatch[3] || "28", 10);

        if (rotChar === "R" || rotChar === "B") rotDeg = 90;
        if (rotChar === "I") rotDeg = 180;
        fontSize = Math.round(hDots / 3);

        setFont(fontCode, fontSize, rotDeg, curRev);
      }

      nodes.push({
        id: `ast-${tok.order}`,
        kind: "SETUP",
        rawSource: raw,
        commandName: raw.substring(0, 4),
        parameters: tok.parameters,
        x: curX,
        y: curY,
        width: 0,
        height: 0,
        rotation: rotDeg,
        font: fontCode,
        fontSizePt: fontSize,
        offset: tok.offset,
        order: tok.order,
      });
      return;
    }

    // 4. ^BY (Barcode Default Parameters)
    if (raw.startsWith("^BY")) {
      const paramStr = raw.substring(3);
      const parts = paramStr.split(",");
      const hDots = parseInt(parts[2] || "50", 10);
      setBarcode(parseFloat((hDots / 8).toFixed(1)), curBRot);

      nodes.push({
        id: `ast-${tok.order}`,
        kind: "SETUP",
        rawSource: raw,
        commandName: "^BY",
        parameters: parts,
        x: curX,
        y: curY,
        width: 0,
        height: 0,
        rotation: 0,
        offset: tok.offset,
        order: tok.order,
      });
      return;
    }

    // 5. ^BC (Code128 Barcode, e.g. ^BCB,50,N,N or ^BCN,30,N,N)
    if (raw.startsWith("^BC")) {
      const paramStr = raw.substring(3);
      const rotChar = paramStr.charAt(0) || "N";
      const parts = paramStr.split(",");
      const hDots = parseInt(parts[1] || "50", 10);

      let rotDeg: 0 | 90 | 180 | 270 = 0;
      if (rotChar === "R" || rotChar === "B") rotDeg = 90;
      if (rotChar === "I") rotDeg = 180;

      setBarcode(parseFloat((hDots / 8).toFixed(1)), rotDeg);

      nodes.push({
        id: `ast-${tok.order}`,
        kind: "SETUP",
        rawSource: raw,
        commandName: "^BC",
        parameters: parts,
        x: curX,
        y: curY,
        width: 0,
        height: parseFloat((hDots / 8).toFixed(1)),
        rotation: rotDeg,
        symbology: "CODE128",
        offset: tok.offset,
        order: tok.order,
      });
      return;
    }

    // 6. ^GB (Graphic Box / Solid Fill / Line)
    if (raw.startsWith("^GB")) {
      const paramStr = raw.substring(3);
      const parts = paramStr.split(",");
      const wDots = parseInt(parts[0] || "0", 10);
      const hDots = parseInt(parts[1] || "0", 10);
      const tDots = parseInt(parts[2] || "1", 10);

      const isLine = hDots === 0 || wDots === 0;
      // Solid background fill check (e.g. ^GB76,80,76 or ^GB277,46,46)
      const isSolidFill = tDots >= Math.min(wDots, hDots) || tDots >= wDots / 2;

      nodes.push({
        id: `ast-${tok.order}`,
        kind: isLine ? "LINE" : "BOX",
        rawSource: raw,
        commandName: "^GB",
        parameters: parts,
        x: curX,
        y: curY,
        width: parseFloat((wDots / 8).toFixed(1)),
        height: parseFloat((hDots / 8).toFixed(1)),
        rotation: 0,
        reversePrint: isSolidFill,
        offset: tok.offset,
        order: tok.order,
      });
      return;
    }

    // 7. ^FD (Field Data)
    if (raw.startsWith("^FD")) {
      let dataContent = raw.substring(3);
      if (dataContent.endsWith("^FS")) {
        dataContent = dataContent.slice(0, -3);
      }
      if (dataContent.endsWith("^")) {
        dataContent = dataContent.slice(0, -1);
      }

      const extractedVars = this.extractPlaceholders(dataContent);
      const isBarcode = curBHeight > 0;

      const node: PRNAstNode = {
        id: `ast-${tok.order}`,
        kind: isBarcode ? "BARCODE" : "TEXT",
        rawSource: raw,
        commandName: "^FD",
        parameters: [dataContent],
        x: curX,
        y: curY,
        width: 35,
        height: isBarcode ? curBHeight : 6,
        rotation: isBarcode ? curBRot : curRot,
        font: curFont,
        fontSizePt: curFontSize,
        reversePrint: curRev,
        symbology: isBarcode ? "CODE128" : undefined,
        data: dataContent,
        placeholders: extractedVars.map((v) => v.name),
        offset: tok.offset,
        order: tok.order,
      };

      nodes.push(node);

      extractedVars.forEach((v) => {
        variables.push({ name: v.name, tag: v.tag, nodeId: node.id, offset: tok.offset + v.index });
      });

      // Reset single-field flags
      setBarcode(0, 0);
      setFont(curFont, curFontSize, curRot, false);
      return;
    }

    // 8. ^PQ (Print Quantity)
    if (raw.startsWith("^PQ")) {
      const paramStr = raw.substring(3);
      const parts = paramStr.split(",");
      nodes.push({
        id: `ast-${tok.order}`,
        kind: "PRINT_QUANTITY",
        rawSource: raw,
        commandName: "^PQ",
        parameters: parts,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        data: parts[0] || "1",
        offset: tok.offset,
        order: tok.order,
      });
      return;
    }

    // 9. Setup & Control Commands (^XA, ^XZ, ^PW, ^LH, ^LR, ^CI, ^SZ, ^JMA, ^MCY, ^PMN, ^JZY)
    if (
      raw.startsWith("^XA") ||
      raw.startsWith("^XZ") ||
      raw.startsWith("^PW") ||
      raw.startsWith("^LH") ||
      raw.startsWith("^LR") ||
      raw.startsWith("^CI") ||
      raw.startsWith("^SZ") ||
      raw.startsWith("^JMA") ||
      raw.startsWith("^MCY") ||
      raw.startsWith("^PMN") ||
      raw.startsWith("^JZY")
    ) {
      const cmdName = raw.substring(0, 3);
      const paramStr = raw.substring(3);
      nodes.push({
        id: `ast-${tok.order}`,
        kind: raw.startsWith("^XA") || raw.startsWith("^XZ") ? "CONTROL" : "SETUP",
        rawSource: raw,
        commandName: cmdName,
        parameters: paramStr ? paramStr.split(",") : [],
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        offset: tok.offset,
        order: tok.order,
      });
      return;
    }

    // 10. Fallback for any unknown / unsupported command node
    unsupported.push(raw);
    nodes.push({
      id: `ast-${tok.order}`,
      kind: "RAW_COMMAND",
      rawSource: raw,
      commandName: raw.substring(0, 3),
      parameters: [raw],
      x: curX,
      y: curY,
      width: 0,
      height: 0,
      rotation: 0,
      offset: tok.offset,
      order: tok.order,
    });
  }

  private extractPlaceholders(text: string): Array<{ name: string; tag: string; index: number }> {
    const results: Array<{ name: string; tag: string; index: number }> = [];
    if (!text) return results;

    const regex = /\{([a-zA-Z0-9_\-\.]+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      results.push({
        name: match[1],
        tag: match[0],
        index: match.index,
      });
    }

    return results;
  }

  private detectSpatialRegions(nodes: PRNAstNode[]): PRNAstRegion[] {
    const printableNodes = nodes.filter(
      (n) => n.kind !== "CONTROL" && n.kind !== "SETUP" && n.kind !== "PRINT_QUANTITY" && n.kind !== "RAW_COMMAND"
    );
    if (printableNodes.length === 0) return [];

    const regionMap: Map<string, PRNAstNode[]> = new Map();

    for (const node of printableNodes) {
      let regionKey = "Region_Main_Right";
      if (node.x < 30) {
        regionKey = node.y < 25 ? "Region_Sub_Left_Upper" : "Region_Sub_Left_Lower";
      }

      if (!regionMap.has(regionKey)) {
        regionMap.set(regionKey, []);
      }
      regionMap.get(regionKey)!.push(node);
    }

    let regionIdx = 1;
    const regions: PRNAstRegion[] = [];

    regionMap.forEach((nodeList, key) => {
      const minX = Math.min(...nodeList.map((n) => n.x));
      const maxX = Math.max(...nodeList.map((n) => n.x + (n.width || 10)));
      const minY = Math.min(...nodeList.map((n) => n.y));
      const maxY = Math.max(...nodeList.map((n) => n.y + (n.height || 10)));

      regions.push({
        id: `reg-${regionIdx++}`,
        name: key,
        xMm: minX,
        yMm: minY,
        widthMm: parseFloat((maxX - minX).toFixed(1)),
        heightMm: parseFloat((maxY - minY).toFixed(1)),
        nodeIds: nodeList.map((n) => n.id),
      });
    });

    return regions;
  }

  /**
   * IMPORT PRN PIPELINE: Detect -> Parse -> Extract Vars -> Convert Document -> Return UniversalPrintTemplate
   */
  public importPRN(
    sourceContent: string,
    options?: { templateName?: string; overrideLanguage?: DetectedPrinterLanguage }
  ): UniversalPrintTemplate {
    const ast = this.parse(sourceContent, options?.overrideLanguage);
    const doc = ast.convertToUniversalLabelDocument();

    const tmpl = new UniversalPrintTemplate({
      name: options?.templateName || `Imported ${ast.language} Template`,
      metadata: {
        id: `tmpl-import-${Date.now()}`,
        name: options?.templateName || `Imported ${ast.language} Template`,
        version: "1.0.0",
        sourceFormat: `PRN_${ast.language}` as any,
        sourceType: "IMPORTED_PRN",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      source: {
        originalContent: sourceContent,
        originalFormat: ast.language,
      },
      document: doc.toJSON(),
      status: "ACTIVE",
    });

    // Populate initial unassigned field mappings from extracted variables
    ast.variables.forEach((v) => {
      tmpl.setFieldMapping(v.tag, "");
    });

    return tmpl;
  }
}

export const PRNAstParser = new PRNAstParserService();
