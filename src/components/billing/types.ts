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
  customerPoLineId?: string;
}
export type BillType = "Product" | "Service";
export type TransactionType = "Credit" | "Cash";

export const CANONICAL_PAYMENT_MODES = [
  "CASH",
  "CARD",
  "UPI",
  "CHEQUE",
  "BANK_TRANSFER",
  "CREDIT_NOTE",
  "SPLIT",
  "CREDIT",
  "ON_ACCOUNT",
  "STORE_CREDIT",
  "WALLET",
  "LOYALTY",
  "GIFT_VOUCHER",
] as const;

export type CanonicalPaymentMode = typeof CANONICAL_PAYMENT_MODES[number];

export type LegacyPaymentModeDisplay =
  | "Cash"
  | "Credit Card"
  | "Debit Card"
  | "Cheque"
  | "UPI"
  | "Credit Note"
  | "Split"
  | "Credit"
  | "On Account";

export type PaymentMode = LegacyPaymentModeDisplay | CanonicalPaymentMode;

/**
 * Normalizes any legacy display string, raw input, or canonical code
 * into the authoritative uppercase CanonicalPaymentMode enum.
 */
export function toCanonicalPaymentMode(raw: string | PaymentMode | null | undefined): CanonicalPaymentMode {
  if (!raw) return "CASH";
  const normalized = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "CASH":
      return "CASH";
    case "CREDIT_CARD":
    case "DEBIT_CARD":
    case "CARD":
      return "CARD";
    case "UPI":
      return "UPI";
    case "CHEQUE":
    case "CHECK":
      return "CHEQUE";
    case "BANK_TRANSFER":
    case "NEFT":
    case "RTGS":
    case "IMPS":
    case "WIRE":
      return "BANK_TRANSFER";
    case "CREDIT_NOTE":
    case "CN":
      return "CREDIT_NOTE";
    case "SPLIT":
    case "MULTI":
      return "SPLIT";
    case "CREDIT":
    case "DUE":
      return "CREDIT";
    case "ON_ACCOUNT":
    case "ACCOUNT":
      return "ON_ACCOUNT";
    case "STORE_CREDIT":
      return "STORE_CREDIT";
    case "WALLET":
      return "WALLET";
    case "LOYALTY":
    case "LOYALTY_POINTS":
    case "REWARD_POINTS":
      return "LOYALTY";
    case "GIFT_VOUCHER":
    case "VOUCHER":
    case "GIFT_CARD":
      return "GIFT_VOUCHER";
    default:
      if ((CANONICAL_PAYMENT_MODES as readonly string[]).includes(normalized)) {
        return normalized as CanonicalPaymentMode;
      }
      return "CASH";
  }
}

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
  gstin?: string | null;
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
  billingSource?: "DIRECT" | "CUSTOMER_PO" | "SALES_ORDER" | "DELIVERY";
  customerPoId?: string | null;

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
  timing?: "ABOVE_TAX" | "BELOW_TAX";
  priceGroupCode?: string;
  isVariable?: boolean;
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
  aboveTaxAddons?: number;
  aboveTaxDeductions?: number;
  belowTaxAddons?: number;
  belowTaxDeductions?: number;
  adjustedTaxableValue?: number;
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

// ─── Barcode CSV Import Engine ───────────────────────────────────────────────

export type CsvFormatTier =
  | "FORMAT_1"
  | "FORMAT_2"
  | "FORMAT_3"
  | "FORMAT_4"
  | "FORMAT_5"
  | "FORMAT_6"
  | "FORMAT_PDT"
  | "FORMAT_B2B_RATE"
  | "FORMAT_COMMERCIAL_DISC";

export type CsvRowStatus = "VALID" | "WARNING" | "REJECTED";

export interface CsvImportRow {
  row_index: number;
  barcode: string;
  status: CsvRowStatus;
  // Resolution (VALID / WARNING)
  resolved_item?: string;
  resolved_sku?: string;
  product_id?: string;  // catalog product UUID — required for checkout
  hsn_code?: string;
  quantity?: number;
  catalog_mrp?: number;
  effective_selling_price?: number;
  is_tax_inclusive?: boolean;
  tax_mode_display?: string;
  mrp_markdown_pct?: number;
  mrp_markdown_display?: string;
  gst_rate?: number;
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  line_total?: number;
  available_stock?: number;
  uom?: string;
  batch_no?: string;
  expiry_date?: string;
  salesperson_id?: string;
  warnings?: string[];
  // Error (REJECTED)
  error_code?: string;
  error_message?: string;
}

export interface CsvImportResult {
  format_detected: CsvFormatTier;
  format_label: string;
  total_rows: number;
  valid_rows: number;
  rejected_rows: number;
  warning_rows: number;
  can_proceed: boolean;
  import_log_id?: string;
  raw_headers?: string[];
  canonical_headers?: string[];
  header_mappings?: Record<string, string>;
  unrecognized_headers?: string[];
  header_suggestions?: string[];
  distinguished_validations?: string[];
  rows: CsvImportRow[];
}

