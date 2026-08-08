/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Print Job Unit Tests
 * Standard     : SCS-PRINT-JOB-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { UniversalPrintJob } from "../core/printing/execution/UniversalPrintJob.ts";
import { PrinterProfile } from "../core/printing/models/PrinterProfile.ts";

describe("Universal Print Job Model Test Suite (Phase H)", () => {
  it("1. Creates a print job with initial QUEUED status", () => {
    const job = new UniversalPrintJob({
      jobId: "job-101",
      templateId: "tmpl-01",
      printerId: "p-01",
    });

    expect(job.status).toBe("QUEUED");
    expect(job.attempts).toBe(0);
    expect(job.copies).toBe(1);
  });

  it("2. Computes deterministic checksum based on job parameters and payload", () => {
    const j1 = new UniversalPrintJob({
      jobId: "job-102",
      templateId: "tmpl-01",
      printerId: "p-01",
      renderedPayload: "^XA^FD1234^FS^XZ",
    });

    const j2 = new UniversalPrintJob({
      jobId: "job-102",
      templateId: "tmpl-01",
      printerId: "p-01",
      renderedPayload: "^XA^FD1234^FS^XZ",
    });

    expect(j1.checksum).toBe(j2.checksum);
    expect(j1.checksum.startsWith("chk-")).toBe(true);
  });

  it("3. Updates status from QUEUED to PRINTING and records startedAt timestamp", () => {
    const job = new UniversalPrintJob({ jobId: "j3", templateId: "t1", printerId: "p1" });
    job.updateStatus("PRINTING");

    expect(job.status).toBe("PRINTING");
    expect(job.startedAt).toBeDefined();
  });

  it("4. Updates status to COMPLETED and records completedAt timestamp", () => {
    const job = new UniversalPrintJob({ jobId: "j4", templateId: "t1", printerId: "p1" });
    job.updateStatus("COMPLETED");

    expect(job.status).toBe("COMPLETED");
    expect(job.completedAt).toBeDefined();
  });

  it("5. Updates status to FAILED with explicit error diagnostic message", () => {
    const job = new UniversalPrintJob({ jobId: "j5", templateId: "t1", printerId: "p1" });
    job.updateStatus("FAILED", "TCP connection reset by target printer");

    expect(job.status).toBe("FAILED");
    expect(job.error).toBe("TCP connection reset by target printer");
    expect(job.diagnostics.errors.includes("TCP connection reset by target printer")).toBe(true);
  });

  it("6. Logs transport steps into diagnostics transcript", () => {
    const job = new UniversalPrintJob({ jobId: "j6", templateId: "t1", printerId: "p1" });
    job.logTransport("Connecting to 192.168.1.200:9100...");
    job.logTransport("Sent 150 bytes.");

    expect(job.diagnostics.transportLogs.length).toBe(2);
    expect(job.diagnostics.transportLogs[0].includes("Connecting to 192.168.1.200:9100")).toBe(true);
  });

  it("7. Serializes cleanly to JSON and deserializes back without data loss", () => {
    const original = new UniversalPrintJob({
      jobId: "j7",
      templateId: "tmpl-footwear-v1",
      templateVersion: "1.2.0",
      printerId: "p-zebra-zd420",
      records: [{ style: "FTW-999", price: 1999 }],
      renderedPayload: "^XA^FDFTW-999^FS^XZ",
    });

    const json = original.toJSON();
    const restored = UniversalPrintJob.fromJSON(json);

    expect(restored.jobId).toBe(original.jobId);
    expect(restored.checksum).toBe(original.checksum);
    expect(restored.records[0].style).toBe("FTW-999");
  });

  it("8. Preserves printer profile snapshot inside print job model", () => {
    const pProfile = new PrinterProfile({
      id: "p-usb",
      name: "Zebra USB Printer",
      dpi: 300,
    });

    const job = new UniversalPrintJob({
      jobId: "j8",
      templateId: "t1",
      printerId: "p-usb",
      printerProfileSnapshot: pProfile.toJSON(),
    });

    expect(job.printerProfileSnapshot.name).toBe("Zebra USB Printer");
    expect(job.printerProfileSnapshot.dpi).toBe(300);
  });

  it("9. Handles custom transport type assignment", () => {
    const job = new UniversalPrintJob({
      jobId: "j9",
      templateId: "t1",
      printerId: "p1",
      transport: "LOCAL_AGENT",
    });

    expect(job.transport).toBe("LOCAL_AGENT");
  });

  it("10. Supports multiple copies count without record duplication", () => {
    const job = new UniversalPrintJob({
      jobId: "j10",
      templateId: "t1",
      printerId: "p1",
      copies: 50,
      records: [{ item: "A" }],
    });

    expect(job.copies).toBe(50);
    expect(job.records.length).toBe(1);
  });

  it("11. Computes distinct checksums for different payload contents", () => {
    const j1 = new UniversalPrintJob({ jobId: "j11", templateId: "t1", printerId: "p1", renderedPayload: "PAYLOAD_A" });
    const j2 = new UniversalPrintJob({ jobId: "j11", templateId: "t1", printerId: "p1", renderedPayload: "PAYLOAD_B" });

    expect(j1.checksum).not.toBe(j2.checksum);
  });

  it("12. Tracks maxAttempts retry threshold", () => {
    const job = new UniversalPrintJob({ jobId: "j12", templateId: "t1", printerId: "p1", maxAttempts: 5 });
    expect(job.maxAttempts).toBe(5);
  });

  it("13. Handles empty records array initialization", () => {
    const job = new UniversalPrintJob({ jobId: "j13", templateId: "t1", printerId: "p1" });
    expect(Array.isArray(job.records)).toBe(true);
    expect(job.records.length).toBe(0);
  });

  it("14. Updates status to CANCELLED and populates completedAt", () => {
    const job = new UniversalPrintJob({ jobId: "j14", templateId: "t1", printerId: "p1" });
    job.updateStatus("CANCELLED", "User cancelled job manually.");

    expect(job.status).toBe("CANCELLED");
    expect(job.completedAt).toBeDefined();
  });

  it("15. Preserves target printer language in job metadata", () => {
    const job = new UniversalPrintJob({ jobId: "j15", templateId: "t1", printerId: "p1", language: "TSPL" });
    expect(job.language).toBe("TSPL");
  });

  it("16. Handles RETRYING status transition", () => {
    const job = new UniversalPrintJob({ jobId: "j16", templateId: "t1", printerId: "p1" });
    job.updateStatus("RETRYING", "Network timeout, retrying...");

    expect(job.status).toBe("RETRYING");
    expect(job.diagnostics.errors[0]).toBe("Network timeout, retrying...");
  });

  it("17. Calculates execution duration when startedAt and completedAt are present", () => {
    const job = new UniversalPrintJob({ jobId: "j17", templateId: "t1", printerId: "p1" });
    job.updateStatus("PRINTING");
    job.updateStatus("COMPLETED");

    const tStart = new Date(job.startedAt!).getTime();
    const tEnd = new Date(job.completedAt!).getTime();
    expect(tEnd >= tStart).toBe(true);
  });

  it("18. Preserves template version in job payload identity", () => {
    const job = new UniversalPrintJob({ jobId: "j18", templateId: "t1", templateVersion: "2.5.0", printerId: "p1" });
    expect(job.templateVersion).toBe("2.5.0");
  });

  it("19. Initializes with empty warnings diagnostic array", () => {
    const job = new UniversalPrintJob({ jobId: "j19", templateId: "t1", printerId: "p1" });
    expect(job.diagnostics.warnings.length).toBe(0);
  });

  it("20. Ensures checksum is non-empty string", () => {
    const job = new UniversalPrintJob({ jobId: "j20", templateId: "t1", printerId: "p1" });
    expect(typeof job.checksum).toBe("string");
    expect(job.checksum.length).toBeGreaterThan(5);
  });
});
