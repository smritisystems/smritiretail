/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { LabelPrintRow } from "./types.ts";

export interface PTFileRecord {
  stockNo: string;
  product: string;
  brand: string;
  style: string;
  colour: string;
  size: string;
  purchaseQty: number;
  mrp: number;
  sellingPrice: number;
  barcode: string;
}

export const SAMPLE_PT_FILE_RECORDS: PTFileRecord[] = [
  {
    stockNo: "000006",
    product: "Shirt",
    brand: "Beanstalk",
    style: "BeeLine",
    colour: "Ecru",
    size: "34",
    purchaseQty: 6,
    mrp: 1299,
    sellingPrice: 999,
    barcode: "890100000006"
  },
  {
    stockNo: "000007",
    product: "Shirt",
    brand: "Beanstalk",
    style: "BeeLine",
    colour: "Ecru",
    size: "36",
    purchaseQty: 10,
    mrp: 1299,
    sellingPrice: 999,
    barcode: "890100000007"
  },
  {
    stockNo: "000008",
    product: "Shirt",
    brand: "Beanstalk",
    style: "BeeLine",
    colour: "Ecru",
    size: "38",
    purchaseQty: 8,
    mrp: 1299,
    sellingPrice: 999,
    barcode: "890100000008"
  },
  {
    stockNo: "000010",
    product: "Trouser",
    brand: "Beanstalk",
    style: "Cargo",
    colour: "Olive",
    size: "32",
    purchaseQty: 12,
    mrp: 1899,
    sellingPrice: 1499,
    barcode: "890100000010"
  },
  {
    stockNo: "000011",
    product: "Trouser",
    brand: "Beanstalk",
    style: "Cargo",
    colour: "Olive",
    size: "34",
    purchaseQty: 15,
    mrp: 1899,
    sellingPrice: 1499,
    barcode: "890100000011"
  },
  {
    stockNo: "000012",
    product: "Trouser",
    brand: "Beanstalk",
    style: "Cargo",
    colour: "Olive",
    size: "36",
    purchaseQty: 5,
    mrp: 1899,
    sellingPrice: 1499,
    barcode: "890100000012"
  }
];

/**
 * Parse text or CSV content of a Purchase Transaction (.pt / .txt / .csv) file
 */
export function parsePTFileContent(content: string): LabelPrintRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows: LabelPrintRow[] = [];

  let lineIdx = 0;
  for (const line of lines) {
    // Skip comments or headers if present
    if (line.startsWith("#") || line.startsWith("//") || line.toLowerCase().startsWith("stock") || line.toLowerCase().startsWith("sku")) {
      continue;
    }

    // Split by comma, tab, or pipe delimiter
    const delimiter = line.includes("\t") ? "\t" : line.includes("|") ? "|" : ",";
    const parts = line.split(delimiter).map(p => p.trim());

    if (parts.length >= 2) {
      lineIdx++;
      const stockNo = parts[0] || String(lineIdx).padStart(6, "0");

      // Check if parts[1] is a numeric barcode (Format B: stockNo|barcode|brand|product|colour|style|size|mrp|sp|qty)
      const isFormatB = parts.length >= 9 && /^\d{8,14}$/.test(parts[1]);

      let product = "Item";
      let brand = "SMRITI";
      let style = "-";
      let colour = "-";
      let size = "-";
      let purchaseQty = 1;
      let mrp = 0;
      let sellingPrice = 0;
      let barcode = stockNo;

      if (isFormatB) {
        barcode = parts[1];
        brand = parts[2] || "SMRITI";
        product = parts[3] || "Item";
        colour = parts[4] || "-";
        style = parts[5] || "-";
        size = parts[6] || "-";
        mrp = parseFloat(parts[7]) || 0;
        sellingPrice = parseFloat(parts[8]) || mrp;
        purchaseQty = parseInt(parts[9]) || 1;
      } else {
        // Format A: stockNo|product|brand|style|colour|size|qty|mrp|sp|barcode
        product = parts[1] || "Item";
        brand = parts[2] || "SMRITI";
        style = parts[3] || "-";
        colour = parts[4] || "-";
        size = parts[5] || "-";
        purchaseQty = parseInt(parts[6]) || 1;
        mrp = parseFloat(parts[7]) || 0;
        sellingPrice = parseFloat(parts[8]) || mrp;
        barcode = parts[9] || stockNo;
      }

      rows.push({
        id: `pt-row-${lineIdx}`,
        sNo: lineIdx,
        stockNo,
        barcode,
        brand,
        product,
        colour,
        style,
        size,
        mrp,
        sellingPrice,
        currentStock: 0,
        labelCount: Math.max(1, purchaseQty)
      });
    }
  }

  // If no rows parsed from raw format, fallback to default sample rows
  if (rows.length === 0) {
    return SAMPLE_PT_FILE_RECORDS.map((rec, idx) => ({
      id: `pt-row-${idx + 1}`,
      sNo: idx + 1,
      stockNo: rec.stockNo,
      barcode: rec.barcode,
      brand: rec.brand,
      product: rec.product,
      colour: rec.colour,
      style: rec.style,
      size: rec.size,
      mrp: rec.mrp,
      sellingPrice: rec.sellingPrice,
      currentStock: 0,
      labelCount: rec.purchaseQty
    }));
  }

  return rows;
}
