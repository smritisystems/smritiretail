/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { Product, Customer } from "../../types.ts";

export interface BillingLineItem {
  id: string;
  sNo: number;
  stockNo: string;
  barcode: string;
  itemDescription: string;
  rate: number;
  qty: number;
  value: number; // rate * qty
  discCode: string;
  discQty: number;
  discPercent: number;
  discAmt: number;
  total: number; // value - discAmt + tax
  salesStaff: string;
  productId?: string;
  hsnCode?: string;
  gstPercentage?: number;
  taxAmount?: number;
  brand?: string;
  color?: string;
  size?: string;
  attributes?: Record<string, any>;
}

export type BillType = "Product" | "Service";
export type PaymentMode = "Cash" | "Credit" | "UPI" | "Card" | "Split";

export interface BillingHeaderState {
  billType: BillType;
  paymentMode: PaymentMode;
  billNo: string;
  billDate: string;
  customer: Customer | null;
  salesStaff: string;
  counterPcs: string;
  counterBatch: string;
}

export interface BillingSummaryTotals {
  itemCount: number;
  totalQty: number;
  salesValue: number; // Gross value
  itemDiscount: number;
  billDiscount: number;
  totalTax: number;
  totalAddons: number;
  totalDeductions: number;
  roundOff: number;
  netAmount: number;
}

export interface PdtImportRow {
  barcode: string;
  qty: number;
  stockNo?: string;
  description?: string;
}

export interface ItemBrowseFilterColumn {
  id: string;
  name: string;
  condition: "Contains" | "Equals" | "Starts With" | "Ends With";
  checked: boolean;
}
