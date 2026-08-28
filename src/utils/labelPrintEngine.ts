/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.116.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Barcode & Label Printing Engine
 *
 * Manages SKU-level label templates and print queue:
 *   Templates   : Configurable fields (barcode, QR, price, MRP, SKU, name, HSN)
 *   Print Queue : `addToBatch()` — batches SKU + qty combos for a print run
 *   Format      : CODE128, QR_CODE, EAN13, CODE39
 *   Status      : QUEUED → PRINTING → PRINTED / FAILED
 *   Reprint     : `reprint()` — copies a previous job with new jobId + audit
 *   Audit       : Immutable log per batch job
 */

export type BarcodeFormat  = "CODE128" | "QR_CODE" | "EAN13" | "CODE39";
export type PrintJobStatus = "QUEUED" | "PRINTING" | "PRINTED" | "FAILED" | "CANCELLED";

export interface LabelField {
  fieldKey:  string;   // e.g. "barcode", "mrp", "sku", "name", "hsn", "mfgDate"
  label:     string;   // Display label on physical label
  visible:   boolean;
  fontSize?:  number;
  bold?:      boolean;
  position?:  "TOP" | "MIDDLE" | "BOTTOM";
}

export interface LabelTemplate {
  templateId:   string;
  templateCode: string;
  name:         string;
  barcodeFormat: BarcodeFormat;
  width:        number;   // mm
  height:       number;   // mm
  fields:       LabelField[];
  copies:       number;   // Default copies per item
  isDefault:    boolean;
  createdAt:    string;
}

export interface PrintItem {
  itemId:       string;
  sku:          string;
  productName:  string;
  mrp:          number;
  barcode:      string;
  hsnCode?:     string;
  qty:          number;   // Labels to print for this SKU
  copies:       number;   // Copies per label
}

export interface PrintJobAuditEntry {
  auditId:     string;
  action:      string;
  performedBy: string;
  timestamp:   string;
  note?:       string;
}

export interface PrintJob {
  jobId:       string;
  jobNo:       string;
  templateId:  string;
  templateName: string;
  branchCode:  string;
  posTerminal?: string;
  status:      PrintJobStatus;
  items:       PrintItem[];
  totalLabels: number;   // sum(item.qty * item.copies)
  printedAt?:  string;
  failReason?:  string;
  isReprint:   boolean;
  originalJobId?: string;
  auditTrail:  PrintJobAuditEntry[];
  createdAt:   string;
  createdBy:   string;
  updatedAt:   string;
}

export const DEFAULT_TEMPLATE: LabelTemplate = {
  templateId:   "TMPL-DEFAULT",
  templateCode: "STD-58MM",
  name:         "Standard 58mm Label",
  barcodeFormat: "CODE128",
  width:  58, height: 40,
  copies: 1,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  fields: [
    { fieldKey: "name",    label: "Product",  visible: true,  fontSize: 10, bold: true, position: "TOP" },
    { fieldKey: "barcode", label: "Barcode",  visible: true,  fontSize: 8,  bold: false, position: "MIDDLE" },
    { fieldKey: "sku",     label: "SKU",      visible: true,  fontSize: 7,  bold: false, position: "MIDDLE" },
    { fieldKey: "mrp",     label: "MRP ₹",   visible: true,  fontSize: 12, bold: true,  position: "BOTTOM" },
    { fieldKey: "hsn",     label: "HSN",      visible: true,  fontSize: 7,  bold: false, position: "BOTTOM" },
  ],
};

export class LabelPrintEngine {
  private static jobCounter  = 1;
  private static itemCounter = 1;
  private static auditId     = () => `LAUD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  /** Create a new print batch */
  public static createJob(params: {
    template:    LabelTemplate;
    branchCode:  string;
    createdBy:   string;
    posTerminal?: string;
    items: Array<{
      sku:         string;
      productName: string;
      mrp:         number;
      barcode:     string;
      hsnCode?:    string;
      qty?:        number;   // labels for this SKU; defaults to 1
      copies?:     number;   // overrides template.copies
    }>;
  }): PrintJob {
    const now    = new Date().toISOString();
    const jobNo  = `LBLJOB-${params.branchCode}-${now.slice(0, 10).replace(/-/g, "")}-${String(this.jobCounter++).padStart(4, "0")}`;

    const items: PrintItem[] = params.items.map((i) => ({
      itemId:      `LITEM-${this.itemCounter++}`,
      sku:         i.sku,
      productName: i.productName,
      mrp:         i.mrp,
      barcode:     i.barcode,
      hsnCode:     i.hsnCode,
      qty:         i.qty   ?? 1,
      copies:      i.copies ?? params.template.copies,
    }));

    const totalLabels = items.reduce((s, i) => s + i.qty * i.copies, 0);

    const audit: PrintJobAuditEntry = {
      auditId: this.auditId(), action: "JOB_CREATED",
      performedBy: params.createdBy, timestamp: now,
      note: `${items.length} SKU(s), ${totalLabels} total labels, template ${params.template.templateCode}`,
    };

    return {
      jobId:        `JBID-${Date.now()}`,
      jobNo, templateId: params.template.templateId,
      templateName: params.template.name,
      branchCode:   params.branchCode,
      posTerminal:  params.posTerminal,
      status:       "QUEUED",
      items, totalLabels,
      isReprint:    false,
      auditTrail:   [audit],
      createdAt:    now, createdBy: params.createdBy, updatedAt: now,
    };
  }

  /** Add items to an existing QUEUED job */
  public static addToBatch(
    job: PrintJob,
    items: Array<{ sku: string; productName: string; mrp: number; barcode: string; hsnCode?: string; qty?: number; copies?: number }>,
    addedBy: string,
    templateCopies: number = 1
  ): PrintJob {
    if (job.status !== "QUEUED") throw new Error(`Cannot add to job ${job.jobNo} — status is ${job.status}`);
    const now = new Date().toISOString();
    const newItems: PrintItem[] = items.map((i) => ({
      itemId: `LITEM-${this.itemCounter++}`,
      sku: i.sku, productName: i.productName, mrp: i.mrp,
      barcode: i.barcode, hsnCode: i.hsnCode,
      qty: i.qty ?? 1, copies: i.copies ?? templateCopies,
    }));
    const allItems   = [...job.items, ...newItems];
    const totalLabels = allItems.reduce((s, i) => s + i.qty * i.copies, 0);
    const audit: PrintJobAuditEntry = {
      auditId: this.auditId(), action: "ITEMS_ADDED",
      performedBy: addedBy, timestamp: now,
      note: `${newItems.length} SKU(s) added, total now ${totalLabels}`,
    };
    return { ...job, items: allItems, totalLabels, auditTrail: [...job.auditTrail, audit], updatedAt: now };
  }

  /** Mark job as printing */
  public static startPrint(job: PrintJob, startedBy: string): PrintJob {
    if (job.status !== "QUEUED") throw new Error(`Cannot start — status is ${job.status}`);
    const now = new Date().toISOString();
    const audit: PrintJobAuditEntry = {
      auditId: this.auditId(), action: "PRINT_STARTED",
      performedBy: startedBy, timestamp: now,
      note: `Printing ${job.totalLabels} labels`,
    };
    return { ...job, status: "PRINTING", auditTrail: [...job.auditTrail, audit], updatedAt: now };
  }

  /** Mark job as printed */
  public static completePrint(job: PrintJob, completedBy: string): PrintJob {
    if (job.status !== "PRINTING") throw new Error(`Cannot complete — status is ${job.status}`);
    const now = new Date().toISOString();
    const audit: PrintJobAuditEntry = {
      auditId: this.auditId(), action: "PRINT_COMPLETED",
      performedBy: completedBy, timestamp: now,
      note: `${job.totalLabels} labels printed`,
    };
    return { ...job, status: "PRINTED", printedAt: now, auditTrail: [...job.auditTrail, audit], updatedAt: now };
  }

  /** Mark job as failed */
  public static failPrint(job: PrintJob, failedBy: string, reason: string): PrintJob {
    if (job.status !== "PRINTING" && job.status !== "QUEUED") throw new Error(`Cannot fail — status is ${job.status}`);
    const now = new Date().toISOString();
    const audit: PrintJobAuditEntry = {
      auditId: this.auditId(), action: "PRINT_FAILED",
      performedBy: failedBy, timestamp: now, note: reason,
    };
    return { ...job, status: "FAILED", failReason: reason, auditTrail: [...job.auditTrail, audit], updatedAt: now };
  }

  /** Reprint — creates a new QUEUED job based on a previous job */
  public static reprint(
    originalJob: PrintJob,
    template: LabelTemplate,
    reprintedBy: string,
    skuFilter?: string[]   // Reprint only specific SKUs; undefined = all
  ): PrintJob {
    const now   = new Date().toISOString();
    const items = skuFilter
      ? originalJob.items.filter((i) => skuFilter.includes(i.sku))
      : originalJob.items;

    const jobNo = `LBLJOB-${originalJob.branchCode}-${now.slice(0, 10).replace(/-/g, "")}-${String(this.jobCounter++).padStart(4, "0")}`;
    const totalLabels = items.reduce((s, i) => s + i.qty * i.copies, 0);

    const audit: PrintJobAuditEntry = {
      auditId: this.auditId(), action: "REPRINT_CREATED",
      performedBy: reprintedBy, timestamp: now,
      note: `Reprint of ${originalJob.jobNo} — ${items.length} SKU(s)`,
    };

    return {
      jobId:        `JBID-${Date.now()}`,
      jobNo, templateId: template.templateId,
      templateName: template.name,
      branchCode:   originalJob.branchCode,
      posTerminal:  originalJob.posTerminal,
      status:       "QUEUED",
      items:        items.map((i) => ({ ...i, itemId: `LITEM-${this.itemCounter++}` })),
      totalLabels,
      isReprint:    true,
      originalJobId: originalJob.jobId,
      auditTrail:   [audit],
      createdAt:    now, createdBy: reprintedBy, updatedAt: now,
    };
  }

  /** Queue summary across a list of jobs */
  public static queueSummary(jobs: PrintJob[]): {
    queued:   number;
    printing: number;
    printed:  number;
    failed:   number;
    totalLabels: number;
    reprintCount: number;
  } {
    return {
      queued:      jobs.filter((j) => j.status === "QUEUED").length,
      printing:    jobs.filter((j) => j.status === "PRINTING").length,
      printed:     jobs.filter((j) => j.status === "PRINTED").length,
      failed:      jobs.filter((j) => j.status === "FAILED").length,
      totalLabels: jobs.reduce((s, j) => s + j.totalLabels, 0),
      reprintCount: jobs.filter((j) => j.isReprint).length,
    };
  }
}

export default LabelPrintEngine;
