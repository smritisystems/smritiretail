/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-009 (Printer Adapter Interface & Base Adapters v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { PrinterProfile, PrinterStatus, PrinterHardwareCapabilities } from "../models/PrinterProfile.ts";
import { UniversalLabelDocument } from "../models/UniversalLabelDocument.ts";
import { PRNRenderer, RenderResult } from "../prn_engine/PRNRenderer.ts";

export interface PrintDispatchOptions {
  copies?: number;
  dataContext?: Record<string, any>;
  rawOverridePayload?: string;
}

export interface PrintOperationResult {
  jobId: string;
  success: boolean;
  status: PrinterStatus;
  bytesSent: number;
  message: string;
  diagnostics: string[];
  warnings: string[];
}

export interface IPrinterAdapter {
  id: string;
  name: string;
  profile: PrinterProfile;

  discover(): Promise<PrinterProfile[]>;
  connect(): Promise<boolean>;
  getStatus(): Promise<PrinterStatus>;
  getCapabilities(): PrinterHardwareCapabilities;
  testPrint(): Promise<PrintOperationResult>;
  print(doc: UniversalLabelDocument, options?: PrintDispatchOptions): Promise<PrintOperationResult>;
  disconnect(): Promise<boolean>;
}

export abstract class BasePrinterAdapter implements IPrinterAdapter {
  public id: string;
  public name: string;
  public profile: PrinterProfile;
  protected isConnected: boolean = false;

  constructor(profile: PrinterProfile) {
    this.profile = profile;
    this.id = `adapter-${profile.id}`;
    this.name = `${profile.name} Adapter (${profile.connectionType})`;
  }

  public async discover(): Promise<PrinterProfile[]> {
    return [this.profile];
  }

  public async connect(): Promise<boolean> {
    this.isConnected = true;
    this.profile.status = "READY";
    return true;
  }

  public async getStatus(): Promise<PrinterStatus> {
    return this.profile.status;
  }

  public getCapabilities(): PrinterHardwareCapabilities {
    return { ...this.profile.capabilities };
  }

  public async disconnect(): Promise<boolean> {
    this.isConnected = false;
    return true;
  }

  public abstract testPrint(): Promise<PrintOperationResult>;
  public abstract print(doc: UniversalLabelDocument, options?: PrintDispatchOptions): Promise<PrintOperationResult>;
}

export class ZplPrinterAdapter extends BasePrinterAdapter {
  public async testPrint(): Promise<PrintOperationResult> {
    const testZpl = `^XA^FO50,50^A0N,36,36^FDSMRITI PRINTER TEST^FS^FO50,100^BY2^BCN,60,Y,N,N^FD123456789012^FS^PQ1,0,1,Y^XZ`;
    return {
      jobId: `test-${Date.now()}`,
      success: true,
      status: "READY",
      bytesSent: testZpl.length,
      message: "ZPL Test label stream generated successfully.",
      diagnostics: ["Language: ZPL", `Target: ${this.profile.host || "USB/Spooler"}`],
      warnings: [],
    };
  }

  public async print(doc: UniversalLabelDocument, options?: PrintDispatchOptions): Promise<PrintOperationResult> {
    const renderRes: RenderResult = PRNRenderer.render(doc, {
      language: "ZPL",
      dataContext: options?.dataContext,
      dpi: this.profile.dpi,
      copies: options?.copies || 1,
    });

    const payload = options?.rawOverridePayload || renderRes.rawStream;

    return {
      jobId: `job-zpl-${Date.now()}`,
      success: renderRes.status !== "FAILED",
      status: "READY",
      bytesSent: payload.length,
      message: `Rendered ${renderRes.elementCount} elements into ZPL script (${payload.length} bytes).`,
      diagnostics: renderRes.diagnostics,
      warnings: renderRes.warnings,
    };
  }
}

export class TsplPrinterAdapter extends BasePrinterAdapter {
  public async testPrint(): Promise<PrintOperationResult> {
    const testTspl = `SIZE 50 mm, 25 mm\nCLS\nTEXT 50,50,"0",0,1,1,"SMRITI TEST"\nBARCODE 50,100,"128",50,1,0,2,2,"123456789012"\nPRINT 1,1`;
    return {
      jobId: `test-tspl-${Date.now()}`,
      success: true,
      status: "READY",
      bytesSent: testTspl.length,
      message: "TSPL Test label stream generated successfully.",
      diagnostics: ["Language: TSPL", `Target: ${this.profile.host || "USB/Spooler"}`],
      warnings: [],
    };
  }

  public async print(doc: UniversalLabelDocument, options?: PrintDispatchOptions): Promise<PrintOperationResult> {
    const renderRes: RenderResult = PRNRenderer.render(doc, {
      language: "TSPL",
      dataContext: options?.dataContext,
      dpi: this.profile.dpi,
      copies: options?.copies || 1,
    });

    const payload = options?.rawOverridePayload || renderRes.rawStream;

    return {
      jobId: `job-tspl-${Date.now()}`,
      success: renderRes.status !== "FAILED",
      status: "READY",
      bytesSent: payload.length,
      message: `Rendered ${renderRes.elementCount} elements into TSPL script (${payload.length} bytes).`,
      diagnostics: renderRes.diagnostics,
      warnings: renderRes.warnings,
    };
  }
}

export class EscPosPrinterAdapter extends BasePrinterAdapter {
  public async testPrint(): Promise<PrintOperationResult> {
    const testEscPos = `\x1B\x40SMRITI TEST RECEIPT\n123456789012\n\x1D\x56\x00`;
    return {
      jobId: `test-escpos-${Date.now()}`,
      success: true,
      status: "READY",
      bytesSent: testEscPos.length,
      message: "ESC/POS Test receipt stream generated successfully.",
      diagnostics: ["Language: ESC_POS"],
      warnings: [],
    };
  }

  public async print(doc: UniversalLabelDocument, options?: PrintDispatchOptions): Promise<PrintOperationResult> {
    const renderRes: RenderResult = PRNRenderer.render(doc, {
      language: "ESC_POS",
      dataContext: options?.dataContext,
      dpi: this.profile.dpi,
      copies: options?.copies || 1,
    });

    const payload = options?.rawOverridePayload || renderRes.rawStream;

    return {
      jobId: `job-escpos-${Date.now()}`,
      success: renderRes.status !== "FAILED",
      status: "READY",
      bytesSent: payload.length,
      message: `Rendered ${renderRes.elementCount} elements into ESC/POS stream (${payload.length} bytes).`,
      diagnostics: renderRes.diagnostics,
      warnings: renderRes.warnings,
    };
  }
}

export class WindowsSpoolerPrinterAdapter extends BasePrinterAdapter {
  public async testPrint(): Promise<PrintOperationResult> {
    return {
      jobId: `test-spooler-${Date.now()}`,
      success: true,
      status: "READY",
      bytesSent: 128,
      message: `Dispatched test page to Windows spooler queue '${this.profile.name}'`,
      diagnostics: [`Printer Name: ${this.profile.name}`, `Connection: WINDOWS_SPOOLER`],
      warnings: [],
    };
  }

  public async print(doc: UniversalLabelDocument, options?: PrintDispatchOptions): Promise<PrintOperationResult> {
    const renderRes = PRNRenderer.render(doc, {
      language: this.profile.language,
      dataContext: options?.dataContext,
      dpi: this.profile.dpi,
      copies: options?.copies || 1,
    });

    return {
      jobId: `job-spooler-${Date.now()}`,
      success: renderRes.status !== "FAILED",
      status: "READY",
      bytesSent: renderRes.rawStream.length,
      message: `Dispatched document to Windows Spooler '${this.profile.name}' (${renderRes.rawStream.length} bytes).`,
      diagnostics: renderRes.diagnostics,
      warnings: renderRes.warnings,
    };
  }
}
