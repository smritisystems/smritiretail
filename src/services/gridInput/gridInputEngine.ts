/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.54.0
 * Created      : 2026-10-03
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Global Grid Input & Import Standard
 */

import {
  GridInputProfile,
  GridImportMode,
  GridDuplicatePolicy,
  ParsedGridRow,
  GridInputParseResult,
  GridResolutionProduct,
} from "./types";
import { HeaderMappingEngine } from "../../lib/headerMapping/HeaderMappingEngine";
import { ColumnMappingResult } from "../../lib/headerMapping/types";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export class GridInputEngine {
  /**
   * Universal Delimited Text Parser (Excel Clipboard TSV, CSV, TXT, PDT Tilde/Pipe).
   * Supports RFC 4180 quoted fields, escaped quotes (""), and varied line endings.
   */
  public static parseDelimitedText(
    rawText: string,
    delimiterOverride?: string
  ): { matrix: string[][]; delimiter: string } {
    const clean = (rawText || "").replace(/^\uFEFF/, "").trim();
    if (!clean) {
      return { matrix: [], delimiter: "\t" };
    }

    const lines = clean.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return { matrix: [], delimiter: "\t" };
    }

    // Auto-detect delimiter from first line if not overridden
    let delimiter = delimiterOverride;
    if (!delimiter) {
      const firstLine = lines[0];
      if (firstLine.includes("\t")) {
        delimiter = "\t"; // Excel / Google Sheets Clipboard
      } else if (firstLine.includes("~")) {
        delimiter = "~"; // PDT Tilde format
      } else if (firstLine.includes("|") && !firstLine.includes(",")) {
        delimiter = "|"; // PDT Pipe format
      } else if (firstLine.includes(";")) {
        delimiter = ";"; // European CSV
      } else {
        delimiter = ","; // Standard CSV
      }
    }

    const matrix: string[][] = [];

    for (const line of lines) {
      if (delimiter !== ",") {
        // Simple fast-split for TAB, TILDE, PIPE, SEMICOLON
        matrix.push(line.split(delimiter).map((c) => c.trim()));
        continue;
      }

      // RFC 4180 stateful quote parsing for CSV
      const row: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          row.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      matrix.push(row);
    }

    return { matrix, delimiter };
  }

  /**
   * Maps matrix columns using the authoritative SMRITI HeaderMappingEngine.
   * If headers are absent, falls back to positional alignment using allowed fields.
   */
  public static mapColumns(
    matrix: string[][],
    profile: GridInputProfile
  ): {
    columnMappings: ColumnMappingResult[];
    hasHeaders: boolean;
    headerRowIndex: number;
    dataRows: string[][];
  } {
    if (!matrix || matrix.length === 0) {
      return {
        columnMappings: [],
        hasHeaders: false,
        headerRowIndex: 0,
        dataRows: [],
      };
    }

    const engine = new HeaderMappingEngine(profile.allowedFields);
    const headerInfo = engine.detectHeaderRow(matrix);
    const engineResult = engine.mapHeaders(headerInfo.headers, profile.mappingContext);

    // If at least 1 high-confidence or recognized header, treat as headers
    const recognizedCount =
      engineResult.exactCount +
      engineResult.highCount +
      engineResult.mediumCount +
      engineResult.ambiguousCount;
    const hasHeaders = recognizedCount >= 1;

    if (hasHeaders) {
      const dataRows = matrix.slice(headerInfo.headerRowIndex + 1);
      return {
        columnMappings: engineResult.columns || [],
        hasHeaders: true,
        headerRowIndex: headerInfo.headerRowIndex,
        dataRows,
      };
    }

    // Positional fallback: map positionally to allowed fields
    const positionalMappings: ColumnMappingResult[] = [];
    const maxCols = Math.max(...matrix.map((r) => r.length));

    for (let c = 0; c < maxCols; c++) {
      const targetField = profile.allowedFields[c];
      positionalMappings.push({
        sourceHeader: `Column ${c + 1}`,
        sourceIndex: c,
        mappedFieldKey: targetField ? targetField.key : null,
        mappedFieldLabel: targetField ? targetField.label : null,
        confidence: targetField ? "MEDIUM" : "UNMAPPED",
        confidenceScore: targetField ? 60 : 0,
        isAmbiguous: false,
      });
    }

    return {
      columnMappings: positionalMappings,
      hasHeaders: false,
      headerRowIndex: -1,
      dataRows: matrix,
    };
  }

  /**
   * Transforms raw 2D string data rows into typed, normalized ParsedGridRow structures.
   * Applies profile defaults, number sanitization, and duplicate policies.
   */
  public static buildGridRows(
    dataRows: string[][],
    columnMappings: ColumnMappingResult[],
    profile: GridInputProfile,
    duplicatePolicy: GridDuplicatePolicy = profile.defaultDuplicatePolicy
  ): ParsedGridRow[] {
    const rawParsed: ParsedGridRow[] = [];

    dataRows.forEach((cells, rIdx) => {
      // Skip completely empty rows
      if (cells.length === 0 || cells.every((c) => !c || c.trim() === "")) {
        return;
      }

      const rawValues: Record<string, string> = {};
      const mappedValues: Record<string, any> = {};

      columnMappings.forEach((m) => {
        const val = (cells[m.sourceIndex] || "").trim();
        rawValues[m.sourceHeader || `Col_${m.sourceIndex}`] = val;
        if (m.mappedFieldKey && val) {
          mappedValues[m.mappedFieldKey] = val;
        }
      });

      // Extract Identifier with Priority: barcode -> sku -> code -> product_id
      const barcode = mappedValues["barcode"] || "";
      const sku = mappedValues["sku"] || mappedValues["code"] || mappedValues["item_code"] || "";
      const productId = mappedValues["product_id"] || mappedValues["productId"] || "";

      let identifier = barcode || sku || productId;
      let identifierType: ParsedGridRow["identifierType"] = "AUTO";

      if (barcode) {
        identifierType = "BARCODE";
      } else if (sku) {
        identifierType = "SKU";
      } else if (productId) {
        identifierType = "PRODUCT_ID";
      }

      // Quantity Parsing & Defaults
      let qty = profile.defaultQuantity;
      if (mappedValues["quantity"] !== undefined && mappedValues["quantity"] !== "") {
        const parsedQty = parseFloat(String(mappedValues["quantity"]).replace(/,/g, ""));
        if (!isNaN(parsedQty)) {
          qty = parsedQty;
        }
      }

      // Pricing & Financials
      const parseNum = (val: any): number | undefined => {
        if (val === undefined || val === null || val === "") return undefined;
        const n = parseFloat(String(val).replace(/[,₹$€£\s]/g, ""));
        return isNaN(n) ? undefined : n;
      };

      const mrp = parseNum(mappedValues["mrp"]);
      const sellingPrice = parseNum(mappedValues["price"] || mappedValues["sellingPrice"]);
      const costPrice = parseNum(mappedValues["costPrice"] || mappedValues["rate"]);
      const discount = parseNum(mappedValues["discount"]);
      const taxRate = parseNum(mappedValues["taxRate"] || mappedValues["gstPercentage"]);

      const row: ParsedGridRow = {
        rowNumber: rIdx + 1,
        rawValues,
        mappedValues,
        identifier,
        identifierType,
        quantity: qty,
        rate: costPrice || sellingPrice,
        mrp,
        sellingPrice,
        costPrice,
        discount,
        taxRate,
        uom: mappedValues["uom"] || "NOS",
        batch: mappedValues["batch"],
        expiry: mappedValues["expiry"],
        warehouse: mappedValues["warehouse"],
        resolutionStatus: "PENDING",
      };

      // Validation Checks
      if (!identifier && profile.requireProductResolution) {
        row.resolutionStatus = "VALIDATION_ERROR";
        row.errorCode = "MISSING_IDENTIFIER";
        row.errorMessage = "Missing Barcode or SKU identifier.";
      }

      rawParsed.push(row);
    });

    // Apply Duplicate Policies
    return this.applyDuplicatePolicy(rawParsed, duplicatePolicy);
  }

  /**
   * Applies configurable duplicate handling policies across parsed rows.
   */
  public static applyDuplicatePolicy(
    rows: ParsedGridRow[],
    policy: GridDuplicatePolicy
  ): ParsedGridRow[] {
    if (policy === "ADD_AS_SEPARATE_ROWS") {
      return rows;
    }

    if (policy === "MERGE_ROWS") {
      const mergedMap = new Map<string, ParsedGridRow>();

      rows.forEach((row) => {
        const key = row.identifier.toUpperCase().trim();
        if (!key) {
          mergedMap.set(`row_${row.rowNumber}`, row);
          return;
        }

        const existing = mergedMap.get(key);
        if (existing) {
          existing.quantity += row.quantity;
          if (!existing.warnings) existing.warnings = [];
          existing.warnings.push(`Merged with row #${row.rowNumber} (+${row.quantity} qty)`);
        } else {
          mergedMap.set(key, { ...row });
        }
      });

      return Array.from(mergedMap.values());
    }

    if (policy === "REJECT_DUPLICATE") {
      const seen = new Set<string>();

      return rows.map((row) => {
        const key = row.identifier.toUpperCase().trim();
        if (key && seen.has(key)) {
          return {
            ...row,
            resolutionStatus: "VALIDATION_ERROR",
            errorCode: "DUPLICATE_ROW",
            errorMessage: `Duplicate item '${row.identifier}' rejected per grid policy.`,
          };
        }
        if (key) seen.add(key);
        return row;
      });
    }

    return rows;
  }

  /**
   * Resolves a batch of ParsedGridRows against the backend authoritative ProductResolutionService.
   * Utilizes /api/v1/products/batch-resolve.
   */
  public static async resolveRowsInBatch(
    rows: ParsedGridRow[],
    companyId?: string,
    allowInactive: boolean = false
  ): Promise<ParsedGridRow[]> {
    const unresolved = rows.filter(
      (r) => r.identifier && r.resolutionStatus !== "VALIDATION_ERROR"
    );

    if (unresolved.length === 0) {
      return rows;
    }

    try {
      const payload = {
        items: unresolved.map((r) => ({
          line_no: r.rowNumber,
          identifier: r.identifier,
          identifier_type: r.identifierType === "AUTO" ? null : r.identifierType,
          barcode: r.identifierType === "BARCODE" ? r.identifier : undefined,
          sku: r.identifierType === "SKU" ? r.identifier : undefined,
        })),
        allow_inactive: allowInactive,
      };

      const resp = await apiFetchV1("/products/batch-resolve", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const resultMap = new Map<number, any>();
      if (resp && Array.isArray(resp.results)) {
        resp.results.forEach((res: any, idx: number) => {
          const lineNo = res.error_detail?.line_no || unresolved[idx]?.rowNumber;
          resultMap.set(lineNo, res);
        });
      }

      return rows.map((row) => {
        const res = resultMap.get(row.rowNumber);
        if (!res) {
          return row;
        }

        if (res.success) {
          const resolvedProduct: GridResolutionProduct = {
            productId: res.product_id,
            itemId: res.item_id,
            variantId: res.variant_id,
            sku: res.sku,
            barcode: res.barcode,
            name: res.name,
            brand: res.brand,
            category: res.category,
            uom: res.uom,
            hsnCode: res.hsn_code,
            taxRate: res.tax_rate !== undefined ? parseFloat(String(res.tax_rate)) : 0,
            mrp: res.mrp !== undefined ? parseFloat(String(res.mrp)) : 0,
            sellingPrice: res.selling_price !== undefined ? parseFloat(String(res.selling_price)) : 0,
            costPrice: res.cost_price !== undefined ? parseFloat(String(res.cost_price)) : 0,
            isActive: res.is_active,
            isQuarantined: res.is_quarantined,
          };

          return {
            ...row,
            resolutionStatus: "VALID",
            resolvedProduct,
            mrp: row.mrp !== undefined ? row.mrp : resolvedProduct.mrp,
            sellingPrice: row.sellingPrice !== undefined ? row.sellingPrice : resolvedProduct.sellingPrice,
            costPrice: row.costPrice !== undefined ? row.costPrice : resolvedProduct.costPrice,
            taxRate: row.taxRate !== undefined ? row.taxRate : resolvedProduct.taxRate,
            uom: row.uom || resolvedProduct.uom || "NOS",
          };
        }

        // Error Mapping conforming to SMRITI Human-Readable Error Policy (HREP)
        let status: ParsedGridRow["resolutionStatus"] = "PRODUCT_NOT_FOUND";
        if (res.code === "PRODUCT_INACTIVE") {
          status = "PRODUCT_INACTIVE";
        } else if (res.code === "PRODUCT_QUARANTINED") {
          status = "PRODUCT_QUARANTINED";
        }

        return {
          ...row,
          resolutionStatus: status,
          errorCode: res.code || "PRODUCT_NOT_FOUND",
          errorMessage: res.error_detail?.explanation || res.message || `Product '${row.identifier}' not found in Product List.`,
        };
      });
    } catch (err: any) {
      console.warn("Batch resolution error, falling back to individual resolution:", err);
      return rows;
    }
  }

  /**
   * Applies import mode (APPEND, MERGE, REPLACE) between incoming parsed rows and existing grid rows.
   */
  public static applyImportMode<T extends Record<string, any>>(
    existingRows: T[],
    incomingRows: ParsedGridRow[],
    mode: GridImportMode,
    rowConverter: (parsed: ParsedGridRow, index: number) => T,
    identifierKey: keyof T = "barcode" as keyof T
  ): T[] {
    if (mode === "REPLACE") {
      return incomingRows.map((r, i) => rowConverter(r, i + 1));
    }

    if (mode === "APPEND") {
      const converted = incomingRows.map((r, i) => rowConverter(r, existingRows.length + i + 1));
      return [...existingRows, ...converted];
    }

    if (mode === "MERGE") {
      const result = [...existingRows];
      const existingMap = new Map<string, number>();

      result.forEach((r, idx) => {
        const idVal = String(r[identifierKey] || "").trim().toUpperCase();
        if (idVal) {
          existingMap.set(idVal, idx);
        }
      });

      incomingRows.forEach((incoming) => {
        const idVal = incoming.identifier.trim().toUpperCase();
        const existingIdx = idVal ? existingMap.get(idVal) : undefined;

        if (existingIdx !== undefined) {
          const current = result[existingIdx];
          const currQty = Number(current.quantity || current.qty || 1);
          result[existingIdx] = {
            ...current,
            quantity: currQty + incoming.quantity,
            qty: currQty + incoming.quantity,
          };
        } else {
          result.push(rowConverter(incoming, result.length + 1));
        }
      });

      return result;
    }

    return existingRows;
  }
}
