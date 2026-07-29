/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : © SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export interface AISpreadsheetCommand {
  type: "increase_mrp" | "fill_hsn" | "highlight_duplicates" | "enforce_margin" | "format_casing";
  parameter?: number | string;
}

export interface AISpreadsheetResult {
  updatedRowsCount: number;
  highlightedRowIndices: number[];
  summary: string;
}

/**
 * Parses natural language AI prompts into executable spreadsheet commands.
 */
export function parseAIPrompt(prompt: string): AISpreadsheetCommand | null {
  const clean = prompt.trim().toLowerCase();

  // Match "Increase MRP by X%" or "Raise MRP by X%"
  const increaseMrpMatch = clean.match(/(?:increase|raise|up|adjust)\s*(?:all\s*)?mrp\s*by\s*(\d+(?:\.\d+)?)\s*%/);
  if (increaseMrpMatch) {
    return {
      type: "increase_mrp",
      parameter: parseFloat(increaseMrpMatch[1]),
    };
  }

  // Match "Fill missing HSN" or "Default HSN code"
  if (clean.includes("hsn")) {
    const hsnMatch = clean.match(/\b\d{4,8}\b/);
    return {
      type: "fill_hsn",
      parameter: hsnMatch ? hsnMatch[0] : "61091000",
    };
  }

  // Match "Highlight duplicates" or "Find duplicates"
  if (clean.includes("duplicate") || clean.includes("dup")) {
    return {
      type: "highlight_duplicates",
    };
  }

  // Match "Enforce margin" or "Set min margin"
  if (clean.includes("margin")) {
    const marginMatch = clean.match(/(\d+(?:\.\d+)?)\s*%/);
    return {
      type: "enforce_margin",
      parameter: marginMatch ? parseFloat(marginMatch[1]) : 25,
    };
  }

  // Match "Format upper case" or "Capitalize"
  if (clean.includes("uppercase") || clean.includes("capitalize")) {
    return {
      type: "format_casing",
    };
  }

  return null;
}

/**
 * Executes AI spreadsheet commands on an array of row objects.
 */
export function executeAISpreadsheetCommand(
  rows: Record<string, any>[],
  command: AISpreadsheetCommand
): { updatedRows: Record<string, any>[]; result: AISpreadsheetResult } {
  const updatedRows = rows.map((r) => ({ ...r }));
  let updatedRowsCount = 0;
  const highlightedRowIndices: number[] = [];
  let summary = "";

  switch (command.type) {
    case "increase_mrp": {
      const pct = (command.parameter as number) || 0;
      const factor = 1 + pct / 100;
      updatedRows.forEach((r, idx) => {
        const mrp = parseFloat(r.mrp || r.price || 0);
        if (mrp > 0) {
          const newMrp = Math.round(mrp * factor * 100) / 100;
          if (newMrp !== mrp) {
            r.mrp = newMrp.toString();
            updatedRowsCount++;
            highlightedRowIndices.push(idx);
          }
        }
      });
      summary = `Increased MRP by ${pct}% across ${updatedRowsCount} rows.`;
      break;
    }

    case "fill_hsn": {
      const defaultHSN = (command.parameter as string) || "61091000";
      updatedRows.forEach((r, idx) => {
        if (!r.hsnCode || r.hsnCode.trim() === "") {
          r.hsnCode = defaultHSN;
          updatedRowsCount++;
          highlightedRowIndices.push(idx);
        }
      });
      summary = `Filled missing HSN codes with default '${defaultHSN}' across ${updatedRowsCount} rows.`;
      break;
    }

    case "highlight_duplicates": {
      const seenBarcodes = new Map<string, number>();
      updatedRows.forEach((r, idx) => {
        const barcode = (r.barcode || r.code || "").trim();
        if (barcode) {
          if (seenBarcodes.has(barcode)) {
            highlightedRowIndices.push(seenBarcodes.get(barcode)!);
            highlightedRowIndices.push(idx);
            updatedRowsCount++;
          } else {
            seenBarcodes.set(barcode, idx);
          }
        }
      });
      summary = `Identified ${highlightedRowIndices.length} duplicate barcode/SKU rows.`;
      break;
    }

    case "enforce_margin": {
      const minMarginPct = (command.parameter as number) || 25;
      const marginFactor = 1 + minMarginPct / 100;
      updatedRows.forEach((r, idx) => {
        const cost = parseFloat(r.costPrice || 0);
        const price = parseFloat(r.price || 0);
        if (cost > 0) {
          const minPrice = Math.round(cost * marginFactor * 100) / 100;
          if (price < minPrice) {
            r.price = minPrice.toString();
            if (parseFloat(r.mrp || 0) < minPrice) {
              r.mrp = (Math.round(minPrice * 1.2 * 100) / 100).toString();
            }
            updatedRowsCount++;
            highlightedRowIndices.push(idx);
          }
        }
      });
      summary = `Enforced minimum ${minMarginPct}% gross margin on ${updatedRowsCount} rows.`;
      break;
    }

    case "format_casing": {
      updatedRows.forEach((r, idx) => {
        if (r.name) {
          r.name = r.name.toUpperCase();
          updatedRowsCount++;
          highlightedRowIndices.push(idx);
        }
        if (r.code) r.code = r.code.toUpperCase();
      });
      summary = `Converted product names and codes to UPPERCASE across ${updatedRowsCount} rows.`;
      break;
    }
  }

  return {
    updatedRows,
    result: {
      updatedRowsCount,
      highlightedRowIndices: Array.from(new Set(highlightedRowIndices)),
      summary,
    },
  };
}
