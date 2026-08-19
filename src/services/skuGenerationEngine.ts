/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export type SkuGenerationMode =
  | "SHEET"      // Direct value from Excel / user input
  | "BARCODE"    // Use Barcode value directly as SKU code
  | "AUTO"       // Auto-increment sequence (e.g. SKU-2026-00001)
  | "DERIVED"    // Attribute combination (e.g. {STYLE}-{COLOR}-{SIZE})
  | "FORMULA";   // Custom expression pattern (e.g. {BRAND:3}-{STYLE}-{SIZE})

export interface SkuConfigOptions {
  mode: SkuGenerationMode;
  prefix?: string;
  sequenceStart?: number;
  delimiter?: string;
  derivedFields?: string[];
  formulaPattern?: string;
}

export const DEFAULT_SKU_CONFIG: SkuConfigOptions = {
  mode: "SHEET",
  prefix: "SKU",
  sequenceStart: 1,
  delimiter: "-",
  derivedFields: ["styleCode", "colour", "size"],
  formulaPattern: "{brand:3}-{styleCode}-{size}",
};

/**
 * Evaluates and generates an SKU Code for a given item row based on configured mode.
 */
export function generateSkuCode(
  row: Record<string, any>,
  config: SkuConfigOptions = DEFAULT_SKU_CONFIG,
  index: number = 0
): string {
  const { mode, prefix = "SKU", sequenceStart = 1, delimiter = "-", derivedFields = ["styleCode", "colour", "size"], formulaPattern = "{brand:3}-{styleCode}-{size}" } = config;

  switch (mode) {
    case "BARCODE": {
      const barcode = row.barcode || row.Barcode || row["barcode"] || "";
      return String(barcode).trim();
    }

    case "AUTO": {
      const seq = sequenceStart + index;
      const year = new Date().getFullYear();
      return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
    }

    case "DERIVED": {
      const parts = derivedFields.map((field) => {
        const val = row[field] || row[field.toLowerCase()] || row[field.toUpperCase()] || "";
        return String(val).trim().toUpperCase();
      }).filter(Boolean);

      if (parts.length === 0) {
        // Fallback to style or sheet code if derived parts are empty
        return row.code || row.styleCode || row.barcode || `SKU-${Date.now()}`;
      }
      return parts.join(delimiter);
    }

    case "FORMULA": {
      if (!formulaPattern) return row.code || row.barcode || "";

      // Replace {field} and {field:length} tokens
      const evaluated = formulaPattern.replace(/\{([a-zA-Z0-9_]+)(?::([0-9]+))?\}/g, (_, fieldName, maxLen) => {
        const rawVal = row[fieldName] || row[fieldName.toLowerCase()] || row[fieldName.toUpperCase()] || "";
        const clean = String(rawVal).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (maxLen) {
          const len = parseInt(maxLen, 10);
          return clean.substring(0, len);
        }
        return clean;
      });

      return evaluated.replace(/-+/g, "-").replace(/^-|-$/g, "");
    }

    case "SHEET":
    default: {
      const sheetVal = row.code || row.sku || row["STYLE/Article CODE"] || row["styleCode"] || row.barcode || "";
      return String(sheetVal).trim();
    }
  }
}
