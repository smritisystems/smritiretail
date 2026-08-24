/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.10.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export interface TaxInvoiceItemRow {
  id: string;
  sNo: number;
  stockNo: string;
  barcode?: string;
  itemDescription: string;
  rate: number;
  qty: number;
  value: number; // rate * qty
  discCode: string; // e.g. "NONE", "PROMO10", "SEASONAL", "LOYALTY"
  discQty: number;
  discPercent: number;
  discAmt: number;
  total: number;
  salesStaff: string;
  hsnCode?: string;
  gstRate?: number;
}

export interface TransporterDetailEntry {
  sNo: number;
  type: string;
  code: string;
  description: string;
  fixedOrVariable: "Fixed" | "Variable";
  rateOrAmt: number;
  rate: number;
  amount: number;
}

export interface PaymentDetailEntry {
  mode: "Cash" | "Card" | "UPI" | "Credit" | "Cheque" | "Bank Transfer";
  amount: number;
  referenceNo: string;
  bankName: string;
}

export interface AddonDeductionEntry {
  id: string;
  type: "Addon" | "Deduction";
  code: string;
  description: string;
  percentage?: number;
  amount: number;
}

export interface TaxInvoiceDocumentState {
  billType: "Tax Invoice" | "Proforma Invoice" | "Bill of Supply" | "Credit Note" | "Debit Note";
  transactionMode: "Tax Invoice" | "Interstate Sale" | "Export (Zero Rated)" | "SEZ Supply";
  docPrefix: string;
  docNo: string;
  docDate: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerGstin?: string;
  customerMobile?: string;
  customerAddress?: string;
  salesStaff: string;
  items: TaxInvoiceItemRow[];
  transporterDetails: TransporterDetailEntry[];
  paymentDetails: PaymentDetailEntry[];
  addonsAndDeductions: AddonDeductionEntry[];
  documentRemarks: string;
  ewayBillNo?: string;
}
