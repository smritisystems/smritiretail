export type UniversalImportTarget =
  | "ITEM_MASTER"
  | "PRICE_BOOK"
  | "PURCHASE_INWARD"
  | "SALES_ORDER"
  | "SALES_RETURN"
  | "STOCK_ADJUSTMENT"
  | "LABEL_PRINT";

export type UniversalImportTemplateId =
  | "BARCODE_ONLY"
  | "BARCODE_QTY"
  | "BARCODE_PRICES"
  | "ATTRIBUTE_IDENTITY";

export interface UniversalImportTemplate {
  id: UniversalImportTemplateId;
  label: string;
  description: string;
  columns: string[];
  defaultTarget: UniversalImportTarget;
}

export const UNIVERSAL_IMPORT_TEMPLATES: UniversalImportTemplate[] = [
  {
    id: "BARCODE_ONLY",
    label: "Barcode only",
    description: "Look up products using barcode, SKU, or item code.",
    columns: ["Barcode"],
    defaultTarget: "ITEM_MASTER",
  },
  {
    id: "BARCODE_QTY",
    label: "Barcode + Quantity",
    description: "Use for stock, orders, returns, and label quantities.",
    columns: ["Barcode", "Qty"],
    defaultTarget: "STOCK_ADJUSTMENT",
  },
  {
    id: "BARCODE_PRICES",
    label: "Barcode + Prices",
    description: "Update MRP, selling price, and cost price in a Price Book.",
    columns: ["Barcode", "Qty", "MRP", "Selling Price", "Cost Price"],
    defaultTarget: "PRICE_BOOK",
  },
  {
    id: "ATTRIBUTE_IDENTITY",
    label: "Style + Size + Color",
    description: "Find a variant when barcode or SKU is unavailable.",
    columns: ["Style / Article", "Size", "Color", "Brand", "Qty", "MRP", "Selling Price"],
    defaultTarget: "ITEM_MASTER",
  },
];

export type UniversalImportIssueCode =
  | "MISSING_IDENTIFIER"
  | "INCOMPLETE_COMPOSITE_IDENTIFIER"
  | "INVALID_NUMBER"
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "PRICE_ABOVE_MRP"
  | "DUPLICATE_ROW";

export interface UniversalImportInputRow {
  rowNumber: number;
  barcode?: string;
  sku?: string;
  itemCode?: string;
  style?: string;
  article?: string;
  styleArticle?: string;
  size?: string;
  color?: string;
  colour?: string;
  brand?: string;
  name?: string;
  quantity?: string | number;
  qty?: string | number;
  mrp?: string | number;
  sellingPrice?: string | number;
  price?: string | number;
  costPrice?: string | number;
  [key: string]: unknown;
}

export interface UniversalImportRow {
  rowNumber: number;
  identifier: string;
  identifierType: "BARCODE" | "SKU" | "ITEM_CODE" | "STYLE_SIZE_COLOR" | "STYLE_SIZE_COLOR_BRAND";
  identity: {
    styleArticle?: string;
    size?: string;
    color?: string;
    brand?: string;
  };
  name?: string;
  quantity: number;
  mrp?: number;
  sellingPrice?: number;
  costPrice?: number;
  raw: UniversalImportInputRow;
}

export interface UniversalImportIssue {
  rowNumber: number;
  code: UniversalImportIssueCode;
  message: string;
}

export interface UniversalImportResult {
  rows: UniversalImportRow[];
  issues: UniversalImportIssue[];
}

const firstValue = (...values: unknown[]): unknown => {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
};

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const parsed = Number(String(value).replace(/[,₹$€£\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const identifierFor = (row: UniversalImportInputRow): { value: string; type: UniversalImportRow["identifierType"] } => {
  const barcode = String(firstValue(row.barcode) ?? "").trim();
  if (barcode) return { value: barcode, type: "BARCODE" };

  const sku = String(firstValue(row.sku) ?? "").trim();
  if (sku) return { value: sku, type: "SKU" };

  const itemCode = String(firstValue(row.itemCode) ?? "").trim();
  if (itemCode) return { value: itemCode, type: "ITEM_CODE" };

  const styleArticle = String(firstValue(row.styleArticle, row.style, row.article) ?? "").trim();
  const size = String(firstValue(row.size) ?? "").trim();
  const color = String(firstValue(row.color, row.colour) ?? "").trim();
  const brand = String(firstValue(row.brand) ?? "").trim();
  if (styleArticle && size && color) {
    return {
      value: [styleArticle, size, color, brand].filter(Boolean).join("|").toUpperCase(),
      type: brand ? "STYLE_SIZE_COLOR_BRAND" : "STYLE_SIZE_COLOR",
    };
  }

  return { value: "", type: "ITEM_CODE" };
};

/**
 * Normalizes all supported import combinations into one row contract.
 * Resolution and committing are intentionally separate so every module can
 * preview the same rows before it mutates inventory, pricing, or documents.
 */
export function normalizeUniversalImport(
  inputRows: UniversalImportInputRow[],
  target: UniversalImportTarget,
): UniversalImportResult {
  const rows: UniversalImportRow[] = [];
  const issues: UniversalImportIssue[] = [];
  const seen = new Set<string>();

  inputRows.forEach((raw) => {
    const { value: identifier, type: identifierType } = identifierFor(raw);
    const styleArticle = String(firstValue(raw.styleArticle, raw.style, raw.article) ?? "").trim();
    const size = String(firstValue(raw.size) ?? "").trim();
    const color = String(firstValue(raw.color, raw.colour) ?? "").trim();
    const brand = String(firstValue(raw.brand) ?? "").trim();
    const quantityValue = firstValue(raw.quantity, raw.qty);
    const quantity = quantityValue === undefined ? 1 : parseOptionalNumber(quantityValue);
    const mrp = parseOptionalNumber(raw.mrp);
    const sellingPrice = parseOptionalNumber(firstValue(raw.sellingPrice, raw.price));
    const costPrice = parseOptionalNumber(raw.costPrice);

    if (!identifier) {
      const hasCompositePart = Boolean(styleArticle || size || color || brand);
      issues.push({
        rowNumber: raw.rowNumber,
        code: hasCompositePart ? "INCOMPLETE_COMPOSITE_IDENTIFIER" : "MISSING_IDENTIFIER",
        message: hasCompositePart
          ? "Style/Article, Size, and Color are all required when barcode or SKU is not provided."
          : "Barcode, SKU, item code, or Style/Article + Size + Color is required.",
      });
      return;
    }

    if (quantity === undefined) {
      issues.push({ rowNumber: raw.rowNumber, code: "INVALID_QUANTITY", message: "Quantity must be a valid number." });
      return;
    }

    const quantityRequired = ["PURCHASE_INWARD", "SALES_ORDER", "SALES_RETURN", "STOCK_ADJUSTMENT", "LABEL_PRINT"].includes(target);
    if (quantityRequired && quantity <= 0) {
      issues.push({ rowNumber: raw.rowNumber, code: "INVALID_QUANTITY", message: "Quantity must be greater than zero for this activity." });
      return;
    }

    if (mrp === undefined && raw.mrp !== undefined && String(raw.mrp).trim() !== "") {
      issues.push({ rowNumber: raw.rowNumber, code: "INVALID_NUMBER", message: "MRP must be a valid number." });
      return;
    }

    if (sellingPrice === undefined && firstValue(raw.sellingPrice, raw.price) !== undefined) {
      issues.push({ rowNumber: raw.rowNumber, code: "INVALID_PRICE", message: "Selling price must be a valid number." });
      return;
    }

    if (costPrice === undefined && raw.costPrice !== undefined && String(raw.costPrice).trim() !== "") {
      issues.push({ rowNumber: raw.rowNumber, code: "INVALID_PRICE", message: "Cost price must be a valid number." });
      return;
    }

    if (mrp !== undefined && sellingPrice !== undefined && sellingPrice > mrp) {
      issues.push({ rowNumber: raw.rowNumber, code: "PRICE_ABOVE_MRP", message: "Selling price cannot be greater than MRP." });
      return;
    }

    const duplicateKey = `${identifierType}:${identifier}`.toLowerCase();
    if (seen.has(duplicateKey)) {
      issues.push({ rowNumber: raw.rowNumber, code: "DUPLICATE_ROW", message: `Duplicate ${identifierType.toLowerCase()} in import.` });
      return;
    }
    seen.add(duplicateKey);

    rows.push({
      rowNumber: raw.rowNumber,
      identifier,
      identifierType,
      identity: { styleArticle: styleArticle || undefined, size: size || undefined, color: color || undefined, brand: brand || undefined },
      name: raw.name ? String(raw.name).trim() : undefined,
      quantity,
      mrp,
      sellingPrice,
      costPrice,
      raw,
    });
  });

  return { rows, issues };
}

export interface UniversalImportPreviewSummary {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
  newItems: number;
  updates: number;
}

/** Combines repeated scanner reads into one row while preserving the first row's data. */
export function aggregateScannedRows(rows: UniversalImportInputRow[]): UniversalImportInputRow[] {
  const aggregated = new Map<string, UniversalImportInputRow>();

  rows.forEach((row) => {
    const identity = identifierFor(row).value.toLowerCase();
    if (!identity) {
      aggregated.set(`row:${row.rowNumber}`, { ...row });
      return;
    }

    const existing = aggregated.get(identity);
    if (!existing) {
      aggregated.set(identity, { ...row, quantity: parseOptionalNumber(firstValue(row.quantity, row.qty)) ?? 1 });
      return;
    }

    const currentQuantity = parseOptionalNumber(firstValue(existing.quantity, existing.qty)) ?? 1;
    const nextQuantity = parseOptionalNumber(firstValue(row.quantity, row.qty)) ?? 1;
    aggregated.set(identity, { ...existing, quantity: currentQuantity + nextQuantity });
  });

  return Array.from(aggregated.values());
}

export function summarizeUniversalImport(
  result: UniversalImportResult,
  resolvedIdentifiers: Set<string> = new Set(),
): UniversalImportPreviewSummary {
  const errors = result.issues.length;
  const updates = result.rows.filter((row) => resolvedIdentifiers.has(row.identifier.toLowerCase())).length;
  return {
    total: result.rows.length + errors,
    valid: result.rows.length,
    errors,
    warnings: 0,
    newItems: result.rows.length - updates,
    updates,
  };
}