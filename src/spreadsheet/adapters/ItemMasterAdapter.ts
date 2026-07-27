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

import { Product } from "../../types.js";
import { SpreadsheetColumn } from "../SmritiSpreadsheetPlatform.js";

/**
 * Domain Data Adapter mapping Product entity records into SMRITI Spreadsheet Platform grid schema.
 */
export class ItemMasterAdapter {
  public static getColumns(): SpreadsheetColumn[] {
    return [
      { key: "code", label: "Item SKU Code", required: true, type: "text" },
      { key: "name", label: "Item Name Description", required: true, type: "text" },
      { key: "barcode", label: "Barcode / EAN-13", required: true, type: "barcode" },
      { key: "category", label: "Category Segment", required: true, type: "text" },
      { key: "brand", label: "Brand", type: "text" },
      { key: "costPrice", label: "Buy Cost Price (₹)", type: "currency" },
      { key: "price", label: "Retail Selling Price (₹)", required: true, type: "currency" },
      { key: "mrp", label: "Max Retail Price MRP (₹)", required: true, type: "currency" },
      { key: "gstPercentage", label: "GST Tax Rate %", type: "gst" },
      { key: "hsnCode", label: "HSN / SAC Code", type: "text" },
      { key: "stock", label: "On-Hand Stock Qty", type: "number" },
    ];
  }

  public static toGridRows(products: Product[]): Record<string, any>[] {
    return products.map((p) => ({
      id: p.id,
      code: p.code || "",
      name: p.name || "",
      barcode: p.barcode || "",
      category: p.category || "",
      brand: p.brand || "",
      costPrice: p.costPrice !== undefined ? p.costPrice.toString() : "",
      price: p.price !== undefined ? p.price.toString() : "",
      mrp: p.mrp !== undefined ? p.mrp.toString() : "",
      gstPercentage: p.gstPercentage !== undefined ? p.gstPercentage.toString() : "18",
      hsnCode: p.hsnCode || "",
      stock: p.stock !== undefined ? p.stock.toString() : "0",
    }));
  }

  public static fromGridRows(rows: Record<string, any>[]): Partial<Product>[] {
    return rows.map((r, idx) => ({
      id: r.id || `PROD-${Date.now()}-${idx}`,
      code: r.code || `SKU-${idx + 1}`,
      name: r.name || `Product ${idx + 1}`,
      barcode: r.barcode || r.code || "",
      category: r.category || "General",
      brand: r.brand || "SMRITI",
      costPrice: parseFloat(r.costPrice) || 0,
      price: parseFloat(r.price) || 0,
      mrp: parseFloat(r.mrp) || parseFloat(r.price) || 0,
      gstPercentage: parseFloat(r.gstPercentage) || 18,
      hsnCode: r.hsnCode || "",
      stock: parseInt(r.stock, 10) || 0,
    }));
  }
}
