/**
 * Project      : SMRITI Retail OS
 * Module       : QZ Tray Printer Transport Adapter Unit Tests
 * Standard     : SCS-PRINT-QZ-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { QzTrayPrinterAdapter } from "../core/printing/execution/adapters/QzTrayPrinterAdapter.ts";
import { UniversalPrintJob } from "../core/printing/execution/UniversalPrintJob.ts";
import { PrinterProfile } from "../core/printing/models/PrinterProfile.ts";
import { UniversalPrintOrchestrator } from "../core/printing/execution/UniversalPrintOrchestrator.ts";
import { UniversalPrintCanvas } from "../core/printing/models/UniversalPrintCanvas.ts";
import { PRNAstParser } from "../core/printing/prn_engine/PRNAstParser.ts";
import { UniversalPrintTemplate } from "../core/printing/models/UniversalPrintTemplate.ts";

describe("QZ Tray Transport Adapter Test Suite", () => {
  let adapter: QzTrayPrinterAdapter;

  beforeEach(() => {
    // Port 8182 is the active QZ Tray port discovered on local OS
    adapter = new QzTrayPrinterAdapter({ ports: [8182, 8192] });
  });

  it("1. Verifies adapter transportType is QZ", () => {
    expect(adapter.transportType).toBe("QZ");
  });

  it("2. Connects to live QZ Tray WebSocket port 8182", async () => {
    const conn = await adapter.connect().catch(() => null);
    if (!conn) {
      console.warn("[QZ Tray] Not running on port 8182 â€” skipping live connection test");
      return;
    }
    expect(conn.socket).toBeDefined();
    expect(conn.port).toBe(8182);
    conn.socket.close();
  });

  it("3. Discovers registered printers via QZ Tray WebSocket API", async () => {
    let disc: Awaited<ReturnType<typeof adapter.discover>>;
    try {
      disc = await adapter.discover("Honeywell");
    } catch {
      console.warn("[QZ Tray] Not available â€” skipping printer discovery test");
      return;
    }
    if (disc.status === "NOT_CONNECTED" || disc.status === "ERROR") {
      console.warn(`[QZ Tray] Reported ${disc.status} â€” skipping live discovery assertions`);
      return;
    }
    expect(disc.status).toBe("CONNECTED");
    expect(Array.isArray(disc.printers)).toBe(true);
    expect(disc.printers.length).toBeGreaterThan(0);
    expect(disc.exactMatch?.includes("Honeywell")).toBe(true);
  }, 15000);

  it("4. Finds exact QZ printer name 'IMPACT by Honeywell IH-2 (300 dpi) - DPL'", async () => {
    const targetName = "IMPACT by Honeywell IH-2 (300 dpi) - DPL";
    let disc: Awaited<ReturnType<typeof adapter.discover>>;
    try {
      disc = await adapter.discover(targetName);
    } catch {
      console.warn("[QZ Tray] Not available â€” skipping exact match test");
      return;
    }
    if (disc.status === "NOT_CONNECTED" || disc.status === "ERROR") {
      console.warn(`[QZ Tray] Reported ${disc.status} â€” skipping exact match assertions`);
      return;
    }
    expect(disc.exactMatch).toBe(targetName);
  }, 15000);

  it("5. Dispatches raw DPL print payload to Honeywell IH-2 via QZ Tray API", async () => {
    const printer = new PrinterProfile({
      id: "p-qz-ih2",
      name: "IMPACT by Honeywell IH-2 (300 dpi) - DPL",
      connectionType: "QZ",
      language: "DPL",
    });

    const job = new UniversalPrintJob({
      jobId: "qz-dpl-j1",
      templateId: "tmpl-dpl-01",
      printerId: printer.id,
      renderedPayload: "\x02L\nD11\n191100000500050SMRITI QZ TEST\n1E0000000200050TEST-BARCODE-001\nE\n",
      language: "DPL",
      transport: "QZ",
      copies: 1,
    });

    const res = await adapter.dispatch(job, printer);
    expect(res.success).toBe(true);
    expect(res.code).toBe("QZ_ACCEPTED");
    expect(res.bytesTransferred).toBeGreaterThan(0);
  });

  it("6. Dispatches raw ZPL print payload via QZ Tray API", async () => {
    const printer = new PrinterProfile({
      id: "p-qz-zpl",
      name: "Microsoft Print to PDF",
      connectionType: "QZ",
      language: "ZPL",
    });

    const job = new UniversalPrintJob({
      jobId: "qz-zpl-j1",
      templateId: "tmpl-zpl-01",
      printerId: printer.id,
      renderedPayload: "^XA^FDSMRITI_ZPL_TEST^FS^XZ",
      language: "ZPL",
      transport: "QZ",
      copies: 1,
    });

    const res = await adapter.dispatch(job, printer);
    expect(res.success).toBe(true);
    expect(res.code).toBe("QZ_ACCEPTED");
  });

  it("7. Executes end-to-end print job pipeline with QZ transport override", async () => {
    const tmpl = PRNAstParser.importPRN("^XA^FD{title}^FS^XZ");
    tmpl.setFieldMapping("{title}", "title");

    const printer = new PrinterProfile({
      id: "p-qz-auto",
      name: "IMPACT by Honeywell IH-2 (300 dpi) - DPL",
      connectionType: "QZ",
    });

    const canvas = new UniversalPrintCanvas();

    const res = await UniversalPrintOrchestrator.executePrintJob({
      template: tmpl,
      canvas,
      printer,
      records: [{ title: "SMRITI_QZ_ORCHESTRATED" }],
      overrideTransport: "QZ",
    });

    expect(res.job.transport).toBe("QZ");
    expect(res.job.status).toBe("COMPLETED");
  });

  it("8. Fails gracefully with QZ_TRAY_NOT_CONNECTED if invalid port is specified", async () => {
    const badAdapter = new QzTrayPrinterAdapter({ ports: [9999] });
    const printer = new PrinterProfile({ id: "p-bad", name: "Dummy", connectionType: "QZ" });
    const job = new UniversalPrintJob({ jobId: "bad-j1", templateId: "t1", printerId: "p-bad", renderedPayload: "^XA^XZ" });

    const res = await badAdapter.dispatch(job, printer);
    expect(res.success).toBe(false);
    expect(res.code).toBe("QZ_TRAY_NOT_CONNECTED");
  });

  it("9. Fails with INVALID_PAYLOAD if payload is empty", async () => {
    const printer = new PrinterProfile({ id: "p1", name: "Dummy", connectionType: "QZ" });
    const job = new UniversalPrintJob({ jobId: "empty-j1", templateId: "t1", printerId: "p1", renderedPayload: "" });

    const res = await adapter.dispatch(job, printer);
    expect(res.success).toBe(false);
    expect(res.code).toBe("INVALID_PAYLOAD");
  });

  it("10. Retrieves supplementary printer status via checkStatus()", async () => {
    const printer = new PrinterProfile({ id: "p1", name: "IMPACT by Honeywell IH-2 (300 dpi) - DPL", connectionType: "QZ" });
    const status = await adapter.checkStatus(printer);
    expect(status.online).toBe(true);
    expect(status.statusMessage.includes("QZ Tray online")).toBe(true);
  });
});

