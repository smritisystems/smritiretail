/**
 * Project      : SMRITI Retail OS
 * Component    : QueueManagerAgent (DXP-QUE-001 Standard)
 * Description  : Priority job scheduling & background queue manager agent
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrintAgent, PrintAgentCategory, PrintAgentStatus } from "../IPrintAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../../models/DxpTypes.ts";
import { DocumentQueueRegistry, DxpDocumentJob } from "../../core/DocumentQueueRegistry.ts";

export class QueueManagerAgent implements IPrintAgent {
  id = "agent.system.queue";
  name = "Print Queue Manager Agent";
  category: PrintAgentCategory = "SYSTEM";
  standardId = "DXP-QUE-001";

  private metrics = { totalJobsProcessed: 0, successfulJobs: 0, failedJobs: 0 };
  private lastTimestamp?: string;

  async initialize(): Promise<boolean> {
    return true;
  }

  canHandle(req: DxpDocumentRequest): boolean {
    return (req.options && req.options.asyncQueue) || false;
  }

  public enqueueJob(req: DxpDocumentRequest): DxpDocumentJob {
    return DocumentQueueRegistry.enqueue(req);
  }

  public async processNextJob(): Promise<DxpDocumentJob | null> {
    const jobs = DocumentQueueRegistry.listJobs().filter((j) => j.status === "QUEUED");
    if (jobs.length === 0) return null;
    return DocumentQueueRegistry.processJob(jobs[0].id);
  }

  async process(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    this.metrics.totalJobsProcessed++;
    this.lastTimestamp = new Date().toISOString();

    const job = this.enqueueJob(req);
    console.log(`[DXP-QUE-001 QueueManagerAgent]: Enqueued job ${job.id}.`);

    this.metrics.successfulJobs++;
    return {
      jobId: job.id,
      lifecycleState: "QUEUED",
      channel: req.channel || "PRINT",
      adapterUsed: "QueueManagerAgent (DXP-QUE-001)",
      templateVersion: 1,
      labelsOrPagesProcessed: 1,
    };
  }

  getStatus(): PrintAgentStatus {
    return {
      agentId: this.id,
      name: this.name,
      category: this.category,
      isReady: true,
      activeJobsCount: DocumentQueueRegistry.listJobs().filter((j) => j.status === "RENDERING" || j.status === "DISPATCHING").length,
      lastExecutionTimestamp: this.lastTimestamp,
      metrics: { ...this.metrics },
    };
  }
}
