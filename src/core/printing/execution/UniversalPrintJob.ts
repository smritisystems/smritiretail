/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Universal Print Job Model
 * Standard     : SCS-PRINT-JOB-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { PrinterProfileJSON } from "../models/PrinterProfile.ts";
import { DetectedPrinterLanguage } from "../prn_engine/PrinterLanguageDetector.ts";

export type PrintJobStatus =
  | "QUEUED"
  | "PREPARING"
  | "RENDERING"
  | "READY"
  | "PRINTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "RETRYING"
  | "SENT_UNKNOWN_RESULT"
  | "FILE_GENERATED";

export type PrintTransportType =
  | "USB"
  | "TCP"
  | "WINDOWS_SPOOLER"
  | "LOCAL_AGENT"
  | "QZ"
  | "FILE";

export interface PrintJobDiagnostics {
  warnings: string[];
  errors: string[];
  transportLogs: string[];
  renderDurationMs?: number;
  transportDurationMs?: number;
}

export interface UniversalPrintJobJSON {
  jobId: string;
  templateId: string;
  templateVersion: string;
  canvasId: string;
  printerId: string;
  printerProfileSnapshot: PrinterProfileJSON;
  language: DetectedPrinterLanguage;
  transport: PrintTransportType;
  copies: number;
  records: any[];
  renderedPayload?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  status: PrintJobStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  diagnostics: PrintJobDiagnostics;
  checksum: string;
}

export class UniversalPrintJob {
  public jobId: string;
  public templateId: string;
  public templateVersion: string;
  public canvasId: string;
  public printerId: string;
  public printerProfileSnapshot: PrinterProfileJSON;
  public language: DetectedPrinterLanguage;
  public transport: PrintTransportType;
  public copies: number;
  public records: any[];
  public renderedPayload?: string;
  public createdAt: string;
  public startedAt?: string;
  public completedAt?: string;
  public status: PrintJobStatus;
  public attempts: number;
  public maxAttempts: number;
  public error?: string;
  public diagnostics: PrintJobDiagnostics;
  public checksum: string;

  constructor(init: Partial<UniversalPrintJobJSON> & { jobId: string; templateId: string; printerId: string }) {
    this.jobId = init.jobId;
    this.templateId = init.templateId;
    this.templateVersion = init.templateVersion || "1.0.0";
    this.canvasId = init.canvasId || "default-canvas";
    this.printerId = init.printerId;
    this.printerProfileSnapshot = init.printerProfileSnapshot || {
      id: init.printerId,
      name: "Generic Printer Profile",
      manufacturer: "Generic",
      model: "Thermal Printer",
      language: "ZPL",
      connectionType: "TCP",
      dpi: 203,
      status: "READY",
      capabilities: {
        supportsBarcode1D: true,
        supportsQRCode: true,
        supportsDataMatrix: true,
        supportsGS1: true,
        supportsRasterImages: true,
        supportsVectorGraphics: true,
        supportsScalableFonts: true,
        supportsRotation: true,
        supportsStatusQuery: true,
        supportsCalibration: true,
        supportsRawPrinting: true,
        supportsZPL: true,
        supportsTSPL: false,
        supportsEPL: false,
        supportsCPCL: false,
        supportsESCPOS: false,
      },
      media: {
        maxWidthMm: 108,
        maxHeightMm: 300,
        minWidthMm: 20,
        minHeightMm: 10,
        defaultDpi: 203,
        supportedDpis: [203, 300],
        supportsCutter: false,
        supportsPeeler: false,
        supportsBlackMark: true,
        supportsGapSensor: true,
        supportedSensors: ["GAP", "BLACK_MARK", "NONE"],
      },
    };
    this.language = init.language || "ZPL";
    this.transport = init.transport || "TCP";
    this.copies = init.copies ?? 1;
    this.records = init.records ? [...init.records] : [];
    this.renderedPayload = init.renderedPayload;
    this.createdAt = init.createdAt || new Date().toISOString();
    this.startedAt = init.startedAt;
    this.completedAt = init.completedAt;
    this.status = init.status || "QUEUED";
    this.attempts = init.attempts ?? 0;
    this.maxAttempts = init.maxAttempts ?? 3;
    this.error = init.error;
    this.diagnostics = init.diagnostics || {
      warnings: [],
      errors: [],
      transportLogs: [],
    };
    this.checksum = init.checksum || this.computeChecksum();
  }

  /**
   * Computes an immutable payload/identity checksum to prevent duplicate printing.
   */
  public computeChecksum(): string {
    const raw = `${this.templateId}:${this.templateVersion}:${this.printerId}:${this.copies}:${JSON.stringify(
      this.records
    )}:${this.renderedPayload || ""}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `chk-${Math.abs(hash).toString(16)}`;
  }

  public updateStatus(status: PrintJobStatus, errorMsg?: string): void {
    this.status = status;
    if (status === "PRINTING" && !this.startedAt) {
      this.startedAt = new Date().toISOString();
    }
    if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED" || status === "FILE_GENERATED") {
      this.completedAt = new Date().toISOString();
    }
    if (errorMsg) {
      this.error = errorMsg;
      this.diagnostics.errors.push(errorMsg);
    }
  }

  public logTransport(msg: string): void {
    this.diagnostics.transportLogs.push(`[${new Date().toISOString()}] ${msg}`);
  }

  public toJSON(): UniversalPrintJobJSON {
    return {
      jobId: this.jobId,
      templateId: this.templateId,
      templateVersion: this.templateVersion,
      canvasId: this.canvasId,
      printerId: this.printerId,
      printerProfileSnapshot: this.printerProfileSnapshot,
      language: this.language,
      transport: this.transport,
      copies: this.copies,
      records: [...this.records],
      renderedPayload: this.renderedPayload,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      status: this.status,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      error: this.error,
      diagnostics: { ...this.diagnostics },
      checksum: this.checksum,
    };
  }

  public static fromJSON(json: UniversalPrintJobJSON): UniversalPrintJob {
    return new UniversalPrintJob(json);
  }
}
