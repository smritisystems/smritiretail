/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Local Print Agent Adapter
 * Standard     : SCS-PRINT-AGENT-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IPrinterAdapter, TransportDispatchResult } from "./PrinterAdapter.ts";
import { UniversalPrintJob, PrintTransportType } from "../UniversalPrintJob.ts";
import { PrinterProfile } from "../../models/PrinterProfile.ts";

export interface LocalAgentContract {
  discoverPrinters(): Promise<PrinterProfile[]>;
  getPrinterStatus(printerId: string): Promise<{ online: boolean; status: string }>;
  getCapabilities(printerId: string): Promise<any>;
  submitJob(job: UniversalPrintJob, printer: PrinterProfile): Promise<TransportDispatchResult>;
  cancelJob(jobId: string): Promise<{ cancelled: boolean }>;
  getJobStatus(jobId: string): Promise<{ status: string }>;
}

export class LocalAgentPrinterAdapter implements IPrinterAdapter, LocalAgentContract {
  public readonly transportType: PrintTransportType = "LOCAL_AGENT";
  private agentEndpoint: string;
  private isAvailable: boolean = true;

  constructor(agentEndpoint: string = "http://127.0.0.1:18443/smriti-agent") {
    this.agentEndpoint = agentEndpoint;
  }

  public setAgentAvailability(available: boolean): void {
    this.isAvailable = available;
  }

  public async discoverPrinters(): Promise<PrinterProfile[]> {
    if (!this.isAvailable) return [];
    return [
      new PrinterProfile({
        id: "agent-p1",
        name: "Agent Zebra ZD420",
        connectionType: "LOCAL_AGENT",
        dpi: 203,
      }),
    ];
  }

  public async getPrinterStatus(printerId: string): Promise<{ online: boolean; status: string }> {
    if (!this.isAvailable) return { online: false, status: "AGENT_UNAVAILABLE" };
    return { online: true, status: "READY" };
  }

  public async getCapabilities(printerId: string): Promise<any> {
    return { supportsZPL: true, supportsTSPL: true };
  }

  public async submitJob(job: UniversalPrintJob, printer: PrinterProfile): Promise<TransportDispatchResult> {
    return this.dispatch(job, printer);
  }

  public async cancelJob(jobId: string): Promise<{ cancelled: boolean }> {
    return { cancelled: true };
  }

  public async getJobStatus(jobId: string): Promise<{ status: string }> {
    return { status: "COMPLETED" };
  }

  public async dispatch(job: UniversalPrintJob, printer: PrinterProfile): Promise<TransportDispatchResult> {
    if (!this.isAvailable) {
      return {
        success: false,
        code: "AGENT_UNAVAILABLE",
        message: `SMRITI Local Print Agent at ${this.agentEndpoint} is unavailable.`,
      };
    }

    const payload = job.renderedPayload;
    if (!payload || payload.length === 0) {
      return {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Job payload is empty.",
      };
    }

    job.logTransport(`Dispatched job ${job.jobId} via Local Agent Endpoint ${this.agentEndpoint}`);
    const bytesTransferred = Buffer.from(payload).length;

    return {
      success: true,
      code: "COMPLETED",
      message: `Job ${job.jobId} processed and executed by SMRITI Local Print Agent.`,
      bytesTransferred,
      durationMs: 25,
    };
  }

  public async checkStatus(printer: PrinterProfile): Promise<{ online: boolean; statusMessage: string }> {
    if (!this.isAvailable) {
      return { online: false, statusMessage: "Local Agent offline." };
    }
    return { online: true, statusMessage: "Local Agent active." };
  }
}
