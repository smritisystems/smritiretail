/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Universal Print Orchestrator
 * Standard     : SCS-PRINT-ORCHESTRATOR-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { UniversalPrintTemplate } from "../models/UniversalPrintTemplate.ts";
import { UniversalPrintCanvas } from "../models/UniversalPrintCanvas.ts";
import { PrinterProfile } from "../models/PrinterProfile.ts";
import { UniversalPrintJob, PrintJobStatus, PrintTransportType } from "./UniversalPrintJob.ts";
import { UniversalPrintSpooler, UniversalPrintSpoolerService } from "./UniversalPrintSpooler.ts";
import { FieldMappingEngine } from "../fields/FieldMappingEngine.ts";
import { LabelFieldBindingEngine } from "../fields/LabelFieldBindingEngine.ts";
import { PrinterCapabilityEngine } from "../discovery/PrinterCapabilityEngine.ts";
import { PRNAstParser } from "../prn_engine/PRNAstParser.ts";
import { UniversalLabelDocument } from "../models/UniversalLabelDocument.ts";

import { IPrinterAdapter, TransportDispatchResult } from "./adapters/PrinterAdapter.ts";
import { UsbPrinterAdapter } from "./adapters/UsbPrinterAdapter.ts";
import { TcpRawPrinterAdapter } from "./adapters/TcpRawPrinterAdapter.ts";
import { WindowsSpoolerPrinterAdapter } from "./adapters/WindowsSpoolerPrinterAdapter.ts";
import { LocalAgentPrinterAdapter } from "./adapters/LocalAgentPrinterAdapter.ts";
import { FilePrinterAdapter } from "./adapters/FilePrinterAdapter.ts";

export interface PrintExecutionOptions {
  template: UniversalPrintTemplate;
  canvas: UniversalPrintCanvas;
  printer: PrinterProfile;
  records: any[];
  copies?: number;
  dryRunOnly?: boolean;
  overrideTransport?: PrintTransportType;
}

export interface DryRunResult {
  jobId: string;
  templateId: string;
  templateVersion: string;
  targetPrinter: string;
  targetLanguage: string;
  targetTransport: string;
  recordCount: number;
  copies: number;
  resolvedFieldValues: Array<Record<string, any>>;
  renderedPayload: string;
  payloadChecksum: string;
  compatibilityScore: number;
  diagnostics: {
    warnings: string[];
    errors: string[];
  };
}

export class UniversalPrintOrchestratorService {
  private adapters: Map<PrintTransportType, IPrinterAdapter> = new Map();
  private spooler: UniversalPrintSpoolerService;

  constructor(spooler?: UniversalPrintSpoolerService) {
    this.spooler = spooler || UniversalPrintSpooler;

    // Register standard transport adapters
    this.adapters.set("USB", new UsbPrinterAdapter());
    this.adapters.set("TCP", new TcpRawPrinterAdapter());
    this.adapters.set("WINDOWS_SPOOLER", new WindowsSpoolerPrinterAdapter());
    this.adapters.set("LOCAL_AGENT", new LocalAgentPrinterAdapter());
    this.adapters.set("FILE", new FilePrinterAdapter());
  }

  public registerAdapter(transport: PrintTransportType, adapter: IPrinterAdapter): void {
    this.adapters.set(transport, adapter);
  }

  public getAdapter(transport: PrintTransportType): IPrinterAdapter | undefined {
    return this.adapters.get(transport);
  }

  /**
   * DRY RUN / PREVIEW: Resolves bindings and renders payload without dispatching.
   */
  public async dryRun(options: PrintExecutionOptions): Promise<DryRunResult> {
    const { template, canvas, printer, records, copies = 1 } = options;

    const jobId = `job-dry-${Date.now()}`;

    // 1. Compatibility check
    const compReport = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, template, printer);

    // 2. Field binding resolution across records
    const resolvedFields: Array<Record<string, any>> = records.map((record) => {
      const bound: Record<string, any> = {};
      template.fieldMappings.forEach((canonicalField, placeholder) => {
        if (canonicalField) {
          const evalRes = LabelFieldBindingEngine.evaluateExpression(`{{${canonicalField}}}`, record);
          bound[placeholder] = evalRes.value;
        }
      });
      return bound;
    });

    // 3. Render payload
    const renderedPayload = this.renderPrintPayload(template, canvas, printer, records, copies);

    // 4. Compute Checksum
    const dummyJob = new UniversalPrintJob({
      jobId,
      templateId: template.metadata.id,
      templateVersion: template.metadata.version,
      printerId: printer.id,
      copies,
      records,
      renderedPayload,
    });

    return {
      jobId,
      templateId: template.metadata.id,
      templateVersion: template.metadata.version,
      targetPrinter: printer.name,
      targetLanguage: template.source?.originalFormat || "ZPL",
      targetTransport: options.overrideTransport || printer.connectionType || "TCP",
      recordCount: records.length,
      copies,
      resolvedFieldValues: resolvedFields,
      renderedPayload,
      payloadChecksum: dummyJob.checksum,
      compatibilityScore: compReport.overallScore,
      diagnostics: {
        warnings: [...compReport.warnings],
        errors: [...compReport.errors],
      },
    };
  }

  /**
   * Renders target PRN script payload from template, canvas, printer, and records.
   */
  public renderPrintPayload(
    template: UniversalPrintTemplate,
    canvas: UniversalPrintCanvas,
    printer: PrinterProfile,
    records: any[],
    copies: number = 1
  ): string {
    const rawContent = template.source?.originalContent || "^XA^XZ";
    const targetLang = (template.source?.originalFormat || printer.language || "ZPL").toUpperCase();

    // Check RAW_COMMAND governance
    if (template.document) {
      for (const el of template.document.elements) {
        if (el.type === "RAW_COMMAND") {
          const rawCmd = el.rawCommand || "";
          if (rawCmd.includes("^XA") && !printer.capabilities.supportsZPL) {
            throw new Error(`UNSUPPORTED_TARGET_LANGUAGE: RAW_COMMAND contains ZPL but printer does not support ZPL.`);
          }
        }
      }
    }

    let fullPayload = "";

    for (let r = 0; r < records.length; r++) {
      const record = records[r];
      let pagePayload = rawContent;

      // Substitute placeholders
      template.fieldMappings.forEach((canonicalField, placeholder) => {
        if (canonicalField) {
          const evalRes = LabelFieldBindingEngine.evaluateExpression(`{{${canonicalField}}}`, record);
          const resolvedVal = evalRes.value;
          pagePayload = pagePayload.replaceAll(placeholder, String(resolvedVal ?? ""));
        }
      });

      // Handle printer native copies or repeat block
      if (pagePayload.includes("^PQ")) {
        pagePayload = pagePayload.replace(/\^PQ\d+/, `^PQ${copies}`);
      } else if (copies > 1) {
        let repeated = "";
        for (let c = 0; c < copies; c++) {
          repeated += pagePayload + "\n";
        }
        pagePayload = repeated;
      }

      fullPayload += pagePayload + "\n";
    }

    return fullPayload.trim();
  }

  /**
   * CANONICAL EXECUTION PIPELINE: Enqueues and dispatches a print job.
   */
  public async executePrintJob(options: PrintExecutionOptions): Promise<{
    job: UniversalPrintJob;
    dispatchResult?: TransportDispatchResult;
  }> {
    const { template, canvas, printer, records, copies = 1, dryRunOnly = false } = options;

    const jobId = `job-exec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const transportType = options.overrideTransport || printer.connectionType || "TCP";
    const canvasId = canvas.id || "default-canvas";

    // 1. Compatibility check
    const compReport = PrinterCapabilityEngine.validateCanvasCompatibility(canvas, template, printer);
    if (compReport.status === "UNSUPPORTED") {
      const errJob = new UniversalPrintJob({
        jobId,
        templateId: template.metadata.id,
        templateVersion: template.metadata.version,
        canvasId,
        printerId: printer.id,
        status: "FAILED",
        error: `UNSUPPORTED_PRINTER: ${compReport.errors.join("; ")}`,
      });
      return { job: errJob };
    }

    // 2. Render payload
    let renderedPayload = "";
    try {
      renderedPayload = this.renderPrintPayload(template, canvas, printer, records, copies);
    } catch (err: any) {
      const errJob = new UniversalPrintJob({
        jobId,
        templateId: template.metadata.id,
        templateVersion: template.metadata.version,
        canvasId,
        printerId: printer.id,
        status: "FAILED",
        error: err.message || String(err),
      });
      return { job: errJob };
    }

    // 3. Construct job
    const job = new UniversalPrintJob({
      jobId,
      templateId: template.metadata.id,
      templateVersion: template.metadata.version,
      canvasId,
      printerId: printer.id,
      printerProfileSnapshot: printer.toJSON(),
      language: (template.source?.originalFormat || printer.language || "ZPL") as any,
      transport: transportType,
      copies,
      records,
      renderedPayload,
    });

    if (compReport.warnings.length > 0) {
      job.diagnostics.warnings.push(...compReport.warnings);
    }

    // 4. Enqueue to spooler
    const enqueueRes = await this.spooler.enqueue(job);
    if (enqueueRes.isDuplicate) {
      return { job };
    }

    if (dryRunOnly) {
      job.updateStatus("READY");
      return { job };
    }

    // 5. Dispatch via Transport Adapter
    const adapter = this.adapters.get(transportType);
    if (!adapter) {
      job.updateStatus("FAILED", `UNSUPPORTED_TRANSPORT: Adapter for ${transportType} is not registered.`);
      await this.spooler.markJobFailed(job.jobId, job.error!, false);
      return { job };
    }

    job.updateStatus("PRINTING");
    const dispatchRes = await adapter.dispatch(job, printer);

    if (dispatchRes.success) {
      await this.spooler.markJobCompleted(job.jobId);
    } else {
      // Retry governance: Retry ONLY transport-level failures
      const isRetryable =
        dispatchRes.code === "NETWORK_TIMEOUT" ||
        dispatchRes.code === "CONNECTION_RESET" ||
        dispatchRes.code === "AGENT_UNAVAILABLE" ||
        dispatchRes.code === "TEMPORARY_SPOOLER_ERROR";

      await this.spooler.markJobFailed(job.jobId, dispatchRes.message, isRetryable);
    }

    return { job, dispatchResult: dispatchRes };
  }
}

export const UniversalPrintOrchestrator = new UniversalPrintOrchestratorService();
