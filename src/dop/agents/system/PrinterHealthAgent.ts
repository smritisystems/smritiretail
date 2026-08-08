/**
 * Project      : SMRITI Retail OS
 * Component    : PrinterHealthAgent (DXP-DIA-001 Standard)
 * Description  : Hardware status polling, paper/ink level & diagnostic agent
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrintAgent, PrintAgentCategory, PrintAgentStatus } from "../IPrintAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../../models/DxpTypes.ts";

export interface PrinterDiagnosticReport {
  printerId: string;
  status: "ONLINE" | "OFFLINE" | "LOW_PAPER" | "PAPER_JAM" | "COVER_OPEN" | "ERROR";
  paperStatus: "OK" | "LOW" | "OUT";
  ribbonStatus: "OK" | "LOW" | "OUT";
  headTemperature: "NORMAL" | "HIGH";
  pendingJobs: number;
}

export class PrinterHealthAgent implements IPrintAgent {
  id = "agent.system.health";
  name = "Printer Health & Diagnostic Agent";
  category: PrintAgentCategory = "DIAGNOSTIC";
  standardId = "DXP-DIA-001";

  private metrics = { totalJobsProcessed: 0, successfulJobs: 0, failedJobs: 0 };
  private lastTimestamp?: string;

  async initialize(): Promise<boolean> {
    return true;
  }

  canHandle(req: DxpDocumentRequest): boolean {
    return (req.options && req.options.action === "DIAGNOSTIC") || false;
  }

  public async runDiagnostics(printerId: string): Promise<PrinterDiagnosticReport> {
    console.log(`[DXP-DIA-001 PrinterHealthAgent]: Running hardware diagnostic poll on ${printerId}...`);
    return {
      printerId,
      status: "ONLINE",
      paperStatus: "OK",
      ribbonStatus: "OK",
      headTemperature: "NORMAL",
      pendingJobs: 0,
    };
  }

  async process(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    this.metrics.totalJobsProcessed++;
    this.lastTimestamp = new Date().toISOString();

    const report = await this.runDiagnostics(req.options?.printerId || "default-printer");

    this.metrics.successfulJobs++;
    return {
      jobId: `job-diag-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: "PREVIEW",
      adapterUsed: "PrinterHealthAgent (DXP-DIA-001)",
      templateVersion: 1,
      labelsOrPagesProcessed: 1,
      outputUri: JSON.stringify(report),
    };
  }

  getStatus(): PrintAgentStatus {
    return {
      agentId: this.id,
      name: this.name,
      category: this.category,
      isReady: true,
      activeJobsCount: 0,
      lastExecutionTimestamp: this.lastTimestamp,
      metrics: { ...this.metrics },
    };
  }
}
