type SourceType = "SALES_ORDER" | "PACKING_SLIP";

interface SourceQuantityLine {
  source_line_id: string;
  product_id?: string;
  code: string;
  barcodes?: string[];
  remaining_quantity: number | string;
  eligible: boolean;
}

export interface SourceBarcodeQuantityResult {
  quantities: Record<string, string>;
  issues: string[];
  rejectedRows: Array<{
    barcode: string;
    quantity: string;
    reason: string;
    status: "NOT_IN_SO" | "INVALID";
  }>;
}

export function initialSourceBillingQuantities(
  sourceType: SourceType,
  lines: SourceQuantityLine[],
): Record<string, string> {
  return Object.fromEntries(
    lines
      .filter(line => line.eligible && Number(line.remaining_quantity) > 0)
      .map(line => [
        line.source_line_id,
        sourceType === "PACKING_SLIP" ? String(line.remaining_quantity) : "0",
      ]),
  );
}

export function parseSourceBarcodeQuantityCsv(value: string): Array<[string, string]> {
  const rows = value.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  if (!rows.length) throw new Error("Paste barcode and quantity rows before importing.");

  const parsed = rows.map((row, index) => {
    const columns = row.split(/[,\t;]/).map(column => column.trim());
    const isBarcodeHeader = /^(barcode|sku|code)$/i.test(columns[0]);
    if (index === 0 && isBarcodeHeader
      && (columns.length === 1 || /^(qty|quantity)$/i.test(columns[1]))) {
      return null;
    }
    if ((columns.length !== 1 && columns.length !== 2) || !columns[0] || (columns.length === 2 && !columns[1])) {
      throw new Error(`Row ${index + 1} must contain a barcode and an optional quantity.`);
    }
    return [columns[0], columns[1] || "1"] as [string, string];
  }).filter((row): row is [string, string] => row !== null);

  if (!parsed.length) throw new Error("No barcode data rows were found.");
  return parsed;
}

export function applySourceBarcodeQuantityRows(
  rows: Array<[string, string]>,
  lines: SourceQuantityLine[],
  currentQuantities: Record<string, string>,
): SourceBarcodeQuantityResult {
  const updated = { ...currentQuantities };
  const issues: string[] = [];
  const rejectedRows: SourceBarcodeQuantityResult["rejectedRows"] = [];

  for (const [rowNumber, [rawBarcode, rawQuantity]] of rows.entries()) {
    const barcode = rawBarcode.trim().toLocaleUpperCase();
    const quantity = Number(rawQuantity);
    const reject = (reason: string, status: "NOT_IN_SO" | "INVALID" = "INVALID") => {
      issues.push(reason);
      rejectedRows.push({ barcode: rawBarcode.trim(), quantity: rawQuantity, reason, status });
    };
    if (!Number.isFinite(quantity) || quantity <= 0 || Number(quantity.toFixed(4)) !== quantity) {
      reject(`Row ${rowNumber + 1}: quantity must be positive with at most four decimal places; row excluded.`);
      continue;
    }
    const matches = lines.filter(line => [
      line.code,
      ...(line.barcodes || []),
    ].some(value => value.trim().toLocaleUpperCase() === barcode));
    if (!matches.length) {
      reject(`Row ${rowNumber + 1}: barcode ${rawBarcode} is not on the selected Sales Order and was excluded.`, "NOT_IN_SO");
      continue;
    }

    const itemIdentities = new Set(matches.map(line => line.product_id || line.code));
    if (itemIdentities.size > 1) {
      reject(`Row ${rowNumber + 1}: barcode ${rawBarcode} matches different Sales Order items; row excluded.`);
      continue;
    }

    const eligibleMatches = matches.filter(line => line.eligible);
    if (!eligibleMatches.length) {
      reject(`${matches[0].code}: this Sales Order line is not eligible for billing; row excluded.`);
      continue;
    }
    const availableByLine = eligibleMatches.map(line => ({
      line,
      available: Math.max(0, Number(line.remaining_quantity) - Number(updated[line.source_line_id] || 0)),
    }));
    const totalAvailable = availableByLine.reduce((total, entry) => total + entry.available, 0);
    if (quantity > totalAvailable) {
      reject(`${matches[0].code}: requested quantity ${quantity} exceeds total SO Pending Qty ${totalAvailable}; row excluded.`);
      continue;
    }

    let remainingToApply = quantity;
    for (const { line, available } of availableByLine) {
      if (remainingToApply <= 0) break;
      const allocated = Math.min(remainingToApply, available);
      if (allocated <= 0) continue;
      updated[line.source_line_id] = String(Number((Number(updated[line.source_line_id] || 0) + allocated).toFixed(4)));
      remainingToApply = Number((remainingToApply - allocated).toFixed(4));
    }
  }

  return { quantities: updated, issues, rejectedRows };
}
