/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-010 (Universal Print Orchestrator v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { UniversalLabelDocument } from "../models/UniversalLabelDocument.ts";
import { PrinterProfile } from "../models/PrinterProfile.ts";
import { PrinterCapabilityEngine } from "../discovery/PrinterCapabilityEngine.ts";
import { PRNRenderer } from "../prn_engine/PRNRenderer.ts";
import {
  IPrinterAdapter,
  ZplPrinterAdapter,
  TsplPrinterAdapter,
  EscPosPrinterAdapter,
  WindowsSpoolerPrinterAdapter,
} from "../adapters/PrinterAdapter.ts";

export interface PrintOrchestratorJobRequest {
  document: UniversalLabelDocument;
  printer: PrinterProfile;
  dataContext?: Record<string, any>;
  copies?: number;
}

export interface PrintOrchestratorJobResult {
  jobId: string;
  status: "SUCCESS" | "WARNING" | "FAILED";
  printer: string;
  language: string;
  copies: number;
  warnings: string[];
  errors: string[];
  durationMs: number;
  renderedPayload: string;
}

export class UniversalPrintOrchestratorService {
  public async executePrintJob(req: PrintOrchestratorJobRequest): Promise<PrintOrchestratorJobResult> {
    const startTime = performance.now();
    const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const warnings: string[] = [];
    const errors: string[] = [];
    const doc = req.document;
    const printer = req.printer;
    const copies = req.copies || 1;

    // 1. Validate Document Structure
    if (!doc || !doc.elements || doc.elements.length === 0) {
      errors.push("Document contains no printable elements.");
      return {
        jobId,
        status: "FAILED",
        printer: printer.name,
        language: printer.language,
        copies,
        warnings,
        errors,
        durationMs: Math.round(performance.now() - startTime),
        renderedPayload: "",
      };
    }

    // 2. Capability Validation
    const capCheck = PrinterCapabilityEngine.validateCapability(doc, printer);
    warnings.push(...capCheck.warnings);

    if (capCheck.status === "UNSUPPORTED") {
      errors.push(...capCheck.unsupportedFeatures);
      return {
        jobId,
        status: "FAILED",
        printer: printer.name,
        language: printer.language,
        copies,
        warnings,
        errors,
        durationMs: Math.round(performance.now() - startTime),
        renderedPayload: "",
      };
    }

    // 3. Render Document to Printer Language Stream
    const renderResult = PRNRenderer.render(doc, {
      language: printer.language,
      dataContext: req.dataContext,
      dpi: printer.dpi,
      copies,
    });

    warnings.push(...renderResult.warnings);

    if (renderResult.status === "FAILED" || renderResult.status === "NOT_IMPLEMENTED") {
      errors.push(`Rendering failed for language '${printer.language}'.`);
      return {
        jobId,
        status: "FAILED",
        printer: printer.name,
        language: printer.language,
        copies,
        warnings,
        errors,
        durationMs: Math.round(performance.now() - startTime),
        renderedPayload: "",
      };
    }

    // 4. Resolve & Instantiate Adapter
    const adapter = this.resolveAdapter(printer);
    await adapter.connect();

    const dispatchResult = await adapter.print(doc, {
      copies,
      dataContext: req.dataContext,
      rawOverridePayload: renderResult.rawStream,
    });

    warnings.push(...dispatchResult.warnings);

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    const finalStatus = errors.length > 0 ? "FAILED" : warnings.length > 0 ? "WARNING" : "SUCCESS";

    return {
      jobId,
      status: finalStatus,
      printer: printer.name,
      language: printer.language,
      copies,
      warnings,
      errors,
      durationMs,
      renderedPayload: renderResult.rawStream,
    };
  }

  private resolveAdapter(profile: PrinterProfile): IPrinterAdapter {
    if (profile.connectionType === "WINDOWS_SPOOLER") {
      return new WindowsSpoolerPrinterAdapter(profile);
    }

    switch (profile.language) {
      case "ZPL":
        return new ZplPrinterAdapter(profile);
      case "TSPL":
        return new TsplPrinterAdapter(profile);
      case "ESC_POS":
        return new EscPosPrinterAdapter(profile);
      default:
        return new ZplPrinterAdapter(profile);
    }
  }
}

export const UniversalPrintOrchestrator = new UniversalPrintOrchestratorService();
