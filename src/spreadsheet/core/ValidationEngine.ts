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

import { isValidGSTIN, isValidPIN } from "../../utils/validators.js";
import { isFormula } from "./FormulaEngine.js";

export type CellValidationStatus = "error" | "warning" | "valid" | "formula";

export interface ValidationIssue {
  rowIndex: number;
  colKey: string;
  severity: "error" | "warning";
  message: string;
}

/**
 * Enterprise Validation Engine for real-time grid cell verification.
 */
export function validateCell(
  row: Record<string, any>,
  colKey: string,
  allRows: Record<string, any>[] = []
): { status: CellValidationStatus; message?: string } {
  const val = (row[colKey] ?? "").toString().trim();

  if (isFormula(val)) {
    return { status: "formula" };
  }

  // 1. GST Percentage Check
  if (colKey === "gstPercentage") {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 50) {
      return { status: "error", message: "GST Rate must be between 0% and 50%" };
    }
  }

  // 2. GSTIN Checksum Verification
  if (colKey === "gstin" && val !== "") {
    if (!isValidGSTIN(val)) {
      return { status: "error", message: "Invalid 15-digit GSTIN or Luhn Modulus 36 checksum" };
    }
  }

  // 3. PIN Code Verification
  if (colKey === "pinCode" && val !== "") {
    if (!isValidPIN(val)) {
      return { status: "error", message: "Invalid 6-digit PIN Code" };
    }
  }

  // 4. Barcode / SKU Duplicate Check
  if ((colKey === "barcode" || colKey === "code") && val !== "") {
    const duplicates = allRows.filter((r) => (r[colKey] ?? "").toString().trim() === val);
    if (duplicates.length > 1) {
      return { status: "warning", message: `Duplicate ${colKey} identifier found across catalog` };
    }
  }

  return { status: "valid" };
}

/**
 * Validates full grid dataset and returns all issues.
 */
export function validateGrid(rows: Record<string, any>[], columns: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  rows.forEach((row, rIdx) => {
    columns.forEach((colKey) => {
      const res = validateCell(row, colKey, rows);
      if (res.status === "error" || res.status === "warning") {
        issues.push({
          rowIndex: rIdx,
          colKey,
          severity: res.status,
          message: res.message || "Validation check failed",
        });
      }
    });
  });

  return issues;
}
