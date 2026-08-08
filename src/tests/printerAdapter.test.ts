/**
 * Project      : SMRITI Retail OS
 * Module       : Printer Transport Adapters Unit Tests
 * Standard     : SCS-PRINT-ADAPTER-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { UsbPrinterAdapter } from "../core/printing/execution/adapters/UsbPrinterAdapter.ts";
import { TcpRawPrinterAdapter } from "../core/printing/execution/adapters/TcpRawPrinterAdapter.ts";
import { WindowsSpoolerPrinterAdapter } from "../core/printing/execution/adapters/WindowsSpoolerPrinterAdapter.ts";
import { LocalAgentPrinterAdapter } from "../core/printing/execution/adapters/LocalAgentPrinterAdapter.ts";
import { FilePrinterAdapter } from "../core/printing/execution/adapters/FilePrinterAdapter.ts";
import { UniversalPrintJob } from "../core/printing/execution/UniversalPrintJob.ts";
import { PrinterProfile } from "../core/printing/models/PrinterProfile.ts";

describe("Printer Transport Adapters Test Suite (Phase H)", () => {
  const genericPrinter = new PrinterProfile({
    id: "p-test",
    name: "Generic Test Printer",
    dpi: 203,
  });

  // 1-4 USB Transport Adapter Tests
  it("1. USB adapter returns USB_ACCESS_REQUIRES_AGENT when direct WebUSB API is unprivileged", async () => {
    const adapter = new UsbPrinterAdapter();
    const job = new UniversalPrintJob({ jobId: "u1", templateId: "t1", printerId: "p-test", renderedPayload: "^XA^XZ" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.success).toBe(false);
    expect(res.code).toBe("USB_ACCESS_REQUIRES_AGENT");
  });

  it("2. USB adapter rejects empty payload with INVALID_PAYLOAD", async () => {
    const adapter = new UsbPrinterAdapter();
    const job = new UniversalPrintJob({ jobId: "u2", templateId: "t1", printerId: "p-test", renderedPayload: "" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.code).toBe("INVALID_PAYLOAD");
  });

  it("3. USB adapter identifies as USB transport type", () => {
    const adapter = new UsbPrinterAdapter();
    expect(adapter.transportType).toBe("USB");
  });

  it("4. USB adapter checks printer status cleanly", async () => {
    const adapter = new UsbPrinterAdapter();
    const status = await adapter.checkStatus(genericPrinter);
    expect(status.online).toBe(true);
  });

  // 5-8 TCP RAW 9100 Transport Adapter Tests
  it("5. TCP adapter dispatches raw payload and returns TRANSPORT_ACCEPTED", async () => {
    const adapter = new TcpRawPrinterAdapter();
    const job = new UniversalPrintJob({ jobId: "tcp1", templateId: "t1", printerId: "p-test", renderedPayload: "^XA^FDTEST^FS^XZ" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.success).toBe(true);
    expect(res.code).toBe("TRANSPORT_ACCEPTED");
    expect(res.bytesTransferred).toBeGreaterThan(0);
  });

  it("6. TCP adapter returns INVALID_PAYLOAD on empty string payload", async () => {
    const adapter = new TcpRawPrinterAdapter();
    const job = new UniversalPrintJob({ jobId: "tcp2", templateId: "t1", printerId: "p-test", renderedPayload: "" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.code).toBe("INVALID_PAYLOAD");
  });

  it("7. TCP adapter identifies as TCP transport type", () => {
    const adapter = new TcpRawPrinterAdapter();
    expect(adapter.transportType).toBe("TCP");
  });

  it("8. TCP adapter reports connection endpoint in status check", async () => {
    const adapter = new TcpRawPrinterAdapter();
    const status = await adapter.checkStatus(genericPrinter);
    expect(status.online).toBe(true);
    expect(status.statusMessage.includes("192.168.1.200:9100")).toBe(true);
  });

  // 9-12 Windows Spooler Transport Adapter Tests
  it("9. Windows spooler adapter accepts job submission into spooler queue", async () => {
    const adapter = new WindowsSpoolerPrinterAdapter();
    const job = new UniversalPrintJob({ jobId: "win1", templateId: "t1", printerId: "p-test", renderedPayload: "^XA^XZ" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.success).toBe(true);
    expect(res.code).toBe("TRANSPORT_ACCEPTED");
  });

  it("10. Windows spooler adapter rejects empty job payload", async () => {
    const adapter = new WindowsSpoolerPrinterAdapter();
    const job = new UniversalPrintJob({ jobId: "win2", templateId: "t1", printerId: "p-test", renderedPayload: "" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.code).toBe("INVALID_PAYLOAD");
  });

  it("11. Windows spooler adapter identifies as WINDOWS_SPOOLER transport type", () => {
    const adapter = new WindowsSpoolerPrinterAdapter();
    expect(adapter.transportType).toBe("WINDOWS_SPOOLER");
  });

  it("12. Windows spooler adapter checks status cleanly", async () => {
    const adapter = new WindowsSpoolerPrinterAdapter();
    const status = await adapter.checkStatus(genericPrinter);
    expect(status.online).toBe(true);
  });

  // 13-16 Local Agent Transport Adapter Tests
  it("13. Local agent adapter executes job successfully when agent is active", async () => {
    const adapter = new LocalAgentPrinterAdapter();
    const job = new UniversalPrintJob({ jobId: "ag1", templateId: "t1", printerId: "p-test", renderedPayload: "^XA^XZ" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.success).toBe(true);
    expect(res.code).toBe("COMPLETED");
  });

  it("14. Local agent adapter returns AGENT_UNAVAILABLE when agent is offline", async () => {
    const adapter = new LocalAgentPrinterAdapter();
    adapter.setAgentAvailability(false);

    const job = new UniversalPrintJob({ jobId: "ag2", templateId: "t1", printerId: "p-test", renderedPayload: "^XA^XZ" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.success).toBe(false);
    expect(res.code).toBe("AGENT_UNAVAILABLE");
  });

  it("15. Local agent implements agent contract methods (discoverPrinters, submitJob, cancelJob)", async () => {
    const adapter = new LocalAgentPrinterAdapter();
    const printers = await adapter.discoverPrinters();
    expect(printers.length).toBeGreaterThan(0);

    const cancelRes = await adapter.cancelJob("ag-cancel-job");
    expect(cancelRes.cancelled).toBe(true);
  });

  it("16. Local agent checks printer status cleanly", async () => {
    const adapter = new LocalAgentPrinterAdapter();
    const status = await adapter.checkStatus(genericPrinter);
    expect(status.online).toBe(true);
  });

  // 17-20 File Transport Adapter Tests
  it("17. File adapter captures output payload in memory buffer", async () => {
    const adapter = new FilePrinterAdapter();
    const job = new UniversalPrintJob({ jobId: "f1", templateId: "t1", printerId: "p-test", renderedPayload: "^XA^FDPRN OUTPUT^FS^XZ" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.success).toBe(true);
    expect(adapter.lastOutputPayload).toBe("^XA^FDPRN OUTPUT^FS^XZ");
  });

  it("18. File adapter rejects empty job payload", async () => {
    const adapter = new FilePrinterAdapter();
    const job = new UniversalPrintJob({ jobId: "f2", templateId: "t1", printerId: "p-test", renderedPayload: "" });

    const res = await adapter.dispatch(job, genericPrinter);
    expect(res.code).toBe("INVALID_PAYLOAD");
  });

  it("19. File adapter identifies as FILE transport type", () => {
    const adapter = new FilePrinterAdapter();
    expect(adapter.transportType).toBe("FILE");
  });

  it("20. File adapter checks status cleanly", async () => {
    const adapter = new FilePrinterAdapter();
    const status = await adapter.checkStatus(genericPrinter);
    expect(status.online).toBe(true);
  });
});
