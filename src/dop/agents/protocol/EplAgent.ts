/**
 * Project      : SMRITI Retail OS
 * Component    : EplAgent (DXP-EPL-001 Standard)
 * Description  : Eltron EPL2 command translation agent
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrintAgent, PrintAgentCategory, PrintAgentStatus } from "../IPrintAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../../models/DxpTypes.ts";

export class EplAgent implements IPrintAgent {
  id = "agent.protocol.epl";
  name = "Eltron EPL2 Command Agent";
  category: PrintAgentCategory = "PROTOCOL";
  standardId = "DXP-EPL-001";

  private metrics = { totalJobsProcessed: 0, successfulJobs: 0, failedJobs: 0 };
  private lastTimestamp?: string;

  async initialize(): Promise<boolean> {
    return true;
  }

  canHandle(req: DxpDocumentRequest): boolean {
    return req.options?.driverId === "epl" || req.options?.driverId === "epl2";
  }

  async process(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    this.metrics.totalJobsProcessed++;
    this.lastTimestamp = new Date().toISOString();

    const copies = req.options?.copies || 1;
    const raw = req.options?.rawContent || 'N\nA50,50,0,3,1,1,N,"SMRITI Systems"\nP1';
    const eplScript = raw.replace("P1", `P${copies}`);

    console.log(`[DXP-EPL-001 EplAgent]: Compiled Eltron EPL2 script (${eplScript.length} chars).`);

    this.metrics.successfulJobs++;
    return {
      jobId: `job-epl-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: req.channel || "PRINT",
      adapterUsed: "EplAgent (DXP-EPL-001)",
      templateVersion: 1,
      labelsOrPagesProcessed: copies,
      outputUri: eplScript,
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
