/**
 * Project      : SMRITI Retail OS
 * Component    : QueueManagerAgent (DXP-QUE-001 Standard)
 * Description  : Priority job scheduling, Dead Letter Queue (DLQ) & audit tracking agent
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrintAgent, PrintAgentCategory, PrintAgentStatus } from "../IPrintAgent.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../../models/DxpTypes.ts";
import { DocumentQueueRegistry, DxpDocumentJob } from "../../core/DocumentQueueRegistry.ts";

export interface PrintJobRecord {
  jobId: string;
  documentType: string;
  referenceId: string;
  protocol: string;
  transport: string;
  copies: number;
  priority: "HIGH" | "NORMAL" | "LOW";
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "DLQ";
  attempts: number;
  createdTimestamp: string;
  completedTimestamp?: string;
}

export class QueueManagerAgent implements IPrintAgent {
  id = "agent.system.queue";
  name = "Print Queue & DLQ Manager Agent";
  category: PrintAgentCategory = "SYSTEM";
  standardId = "DXP-QUE-001";

  private dlq: Map<string, PrintJobRecord> = new Map();
  private auditRecords: Map<string, PrintJobRecord> = new Map();
  private metrics = { totalJobsProcessed: 0, successfulJobs: 0, failedJobs: 0 };
  private lastTimestamp?: string;

  async initialize(): Promise<boolean> {
    return true;
  }

  canHandle(req: DxpDocumentRequest): boolean {
    return Boolean(req.options && req.options.asyncQueue);
  }

  public enqueueJob(req: DxpDocumentRequest): DxpDocumentJob {
    const job = DocumentQueueRegistry.enqueue(req);
    const record: PrintJobRecord = {
      jobId: job.id,
      documentType: req.documentType,
      referenceId: req.referenceId,
      protocol: (req.options?.protocol as string) || "ESC/POS",
      transport: (req.options?.transport as string) || "SDA",
      copies: req.copies || 1,
      priority: (req.options?.priority as "HIGH" | "NORMAL" | "LOW") || "NORMAL",
      status: "QUEUED",
      attempts: 0,
      createdTimestamp: new Date().toISOString(),
    };
    this.auditRecords.set(job.id, record);
    return job;
  }

  public moveToDeadLetterQueue(jobId: string, errorReason: string): void {
    const record = this.auditRecords.get(jobId);
    if (record) {
      record.status = "DLQ";
      record.completedTimestamp = new Date().toISOString();
      this.dlq.set(jobId, record);
      console.warn(`[DXP-QUE-001 DLQ]: Job ${jobId} moved to Dead Letter Queue. Reason: ${errorReason}`);
    }
  }

  public getDeadLetterQueue(): PrintJobRecord[] {
    return Array.from(this.dlq.values());
  }

  public getAuditRecords(): PrintJobRecord[] {
    return Array.from(this.auditRecords.values());
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
