/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Stitch Distributor Invoicing & Settlement Studio
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
export type TransactionType = "Credit" | "Cash";
export type PaymentMode = "Cash" | "Credit Card" | "Debit Card" | "Cheque" | "UPI" | "Credit Note" | "Split" | "Credit" | "On Account";

export interface BillingHeaderState {
  billType: BillType;
  transaction: TransactionType;
  docPrefix: string;
  docNo: string;
  billDate: string;
  customer: Customer | null;
  salesStaff: string;
  remarks: string;
}

export interface TransporterRow {
  sNo: number;
  type: string;
  code: string;
  description: string;
  rateType: "Fixed" | "Variable";
  rateAmt: number;
  rate: number;
  amount: number;
}

export interface AddonDeductionRow {
  sNo: number;
  type: "Addon" | "Deduction";
  code: string;
  description: string;
  rateType: "Fixed" | "Percentage";
  rate: number;
  amount: number;
}

export interface BillingSummaryTotals {
  itemCount: number;
  totalQty: number;
  salesValue: number; // Gross sales
  itemDiscount: number;
  billDiscount: number;
  totalTax: number;
  totalAddons: number;
  totalDeductions: number;
  roundOff: number;
  netAmount: number;
}

export interface SettlementPaymentRow {
  id: string;
  mode: PaymentMode;
  refNo: string;
  amount: number;
  bankDetails: string;
}

export interface CashDenominationState {
  d2000: number;
  d500: number;
  d200: number;
  d100: number;
  d50: number;
  d20: number;
  d10: number;
  coins: number;
}

export type PdtFieldTemplate = 
  | "Stock Number" 
  | "Stock Number + Qty + Rate" 
  | "Stock Number + Rate + Qty" 
  | "Stock Number + Qty";

export interface PdtImportRow {
  barcode: string;
  qty: number;
  rate?: number;
  stockNo?: string;
  description?: string;
}

export interface ItemBrowseFilterColumn {
  id: string;
  name: string;
  condition: "Contains" | "Equals" | "Starts With" | "Ends With";
  checked: boolean;
}
