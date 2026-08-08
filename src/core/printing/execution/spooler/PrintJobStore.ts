/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Print Job Store Abstraction
 * Standard     : SCS-PRINT-JOBSTORE-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { UniversalPrintJob } from "../UniversalPrintJob.ts";

export interface IPrintJobStore {
  save(job: UniversalPrintJob): Promise<void>;
  get(jobId: string): Promise<UniversalPrintJob | null>;
  getByChecksum(checksum: string): Promise<UniversalPrintJob | null>;
  listAll(): Promise<UniversalPrintJob[]>;
  remove(jobId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export class MemoryPrintJobStore implements IPrintJobStore {
  private jobs: Map<string, UniversalPrintJob> = new Map();
  private checksumIndex: Map<string, string> = new Map();

  public async save(job: UniversalPrintJob): Promise<void> {
    this.jobs.set(job.jobId, job);
    if (job.checksum) {
      this.checksumIndex.set(job.checksum, job.jobId);
    }
  }

  public async get(jobId: string): Promise<UniversalPrintJob | null> {
    return this.jobs.get(jobId) || null;
  }

  public async getByChecksum(checksum: string): Promise<UniversalPrintJob | null> {
    const jobId = this.checksumIndex.get(checksum);
    if (!jobId) return null;
    return this.get(jobId);
  }

  public async listAll(): Promise<UniversalPrintJob[]> {
    return Array.from(this.jobs.values());
  }

  public async remove(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (job && job.checksum) {
      this.checksumIndex.delete(job.checksum);
    }
    return this.jobs.delete(jobId);
  }

  public async clear(): Promise<void> {
    this.jobs.clear();
    this.checksumIndex.clear();
  }
}
