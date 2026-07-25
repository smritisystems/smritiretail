/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Intelligent Print Queue & Offline Spooler Service)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

export type PrintJobStatus = "Pending" | "Printing" | "Completed" | "Failed" | "Cancelled";

export interface PrintQueueItem {
  id: string;
  jobName: string;
  printerName: string;
  port: string;
  templateName: string;
  itemCount: number;
  totalLabels: number;
  estimatedTimeSec: number;
  status: PrintJobStatus;
  progressPercent: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  rawPayload: string;
  userName: string;
}

const LOCAL_STORAGE_QUEUE_KEY = "smriti_print_queue_spool_v1";

export const getStoredPrintQueue = (): PrintQueueItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const savePrintQueue = (queue: PrintQueueItem[]): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to save print queue:", err);
  }
};

export const addJobToPrintQueue = (
  jobName: string,
  printerName: string,
  port: string,
  templateName: string,
  itemCount: number,
  totalLabels: number,
  rawPayload: string,
  userName: string = "System Manager"
): PrintQueueItem => {
  const queue = getStoredPrintQueue();
  const estimatedTimeSec = Math.ceil(totalLabels * 0.25); // ~4 labels per second

  const newJob: PrintQueueItem = {
    id: `JOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    jobName,
    printerName,
    port,
    templateName,
    itemCount,
    totalLabels,
    estimatedTimeSec,
    status: "Pending",
    progressPercent: 0,
    createdAt: new Date().toISOString(),
    rawPayload,
    userName
  };

  queue.unshift(newJob);
  savePrintQueue(queue);
  return newJob;
};

export const updatePrintJobStatus = (
  jobId: string,
  status: PrintJobStatus,
  progressPercent?: number,
  errorMessage?: string
): PrintQueueItem[] => {
  const queue = getStoredPrintQueue();
  const updated = queue.map(job => {
    if (job.id === jobId) {
      const now = new Date().toISOString();
      return {
        ...job,
        status,
        progressPercent: progressPercent !== undefined ? progressPercent : job.progressPercent,
        startedAt: status === "Printing" && !job.startedAt ? now : job.startedAt,
        completedAt: (status === "Completed" || status === "Failed" || status === "Cancelled") ? now : job.completedAt,
        errorMessage: errorMessage || job.errorMessage
      };
    }
    return job;
  });

  savePrintQueue(updated);
  return updated;
};

export const clearCompletedPrintJobs = (): PrintQueueItem[] => {
  const queue = getStoredPrintQueue();
  const activeOnly = queue.filter(job => job.status === "Pending" || job.status === "Printing");
  savePrintQueue(activeOnly);
  return activeOnly;
};
