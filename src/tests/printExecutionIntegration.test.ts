/**
 * Project      : SMRITI Retail OS
 * Module       : Print Execution Integration Test Suite
 * Standard     : SCS-PRINT-EXEC-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { UniversalPrintOrchestrator } from "../core/printing/execution/UniversalPrintOrchestrator.ts";
import { UniversalPrintSpooler } from "../core/printing/execution/UniversalPrintSpooler.ts";
import { UniversalPrintCanvas } from "../core/printing/models/UniversalPrintCanvas.ts";
import { UniversalPrintTemplate } from "../core/printing/models/UniversalPrintTemplate.ts";
import { PrinterProfile } from "../core/printing/models/PrinterProfile.ts";
import { PRNAstParser } from "../core/printing/prn_engine/PRNAstParser.ts";

const TATTLY_GOLDEN_PRN = `^XA
^PW804
^FO706,47^BY3^BCB,50,N,N^FD{barcode}^FS
^FT781,340^CI0^AAB,27,15^FD{barcode}^FS
^FT345,53^A0N,34,46^FD{brand}^FS
^FT410,124^A0N,45,43^FR^FD{style_code}^FS
^PQ1,0,1,Y
^XZ`;

describe("Print Execution Integration & Orchestration Test Suite (Phase H)", () => {
  const zplPrinter = new PrinterProfile({
    id: "p-zd420",
    name: "Zebra ZD420",
    dpi: 203,
    connectionType: "TCP",
    host: "192.168.1.200",
    port: 9100,
    media: { maxWidthMm: 104, maxHeightMm: 1000 },
    capabilities: { supportsZPL: true, supportsTSPL: false },
  });

  const tsplPrinter = new PrinterProfile({
    id: "p-tsc244",
    name: "TSC TTP-244",
    dpi: 203,
    connectionType: "TCP",
    host: "192.168.1.201",
    port: 9100,
    media: { maxWidthMm: 108, maxHeightMm: 1000 },
    capabilities: { supportsZPL: false, supportsTSPL: true },
  });

  beforeEach(async () => {
    await UniversalPrintSpooler.clear();
  });

  // 1. Dry run preview verification
  it("1. Executes dry run preview without physical dispatch and returns resolved field values & checksum", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{style_code}^FS^XZ");
    const canvas = new UniversalPrintCanvas({ widthMm: 100 });

    const records = [{ style_code: "SHOE-101" }];

    const dryRes = await UniversalPrintOrchestrator.dryRun({
      template: tmpl,
      canvas,
      printer: zplPrinter,
      records,
    });

    expect(dryRes.recordCount).toBe(1);
    expect(dryRes.renderedPayload.includes("SHOE-101")).toBe(true);
    expect(dryRes.payloadChecksum.startsWith("chk-")).toBe(true);
  });

  // 2. Full job execution pipeline
  it("2. Executes full job execution pipeline (Template -> Binding -> Render -> Spool -> Adapter)", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{style_code}^FS^XZ");
    const canvas = new UniversalPrintCanvas({ widthMm: 100 });

    const records = [{ style_code: "SHOE-202" }];

    const execRes = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: zplPrinter,
      records,
    });

    expect(execRes.job.status).toBe("COMPLETED");
    expect(execRes.dispatchResult?.success).toBe(true);
    expect(execRes.job.renderedPayload?.includes("SHOE-202")).toBe(true);
  });

  // 3. MANDATORY FIXTURE: Tattly Golden Print Job Pipeline
  it("3. MANDATORY FIXTURE: Executes Tattly Threads golden print job through entire kernel pipeline", async () => {
    const tmpl = PRNAstParser.importPRN(TATTLY_GOLDEN_PRN);
    tmpl.setFieldMapping("{barcode}", "barcode");
    tmpl.setFieldMapping("{brand}", "brand");
    tmpl.setFieldMapping("{style_code}", "style_code");

    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50, dpi: 203 });

    const records = [
      {
        barcode: "8901234567890",
        brand: "Tattly Threads",
        style_code: "TTL-BLK-M",
      },
    ];

    const dryRes = await UniversalPrintOrchestrator.dryRun({
      template: tmpl,
      canvas,
      printer: zplPrinter,
      records,
    });

    expect(dryRes.compatibilityScore).toBe(100);
    expect(dryRes.renderedPayload.includes("8901234567890")).toBe(true);
    expect(dryRes.renderedPayload.includes("Tattly Threads")).toBe(true);
    expect(dryRes.renderedPayload.includes("TTL-BLK-M")).toBe(true);

    const execRes = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: zplPrinter,
      records,
    });

    expect(execRes.job.status).toBe("COMPLETED");
    expect(execRes.job.checksum).toBeDefined();
  });

  // 4. Multiple PRN templates coexistence
  it("4. Supports multiple PRN templates simultaneously by templateId + version", async () => {
    const t1 = PRNAstParser.importPRN("^XA^FD{style_code}^FS^XZ", { templateName: "Footwear Template" });
    t1.metadata.id = "tmpl-footwear-v1";
    t1.metadata.version = "1.0.0";

    const t2 = PRNAstParser.importPRN("^XA^FD{barcode}^FS^XZ", { templateName: "Apparel Template" });
    t2.metadata.id = "tmpl-apparel-v2";
    t2.metadata.version = "2.1.0";

    const canvas = new UniversalPrintCanvas({ widthMm: 100 });

    const res1 = await UniversalPrintOrchestrator.dryRun({ template: t1, canvas, printer: zplPrinter, records: [{ style_code: "F1" }] });
    const res2 = await UniversalPrintOrchestrator.dryRun({ template: t2, canvas, printer: zplPrinter, records: [{ barcode: "A1" }] });

    expect(res1.templateId).toBe("tmpl-footwear-v1");
    expect(res2.templateId).toBe("tmpl-apparel-v2");
    expect(res1.payloadChecksum).not.toBe(res2.payloadChecksum);
  });

  // 5. Incompatible target printer language governance
  it("5. Fails print job with UNSUPPORTED_PRINTER if template language is incompatible with printer", async () => {
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });
    const canvas = new UniversalPrintCanvas();

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: tsplPrinter, // TSPL printer does not support ZPL
      records: [{}],
    });

    expect(res.job.status).toBe("FAILED");
    expect(res.job.error?.includes("UNSUPPORTED_PRINTER")).toBe(true);
  });

  // 6. RAW_COMMAND preservation and language mismatch check
  it("6. Fails print job with UNSUPPORTED_TARGET_LANGUAGE if RAW_COMMAND content language contradicts printer", async () => {
    const ast = PRNAstParser.parse("^XA^FO50,50^FDRAW ZPL^FS^XZ");
    const tmpl = new UniversalPrintTemplate({ source: { originalFormat: "ZPL", originalContent: "^XA^XZ" } });
    tmpl.document = ast.convertToUniversalLabelDocument();
    const canvas = new UniversalPrintCanvas();

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: tsplPrinter,
      records: [{}],
    });

    expect(res.job.status).toBe("FAILED");
  });

  // 7. Deduplication double print safety
  it("7. Prevents duplicate job execution by payload checksum deduplication", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{style_code}^FS^XZ");
    const canvas = new UniversalPrintCanvas();
    const records = [{ style_code: "UNIQUE-99" }];

    const res1 = await UniversalPrintOrchestrator.executePrintJob({ template: tmpl, canvas, printer: zplPrinter, records });
    const res2 = await UniversalPrintOrchestrator.executePrintJob({ template: tmpl, canvas, printer: zplPrinter, records });

    expect(res1.job.status).toBe("COMPLETED");
    expect(res2.job.status).toBe("CANCELLED"); // Duplicate cancelled
  });

  // 8. Copies count handling
  it("8. Updates ^PQ print quantity command for multiple copies count", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FDITEM^FS^PQ1^XZ");
    const canvas = new UniversalPrintCanvas();

    const payload = UniversalPrintOrchestrator.renderPrintPayload(tmpl, canvas, zplPrinter, [{}], 5);
    expect(payload.includes("^PQ5")).toBe(true);
  });

  // 9. N records to 1 canvas execution
  it("9. Renders N product records into multi-label payload", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{item}^FS^XZ");
    tmpl.setFieldMapping("{item}", "item");
    const canvas = new UniversalPrintCanvas();

    const records = [{ item: "A" }, { item: "B" }, { item: "C" }];
    const payload = UniversalPrintOrchestrator.renderPrintPayload(tmpl, canvas, zplPrinter, records);

    expect(payload.includes("A")).toBe(true);
    expect(payload.includes("B")).toBe(true);
    expect(payload.includes("C")).toBe(true);
  });

  // 10. USB transport security boundary handling
  it("10. USB transport requires Local Agent authorization without faking print success", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^XZ");
    const canvas = new UniversalPrintCanvas();

    const usbPrinter = new PrinterProfile({ id: "p-usb-1", name: "USB Printer", connectionType: "USB" });

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: usbPrinter,
      records: [{}],
    });

    expect(res.dispatchResult?.code).toBe("USB_ACCESS_REQUIRES_AGENT");
    expect(res.job.status).toBe("FAILED");
  });

  // 11. Local Agent transport dispatch
  it("11. Local Agent transport executes print job cleanly", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^XZ");
    const canvas = new UniversalPrintCanvas();

    const agentPrinter = new PrinterProfile({ id: "p-agent-1", name: "Agent Printer", connectionType: "LOCAL_AGENT" });

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: agentPrinter,
      records: [{}],
    });

    expect(res.job.status).toBe("COMPLETED");
    expect(res.dispatchResult?.code).toBe("COMPLETED");
  });

  // 12. File transport dispatch
  it("12. File transport captures PRN output payload stream", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FDFILE_OUTPUT^FS^XZ");
    const canvas = new UniversalPrintCanvas();

    const filePrinter = new PrinterProfile({ id: "p-file-1", name: "File Printer", connectionType: "FILE" });

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: filePrinter,
      records: [{}],
    });

    expect(res.job.status).toBe("COMPLETED");
    expect(res.job.renderedPayload?.includes("FILE_OUTPUT")).toBe(true);
  });

  // 13. Audit diagnostics logging
  it("13. Records detailed transport logs and warnings in print job diagnostics", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{brand}^FS^XZ");
    const canvas = new UniversalPrintCanvas({ dpi: 300 }); // DPI mismatch generates warning

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: zplPrinter,
      records: [{ brand: "Nike" }],
    });

    expect(res.job.diagnostics.warnings.length).toBeGreaterThan(0);
    expect(res.job.diagnostics.transportLogs.length).toBeGreaterThan(0);
  });

  // 14. 3-up multi-up canvas payload rendering
  it("14. Renders 3-up multi-up grid layout records into multi-column payload", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{code}^FS^XZ");
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, heightMm: 50 });
    canvas.setupGrid(3, 1, 30, 50, 2, 0);

    const records = [{ code: "C1" }, { code: "C2" }, { code: "C3" }];
    const dryRes = await UniversalPrintOrchestrator.dryRun({ template: tmpl, canvas, printer: zplPrinter, records });

    expect(dryRes.renderedPayload.includes("C1")).toBe(true);
    expect(dryRes.renderedPayload.includes("C3")).toBe(true);
  });

  // 15. Non-destructive field mapping resolution
  it("15. Resolves field bindings dynamically without mutating template source or mappings", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{color}^FS^XZ");
    tmpl.setFieldMapping("{color}", "product.color");

    const canvas = new UniversalPrintCanvas();

    await UniversalPrintOrchestrator.dryRun({ template: tmpl, canvas, printer: zplPrinter, records: [{ color: "RED" }] });
    await UniversalPrintOrchestrator.dryRun({ template: tmpl, canvas, printer: zplPrinter, records: [{ color: "BLUE" }] });

    expect(tmpl.fieldMappings.get("{color}")).toBe("product.color");
  });
});
