/**
 * Project      : SMRITI Retail OS
 * Component    : RawPrintAgent (DXP-RAW-001 Standard)
 * Description  : Pass-through RAW script & PRN stream execution agent
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrintAgent, PrintAgentCategory, PrintAgentStatus } from "../IPrintAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../../models/DxpTypes.ts";

export class RawPrintAgent implements IPrintAgent {
  id = "agent.protocol.raw";
  name = "Raw PRN Pass-Through Agent";
  category: PrintAgentCategory = "PROTOCOL";
  standardId = "DXP-RAW-001";

  private metrics = { totalJobsProcessed: 0, successfulJobs: 0, failedJobs: 0 };
  private lastTimestamp?: string;

  async initialize(): Promise<boolean> {
    return true;
  }

  canHandle(req: DxpDocumentRequest): boolean {
    return req.format === "Label" || (req.options && req.options.rawContent);
  }

  async process(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    this.metrics.totalJobsProcessed++;
    this.lastTimestamp = new Date().toISOString();

    console.log(`[DXP-RAW-001 RawPrintAgent]: Processing RAW pass-through payload for ${req.documentType}.`);

    this.metrics.successfulJobs++;
    return {
      jobId: `job-raw-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: req.channel || "PRINT",
      adapterUsed: "RawPrintAgent (DXP-RAW-001)",
      templateVersion: 1,
      labelsOrPagesProcessed: req.options?.copies || 1,
      outputUri: req.options?.rawContent || "",
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
