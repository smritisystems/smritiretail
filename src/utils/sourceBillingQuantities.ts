type SourceType = "SALES_ORDER" | "PACKING_SLIP";

interface SourceQuantityLine {
  source_line_id: string;
  code: string;
  barcodes?: string[];
  remaining_quantity: number | string;
  eligible: boolean;
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
    if (index === 0 && columns.length >= 2
      && /^(barcode|sku|code)$/i.test(columns[0])
      && /^(qty|quantity)$/i.test(columns[1])) {
      return null;
    }
    if (columns.length !== 2 || !columns[0] || !columns[1]) {
      throw new Error(`Row ${index + 1} must contain exactly a barcode and quantity.`);
    }
    return [columns[0], columns[1]] as [string, string];
  }).filter((row): row is [string, string] => row !== null);

  if (!parsed.length) throw new Error("No barcode and quantity data rows were found.");
  return parsed;
}

export function applySourceBarcodeQuantityRows(
  rows: Array<[string, string]>,
  lines: SourceQuantityLine[],
  currentQuantities: Record<string, string>,
): Record<string, string> {
  const updated = { ...currentQuantities };

  for (const [rowNumber, [rawBarcode, rawQuantity]] of rows.entries()) {
    const barcode = rawBarcode.trim().toLocaleUpperCase();
    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || Number(quantity.toFixed(4)) !== quantity) {
      throw new Error(`Row ${rowNumber + 1}: quantity must be positive with at most four decimal places.`);
    }
    const matches = lines.filter(line => [
      line.code,
      ...(line.barcodes || []),
    ].some(value => value.trim().toLocaleUpperCase() === barcode));
    if (matches.length !== 1) {
      throw new Error(matches.length
        ? `Row ${rowNumber + 1}: barcode ${rawBarcode} matches multiple source lines.`
        : `Row ${rowNumber + 1}: barcode ${rawBarcode} is not on this source document.`);
    }

    const line = matches[0];
    if (!line.eligible) throw new Error(`${line.code}: this source line is not eligible for billing.`);
    const remaining = Number(line.remaining_quantity);
    const nextQuantity = Number(updated[line.source_line_id] || 0) + quantity;
    if (nextQuantity > remaining) {
      throw new Error(`${line.code}: requested quantity ${nextQuantity} exceeds remaining quantity ${remaining}.`);
    }
    updated[line.source_line_id] = String(Number(nextQuantity.toFixed(4)));
  }

  return updated;
}
