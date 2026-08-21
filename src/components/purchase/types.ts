/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { Product } from "../../types.ts";

export type PurchaseDocumentType = "Purchase Order" | "Indent";

export interface PurchaseOrderHeader {
  documentType: PurchaseDocumentType;
  prefix: string;
  orderNumber: string;
  orderDate: string;
  supplierId: string;
  supplierName: string;
  billTo: string;
  deliveryDate: string;
  leadTimeDays: number;
  deliveryLocation: string;
  commonTaxPercent: number;
  pictureUrl?: string;
}

export interface PurchaseOrderLineItem {
  id: string;
  sNo: number;
  stockNo: string;
  product: string;
  brand: string;
  style: string;
  shade: string;
  size: string;
  fibre: string;
  colourBase: string;
  styling: string;
  rate: number;
  orderQty: number;
  value: number; // rate * orderQty
  stockOnHand: number;
  taxPercent: number;
  taxAmount: number; // value * (taxPercent / 100)
  addOnPercent: number;
  addOnAmount: number;
  totalValue: number; // value + taxAmount + addOnAmount
  originalProduct?: Product;
}

export interface PurchaseOrderSizePivotRow {
  id: string;
  sNo: number;
  articleNo: string;
  product: string;
  brand: string;
  style: string;
  color: string;
  sizeQuantities: Record<string, number>; // e.g. { "36": 2, "37": 0, ... }
  totalQty: number;
  gstPercent: number; // GST % per line item
  rate: number;
  totalValue: number; // totalQty * rate
  originalProduct?: Product;
}

export interface PurchaseOrderSummaryTotals {
  totalQty: number;
  grossValue: number;
  totalTax: number;
  totalAddOn: number;
  totalValue: number;
}
