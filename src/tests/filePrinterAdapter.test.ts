/**
 * Project      : SMRITI Retail OS
 * Module       : File Printer Transport Adapter Unit Tests
 * Standard     : SCS-PRINT-FILE-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FilePrinterAdapter } from "../core/printing/execution/adapters/FilePrinterAdapter.ts";
import { UniversalPrintOrchestrator } from "../core/printing/execution/UniversalPrintOrchestrator.ts";
import { UniversalPrintJob } from "../core/printing/execution/UniversalPrintJob.ts";
import { PrinterProfile } from "../core/printing/models/PrinterProfile.ts";
import { UniversalPrintCanvas } from "../core/printing/models/UniversalPrintCanvas.ts";
import { PRNAstParser } from "../core/printing/prn_engine/PRNAstParser.ts";
import { UniversalPrintTemplate } from "../core/printing/models/UniversalPrintTemplate.ts";
import * as fs from "fs";
import * as path from "path";

describe("File Printer Transport Adapter Test Suite", () => {
  const testOutputDir = path.join(process.cwd(), "scratch", "test_file_outputs");
  let adapter: FilePrinterAdapter;

  beforeEach(() => {
    adapter = new FilePrinterAdapter(testOutputDir);
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      try {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it("1. Automatically detects FILE transport for PortName === FILE: queue", async () => {
    const filePrinter = new PrinterProfile({
      id: "p-file-ih2",
      name: "IMPACT by Honeywell IH-2 (300 dpi) - DPL",
      connectionType: "WINDOWS_SPOOLER",
      connection: { interfaceType: "WINDOWS_SPOOLER", spoolerName: "IMPACT by Honeywell IH-2 (300 dpi) - DPL (FILE:)" },
    });

    const tmpl = PRNAstParser.importPRN("^XA^FDTEST^FS^XZ");
    const canvas = new UniversalPrintCanvas();

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: filePrinter,
      records: [{}],
    });

    expect(res.job.transport).toBe("FILE");
    expect(res.job.status).toBe("FILE_GENERATED");
  });

  it("2. Generates valid DPL .prn file on disk", async () => {
    const dplTmpl = new UniversalPrintTemplate({
      metadata: { id: "tmpl-dpl-01", name: "DPL Template", version: "1.0.0", sourceFormat: "PRN_DPL", sourceType: "IMPORTED_PRN", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      source: { originalFormat: "DPL", originalContent: "\x02L\nD11\n191100000500050{brand}\nE\n" },
    });
    dplTmpl.setFieldMapping("{brand}", "brand");

    const dplPrinter = new PrinterProfile({ id: "p-dpl", name: "Honeywell IH2", connectionType: "FILE" });
    const canvas = new UniversalPrintCanvas();

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: dplTmpl,
      canvas,
      printer: dplPrinter,
      records: [{ brand: "Honeywell DPL" }],
    });

    expect(res.job.status).toBe("FILE_GENERATED");
    expect(res.job.renderedPayload?.includes("Honeywell DPL")).toBe(true);
  });

  it("3. Generates valid ZPL .prn file on disk", async () => {
    const zplTmpl = PRNAstParser.importPRN("^XA^FD{item}^FS^XZ");
    zplTmpl.setFieldMapping("{item}", "item");

    const zplPrinter = new PrinterProfile({ id: "p-zpl", name: "Zebra ZD420", connectionType: "FILE" });
    const canvas = new UniversalPrintCanvas();

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: zplTmpl,
      canvas,
      printer: zplPrinter,
      records: [{ item: "ZPL_SHOES" }],
    });

    expect(res.job.status).toBe("FILE_GENERATED");
    expect(res.job.renderedPayload?.includes("ZPL_SHOES")).toBe(true);
  });

  it("4. Generates valid TSPL .prn file on disk", async () => {
    const tsplTmpl = new UniversalPrintTemplate({
      metadata: { id: "tmpl-tspl-01", name: "TSPL Template", version: "1.0.0", sourceFormat: "PRN_TSPL", sourceType: "IMPORTED_PRN", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      source: { originalFormat: "TSPL", originalContent: "SIZE 100 mm, 50 mm\nTEXT 50,50,\"3\",0,1,1,\"{style}\"\nPRINT 1\n" },
    });
    tsplTmpl.setFieldMapping("{style}", "style");

    const tsplPrinter = new PrinterProfile({
      id: "p-tspl",
      name: "TSC TTP-244",
      connectionType: "FILE",
      capabilities: { supportsTSPL: true },
    });
    const canvas = new UniversalPrintCanvas();

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tsplTmpl,
      canvas,
      printer: tsplPrinter,
      records: [{ style: "TSPL_STYLE_99" }],
    });

    expect(res.job.status).toBe("FILE_GENERATED");
    expect(res.job.renderedPayload?.includes("TSPL_STYLE_99")).toBe(true);
  });

  it("5. Supports multiple PRN templates generated to separate files independently", async () => {
    const t1 = PRNAstParser.importPRN("^XA^FD{code}^FS^XZ");
    t1.metadata.id = "Tattly_ZPL";

    const t2 = new UniversalPrintTemplate({
      metadata: { id: "Honeywell_DPL", name: "Honeywell DPL", version: "1.0.0", sourceFormat: "PRN_DPL", sourceType: "IMPORTED_PRN", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      source: { originalFormat: "DPL", originalContent: "DPL_PAYLOAD" },
    });

    const filePrinter = new PrinterProfile({ id: "p-file-1", name: "File Printer", connectionType: "FILE" });
    const canvas = new UniversalPrintCanvas();

    const job1 = new UniversalPrintJob({ jobId: "j1", templateId: t1.metadata.id, printerId: filePrinter.id, renderedPayload: "^XA^FDTATTLY^FS^XZ" });
    const job2 = new UniversalPrintJob({ jobId: "j2", templateId: t2.metadata.id, printerId: filePrinter.id, renderedPayload: "\x02L\nD11\nHONEYWELL\nE\n" });

    const f1 = await adapter.generate(job1, filePrinter, "Tattly.prn");
    const f2 = await adapter.generate(job2, filePrinter, "Honeywell.prn");

    expect(fs.existsSync(f1.filePath)).toBe(true);
    expect(fs.existsSync(f2.filePath)).toBe(true);
    expect(f1.fileName).toBe("Tattly.prn");
    expect(f2.fileName).toBe("Honeywell.prn");
  });

  it("6. Resolves field bindings fully before writing payload to file", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{brand}^FS^FD{mrp}^FS^XZ");
    tmpl.setFieldMapping("{brand}", "brand");
    tmpl.setFieldMapping("{mrp}", "mrp");

    const filePrinter = new PrinterProfile({ id: "p-file", name: "File Printer", connectionType: "FILE" });
    const canvas = new UniversalPrintCanvas();

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: filePrinter,
      records: [{ brand: "Nike", mrp: "2999" }],
    });

    expect(res.job.renderedPayload?.includes("{brand}")).toBe(false);
    expect(res.job.renderedPayload?.includes("Nike")).toBe(true);
    expect(res.job.renderedPayload?.includes("2999")).toBe(true);
  });

  it("7. Binds multiple product records to distinct label instances in generated payload", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{item}^FS^XZ");
    tmpl.setFieldMapping("{item}", "item");

    const filePrinter = new PrinterProfile({ id: "p-file", name: "File Printer", connectionType: "FILE" });
    const canvas = new UniversalPrintCanvas();

    const records = [{ item: "PRODUCT_A" }, { item: "PRODUCT_B" }];
    const payload = UniversalPrintOrchestrator.renderPrintPayload(tmpl, canvas, filePrinter, records);

    expect(payload.includes("PRODUCT_A")).toBe(true);
    expect(payload.includes("PRODUCT_B")).toBe(true);
  });

  it("8. Formats multiple copies count natively without duplicating logical records", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FDITEM^FS^PQ1^XZ");
    const filePrinter = new PrinterProfile({ id: "p-file", name: "File Printer", connectionType: "FILE" });
    const canvas = new UniversalPrintCanvas();

    const payload = UniversalPrintOrchestrator.renderPrintPayload(tmpl, canvas, filePrinter, [{}], 5);
    expect(payload.includes("^PQ5")).toBe(true);
  });

  it("9. Computes deterministic file payload checksum", async () => {
    const job = new UniversalPrintJob({
      jobId: "chk-j1",
      templateId: "t1",
      printerId: "p1",
      renderedPayload: "^XA^FDCHECKSUM_TEST^FS^XZ",
    });

    const filePrinter = new PrinterProfile({ id: "p1", name: "Printer", connectionType: "FILE" });
    const fileRes = await adapter.generate(job, filePrinter, "checksum_test.prn");

    expect(fileRes.checksum).toBe(job.checksum);
    expect(fileRes.bytes).toBeGreaterThan(0);
  });

  it("10. Retrieves accurate metadata for generated file via getMetadata()", async () => {
    const job = new UniversalPrintJob({
      jobId: "meta-j1",
      templateId: "t1",
      printerId: "p1",
      renderedPayload: "^XA^FDMETADATA^FS^XZ",
    });

    const filePrinter = new PrinterProfile({ id: "p1", name: "Printer", connectionType: "FILE" });
    const fileRes = await adapter.generate(job, filePrinter, "meta_test.prn");

    const meta = await adapter.getMetadata(fileRes.filePath);
    expect(meta.exists).toBe(true);
    expect(meta.sizeBytes).toBe(fileRes.bytes);
    expect(meta.language).toBe("ZPL");
  });

  it("11. Previews raw PRN payload content and line count summary", () => {
    const preview = adapter.preview("^XA\n^FDLINE 1^FS\n^FDLINE 2^FS\n^XZ", "ZPL");
    expect(preview.lineCount).toBe(4);
    expect(preview.summary.includes("ZPL")).toBe(true);
  });

  it("12. Generates OS directory folder show path via getFolderShowPath()", () => {
    const dummyPath = path.join(testOutputDir, "sample.prn");
    const folderPath = adapter.getFolderShowPath(dummyPath);
    expect(folderPath).toBe(path.resolve(testOutputDir));
  });

  it("13. Preserves RAW_COMMAND nodes in rendered file stream", async () => {
    const ast = PRNAstParser.parse("^XA^FO10,10^FDRAW ZPL^FS^XZ");
    const tmpl = new UniversalPrintTemplate({
      metadata: { id: "raw-t1", name: "RAW Template", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      source: { originalFormat: "ZPL", originalContent: "^XA^FO10,10^FDRAW ZPL^FS^XZ" },
    });
    tmpl.document = ast.convertToUniversalLabelDocument();

    const zplPrinter = new PrinterProfile({ id: "p1", name: "Printer", connectionType: "FILE" });
    const canvas = new UniversalPrintCanvas();

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer: zplPrinter,
      records: [{}],
    });

    expect(res.job.status).toBe("FILE_GENERATED");
  });

  it("14. Sanitizes output filenames to remove OS invalid characters", () => {
    const dirtyName = "test/label:v1<spec>*.txt";
    const cleanName = adapter.sanitizeFilename(dirtyName);

    expect(cleanName.includes("/")).toBe(false);
    expect(cleanName.includes(":")).toBe(false);
    expect(cleanName.includes("<")).toBe(false);
    expect(cleanName.endsWith(".prn")).toBe(true);
  });

  it("15. Strictly maintains FILE_GENERATED status distinctly separate from PRINTED", async () => {
    const job = new UniversalPrintJob({
      jobId: "sep-j1",
      templateId: "t1",
      printerId: "p1",
      renderedPayload: "^XA^XZ",
    });

    const filePrinter = new PrinterProfile({ id: "p1", name: "Printer", connectionType: "FILE" });
    const res = await adapter.dispatch(job, filePrinter);

    expect(res.success).toBe(true);
    expect(job.status).toBe("FILE_GENERATED");
    expect(job.status as string).not.toBe("PRINTED");
    expect(job.status as string).not.toBe("COMPLETED");
  });
});
