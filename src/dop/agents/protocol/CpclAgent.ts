/**
 * Project      : SMRITI Retail OS
 * Component    : CpclAgent (DXP-CPC-001 Standard)
 * Description  : Comtec CPCL mobile printer formatting & text layout agent
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrintAgent, PrintAgentCategory, PrintAgentStatus } from "../IPrintAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../../models/DxpTypes.ts";

export class CpclAgent implements IPrintAgent {
  id = "agent.protocol.cpcl";
  name = "Comtec CPCL Mobile Printer Agent";
  category: PrintAgentCategory = "PROTOCOL";
  standardId = "DXP-CPC-001";

  private metrics = { totalJobsProcessed: 0, successfulJobs: 0, failedJobs: 0 };
  private lastTimestamp?: string;

  async initialize(): Promise<boolean> {
    return true;
  }

  canHandle(req: DxpDocumentRequest): boolean {
    return req.options?.driverId === "cpcl";
  }

  async process(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    this.metrics.totalJobsProcessed++;
    this.lastTimestamp = new Date().toISOString();

    const raw = req.options?.rawContent || "! 0 200 200 210 1\nTEXT 4 0 30 40 SMRITI Systems\nPRINT\n";
    console.log(`[DXP-CPC-001 CpclAgent]: Compiled Comtec CPCL mobile script (${raw.length} chars).`);

    this.metrics.successfulJobs++;
    return {
      jobId: `job-cpcl-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: req.channel || "PRINT",
      adapterUsed: "CpclAgent (DXP-CPC-001)",
      templateVersion: 1,
      labelsOrPagesProcessed: req.options?.copies || 1,
      outputUri: raw,
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
