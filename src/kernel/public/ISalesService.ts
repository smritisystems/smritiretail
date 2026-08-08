/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : ISalesService Public Interface Contract
 * Standard     : SMAP Constitution v1.0 — Public Contract (Level 2)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { DocumentTaxSnapshot } from "./ITaxResolutionEngine.js";

export type SalesInvoiceStatus = "Paid" | "Credit" | "Cancelled" | "Refunded";

export interface SalesInvoiceLineItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  hsnCode: string;
  qty: number;
  uom: string;
  rate: number;
  discountPct: number;
  discountAmount: number;
  taxableValue: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  lineTotal: number;
}

export interface SalesInvoiceRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerMobile: string;
  customerGstin?: string;
  customerGroupId?: string;
  invoiceDate: string; // ISO YYYY-MM-DD
  paymentMode: "Cash" | "Card" | "UPI" | "Credit" | "Split" | string;
  cashierName: string;
  itemsTotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  netPayable: number;
  roundedAmount: number;
  taxSnapshot?: DocumentTaxSnapshot;
  lines: SalesInvoiceLineItem[];
  status: SalesInvoiceStatus;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface ISalesService {
  /**
   * Resolve a sales invoice by primary ID / UUID
   */
  getInvoiceById(id: string): Promise<SalesInvoiceRecord | null>;

  /**
   * Resolve a sales invoice by Invoice Number
   */
  getByInvoiceNumber(invoiceNumber: string): Promise<SalesInvoiceRecord | null>;

  /**
   * Resolve all invoices for a customer by Customer ID or Mobile Number
   */
  getByCustomer(customerMobileOrId: string): Promise<SalesInvoiceRecord[]>;

  /**
   * Search sales invoices by Invoice Number, Customer Name, or Mobile
   */
  searchInvoices(query: string, limit?: number): Promise<SalesInvoiceRecord[]>;

  /**
   * Save or post a new sales invoice through UVE validation and Command Bus
   */
  saveInvoice(invoice: Partial<SalesInvoiceRecord>): Promise<SalesInvoiceRecord>;

  /**
   * Cancel / Void a sales invoice with mandatory reason code and audit trail
   */
  cancelInvoice(id: string, reason: string, cancelledBy?: string): Promise<SalesInvoiceRecord>;

  /**
   * Fetch all sales invoices from SSOT
   */
  getAllInvoices(): Promise<SalesInvoiceRecord[]>;
}
