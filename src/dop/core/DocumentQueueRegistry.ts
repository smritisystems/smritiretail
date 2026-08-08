/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Document Queue Registry (DXP-JOB-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 *
 * DXP-JOB-001 Compliance Declaration
 * Principle    : Asynchronous Document Processing — Manages document queue jobs (batch invoices,
 *                barcode sticker batches, email dispatches, WhatsApp campaigns) with state lifecycle
 *                (QUEUED -> PREPARING -> RENDERING -> DISPATCHING -> COMPLETED / FAILED / RETRY).
 */

import { DxpDocumentRequest, DxpDocumentResult, DxpDocumentType, DxpOutputChannel } from "../models/DxpTypes.ts";
import { OutputChannelRegistry } from "./OutputChannelRegistry.ts";

export type DxpJobStatus = "QUEUED" | "PREPARING" | "RENDERING" | "DISPATCHING" | "COMPLETED" | "FAILED" | "RETRY";

export interface DxpDocumentJob {
  id: string;
  documentType: DxpDocumentType;
  channel: DxpOutputChannel;
  request: DxpDocumentRequest;
  status: DxpJobStatus;
  attempts: number;
  maxRetries: number;
  createdTimestamp: number;
  completedTimestamp?: number;
  errorMessage?: string;
  result?: DxpDocumentResult;
}

class DocumentQueueRegistryManager {
  private jobs: Map<string, DxpDocumentJob> = new Map();
  private listeners: Set<() => void> = new Set();

  public enqueue(request: DxpDocumentRequest, maxRetries = 3): DxpDocumentJob {
    const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const job: DxpDocumentJob = {
      id: jobId,
      documentType: request.documentType,
      channel: request.channel || "PRINT",
      request,
      status: "QUEUED",
      attempts: 0,
      maxRetries,
      createdTimestamp: Date.now(),
    };

    this.jobs.set(jobId, job);
    this.notify();
    return job;
  }

  public getJob(id: string): DxpDocumentJob | undefined {
    return this.jobs.get(id);
  }

  public listJobs(status?: DxpJobStatus): DxpDocumentJob[] {
    const list = Array.from(this.jobs.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    return status ? list.filter((j) => j.status === status) : list;
  }

  public async processJob(jobId: string): Promise<DxpDocumentJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    try {
      job.status = "PREPARING";
      job.attempts += 1;
      this.notify();

      job.status = "RENDERING";
      this.notify();

      const adapter = OutputChannelRegistry.get(job.channel);
      if (!adapter) throw new Error(`Adapter for channel ${job.channel} not found`);

      job.status = "DISPATCHING";
      this.notify();

      const res = await adapter.execute(job.request);
      job.status = "COMPLETED";
      job.completedTimestamp = Date.now();
      job.result = res;
    } catch (err: any) {
      job.errorMessage = err.message || "Failed to dispatch document job";
      if (job.attempts < job.maxRetries) {
        job.status = "RETRY";
      } else {
        job.status = "FAILED";
      }
    }

    this.notify();
    return job;
  }

  public async retryJob(jobId: string): Promise<DxpDocumentJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    job.status = "QUEUED";
    job.errorMessage = undefined;
    return this.processJob(jobId);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const DocumentQueueRegistry = new DocumentQueueRegistryManager();
