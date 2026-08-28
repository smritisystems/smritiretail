/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.94.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * GST e-Invoice IRN Generation & QR Code Printing Studio
 *
 * Implements the Indian Government e-Invoice schema (GSTN API v1.03):
 *   - Invoice Registration Number (IRN) as SHA-256 of SupplierGSTIN + DocNo + DocType + DocDate
 *   - QR payload per CBIC specification (pipe-delimited canonical string)
 *   - Acknowledgement Number (ACK) + Acknowledgement Date
 *   - Bulk print queue management
 */

export type GSTDocType = "INV" | "CRN" | "DBN";   // Invoice / Credit Note / Debit Note

export interface GSTParty {
  gstin: string;
  legalName: string;
  tradeName?: string;
  address1: string;
  address2?: string;
  location: string;
  pincode: string;
  stateCode: string;   // 2-digit GST state code e.g. "27" for Maharashtra
}

export interface GSTLineItem {
  slNo: number;
  description: string;
  hsn: string;
  qty: number;
  unit: string;       // "NOS", "KGS", "MTR"
  unitPrice: number;  // Taxable value per unit
  taxableValue: number;
  gstRate: number;    // e.g. 18 for 18%
  cgst: number;
  sgst: number;
  igst: number;
  cess?: number;
  lineTotal: number;
}

export interface EInvoice {
  invoiceId: string;            // Internal SMRITI doc ID
  docType: GSTDocType;
  docNo: string;
  docDate: string;              // "DD/MM/YYYY"
  supplier: GSTParty;
  buyer: GSTParty;
  dispatchFrom?: GSTParty;
  shipTo?: GSTParty;
  items: GSTLineItem[];
  totals: EInvoiceTotals;
  irn?: string;                 // Set after registration
  ackNo?: string;
  ackDate?: string;
  qrPayload?: string;
  status: "DRAFT" | "PENDING_REGISTRATION" | "REGISTERED" | "CANCELLED" | "PRINT_QUEUED" | "PRINTED";
  cancelledAt?: string;
  cancelReason?: string;
  printQueuedAt?: string;
  printedAt?: string;
}

export interface EInvoiceTotals {
  taxableValue: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalCess: number;
  roundOff: number;
  grandTotal: number;
}

export interface BulkPrintJob {
  jobId: string;
  invoiceIds: string[];
  createdAt: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  printedCount: number;
  failedCount: number;
  completedAt?: string;
}

/** Deterministic SHA-256-like IRN from key fields (browser-compatible pure-TS simulation) */
function deterministicIRN(supplierGSTIN: string, docNo: string, docType: GSTDocType, docDate: string): string {
  // In production: actual HMAC-SHA256 sent to GSTN API — this simulates a 64-char hex hash
  const raw = `${supplierGSTIN}|${docNo}|${docType}|${docDate}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  // Expand to 64-char hex by repeating and XOR-mixing
  const base = Math.abs(hash).toString(16).padStart(8, "0");
  let irn = "";
  for (let i = 0; i < 8; i++) irn += base.split("").map((c, j) => (parseInt(c, 16) ^ (i + j)).toString(16)).join("");
  return irn.slice(0, 64).padEnd(64, "a");
}

export class EInvoiceEngine {
  /** Compute line item GST values */
  public static computeLineItem(params: {
    slNo: number;
    description: string;
    hsn: string;
    qty: number;
    unit: string;
    unitPrice: number;
    gstRate: number;
    isInterState: boolean;
    cess?: number;
  }): GSTLineItem {
    const taxableValue = Math.round(params.qty * params.unitPrice * 100) / 100;
    const gstAmount = Math.round((taxableValue * params.gstRate) / 100 * 100) / 100;
    const cgst = params.isInterState ? 0 : Math.round(gstAmount / 2 * 100) / 100;
    const sgst = params.isInterState ? 0 : Math.round(gstAmount / 2 * 100) / 100;
    const igst = params.isInterState ? gstAmount : 0;
    const cess = params.cess ? Math.round((taxableValue * params.cess) / 100 * 100) / 100 : 0;
    const lineTotal = taxableValue + cgst + sgst + igst + cess;

    return {
      slNo: params.slNo,
      description: params.description,
      hsn: params.hsn,
      qty: params.qty,
      unit: params.unit,
      unitPrice: params.unitPrice,
      taxableValue,
      gstRate: params.gstRate,
      cgst,
      sgst,
      igst,
      cess,
      lineTotal: Math.round(lineTotal * 100) / 100,
    };
  }

  /** Compute invoice totals from line items */
  public static computeTotals(items: GSTLineItem[]): EInvoiceTotals {
    const taxableValue = items.reduce((s, i) => s + i.taxableValue, 0);
    const totalCGST   = items.reduce((s, i) => s + i.cgst, 0);
    const totalSGST   = items.reduce((s, i) => s + i.sgst, 0);
    const totalIGST   = items.reduce((s, i) => s + i.igst, 0);
    const totalCess   = items.reduce((s, i) => s + (i.cess ?? 0), 0);
    const grandTotal  = taxableValue + totalCGST + totalSGST + totalIGST + totalCess;
    const roundOff    = Math.round((Math.round(grandTotal) - grandTotal) * 100) / 100;

    return {
      taxableValue: Math.round(taxableValue * 100) / 100,
      totalCGST:    Math.round(totalCGST * 100) / 100,
      totalSGST:    Math.round(totalSGST * 100) / 100,
      totalIGST:    Math.round(totalIGST * 100) / 100,
      totalCess:    Math.round(totalCess * 100) / 100,
      roundOff,
      grandTotal:   Math.round((grandTotal + roundOff) * 100) / 100,
    };
  }

  /** Create a new draft e-invoice */
  public static createDraft(params: {
    docType: GSTDocType;
    docNo: string;
    docDate: string;
    supplier: GSTParty;
    buyer: GSTParty;
    items: GSTLineItem[];
  }): EInvoice {
    const totals = this.computeTotals(params.items);
    return {
      invoiceId: `INV-${Date.now()}`,
      docType: params.docType,
      docNo: params.docNo,
      docDate: params.docDate,
      supplier: params.supplier,
      buyer: params.buyer,
      items: params.items,
      totals,
      status: "DRAFT",
    };
  }

  /** Simulate IRN registration with GSTN API */
  public static registerIRN(invoice: EInvoice): EInvoice {
    const irn = deterministicIRN(invoice.supplier.gstin, invoice.docNo, invoice.docType, invoice.docDate);
    const ackNo = `${Date.now().toString().slice(-12)}`;
    const ackDate = new Date().toISOString();
    const qrPayload = this.buildQRPayload(invoice, irn, ackNo, ackDate);

    return {
      ...invoice,
      irn,
      ackNo,
      ackDate,
      qrPayload,
      status: "REGISTERED",
    };
  }

  /** Build CBIC-spec QR payload (pipe-delimited canonical string) */
  public static buildQRPayload(invoice: EInvoice, irn: string, ackNo: string, ackDate: string): string {
    return [
      invoice.supplier.gstin,
      invoice.buyer.gstin,
      invoice.docNo,
      invoice.docDate,
      invoice.totals.grandTotal.toFixed(2),
      irn,
      ackNo,
      ackDate,
    ].join("|");
  }

  /** Cancel a registered IRN */
  public static cancelIRN(invoice: EInvoice, reason: string): EInvoice {
    if (invoice.status !== "REGISTERED") throw new Error("Only REGISTERED invoices can be cancelled");
    return { ...invoice, status: "CANCELLED", cancelledAt: new Date().toISOString(), cancelReason: reason };
  }

  /** Add invoice to print queue */
  public static queueForPrint(invoice: EInvoice): EInvoice {
    if (!["REGISTERED"].includes(invoice.status)) throw new Error("Only REGISTERED invoices can be queued for print");
    return { ...invoice, status: "PRINT_QUEUED", printQueuedAt: new Date().toISOString() };
  }

  /** Create a bulk print job from a list of invoices */
  public static createBulkPrintJob(invoices: EInvoice[]): { job: BulkPrintJob; invoices: EInvoice[] } {
    const now = new Date().toISOString();
    const queued = invoices.map((inv) => (inv.status === "REGISTERED" ? { ...inv, status: "PRINT_QUEUED" as const, printQueuedAt: now } : inv));
    const job: BulkPrintJob = {
      jobId: `PJOB-${Date.now()}`,
      invoiceIds: queued.filter((i) => i.status === "PRINT_QUEUED").map((i) => i.invoiceId),
      createdAt: now,
      status: "QUEUED",
      printedCount: 0,
      failedCount: 0,
    };
    return { job, invoices: queued };
  }

  /** Complete a bulk print job */
  public static completePrintJob(job: BulkPrintJob, printedCount: number, failedCount: number): BulkPrintJob {
    return { ...job, status: failedCount > 0 ? "FAILED" : "COMPLETED", printedCount, failedCount, completedAt: new Date().toISOString() };
  }
}

export default EInvoiceEngine;
