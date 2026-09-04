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

export interface CustomerGSTRegistrationDTO {
  id: string;
  customer_id: string;
  gstin: string;
  trade_name?: string | null;
  legal_name?: string | null;
  state_code: string;
  state_name: string;
  registration_type: string;
  is_primary: boolean;
  is_active: boolean;
}

export interface CustomerDeliveryLocationDTO {
  id: string;
  customer_id: string;
  store_code: string;
  location_name: string;
  site_type?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  district?: string | null;
  state_code: string;
  state_name: string;
  pin_code: string;
  gst_registration_id?: string | null;
  delivery_gstin?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  is_default?: boolean;
  is_active: boolean;
}

export interface CustomerBillingLocationDTO {
  id: string;
  customer_id: string;
  billing_store_code: string;
  name?: string | null;
  gst_registration_id?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  state_code?: string | null;
  pincode: string;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  is_default: boolean;
  status: string;
}

export interface BillingHeaderState {
  billType: BillType;
  transaction: TransactionType;
  docPrefix: string;
  docNo: string;
  billDate: string;
  customer: Customer | null;
  salesStaff: string;
  remarks: string;

  // Phase 2C Corporate B2B Billing Fields
  billedPartyGstinId?: string | null;
  billedGstin?: string | null;
  deliveryLocationId?: string | null;
  deliveryStoreCode?: string | null;
  deliveryGstin?: string | null;
  deliveryLocationSnapshot?: Record<string, any> | null;
  placeOfSupplyCode?: string | null;
  poReference?: string | null;

  // Phase 2F Billing Location & Address Snapshots
  billingLocationId?: string | null;
  billingStoreCode?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
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
