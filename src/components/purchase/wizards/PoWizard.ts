/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Studio — PO Creation Wizard (3-Step)
 * Standard     : SXP Constitution v1.0 / SWEF P-007
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0  (Sprint 5 — Wave 1)
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Steps:
 *   Step 1 — Supplier + Barcode/SKU
 *   Step 2 — Qty, Rate, HSN, GST rate, Delivery date
 *   Step 3 — Review + Submit
 *
 * This file has zero UI code. It exports pure payload types and
 * validation/builder functions consumed by PurchaseCommandFacade and tests.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PoWizardLine {
  skuId:       string;
  description: string;
  qty:         number;
  unitCost:    number;
  hsnCode:     string;
  gstRate:     number;   // percentage, e.g. 18 = 18%
}

export interface PoWizardPayload {
  supplierId:            string;
  supplierName:          string;
  warehouseId:           string;
  lines:                 PoWizardLine[];
  expectedDeliveryDate?: string;   // ISO YYYY-MM-DD, optional
  notes?:                string;
}

export interface PoBuiltLine {
  id:          string;
  itemId:      string;
  itemCode:    string;
  itemName:    string;
  hsnCode:     string;
  orderedQty:  number;
  receivedQty: number;
  unitPrice:   number;
  taxRate:     number;
  taxAmount:   number;
  totalAmount: number;
}

export interface PoBuiltRecord {
  supplierId:            string;
  supplierName:          string;
  warehouseId:           string;
  orderDate:             string;
  expectedDeliveryDate?: string;
  notes?:                string;
  status:                "Draft";
  lines:                 PoBuiltLine[];
  totalAmount:           number;
  totalTaxAmount:        number;
  netPayable:            number;
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates a PO wizard payload.
 * Returns an array of validation error strings.
 * Empty array = payload is valid and ready to submit.
 *
 * Step 1 validations: supplierId, supplierName, warehouseId, at least one line.
 * Step 2 validations: per-line qty, unitCost, skuId, description, hsnCode, gstRate.
 * Step 3 is review-only — no additional field validation required.
 */
export function validatePoPayload(p: Partial<PoWizardPayload>): string[] {
  const errors: string[] = [];

  // ── Step 1 ─────────────────────────────────────────────────────────────────
  if (!p.supplierId?.trim())   errors.push("Supplier is required.");
  if (!p.supplierName?.trim()) errors.push("Supplier name is required.");
  if (!p.warehouseId?.trim())  errors.push("Warehouse is required.");

  if (!p.lines || p.lines.length === 0) {
    errors.push("At least one line item is required.");
    return errors;   // no point validating empty lines array
  }

  // ── Step 2 (per line) ──────────────────────────────────────────────────────
  p.lines.forEach((line, idx) => {
    const n = idx + 1;
    if (!line.skuId?.trim())       errors.push(`Line ${n}: SKU / Barcode is required.`);
    if (!line.description?.trim()) errors.push(`Line ${n}: Description is required.`);
    if (!(line.qty > 0))           errors.push(`Line ${n}: Quantity must be greater than 0.`);
    if (!(line.unitCost > 0))      errors.push(`Line ${n}: Unit cost must be greater than 0.`);
    if (!line.hsnCode?.trim())     errors.push(`Line ${n}: HSN code is required.`);
    if (typeof line.gstRate !== "number" || line.gstRate < 0)
                                   errors.push(`Line ${n}: GST rate cannot be negative.`);
  });

  return errors;
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Converts a validated PoWizardPayload into a PoBuiltRecord
 * ready for PurchaseCommandFacade → IPurchaseService.savePO().
 *
 * All monetary values rounded to 2 decimal places.
 */
export function buildPoFromWizard(p: PoWizardPayload): PoBuiltRecord {
  const orderDate = new Date().toISOString().slice(0, 10);

  const lines: PoBuiltLine[] = p.lines.map((line, idx) => {
    const net        = Math.round(line.qty * line.unitCost * 100) / 100;
    const taxAmount  = Math.round(net * (line.gstRate / 100) * 100) / 100;
    const totalAmount = Math.round((net + taxAmount) * 100) / 100;
    return {
      id:          `pol-${idx + 1}`,
      itemId:      line.skuId,
      itemCode:    line.skuId,
      itemName:    line.description,
      hsnCode:     line.hsnCode,
      orderedQty:  line.qty,
      receivedQty: 0,
      unitPrice:   line.unitCost,
      taxRate:     line.gstRate,
      taxAmount,
      totalAmount,
    };
  });

  const totalAmount    = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.orderedQty, 0) * 100) / 100;
  const totalTaxAmount = Math.round(lines.reduce((s, l) => s + l.taxAmount, 0) * 100) / 100;
  const netPayable     = Math.round((totalAmount + totalTaxAmount) * 100) / 100;

  return {
    supplierId:           p.supplierId,
    supplierName:         p.supplierName,
    warehouseId:          p.warehouseId,
    orderDate,
    expectedDeliveryDate: p.expectedDeliveryDate,
    notes:                p.notes,
    status:               "Draft",
    lines,
    totalAmount,
    totalTaxAmount,
    netPayable,
  };
}
