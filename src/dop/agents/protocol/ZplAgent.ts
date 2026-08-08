/**
 * Project      : SMRITI Retail OS
 * Component    : ZplAgent (DXP-ZPL-001 Standard)
 * Description  : Zebra ZPL II label formatting, density & tear-off offset agent
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrintAgent, PrintAgentCategory, PrintAgentStatus } from "../IPrintAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../../models/DxpTypes.ts";

export class ZplAgent implements IPrintAgent {
  id = "agent.protocol.zpl";
  name = "Zebra ZPL II Command Agent";
  category: PrintAgentCategory = "PROTOCOL";
  standardId = "DXP-ZPL-001";

  private metrics = { totalJobsProcessed: 0, successfulJobs: 0, failedJobs: 0 };
  private lastTimestamp?: string;

  async initialize(): Promise<boolean> {
    return true;
  }

  canHandle(req: DxpDocumentRequest): boolean {
    return (
      req.documentType === "BARCODE_LABEL" ||
      req.documentType === "SHELF_LABEL" ||
      Boolean(req.options && req.options.driverId === "zpl")
    );
  }

  public compileZpl(req: DxpDocumentRequest): string {
    const copies = req.options?.copies || 1;
    const raw = req.options?.rawContent || "^XA^FO50,50^A0N,30,30^FDSMRITI Systems^FS^XZ";
    return raw.replace("^PQ1", `^PQ${copies}`);
  }

  async process(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    this.metrics.totalJobsProcessed++;
    this.lastTimestamp = new Date().toISOString();

    const zplScript = this.compileZpl(req);
    console.log(`[DXP-ZPL-001 ZplAgent]: Compiled Zebra ZPL II script (${zplScript.length} chars).`);

    this.metrics.successfulJobs++;
    return {
      jobId: `job-zpl-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: req.channel || "PRINT",
      adapterUsed: "ZplAgent (DXP-ZPL-001)",
      templateVersion: 1,
      labelsOrPagesProcessed: req.options?.copies || 1,
      outputUri: zplScript,
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
