/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.33.0 (Universal Label Printing Engine Service)
 * * Created    : 2026-07-25
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

export interface UniversalLabelItem {
  id: string;
  item_code: string;
  barcode: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  department?: string;
  vendor?: string;
  warehouse?: string;
  batch_no?: string;
  lot_no?: string;
  serial_no?: string;
  cost_price?: number;
  price?: number;
  mrp?: number;
  mfg_date?: string;
  expiry_date?: string;
  stock_qty?: number;
  received_qty?: number;
  sold_qty?: number;
  style_code?: string;
  custom_fields?: Record<string, any>;
  [key: string]: any;
}

export type QuantitySource = "fixed" | "stock" | "received" | "sold" | "custom";

export interface LabelTemplate {
  id: string;
  name: string;
  dimensions: string; // e.g. "50x25mm"
  type: "barcode" | "qrcode" | "dual" | "gs1";
  prnScript: string; // Raw PRN / ZPL template script
}

export interface PrinterProfile {
  id: string;
  name: string;
  protocol: "ZPL" | "TSPL" | "PDF";
  address: string;
  isDefault: boolean;
}

export const DEFAULT_LABEL_TEMPLATES: LabelTemplate[] = [
  {
    id: "tpl-tag-50x25",
    name: "Standard Product Tag (50x25mm)",
    dimensions: "50x25mm",
    type: "barcode",
    prnScript: `^XA
^FO50,30^A0N,24,24^FDStyle: {style}^FS
^FO50,60^A0N,20,20^FD{name}^FS
^FO50,90^BY2,2.0,50^BCN,50,Y,N,N^FD{barcode}^FS
^FO50,165^A0N,24,24^FDSell: RS.{price}  MRP: RS.{mrp}^FS
^PQ{qty}
^XZ`
  },
  {
    id: "tpl-box-75x50",
    name: "Footwear Box Label (75x50mm)",
    dimensions: "75x50mm",
    type: "dual",
    prnScript: `^XA
^FO30,30^A0N,30,30^FD{brand} - {category}^FS
^FO30,70^A0N,26,26^FDSKU: {sku}^FS
^FO30,105^A0N,22,22^FD{name}^FS
^FO30,140^BY3,2.0,70^BCN,70,Y,N,N^FD{barcode}^FS
^FO450,140^BQN,2,4^FDMM,A{barcode}^FS
^FO30,230^A0N,28,28^FDM.R.P: RS.{mrp} (INCL. TAXES)^FS
^FO30,265^A0N,22,22^FDMfg: {mfg_date} Exp: {expiry_date} Batch: {batch_no}^FS
^PQ{qty}
^XZ`
  },
  {
    id: "tpl-gs1-100x150",
    name: "Carton Outer GS1-128 (100x150mm)",
    dimensions: "100x150mm",
    type: "gs1",
    prnScript: `^XA
^FO50,40^A0N,36,36^FDSMRITI LOGISTICS OUTER CARTON^FS
^FO50,90^A0N,28,28^FDVENDOR: {vendor}^FS
^FO50,130^A0N,28,28^FDDESTINATION: {warehouse}^FS
^FO50,170^A0N,24,24^FDITEM: {name} (QTY: {qty})^FS
^FO50,220^BY4,3.0,120^BCN,120,Y,N,N^FD(01){barcode}(10){batch_no}^FS
^PQ{qty}
^XZ`
  },
  {
    id: "tpl-jewelry-30x10",
    name: "Jewelry Butterfly Tag (30x10mm)",
    dimensions: "30x10mm",
    type: "barcode",
    prnScript: `^XA
^FO20,15^A0N,18,18^FD{item_code}^FS
^FO20,38^BY1,2.0,30^BCN,30,Y,N,N^FD{barcode}^FS
^FO20,75^A0N,18,18^FDRS.{price}^FS
^PQ{qty}
^XZ`
  }
];

export const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [
  { id: "prn-zebra-01", name: "Zebra ZD421 (Network ZPL)", protocol: "ZPL", address: "192.168.1.45:9100", isDefault: true },
  { id: "prn-tsc-02", name: "TSC TE244 (USB TSPL)", protocol: "TSPL", address: "USB / COM4", isDefault: false },
  { id: "prn-pdf-03", name: "Virtual PDF / A4 Grid Renderer", protocol: "PDF", address: "Local Browser PDF", isDefault: false },
];

/**
 * Extracts 20+ variable tokens from a UniversalLabelItem record
 */
export function extractLabelTokens(item: UniversalLabelItem, qty: number = 1): Record<string, string> {
  let styleVal = item.style_code || "";
  if (!styleVal && item.sku && item.sku.includes("-")) {
    const parts = item.sku.split("-");
    styleVal = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : parts[0];
  }

  return {
    item_code: item.item_code || item.code || "ITEM-001",
    barcode: item.barcode || "8901234560000",
    sku: item.sku || item.code || "SKU-001",
    name: item.name || "Master Retail Product",
    category: item.category || "Apparel",
    brand: item.brand || "SMRITI",
    department: item.department || "General",
    vendor: item.vendor || "Primary Supplier",
    warehouse: item.warehouse || "Main Store",
    batch_no: item.batch_no || "B-001",
    lot_no: item.lot_no || "LOT-01",
    serial_no: item.serial_no || "SN-1001",
    cost_price: String(item.cost_price || 0),
    price: String(item.price || 0),
    mrp: String(item.mrp || item.price || 0),
    mfg_date: item.mfg_date || new Date().toISOString().split("T")[0],
    expiry_date: item.expiry_date || "2028-12-31",
    stock_qty: String(item.stock_qty || 0),
    received_qty: String(item.received_qty || item.stock_qty || 0),
    sold_qty: String(item.sold_qty || 0),
    qty: String(qty),
    style: styleVal || item.item_code || "STYLE-01"
  };
}

/**
 * Renders a raw PRN script by replacing all {token} placeholders with item values
 */
export function renderPRNScript(prnTemplateScript: string, item: UniversalLabelItem, qty: number = 1): string {
  const tokens = extractLabelTokens(item, qty);
  let rendered = prnTemplateScript;
  Object.entries(tokens).forEach(([key, val]) => {
    const reg = new RegExp(`\\{${key}\\}`, "gi");
    rendered = rendered.replace(reg, val);
  });
  return rendered;
}

/**
 * Computes required label copies based on QuantitySource rule
 */
export function computeLabelCopies(item: UniversalLabelItem, source: QuantitySource, fixedVal: number = 1): number {
  switch (source) {
    case "fixed":
      return Math.max(1, fixedVal);
    case "stock":
      return Math.max(1, item.stock_qty || 1);
    case "received":
      return Math.max(1, item.received_qty || item.stock_qty || 1);
    case "sold":
      return Math.max(1, item.sold_qty || 1);
    case "custom":
      return Math.max(1, item.label_copies || 1);
    default:
      return 1;
  }
}
