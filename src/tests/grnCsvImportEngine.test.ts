/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.122.0
 * Created      : 2026-09-20
 * Modified     : 2026-09-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";

export interface ParsedGrnCsvRow {
  rowNumber: number;
  barcode: string;
  sku: string;
  name: string;
  size?: string;
  color?: string;
  quantity_received: number;
  quantity_damaged: number;
  invoice_rate: number;
  cost_price?: number;
  mrp?: number;
  gst_rate?: number;
  isValid: boolean;
  errors: string[];
}

function parseInwardCsvOrPdt(text: string): { rows: ParsedGrnCsvRow[]; detectedFormat: "CSV" | "PDT" } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { rows: [], detectedFormat: "CSV" };
  }

  // Detect PDT format (tilde-delimited: barcode~qty or barcode~qty~rate)
  const isPdt = lines.some((l) => l.includes("~"));
  if (isPdt) {
    const rows: ParsedGrnCsvRow[] = [];
    lines.forEach((line, idx) => {
      const parts = line.split("~").map((p) => p.trim());
      const barcode = parts[0] || "";
      const qty = parseFloat(parts[1]) || 1;
      const rate = parseFloat(parts[2]) || 0;

      const errors: string[] = [];
      if (!barcode) errors.push("Missing barcode");
      if (qty <= 0) errors.push("Quantity must be > 0");

      rows.push({
        rowNumber: idx + 1,
        barcode,
        sku: barcode,
        name: `PDT Item (${barcode})`,
        quantity_received: qty,
        quantity_damaged: 0,
        invoice_rate: rate,
        isValid: errors.length === 0,
        errors,
      });
    });
    return { rows, detectedFormat: "PDT" };
  }

  // Standard CSV parsing
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headerTokens = lines[0].split(delimiter).map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

  const colMap: Record<string, number> = {};
  headerTokens.forEach((tok, idx) => {
    if (["barcode", "ean", "upc", "item_barcode"].includes(tok)) colMap.barcode = idx;
    else if (["sku", "code", "item_code", "item_no", "product_code"].includes(tok)) colMap.sku = idx;
    else if (["name", "product_name", "description", "title"].includes(tok)) colMap.name = idx;
    else if (["size", "sz"].includes(tok)) colMap.size = idx;
    else if (["color", "colour", "shade"].includes(tok)) colMap.color = idx;
    else if (["quantity", "qty", "received_qty", "quantity_received", "recv_qty"].includes(tok)) colMap.quantity = idx;
    else if (["damaged", "damaged_qty", "quantity_damaged", "rejected"].includes(tok)) colMap.damaged = idx;
    else if (["rate", "invoice_rate", "cost", "unit_price", "price"].includes(tok)) colMap.rate = idx;
    else if (["mrp", "retail_price"].includes(tok)) colMap.mrp = idx;
    else if (["gst", "gst_rate", "tax_rate", "tax"].includes(tok)) colMap.gst = idx;
  });

  const rows: ParsedGrnCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawTokens = lines[i].split(delimiter).map((t) => t.replace(/^["']|["']$/g, "").trim());
    if (rawTokens.length === 0 || (rawTokens.length === 1 && rawTokens[0] === "")) continue;

    const barcode = colMap.barcode !== undefined ? rawTokens[colMap.barcode] || "" : "";
    const sku = colMap.sku !== undefined ? rawTokens[colMap.sku] || barcode : barcode;
    const name = colMap.name !== undefined ? rawTokens[colMap.name] || `Item ${sku}` : `Item ${sku}`;
    const size = colMap.size !== undefined ? rawTokens[colMap.size] : undefined;
    const color = colMap.color !== undefined ? rawTokens[colMap.color] : undefined;
    const qty = colMap.quantity !== undefined ? parseFloat(rawTokens[colMap.quantity]) || 0 : 0;
    const damaged = colMap.damaged !== undefined ? parseFloat(rawTokens[colMap.damaged]) || 0 : 0;
    const rate = colMap.rate !== undefined ? parseFloat(rawTokens[colMap.rate]) || 0 : 0;
    const mrp = colMap.mrp !== undefined ? parseFloat(rawTokens[colMap.mrp]) || 0 : undefined;
    const gst = colMap.gst !== undefined ? parseFloat(rawTokens[colMap.gst]) || 18 : 18;

    const errors: string[] = [];
    if (!barcode && !sku) errors.push("Row missing both barcode and SKU");
    if (qty <= 0) errors.push("Received quantity must be greater than 0");

    rows.push({
      rowNumber: i + 1,
      barcode,
      sku,
      name,
      size,
      color,
      quantity_received: qty,
      quantity_damaged: damaged,
      invoice_rate: rate,
      mrp,
      gst_rate: gst,
      isValid: errors.length === 0,
      errors,
    });
  }

  return { rows, detectedFormat: "CSV" };
}

describe("GRN CSV / PDT Import Engine", () => {
  it("should parse RFC 4180 standard CSV file with canonical headers", () => {
    const csvContent = `barcode,sku,name,quantity,damaged,invoice_rate,mrp,gst_rate
8901234567890,SH-001,"Runner Pro Sports Shoes",200,0,1450.00,3129.50,18
8901234567891,SH-002,"City Walk Casual Shoes",298,2,1300.00,2549.00,18`;

    const { rows, detectedFormat } = parseInwardCsvOrPdt(csvContent);

    expect(detectedFormat).toBe("CSV");
    expect(rows.length).toBe(2);

    expect(rows[0].isValid).toBe(true);
    expect(rows[0].barcode).toBe("8901234567890");
    expect(rows[0].sku).toBe("SH-001");
    expect(rows[0].name).toBe("Runner Pro Sports Shoes");
    expect(rows[0].quantity_received).toBe(200);
    expect(rows[0].quantity_damaged).toBe(0);
    expect(rows[0].invoice_rate).toBe(1450.0);
    expect(rows[0].mrp).toBe(3129.5);

    expect(rows[1].isValid).toBe(true);
    expect(rows[1].quantity_received).toBe(298);
    expect(rows[1].quantity_damaged).toBe(2);
    expect(rows[1].invoice_rate).toBe(1300.0);
  });

  it("should resolve alternate header aliases (ean, product_code, recv_qty, unit_price)", () => {
    const csvContent = `ean,product_code,description,recv_qty,unit_price
8909998887771,SKU-ALT-01,Alternate Footwear,50,899.00`;

    const { rows } = parseInwardCsvOrPdt(csvContent);
    expect(rows.length).toBe(1);
    expect(rows[0].barcode).toBe("8909998887771");
    expect(rows[0].sku).toBe("SKU-ALT-01");
    expect(rows[0].name).toBe("Alternate Footwear");
    expect(rows[0].quantity_received).toBe(50);
    expect(rows[0].invoice_rate).toBe(899.0);
    expect(rows[0].isValid).toBe(true);
  });

  it("should detect and parse PDT tilde-delimited barcode scanning terminal files", () => {
    const pdtContent = `8901234567890~200~1450.00
8901234567891~298~1300.00
8901234567892~250~1650.00`;

    const { rows, detectedFormat } = parseInwardCsvOrPdt(pdtContent);

    expect(detectedFormat).toBe("PDT");
    expect(rows.length).toBe(3);
    expect(rows[0].barcode).toBe("8901234567890");
    expect(rows[0].quantity_received).toBe(200);
    expect(rows[0].invoice_rate).toBe(1450.0);
    expect(rows[1].quantity_received).toBe(298);
    expect(rows[2].quantity_received).toBe(250);
  });

  it("should validate and flag invalid rows with 0 or negative quantities", () => {
    const badCsv = `barcode,sku,quantity,invoice_rate
890001,SKU-1,-5,100
890002,SKU-2,0,100
, ,10,100`;

    const { rows } = parseInwardCsvOrPdt(badCsv);
    expect(rows.length).toBe(3);

    expect(rows[0].isValid).toBe(false);
    expect(rows[0].errors).toContain("Received quantity must be greater than 0");

    expect(rows[1].isValid).toBe(false);
    expect(rows[1].errors).toContain("Received quantity must be greater than 0");

    expect(rows[2].isValid).toBe(false);
    expect(rows[2].errors).toContain("Row missing both barcode and SKU");
  });
});
