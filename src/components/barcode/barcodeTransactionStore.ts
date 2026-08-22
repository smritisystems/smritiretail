/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.4.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { LabelPrintRow } from "./types.ts";

export interface TransactionDocRecord {
  docType: "Purchase Inward (GRN)" | "Sales Return Inward" | "Stock Transfer Inward" | "POS Exchange";
  docPrefix: string;
  docNo: string;
  docDate: string;
  vendorOrCustomer: string;
  items: {
    stockNo: string;
    product: string;
    brand: string;
    style: string;
    colour: string;
    size: string;
    qty: number;
    mrp: number;
    sellingPrice: number;
    barcode: string;
  }[];
}

export interface PurchaseOrderDocRecord {
  poPrefix: string;
  poNo: string;
  poDate: string;
  supplier: string;
  items: {
    stockNo: string;
    product: string;
    brand: string;
    style: string;
    colour: string;
    size: string;
    poQty: number;
    mrp: number;
    sellingPrice: number;
    barcode: string;
  }[];
}

export interface MasterItemWithDateRecord {
  id: string;
  stockNo: string;
  barcode: string;
  brand: string;
  product: string;
  colour: string;
  style: string;
  size: string;
  mrp: number;
  sellingPrice: number;
  currentStock: number;
  createdDate: string; // YYYY-MM-DD
  isLabelPrinted: boolean;
}

// Built-in Transaction Records (GRN / Inwards)
export const MOCK_TRANSACTIONS: TransactionDocRecord[] = [
  {
    docType: "Purchase Inward (GRN)",
    docPrefix: "GRN-2026-",
    docNo: "001",
    docDate: "2026-08-18",
    vendorOrCustomer: "Apex Textiles Ltd",
    items: [
      { stockNo: "000006", product: "Shirt", brand: "Beanstalk", style: "BeeLine", colour: "Ecru", size: "34", qty: 12, mrp: 1299, sellingPrice: 999, barcode: "890100000006" },
      { stockNo: "000007", product: "Shirt", brand: "Beanstalk", style: "BeeLine", colour: "Ecru", size: "36", qty: 15, mrp: 1299, sellingPrice: 999, barcode: "890100000007" },
      { stockNo: "000008", product: "Shirt", brand: "Beanstalk", style: "BeeLine", colour: "Ecru", size: "38", qty: 8, mrp: 1299, sellingPrice: 999, barcode: "890100000008" }
    ]
  },
  {
    docType: "Purchase Inward (GRN)",
    docPrefix: "GRN-2026-",
    docNo: "002",
    docDate: "2026-08-20",
    vendorOrCustomer: "Raymond Apparels",
    items: [
      { stockNo: "000010", product: "Trouser", brand: "Beanstalk", style: "Cargo", colour: "Olive", size: "32", qty: 20, mrp: 1899, sellingPrice: 1499, barcode: "890100000010" },
      { stockNo: "000011", product: "Trouser", brand: "Beanstalk", style: "Cargo", colour: "Olive", size: "34", qty: 18, mrp: 1899, sellingPrice: 1499, barcode: "890100000011" },
      { stockNo: "000012", product: "Trouser", brand: "Beanstalk", style: "Cargo", colour: "Olive", size: "36", qty: 10, mrp: 1899, sellingPrice: 1499, barcode: "890100000012" }
    ]
  },
  {
    docType: "Sales Return Inward",
    docPrefix: "RET-2026-",
    docNo: "001",
    docDate: "2026-08-21",
    vendorOrCustomer: "Counter Customer (POS)",
    items: [
      { stockNo: "000006", product: "Shirt", brand: "Beanstalk", style: "BeeLine", colour: "Ecru", size: "34", qty: 2, mrp: 1299, sellingPrice: 999, barcode: "890100000006" },
      { stockNo: "000010", product: "Trouser", brand: "Beanstalk", style: "Cargo", colour: "Olive", size: "32", qty: 1, mrp: 1899, sellingPrice: 1499, barcode: "890100000010" }
    ]
  }
];

// Built-in Purchase Orders
export const MOCK_PURCHASE_ORDERS: PurchaseOrderDocRecord[] = [
  {
    poPrefix: "PO-2026-",
    poNo: "001",
    poDate: "2026-08-15",
    supplier: "Madura Garments",
    items: [
      { stockNo: "000006", product: "Shirt", brand: "Beanstalk", style: "BeeLine", colour: "Ecru", size: "34", poQty: 24, mrp: 1299, sellingPrice: 999, barcode: "890100000006" },
      { stockNo: "000007", product: "Shirt", brand: "Beanstalk", style: "BeeLine", colour: "Ecru", size: "36", poQty: 30, mrp: 1299, sellingPrice: 999, barcode: "890100000007" },
      { stockNo: "000008", product: "Shirt", brand: "Beanstalk", style: "BeeLine", colour: "Ecru", size: "38", poQty: 18, mrp: 1299, sellingPrice: 999, barcode: "890100000008" }
    ]
  },
  {
    poPrefix: "PO-2026-",
    poNo: "002",
    poDate: "2026-08-19",
    supplier: "Arvind Mills",
    items: [
      { stockNo: "000010", product: "Trouser", brand: "Beanstalk", style: "Cargo", colour: "Olive", size: "32", poQty: 40, mrp: 1899, sellingPrice: 1499, barcode: "890100000010" },
      { stockNo: "000011", product: "Trouser", brand: "Beanstalk", style: "Cargo", colour: "Olive", size: "34", poQty: 35, mrp: 1899, sellingPrice: 1499, barcode: "890100000011" }
    ]
  }
];

// Master Items with Creation Dates & Label Printed Status
export const MOCK_MASTER_ITEMS_WITH_DATES: MasterItemWithDateRecord[] = [
  { id: "m-1", stockNo: "000006", barcode: "890100000006", brand: "Beanstalk", product: "Shirt", colour: "Ecru", style: "BeeLine", size: "34", mrp: 1299, sellingPrice: 999, currentStock: 12, createdDate: "2026-08-05", isLabelPrinted: true },
  { id: "m-2", stockNo: "000007", barcode: "890100000007", brand: "Beanstalk", product: "Shirt", colour: "Ecru", style: "BeeLine", size: "36", mrp: 1299, sellingPrice: 999, currentStock: 15, createdDate: "2026-08-08", isLabelPrinted: true },
  { id: "m-3", stockNo: "000008", barcode: "890100000008", brand: "Beanstalk", product: "Shirt", colour: "Ecru", style: "BeeLine", size: "38", mrp: 1299, sellingPrice: 999, currentStock: 8, createdDate: "2026-08-15", isLabelPrinted: false },
  { id: "m-4", stockNo: "000010", barcode: "890100000010", brand: "Beanstalk", product: "Trouser", colour: "Olive", style: "Cargo", size: "32", mrp: 1899, sellingPrice: 1499, currentStock: 24, createdDate: "2026-08-18", isLabelPrinted: false },
  { id: "m-5", stockNo: "000011", barcode: "890100000011", brand: "Beanstalk", product: "Trouser", colour: "Olive", style: "Cargo", size: "34", mrp: 1899, sellingPrice: 1499, currentStock: 18, createdDate: "2026-08-20", isLabelPrinted: false },
  { id: "m-6", stockNo: "000012", barcode: "890100000012", brand: "Beanstalk", product: "Trouser", colour: "Olive", style: "Cargo", size: "36", mrp: 1899, sellingPrice: 1499, currentStock: 6, createdDate: "2026-08-21", isLabelPrinted: false }
];

/**
 * Filter items from Transactions matching Doc Prefix and Number range
 */
export function queryTransactionItems(
  docType: string,
  prefix: string,
  fromNo: string,
  toNo: string
): LabelPrintRow[] {
  const matchingDocs = MOCK_TRANSACTIONS.filter(t => {
    if (docType && t.docType !== docType) return false;
    if (prefix && !t.docPrefix.toLowerCase().includes(prefix.toLowerCase())) return false;
    if (fromNo && t.docNo < fromNo) return false;
    if (toNo && t.docNo > toNo) return false;
    return true;
  });

  const rows: LabelPrintRow[] = [];
  let sNo = 1;
  for (const doc of matchingDocs) {
    for (const itm of doc.items) {
      rows.push({
        id: `tx-row-${doc.docPrefix}${doc.docNo}-${itm.stockNo}`,
        sNo: sNo++,
        stockNo: itm.stockNo,
        barcode: itm.barcode,
        brand: itm.brand,
        product: `${itm.product} [${doc.docPrefix}${doc.docNo}]`,
        colour: itm.colour,
        style: itm.style,
        size: itm.size,
        mrp: itm.mrp,
        sellingPrice: itm.sellingPrice,
        currentStock: 0,
        labelCount: itm.qty
      });
    }
  }
  return rows;
}

/**
 * Filter items from Purchase Orders matching PO Prefix and PO Number range
 */
export function queryPurchaseOrderItems(
  prefix: string,
  fromNo: string,
  toNo: string
): LabelPrintRow[] {
  const matchingPOs = MOCK_PURCHASE_ORDERS.filter(po => {
    if (prefix && !po.poPrefix.toLowerCase().includes(prefix.toLowerCase())) return false;
    if (fromNo && po.poNo < fromNo) return false;
    if (toNo && po.poNo > toNo) return false;
    return true;
  });

  // Cumulative item map so same stockNo across multiple POs aggregates purchase quantities
  const mapByStock = new Map<string, LabelPrintRow>();
  let sNo = 1;

  for (const po of matchingPOs) {
    for (const itm of po.items) {
      if (mapByStock.has(itm.stockNo)) {
        const existing = mapByStock.get(itm.stockNo)!;
        existing.labelCount += itm.poQty;
      } else {
        const row: LabelPrintRow = {
          id: `po-row-${itm.stockNo}`,
          sNo: sNo++,
          stockNo: itm.stockNo,
          barcode: itm.barcode,
          brand: itm.brand,
          product: itm.product,
          colour: itm.colour,
          style: itm.style,
          size: itm.size,
          mrp: itm.mrp,
          sellingPrice: itm.sellingPrice,
          currentStock: 0,
          labelCount: itm.poQty
        };
        mapByStock.set(itm.stockNo, row);
      }
    }
  }
  return Array.from(mapByStock.values());
}

/**
 * Filter Master Items by Date Range and Print Status (Unprinted Only vs All)
 */
export function queryMasterItemsByDate(
  dateFrom: string,
  dateTo: string,
  unprintedOnly: boolean
): LabelPrintRow[] {
  const filtered = MOCK_MASTER_ITEMS_WITH_DATES.filter(m => {
    if (dateFrom && m.createdDate < dateFrom) return false;
    if (dateTo && m.createdDate > dateTo) return false;
    if (unprintedOnly && m.isLabelPrinted) return false;
    return true;
  });

  return filtered.map((m, idx) => ({
    id: `master-row-${m.id}`,
    sNo: idx + 1,
    stockNo: m.stockNo,
    barcode: m.barcode,
    brand: m.brand,
    product: m.product,
    colour: m.colour,
    style: m.style,
    size: m.size,
    mrp: m.mrp,
    sellingPrice: m.sellingPrice,
    currentStock: m.currentStock,
    labelCount: 1
  }));
}
