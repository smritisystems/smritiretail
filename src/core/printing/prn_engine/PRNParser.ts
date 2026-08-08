/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-005 (PRN Parser Engine v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { UniversalLabelDocument, LabelElement } from "../models/UniversalLabelDocument.ts";
import { PrinterLanguageDetector, DetectedPrinterLanguage } from "./PrinterLanguageDetector.ts";

export interface ParseResult {
  document: UniversalLabelDocument;
  detectedLanguage: DetectedPrinterLanguage;
  confidence: number;
  unparsedCommands: string[];
  warnings: string[];
  rawSourcePreserved: boolean;
}

export class PRNParserService {
  public parse(rawPrn: string, overrideLanguage?: DetectedPrinterLanguage): ParseResult {
    const warnings: string[] = [];
    const unparsedCommands: string[] = [];

    const detection = PrinterLanguageDetector.detect(rawPrn);
    const lang = overrideLanguage || detection.language;

    const doc = new UniversalLabelDocument({
      metadata: {
        id: `parsed-${Date.now()}`,
        name: `Imported ${lang} Template`,
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    if (lang === "SBPL" || lang === "DPL") {
      warnings.push(`Language '${lang}' is currently SUPPORTED_FOR_DETECTION_ONLY. Source preserved as RAW_COMMAND element.`);
      doc.addElement({
        id: "raw-1",
        type: "RAW_COMMAND",
        x: 0,
        y: 0,
        width: doc.dimensions.widthMm,
        height: doc.dimensions.heightMm,
        rotation: 0,
        visible: true,
        zIndex: 1,
        rawCommand: rawPrn,
      });
      return {
        document: doc,
        detectedLanguage: lang,
        confidence: detection.confidence,
        unparsedCommands: [],
        warnings,
        rawSourcePreserved: true,
      };
    }

    switch (lang) {
      case "ZPL":
        this.parseZpl(rawPrn, doc, unparsedCommands, warnings);
        break;
      case "TSPL":
        this.parseTspl(rawPrn, doc, unparsedCommands, warnings);
        break;
      case "EPL":
        this.parseEpl(rawPrn, doc, unparsedCommands, warnings);
        break;
      case "CPCL":
        this.parseCpcl(rawPrn, doc, unparsedCommands, warnings);
        break;
      case "ESC_POS":
        this.parseEscPos(rawPrn, doc, unparsedCommands, warnings);
        break;
      default:
        // RAW fallback
        doc.addElement({
          id: `raw-${Date.now()}`,
          type: "RAW_COMMAND",
          x: 0,
          y: 0,
          width: doc.dimensions.widthMm,
          height: doc.dimensions.heightMm,
          rotation: 0,
          visible: true,
          zIndex: 1,
          rawCommand: rawPrn,
        });
        break;
    }

    // Preserve any unparsed command blocks as RAW_COMMAND elements so original source is NEVER lost
    if (unparsedCommands.length > 0) {
      doc.addElement({
        id: `raw-unparsed-${Date.now()}`,
        type: "RAW_COMMAND",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        visible: true,
        zIndex: 99,
        rawCommand: unparsedCommands.join("\n"),
      });
    }

    return {
      document: doc,
      detectedLanguage: lang,
      confidence: detection.confidence,
      unparsedCommands,
      warnings,
      rawSourcePreserved: true,
    };
  }

  private parseZpl(
    zpl: string,
    doc: UniversalLabelDocument,
    unparsed: string[],
    warnings: string[]
  ): void {
    // Check for width and height commands (^PW, ^LL)
    const pwMatch = zpl.match(/\^PW(\d+)/i);
    if (pwMatch) {
      const dots = parseInt(pwMatch[1], 10);
      doc.dimensions.widthMm = parseFloat((dots / 8).toFixed(1)); // assuming 203 dpi (8 dots/mm)
    }

    const llMatch = zpl.match(/\^LL(\d+)/i);
    if (llMatch) {
      const dots = parseInt(llMatch[1], 10);
      doc.dimensions.heightMm = parseFloat((dots / 8).toFixed(1));
    }

    // Match text and barcode field commands in ZPL
    // e.g. ^FO50,50^A0N,36,36^FD{product.name}^FS
    const fieldRegex = /\^FO(\d+),(\d+)(.*?)\^FD([^\^]*)\^FS/gi;
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = fieldRegex.exec(zpl)) !== null) {
      count++;
      const xDots = parseInt(match[1], 10);
      const yDots = parseInt(match[2], 10);
      const options = match[3];
      const textVal = match[4];

      const xMm = parseFloat((xDots / 8).toFixed(1));
      const yMm = parseFloat((yDots / 8).toFixed(1));

      if (options.includes("^BC") || options.includes("^BY")) {
        // Barcode element
        doc.addElement({
          id: `bcode-${count}`,
          type: "BARCODE",
          x: xMm,
          y: yMm,
          width: 40,
          height: 15,
          rotation: 0,
          visible: true,
          zIndex: count,
          staticText: textVal.startsWith("{") ? undefined : textVal,
          binding: textVal.startsWith("{") ? { expression: textVal } : undefined,
          symbology: "CODE128",
        });
      } else {
        // Text element
        doc.addElement({
          id: `txt-${count}`,
          type: "TEXT",
          x: xMm,
          y: yMm,
          width: 40,
          height: 8,
          rotation: 0,
          visible: true,
          zIndex: count,
          staticText: textVal.startsWith("{") ? undefined : textVal,
          binding: textVal.startsWith("{") ? { expression: textVal } : undefined,
        });
      }
    }

    if (count === 0 && zpl.length > 0) {
      unparsed.push(zpl);
      warnings.push("ZPL command script did not contain standard ^FO...^FD...^FS field blocks. Preserved as RAW_COMMAND.");
    }
  }

  private parseTspl(
    tspl: string,
    doc: UniversalLabelDocument,
    unparsed: string[],
    warnings: string[]
  ): void {
    const lines = tspl.split(/\r?\n/);
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const sizeMatch = trimmed.match(/^SIZE\s+(\d+(\.\d+)?)\s*(mm)?,\s*(\d+(\.\d+)?)\s*(mm)?/i);
      if (sizeMatch) {
        doc.dimensions.widthMm = parseFloat(sizeMatch[1]);
        doc.dimensions.heightMm = parseFloat(sizeMatch[4]);
        continue;
      }

      const textMatch = trimmed.match(/^TEXT\s+(\d+),(\d+),"[^"]*",\d+,\d+,\d+,"([^"]*)"/i);
      if (textMatch) {
        count++;
        const xDots = parseInt(textMatch[1], 10);
        const yDots = parseInt(textMatch[2], 10);
        const content = textMatch[3];

        doc.addElement({
          id: `tspl-txt-${count}`,
          type: "TEXT",
          x: parseFloat((xDots / 8).toFixed(1)),
          y: parseFloat((yDots / 8).toFixed(1)),
          width: 35,
          height: 6,
          rotation: 0,
          visible: true,
          zIndex: count,
          staticText: content.startsWith("{") ? undefined : content,
          binding: content.startsWith("{") ? { expression: content } : undefined,
        });
        continue;
      }

      const bcodeMatch = trimmed.match(/^BARCODE\s+(\d+),(\d+),"[^"]*",\d+,\d+,\d+,\d+,\d+,"([^"]*)"/i);
      if (bcodeMatch) {
        count++;
        const xDots = parseInt(bcodeMatch[1], 10);
        const yDots = parseInt(bcodeMatch[2], 10);
        const content = bcodeMatch[3];

        doc.addElement({
          id: `tspl-bcode-${count}`,
          type: "BARCODE",
          x: parseFloat((xDots / 8).toFixed(1)),
          y: parseFloat((yDots / 8).toFixed(1)),
          width: 40,
          height: 12,
          rotation: 0,
          visible: true,
          zIndex: count,
          staticText: content.startsWith("{") ? undefined : content,
          binding: content.startsWith("{") ? { expression: content } : undefined,
          symbology: "CODE128",
        });
        continue;
      }

      // If line not matching standard TEXT/BARCODE/SIZE, record as unparsed command
      if (!trimmed.startsWith("CLS") && !trimmed.startsWith("PRINT") && !trimmed.startsWith("GAP")) {
        unparsed.push(trimmed);
      }
    }

    if (count === 0) {
      warnings.push("TSPL script did not contain recognized TEXT or BARCODE lines. Unparsed lines stored in RAW_COMMAND element.");
    }
  }

  private parseEpl(
    epl: string,
    doc: UniversalLabelDocument,
    unparsed: string[],
    warnings: string[]
  ): void {
    const lines = epl.split(/\r?\n/);
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const aMatch = trimmed.match(/^A(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),([NR]),"([^"]*)"/i);
      if (aMatch) {
        count++;
        const xDots = parseInt(aMatch[1], 10);
        const yDots = parseInt(aMatch[2], 10);
        const content = aMatch[8];

        doc.addElement({
          id: `epl-txt-${count}`,
          type: "TEXT",
          x: parseFloat((xDots / 8).toFixed(1)),
          y: parseFloat((yDots / 8).toFixed(1)),
          width: 30,
          height: 6,
          rotation: 0,
          visible: true,
          zIndex: count,
          staticText: content.startsWith("{") ? undefined : content,
          binding: content.startsWith("{") ? { expression: content } : undefined,
        });
        continue;
      }

      if (!trimmed.startsWith("N") && !trimmed.startsWith("P")) {
        unparsed.push(trimmed);
      }
    }

    if (count === 0) {
      warnings.push("EPL script contained no parsed ASCII text commands. Preserved as RAW_COMMAND.");
    }
  }

  private parseCpcl(
    cpcl: string,
    doc: UniversalLabelDocument,
    unparsed: string[],
    warnings: string[]
  ): void {
    unparsed.push(cpcl);
    warnings.push("CPCL layout commands preserved in RAW_COMMAND element.");
  }

  private parseEscPos(
    escpos: string,
    doc: UniversalLabelDocument,
    unparsed: string[],
    warnings: string[]
  ): void {
    unparsed.push(escpos);
    warnings.push("ESC/POS binary stream preserved in RAW_COMMAND element.");
  }
}

export const PRNParser = new PRNParserService();
