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

import { describe, it, expect } from "vitest";
import LabelPrintEngine, { DEFAULT_TEMPLATE } from "../utils/labelPrintEngine";

describe("LabelPrintEngine — Barcode & Label Printing Engine", () => {

  const BRANCH = "BR-MUM-01";
  const ITEMS = [
    { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",   mrp: 250, barcode: "8901234567890", hsnCode: "5209", qty: 5, copies: 2 },
    { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m",  mrp: 120, barcode: "8901234567891", hsnCode: "5208", qty: 3, copies: 1 },
    { sku: "ACC-BELT-BRN",   productName: "Leather Belt",     mrp: 350, barcode: "8901234567892", hsnCode: "4205", qty: 2, copies: 2 },
  ];

  // ─── Test 1: Create job — totalLabels and default template fields ──────────
  it("creates a print job with correct totalLabels from qty × copies", () => {
    const job = LabelPrintEngine.createJob({
      template: DEFAULT_TEMPLATE, branchCode: BRANCH, createdBy: "STORE-MGR-001",
      items: ITEMS,
    });

    expect(job.status).toBe("QUEUED");
    expect(job.items).toHaveLength(3);
    // totalLabels: (5×2) + (3×1) + (2×2) = 10 + 3 + 4 = 17
    expect(job.totalLabels).toBe(17);
    expect(job.isReprint).toBe(false);
    expect(job.auditTrail).toHaveLength(1);
    expect(job.auditTrail[0].action).toBe("JOB_CREATED");
    expect(job.templateName).toBe(DEFAULT_TEMPLATE.name);
  });

  // ─── Test 2: addToBatch → startPrint → completePrint lifecycle ────────────
  it("addToBatch appends items; lifecycle QUEUED→PRINTING→PRINTED with audit trail", () => {
    let job = LabelPrintEngine.createJob({
      template: DEFAULT_TEMPLATE, branchCode: BRANCH, createdBy: "MGR-001",
      items: [ITEMS[0]],  // Start with 1 item: 5×2=10 labels
    });
    expect(job.totalLabels).toBe(10);

    // Add another item: 3×1=3 labels
    job = LabelPrintEngine.addToBatch(job, [ITEMS[1]], "MGR-001");
    expect(job.items).toHaveLength(2);
    expect(job.totalLabels).toBe(13);  // 10 + 3
    expect(job.auditTrail).toHaveLength(2);
    expect(job.auditTrail[1].action).toBe("ITEMS_ADDED");

    // Start printing
    job = LabelPrintEngine.startPrint(job, "PRINTER-OPERATOR-001");
    expect(job.status).toBe("PRINTING");

    // Complete
    job = LabelPrintEngine.completePrint(job, "PRINTER-OPERATOR-001");
    expect(job.status).toBe("PRINTED");
    expect(job.printedAt).toBeDefined();
    expect(job.auditTrail).toHaveLength(4);   // CREATE + ADD + START + COMPLETE
  });

  // ─── Test 3: failPrint and guard errors ───────────────────────────────────
  it("failPrint records FAILED status with reason; addToBatch throws on non-QUEUED job", () => {
    let job = LabelPrintEngine.createJob({
      template: DEFAULT_TEMPLATE, branchCode: BRANCH, createdBy: "MGR-001",
      items: [ITEMS[2]],
    });
    job = LabelPrintEngine.startPrint(job, "OP-001");
    job = LabelPrintEngine.failPrint(job, "OP-001", "Printer offline — QZ Tray disconnected");

    expect(job.status).toBe("FAILED");
    expect(job.failReason).toBe("Printer offline — QZ Tray disconnected");
    expect(job.auditTrail.at(-1)!.action).toBe("PRINT_FAILED");

    // Cannot add to a FAILED job
    expect(() => LabelPrintEngine.addToBatch(job, [ITEMS[0]], "MGR-001")).toThrow("Cannot add to job");
  });

  // ─── Test 4: Reprint (all + SKU-filtered) and queueSummary ───────────────
  it("reprint() creates new QUEUED job; skuFilter reduces items; queueSummary aggregates", () => {
    let original = LabelPrintEngine.createJob({
      template: DEFAULT_TEMPLATE, branchCode: BRANCH, createdBy: "MGR-001",
      items: ITEMS,   // 3 items, 17 labels
    });
    original = LabelPrintEngine.startPrint(original, "OP-001");
    original = LabelPrintEngine.completePrint(original, "OP-001");
    expect(original.status).toBe("PRINTED");

    // Full reprint
    const fullReprint = LabelPrintEngine.reprint(original, DEFAULT_TEMPLATE, "MGR-001");
    expect(fullReprint.isReprint).toBe(true);
    expect(fullReprint.originalJobId).toBe(original.jobId);
    expect(fullReprint.items).toHaveLength(3);
    expect(fullReprint.totalLabels).toBe(17);
    expect(fullReprint.status).toBe("QUEUED");

    // Filtered reprint — only belt
    const filtered = LabelPrintEngine.reprint(original, DEFAULT_TEMPLATE, "MGR-001", ["ACC-BELT-BRN"]);
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].sku).toBe("ACC-BELT-BRN");
    expect(filtered.totalLabels).toBe(4);  // 2×2

    // Queue summary over all 3 jobs
    const summary = LabelPrintEngine.queueSummary([original, fullReprint, filtered]);
    expect(summary.printed).toBe(1);
    expect(summary.queued).toBe(2);
    expect(summary.reprintCount).toBe(2);
    expect(summary.totalLabels).toBe(17 + 17 + 4);  // 38
  });
});
