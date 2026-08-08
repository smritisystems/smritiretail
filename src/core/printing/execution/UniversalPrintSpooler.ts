/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Universal Print Spooler
 * Standard     : SCS-PRINT-SPOOLER-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { UniversalPrintJob, PrintJobStatus } from "./UniversalPrintJob.ts";
import { IPrintJobStore, MemoryPrintJobStore } from "./spooler/PrintJobStore.ts";

export class UniversalPrintSpoolerService {
  private store: IPrintJobStore;
  private queue: string[] = [];
  private isPaused: boolean = false;
  private activeJobs: Set<string> = new Set();

  constructor(store?: IPrintJobStore) {
    this.store = store || new MemoryPrintJobStore();
  }

  public setStore(store: IPrintJobStore): void {
    this.store = store;
  }

  /**
   * Enqueues a job into the spooler with deduplication check.
   */
  public async enqueue(job: UniversalPrintJob): Promise<{ success: boolean; isDuplicate: boolean; jobId: string }> {
    // 1. Deduplication check via payload checksum
    const existing = await this.store.getByChecksum(job.checksum);
    if (existing && (existing.status === "COMPLETED" || existing.status === "PRINTING" || existing.status === "QUEUED")) {
      job.updateStatus("CANCELLED", `Duplicate job detected with checksum ${job.checksum}. Previous jobId: ${existing.jobId}`);
      await this.store.save(job);
      return { success: false, isDuplicate: true, jobId: existing.jobId };
    }

    job.updateStatus("QUEUED");
    await this.store.save(job);
    this.queue.push(job.jobId);

    return { success: true, isDuplicate: false, jobId: job.jobId };
  }

  /**
   * Dequeues the next pending job in FIFO order.
   */
  public async dequeue(): Promise<UniversalPrintJob | null> {
    if (this.isPaused || this.queue.length === 0) {
      return null;
    }

    const nextId = this.queue.shift();
    if (!nextId) return null;

    const job = await this.store.get(nextId);
    if (!job || job.status === "CANCELLED") {
      return this.dequeue(); // Skip cancelled/missing jobs
    }

    this.activeJobs.add(job.jobId);
    return job;
  }

  public async cancel(jobId: string, reason: string = "User cancelled job"): Promise<boolean> {
    const job = await this.store.get(jobId);
    if (!job) return false;

    job.updateStatus("CANCELLED", reason);
    await this.store.save(job);

    const queueIdx = this.queue.indexOf(jobId);
    if (queueIdx >= 0) {
      this.queue.splice(queueIdx, 1);
    }
    this.activeJobs.delete(jobId);

    return true;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public isQueuePaused(): boolean {
    return this.isPaused;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public async getJobStatus(jobId: string): Promise<PrintJobStatus | "NOT_FOUND"> {
    const job = await this.store.get(jobId);
    return job ? job.status : "NOT_FOUND";
  }

  public async getJob(jobId: string): Promise<UniversalPrintJob | null> {
    return this.store.get(jobId);
  }

  public async markJobCompleted(jobId: string): Promise<void> {
    const job = await this.store.get(jobId);
    if (job) {
      job.updateStatus("COMPLETED");
      await this.store.save(job);
    }
    this.activeJobs.delete(jobId);
  }

  public async markJobFileGenerated(jobId: string): Promise<void> {
    const job = await this.store.get(jobId);
    if (job) {
      job.updateStatus("FILE_GENERATED");
      await this.store.save(job);
    }
    this.activeJobs.delete(jobId);
  }

  public async markJobFailed(jobId: string, errorMsg: string, retryable: boolean): Promise<void> {
    const job = await this.store.get(jobId);
    if (!job) return;

    job.attempts += 1;

    if (retryable && job.attempts < job.maxAttempts) {
      job.updateStatus("RETRYING", errorMsg);
      await this.store.save(job);
      this.queue.push(job.jobId); // Re-queue for retry
    } else {
      job.updateStatus("FAILED", errorMsg);
      await this.store.save(job);
    }
    this.activeJobs.delete(jobId);
  }

  public async clear(): Promise<void> {
    this.queue = [];
    this.activeJobs.clear();
    await this.store.clear();
  }
}

export const UniversalPrintSpooler = new UniversalPrintSpoolerService();
