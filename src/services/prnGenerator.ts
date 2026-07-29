/**
 * Project      : SMRITI Retail OS
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

import { Product } from "../types.js";

export interface PRNOptions {
  language: "TSPL" | "ZPL";
  widthMm?: number;
  heightMm?: number;
  gapMm?: number;
}

/**
 * Generates TSPL PRN script for TSC/TTP/GPRINTER thermal printers.
 */
export function generateTSPLScript(
  item: Product, 
  copies: number = 1, 
  options: { widthMm?: number; heightMm?: number; gapMm?: number } = {}
): string {
  const width = options.widthMm || 50;
  const height = options.heightMm || 25;
  const gap = options.gapMm || 2;
  const priceStr = `₹${Number(item.price || item.mrp || 0).toFixed(2)}`;
  const mrpStr = item.mrp ? `MRP: ₹${Number(item.mrp).toFixed(2)}` : "";
  const nameStr = (item.name || "Item").slice(0, 24).replace(/"/g, "'");
  const codeStr = (item.code || "").slice(0, 16).replace(/"/g, "'");
  const barcodeStr = item.barcode || item.code || "123456789";

  return `SIZE ${width} mm, ${height} mm
GAP ${gap} mm, 0 mm
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET PEEL OFF
SET CUTTER OFF
CLS
TEXT 20,15,"3",0,1,1,"${nameStr}"
TEXT 20,40,"2",0,1,1,"SKU: ${codeStr} ${mrpStr ? "| " + mrpStr : ""}"
BARCODE 20,65,"128",40,1,0,2,2,"${barcodeStr}"
TEXT 20,115,"3",0,1,1,"OUR PRICE: ${priceStr}"
PRINT ${Math.max(1, copies)},1`;
}

/**
 * Generates ZPL PRN script for Zebra ZD421 / GX430 / GK420 thermal printers.
 */
export function generateZPLScript(
  item: Product, 
  copies: number = 1, 
  options: { widthMm?: number; heightMm?: number } = {}
): string {
  const priceStr = `INR ${Number(item.price || item.mrp || 0).toFixed(2)}`;
  const mrpStr = item.mrp ? `MRP:${Number(item.mrp).toFixed(2)}` : "";
  const nameStr = (item.name || "Item").slice(0, 24).replace(/[\^\~]/g, "");
  const codeStr = (item.code || "").slice(0, 16).replace(/[\^\~]/g, "");
  const barcodeStr = (item.barcode || item.code || "123456789").replace(/[\^\~]/g, "");

  return `^XA
^PW400
^LL200
^FO20,15^A0N,22,22^FD${nameStr}^FS
^FO20,42^A0N,18,18^FDSKU:${codeStr} ${mrpStr ? " " + mrpStr : ""}^FS
^FO20,68^BY2,3,38^BCN,38,Y,N,N^FD${barcodeStr}^FS
^FO20,122^A0N,22,22^FDPRICE: ${priceStr}^FS
^PQ${Math.max(1, copies)}
^XZ`;
}

/**
 * Universal PRN Generator mapping Item Master products into raw TSPL/ZPL printer commands.
 */
export function generatePRNScript(
  items: Array<{ product: Product; copies: number }>,
  options: PRNOptions
): string {
  if (!items || items.length === 0) return "";
  const generator = options.language === "ZPL" ? generateZPLScript : generateTSPLScript;
  return items
    .map(({ product, copies }) => generator(product, copies, options))
    .join("\n\n");
}
