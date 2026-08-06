/**
 * Project      : SMRITI Retail OS
 * Component    : EscPosAgent (DXP-ESC-001 Standard)
 * Description  : ESC/POS thermal receipt formatting, cutter & cash drawer pulse agent
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrintAgent, PrintAgentCategory, PrintAgentStatus } from "../IPrintAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../../models/DxpTypes.ts";

export class EscPosAgent implements IPrintAgent {
  id = "agent.protocol.escpos";
  name = "ESC/POS Thermal Command Agent";
  category: PrintAgentCategory = "PROTOCOL";
  standardId = "DXP-ESC-001";

  private metrics = { totalJobsProcessed: 0, successfulJobs: 0, failedJobs: 0 };
  private lastTimestamp?: string;

  async initialize(): Promise<boolean> {
    return true;
  }

  canHandle(req: DxpDocumentRequest): boolean {
    return req.documentType === "RECEIPT" || req.format === "Thermal80mm";
  }

  public generateEscPosBytes(req: DxpDocumentRequest): string {
    const init = "\x1B\x40"; // ESC @ Reset
    const alignCenter = "\x1B\x61\x01";
    const alignLeft = "\x1B\x61\x00";
    const cut = "\x1D\x56\x41\x00"; // GS V cut
    const drawerPulse = "\x1B\x70\x00\x19\xFA"; // ESC p pulse

    let body = `${init}${alignCenter}*** RECEIPT ***\n${alignLeft}`;
    if (req.options?.openDrawer) {
      body += drawerPulse;
    }
    body += cut;
    return body;
  }

  async process(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    this.metrics.totalJobsProcessed++;
    this.lastTimestamp = new Date().toISOString();

    const bytes = this.generateEscPosBytes(req);
    console.log(`[DXP-ESC-001 EscPosAgent]: Formatted ${bytes.length} ESC/POS command bytes for receipt ${req.documentType}.`);

    this.metrics.successfulJobs++;
    return {
      jobId: `job-esc-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: req.channel || "PRINT",
      adapterUsed: "EscPosAgent (DXP-ESC-001)",
      templateVersion: 1,
      labelsOrPagesProcessed: 1,
      outputUri: bytes,
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
