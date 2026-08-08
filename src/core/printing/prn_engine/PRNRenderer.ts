/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-006 (PRN Renderer Engine v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { UniversalLabelDocument, LabelElement } from "../models/UniversalLabelDocument.ts";
import { LabelFieldBindingEngine } from "../fields/LabelFieldBindingEngine.ts";
import { DetectedPrinterLanguage } from "./PrinterLanguageDetector.ts";

export interface RenderResult {
  status: "SUCCESS" | "WARNING" | "NOT_IMPLEMENTED" | "FAILED";
  language: DetectedPrinterLanguage;
  rawStream: string;
  diagnostics: string[];
  unsupportedElements: Array<{ elementId: string; type: string; reason: string }>;
  warnings: string[];
  elementCount: number;
}

export interface RenderOptions {
  language: DetectedPrinterLanguage;
  dataContext?: Record<string, any>;
  dpi?: number;
  copies?: number;
}

export class PRNRendererService {
  public render(doc: UniversalLabelDocument, options: RenderOptions): RenderResult {
    const lang = options.language || "ZPL";
    const dataContext = options.dataContext || {};
    const dpi = options.dpi || doc.dimensions.dpi || 203;
    const copies = options.copies || 1;

    const diagnostics: string[] = [];
    const warnings: string[] = [];
    const unsupportedElements: Array<{ elementId: string; type: string; reason: string }> = [];

    diagnostics.push(`Target language: ${lang}, DPI: ${dpi}, Copies: ${copies}`);

    if (lang === "SBPL" || lang === "DPL") {
      return {
        status: "NOT_IMPLEMENTED",
        language: lang,
        rawStream: "",
        diagnostics,
        unsupportedElements: [],
        warnings: [`Printer language '${lang}' rendering is not implemented in v1.0 Kernel.`],
        elementCount: 0,
      };
    }

    let rawStream = "";

    switch (lang) {
      case "ZPL":
        rawStream = this.renderZpl(doc, dataContext, dpi, copies, warnings, unsupportedElements);
        break;
      case "TSPL":
        rawStream = this.renderTspl(doc, dataContext, dpi, copies, warnings, unsupportedElements);
        break;
      case "EPL":
        rawStream = this.renderEpl(doc, dataContext, dpi, copies, warnings, unsupportedElements);
        break;
      case "CPCL":
        rawStream = this.renderCpcl(doc, dataContext, dpi, copies, warnings, unsupportedElements);
        break;
      case "ESC_POS":
        rawStream = this.renderEscPos(doc, dataContext, dpi, copies, warnings, unsupportedElements);
        break;
      default:
        rawStream = this.renderRawFallback(doc, dataContext, warnings);
        break;
    }

    const status = unsupportedElements.length > 0 || warnings.length > 0 ? "WARNING" : "SUCCESS";

    return {
      status,
      language: lang,
      rawStream,
      diagnostics,
      unsupportedElements,
      warnings,
      elementCount: doc.elements.length,
    };
  }

  private resolveElementText(el: LabelElement, ctx: Record<string, any>): string {
    if (el.binding && el.binding.expression) {
      const res = LabelFieldBindingEngine.evaluateExpression(el.binding.expression, ctx);
      if (res.value) return res.value;
      if (el.binding.fallback) return el.binding.fallback;
    }
    if (el.staticText !== undefined) return el.staticText;
    return "";
  }

  private mmToDots(mm: number, dpi: number): number {
    const dotsPerMm = dpi / 25.4;
    return Math.round(mm * dotsPerMm);
  }

  private renderZpl(
    doc: UniversalLabelDocument,
    ctx: Record<string, any>,
    dpi: number,
    copies: number,
    warnings: string[],
    unsupported: Array<{ elementId: string; type: string; reason: string }>
  ): string {
    const wDots = this.mmToDots(doc.dimensions.widthMm, dpi);
    const hDots = this.mmToDots(doc.dimensions.heightMm, dpi);

    const parts: string[] = [];
    parts.push("^XA");
    parts.push(`^PW${wDots}`);
    parts.push(`^LL${hDots}`);
    parts.push("^LH0,0^LRN");

    for (const el of doc.elements) {
      if (!el.visible) continue;

      const x = this.mmToDots(el.x, dpi);
      const y = this.mmToDots(el.y, dpi);
      const text = this.resolveElementText(el, ctx);

      switch (el.type) {
        case "TEXT":
        case "PRICE":
        case "DATE":
        case "TIME":
        case "COUNTER": {
          const fontSize = el.style?.fontSizePt ? Math.round(el.style.fontSizePt * 3) : 28;
          parts.push(`^FO${x},${y}^A0N,${fontSize},${fontSize}^FD${text}^FS`);
          break;
        }
        case "BARCODE": {
          const barHeight = this.mmToDots(el.height || 12, dpi);
          parts.push(`^FO${x},${y}^BY2^BCN,${barHeight},Y,N,N^FD${text || "123456789012"}^FS`);
          break;
        }
        case "QR": {
          parts.push(`^FO${x},${y}^BQN,2,5^FDQA,${text || "https://smritibooks.com"}^FS`);
          break;
        }
        case "DATAMATRIX": {
          parts.push(`^FO${x},${y}^BXN,6,200^FD${text || "SMRITI-DM"}^FS`);
          break;
        }
        case "LINE": {
          const w = this.mmToDots(el.width, dpi);
          const h = this.mmToDots(el.height || 1, dpi);
          parts.push(`^FO${x},${y}^GB${w},${h},${h}^FS`);
          break;
        }
        case "BOX":
        case "RECTANGLE": {
          const w = this.mmToDots(el.width, dpi);
          const h = this.mmToDots(el.height, dpi);
          const border = el.style?.strokeWidthMm ? this.mmToDots(el.style.strokeWidthMm, dpi) : 2;
          parts.push(`^FO${x},${y}^GB${w},${h},${border}^FS`);
          break;
        }
        case "RAW_COMMAND": {
          if (el.rawCommand) {
            parts.push(el.rawCommand);
          }
          break;
        }
        default: {
          unsupported.push({
            elementId: el.id,
            type: el.type,
            reason: `Element type '${el.type}' is rendered as fallback text in ZPL.`,
          });
          warnings.push(`Element '${el.id}' (${el.type}) rendered as fallback string.`);
          parts.push(`^FO${x},${y}^A0N,20,20^FD${text || el.type}^FS`);
          break;
        }
      }
    }

    parts.push(`^PQ${copies},0,1,Y`);
    parts.push("^XZ");

    return parts.join("\n");
  }

  private renderTspl(
    doc: UniversalLabelDocument,
    ctx: Record<string, any>,
    dpi: number,
    copies: number,
    warnings: string[],
    unsupported: Array<{ elementId: string; type: string; reason: string }>
  ): string {
    const parts: string[] = [];
    parts.push(`SIZE ${doc.dimensions.widthMm} mm, ${doc.dimensions.heightMm} mm`);
    parts.push(`GAP ${doc.dimensions.gapMm || 3} mm, 0 mm`);
    parts.push("DIRECTION 1");
    parts.push("CLS");

    for (const el of doc.elements) {
      if (!el.visible) continue;

      const x = this.mmToDots(el.x, dpi);
      const y = this.mmToDots(el.y, dpi);
      const text = this.resolveElementText(el, ctx);

      switch (el.type) {
        case "TEXT":
        case "PRICE":
        case "DATE":
        case "TIME":
        case "COUNTER": {
          parts.push(`TEXT ${x},${y},"0",0,1,1,"${text}"`);
          break;
        }
        case "BARCODE": {
          const h = this.mmToDots(el.height || 12, dpi);
          parts.push(`BARCODE ${x},${y},"128",${h},1,0,2,2,"${text || "123456789012"}"`);
          break;
        }
        case "QR": {
          parts.push(`QRCODE ${x},${y},L,5,A,0,"${text || "https://smritibooks.com"}"`);
          break;
        }
        case "RAW_COMMAND": {
          if (el.rawCommand) parts.push(el.rawCommand);
          break;
        }
        default: {
          unsupported.push({
            elementId: el.id,
            type: el.type,
            reason: `Element type '${el.type}' fallback rendered as TEXT in TSPL.`,
          });
          parts.push(`TEXT ${x},${y},"0",0,1,1,"${text || el.type}"`);
          break;
        }
      }
    }

    parts.push(`PRINT 1,${copies}`);
    return parts.join("\n");
  }

  private renderEpl(
    doc: UniversalLabelDocument,
    ctx: Record<string, any>,
    dpi: number,
    copies: number,
    warnings: string[],
    unsupported: Array<{ elementId: string; type: string; reason: string }>
  ): string {
    const parts: string[] = [];
    parts.push("N"); // Clear buffer

    for (const el of doc.elements) {
      if (!el.visible) continue;
      const x = this.mmToDots(el.x, dpi);
      const y = this.mmToDots(el.y, dpi);
      const text = this.resolveElementText(el, ctx);

      if (el.type === "BARCODE") {
        const h = this.mmToDots(el.height || 12, dpi);
        parts.push(`B${x},${y},0,1,2,2,${h},B,"${text || "123456789012"}"`);
      } else if (el.type === "RAW_COMMAND" && el.rawCommand) {
        parts.push(el.rawCommand);
      } else {
        parts.push(`A${x},${y},0,3,1,1,N,"${text}"`);
      }
    }

    parts.push(`P${copies}`);
    return parts.join("\n");
  }

  private renderCpcl(
    doc: UniversalLabelDocument,
    ctx: Record<string, any>,
    dpi: number,
    copies: number,
    warnings: string[],
    unsupported: Array<{ elementId: string; type: string; reason: string }>
  ): string {
    const parts: string[] = [];
    const hDots = this.mmToDots(doc.dimensions.heightMm, dpi);
    parts.push(`! 0 200 200 ${hDots} ${copies}`);

    for (const el of doc.elements) {
      if (!el.visible) continue;
      const x = this.mmToDots(el.x, dpi);
      const y = this.mmToDots(el.y, dpi);
      const text = this.resolveElementText(el, ctx);

      if (el.type === "BARCODE") {
        parts.push(`BARCODE 128 1 1 50 ${x} ${y} ${text || "123456789012"}`);
      } else if (el.type === "RAW_COMMAND" && el.rawCommand) {
        parts.push(el.rawCommand);
      } else {
        parts.push(`TEXT 7 0 ${x} ${y} ${text}`);
      }
    }

    parts.push("PRINT");
    return parts.join("\n");
  }

  private renderEscPos(
    doc: UniversalLabelDocument,
    ctx: Record<string, any>,
    dpi: number,
    copies: number,
    warnings: string[],
    unsupported: Array<{ elementId: string; type: string; reason: string }>
  ): string {
    const parts: string[] = [];
    parts.push("\x1B\x40"); // ESC @ Init

    for (const el of doc.elements) {
      if (!el.visible) continue;
      const text = this.resolveElementText(el, ctx);

      if (el.type === "RAW_COMMAND" && el.rawCommand) {
        parts.push(el.rawCommand);
      } else {
        parts.push(`${text}\n`);
      }
    }

    parts.push("\x1D\x56\x00"); // GS V Cut
    return parts.join("");
  }

  private renderRawFallback(
    doc: UniversalLabelDocument,
    ctx: Record<string, any>,
    warnings: string[]
  ): string {
    warnings.push("Using raw fallback renderer.");
    const lines: string[] = [];
    for (const el of doc.elements) {
      if (el.type === "RAW_COMMAND" && el.rawCommand) {
        lines.push(el.rawCommand);
      } else {
        const text = this.resolveElementText(el, ctx);
        lines.push(text);
      }
    }
    return lines.join("\n");
  }
}

export const PRNRenderer = new PRNRendererService();
