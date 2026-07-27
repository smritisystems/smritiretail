/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Spreadsheet Platform (SSP)
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

export interface ClipboardColumnMapping {
  key: string;
  label: string;
}

export interface ParsedClipboardResult {
  rows: Record<string, any>[];
  rowCount: number;
  columnCount: number;
}

/**
 * Enterprise Clipboard Engine for MS Excel, Google Sheets, TSV, and CSV parsing.
 * Supports pasting 5,000+ rows directly into SMRITI Spreadsheet Platform.
 */
export function parseClipboardData(
  clipboardText: string,
  columns: ClipboardColumnMapping[]
): ParsedClipboardResult {
  if (!clipboardText || clipboardText.trim() === "") {
    return { rows: [], rowCount: 0, columnCount: 0 };
  }

  const lines = clipboardText.split(/\r\n|\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) {
    return { rows: [], rowCount: 0, columnCount: 0 };
  }

  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const parsedRows: Record<string, any>[] = [];
  let maxCols = 0;

  lines.forEach((line) => {
    const rawValues = line.split(delimiter);
    maxCols = Math.max(maxCols, rawValues.length);
    const rowObj: Record<string, any> = {};

    columns.forEach((col, idx) => {
      rowObj[col.key] = rawValues[idx] !== undefined ? rawValues[idx].trim().replace(/^"|"$/g, "") : "";
    });

    parsedRows.push(rowObj);
  });

  return {
    rows: parsedRows,
    rowCount: parsedRows.length,
    columnCount: maxCols,
  };
}
