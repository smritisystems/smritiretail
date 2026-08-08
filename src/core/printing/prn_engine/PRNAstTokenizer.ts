/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — PRN AST Tokenizer
 * Standard     : SCS-PRINT-AST-TOKENIZER-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { PrinterLanguageDetector, DetectedPrinterLanguage } from "./PrinterLanguageDetector.ts";

export type PRNTokenType =
  | "HEADER_START" // ^XA, SIZE, !, \x1B@
  | "HEADER_END"   // ^XZ, PRINT, \x1DV
  | "COMMAND"      // ^FO, ^FT, ^A0N, ^BC, ^GB, TEXT, BARCODE
  | "DATA"         // ^FD...^FS, string literal
  | "CONTROL"      // ^SZ, ^JMA, ^MCY, ^PMN, ^PW, ^PQ, CLS, GAP
  | "UNKNOWN";

export interface PRNToken {
  id: string;
  type: PRNTokenType;
  language: DetectedPrinterLanguage;
  commandName: string; // e.g. "^PW", "^FO", "^FD", "^GB", "SIZE", "TEXT", "BARCODE"
  parameters: string[]; // e.g. ["804"], ["706", "47"], ["76", "80", "76"]
  rawContent: string; // Full raw text substring of this token
  offset: number; // Character index in source
  length: number;
  order: number;
}

export class PRNAstTokenizerService {
  public tokenize(rawSource: string, overrideLanguage?: DetectedPrinterLanguage): {
    language: DetectedPrinterLanguage;
    tokens: PRNToken[];
  } {
    if (!rawSource) {
      return { language: "RAW", tokens: [] };
    }

    const detected = PrinterLanguageDetector.detect(rawSource);
    const lang = overrideLanguage || detected.language;

    let tokens: PRNToken[] = [];

    switch (lang) {
      case "ZPL":
        tokens = this.tokenizeZpl(rawSource);
        break;
      case "TSPL":
        tokens = this.tokenizeTspl(rawSource);
        break;
      case "EPL":
        tokens = this.tokenizeEpl(rawSource);
        break;
      case "CPCL":
        tokens = this.tokenizeCpcl(rawSource);
        break;
      case "ESC_POS":
        tokens = this.tokenizeEscPos(rawSource);
        break;
      default:
        tokens = this.tokenizeRawFallback(rawSource, lang);
        break;
    }

    return { language: lang, tokens };
  }

  private tokenizeZpl(source: string): PRNToken[] {
    const tokens: PRNToken[] = [];
    // Regex matching ZPL commands: ^ or ~ followed by 1-3 alphabetic letters or A0 font codes
    const zplRegex = /(\^|\~)([A-Z]{1,3}|A[0-9][NRIB]?)([^\^~\r\n]*)/gi;
    let match: RegExpExecArray | null;
    let order = 0;

    while ((match = zplRegex.exec(source)) !== null) {
      order++;
      const fullRaw = match[0];
      const prefix = match[1];
      const cmdLetters = match[2].toUpperCase();
      let rawParamStr = (match[3] || "").trim();

      const cmd = prefix + cmdLetters;

      let type: PRNTokenType = "COMMAND";
      if (cmd === "^XA") type = "HEADER_START";
      else if (cmd === "^XZ") type = "HEADER_END";
      else if (["^SZ", "^JMA", "^MCY", "^PMN", "^PW", "^JZY", "^LH", "^LR", "^CI", "^PQ"].some((c) => cmd.startsWith(c))) {
        type = "CONTROL";
      } else if (cmd.startsWith("^FD")) {
        type = "DATA";
      }

      if (rawParamStr.endsWith("^FS")) {
        rawParamStr = rawParamStr.slice(0, -3);
      }

      const params = rawParamStr ? rawParamStr.split(",").map((p) => p.trim()) : [];

      tokens.push({
        id: `tok-zpl-${order}`,
        type,
        language: "ZPL",
        commandName: cmd,
        parameters: params,
        rawContent: fullRaw,
        offset: match.index,
        length: fullRaw.length,
        order,
      });
    }

    if (tokens.length === 0 && source.length > 0) {
      tokens.push({
        id: `tok-zpl-fallback`,
        type: "UNKNOWN",
        language: "ZPL",
        commandName: "RAW",
        parameters: [],
        rawContent: source,
        offset: 0,
        length: source.length,
        order: 1,
      });
    }

    return tokens;
  }

  private tokenizeTspl(source: string): PRNToken[] {
    const tokens: PRNToken[] = [];
    const lines = source.split(/\r?\n/);
    let order = 0;
    let currentOffset = 0;

    for (const line of lines) {
      const lineLen = line.length + 1;
      const trimmed = line.trim();
      if (trimmed) {
        order++;
        const parts = trimmed.split(/\s+/);
        const cmdName = parts[0].toUpperCase();
        const rawParams = trimmed.substring(cmdName.length).trim();
        const params = rawParams ? rawParams.split(",").map((p) => p.replace(/^["']|["']$/g, "").trim()) : [];

        let type: PRNTokenType = "COMMAND";
        if (["SIZE", "GAP", "CLS", "DIRECTION", "OFFSET"].includes(cmdName)) {
          type = "CONTROL";
        } else if (cmdName === "PRINT") {
          type = "HEADER_END";
        }

        tokens.push({
          id: `tok-tspl-${order}`,
          type,
          language: "TSPL",
          commandName: cmdName,
          parameters: params,
          rawContent: trimmed,
          offset: currentOffset,
          length: trimmed.length,
          order,
        });
      }
      currentOffset += lineLen;
    }

    return tokens;
  }

  private tokenizeEpl(source: string): PRNToken[] {
    const tokens: PRNToken[] = [];
    const lines = source.split(/\r?\n/);
    let order = 0;
    let currentOffset = 0;

    for (const line of lines) {
      const lineLen = line.length + 1;
      const trimmed = line.trim();
      if (trimmed) {
        order++;
        const cmdChar = trimmed.substring(0, 1).toUpperCase();
        const rawParams = trimmed.substring(1);
        const params = rawParams ? rawParams.split(",").map((p) => p.replace(/^["']|["']$/g, "").trim()) : [];

        let type: PRNTokenType = "COMMAND";
        if (cmdChar === "N") type = "HEADER_START";
        else if (cmdChar === "P") type = "HEADER_END";

        tokens.push({
          id: `tok-epl-${order}`,
          type,
          language: "EPL",
          commandName: cmdChar,
          parameters: params,
          rawContent: trimmed,
          offset: currentOffset,
          length: trimmed.length,
          order,
        });
      }
      currentOffset += lineLen;
    }

    return tokens;
  }

  private tokenizeCpcl(source: string): PRNToken[] {
    const tokens: PRNToken[] = [];
    const lines = source.split(/\r?\n/);
    let order = 0;
    let currentOffset = 0;

    for (const line of lines) {
      const lineLen = line.length + 1;
      const trimmed = line.trim();
      if (trimmed) {
        order++;
        const parts = trimmed.split(/\s+/);
        const cmdName = parts[0].toUpperCase();

        let type: PRNTokenType = "COMMAND";
        if (cmdName.startsWith("!")) type = "HEADER_START";
        else if (cmdName === "PRINT" || cmdName === "FORM") type = "HEADER_END";

        tokens.push({
          id: `tok-cpcl-${order}`,
          type,
          language: "CPCL",
          commandName: cmdName,
          parameters: parts.slice(1),
          rawContent: trimmed,
          offset: currentOffset,
          length: trimmed.length,
          order,
        });
      }
      currentOffset += lineLen;
    }

    return tokens;
  }

  private tokenizeEscPos(source: string): PRNToken[] {
    const tokens: PRNToken[] = [];
    const lines = source.split(/\r?\n/);
    let order = 0;
    let currentOffset = 0;

    for (const line of lines) {
      const lineLen = line.length + 1;
      if (line.length > 0) {
        order++;
        tokens.push({
          id: `tok-escpos-${order}`,
          type: line.includes("\x1B@") ? "HEADER_START" : line.includes("\x1DV") ? "HEADER_END" : "COMMAND",
          language: "ESC_POS",
          commandName: line.includes("\x1B@") ? "ESC_INIT" : "LINE",
          parameters: [line],
          rawContent: line,
          offset: currentOffset,
          length: line.length,
          order,
        });
      }
      currentOffset += lineLen;
    }

    return tokens;
  }

  private tokenizeRawFallback(source: string, lang: DetectedPrinterLanguage): PRNToken[] {
    return [
      {
        id: `tok-raw-1`,
        type: "UNKNOWN",
        language: lang,
        commandName: "RAW_STREAM",
        parameters: [],
        rawContent: source,
        offset: 0,
        length: source.length,
        order: 1,
      },
    ];
  }
}

export const PRNAstTokenizer = new PRNAstTokenizerService();
