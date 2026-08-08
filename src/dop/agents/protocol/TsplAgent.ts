/**
 * Project      : SMRITI Retail OS
 * Component    : TsplAgent (DXP-TSP-001 Standard)
 * Description  : TSC TSPL label formatting, gap & peel-off command agent
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrintAgent, PrintAgentCategory, PrintAgentStatus } from "../IPrintAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../../models/DxpTypes.ts";

export class TsplAgent implements IPrintAgent {
  id = "agent.protocol.tspl";
  name = "TSC TSPL Command Agent";
  category: PrintAgentCategory = "PROTOCOL";
  standardId = "DXP-TSP-001";

  private metrics = { totalJobsProcessed: 0, successfulJobs: 0, failedJobs: 0 };
  private lastTimestamp?: string;

  async initialize(): Promise<boolean> {
    return true;
  }

  canHandle(req: DxpDocumentRequest): boolean {
    return req.options?.driverId === "tspl" || req.options?.driverId === "tspl2";
  }

  public compileTspl(req: DxpDocumentRequest): string {
    const copies = req.options?.copies || 1;
    const raw = req.options?.rawContent || 'SIZE 100 mm, 50 mm\nGAP 2 mm, 0 mm\nCLS\nTEXT 50,50,"3",0,1,1,"SMRITI Systems"\nPRINT 1,1';
    return raw.replace("PRINT 1,1", `PRINT ${copies},1`);
  }

  async process(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    this.metrics.totalJobsProcessed++;
    this.lastTimestamp = new Date().toISOString();

    const tsplScript = this.compileTspl(req);
    console.log(`[DXP-TSP-001 TsplAgent]: Compiled TSC TSPL script (${tsplScript.length} chars).`);

    this.metrics.successfulJobs++;
    return {
      jobId: `job-tspl-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: req.channel || "PRINT",
      adapterUsed: "TsplAgent (DXP-TSP-001)",
      templateVersion: 1,
      labelsOrPagesProcessed: req.options?.copies || 1,
      outputUri: tsplScript,
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
