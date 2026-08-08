/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Print Spooler Unit Tests
 * Standard     : SCS-PRINT-SPOOLER-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { UniversalPrintSpoolerService } from "../core/printing/execution/UniversalPrintSpooler.ts";
import { UniversalPrintJob } from "../core/printing/execution/UniversalPrintJob.ts";
import { MemoryPrintJobStore } from "../core/printing/execution/spooler/PrintJobStore.ts";

describe("Universal Print Spooler Test Suite (Phase H)", () => {
  let spooler: UniversalPrintSpoolerService;

  beforeEach(async () => {
    spooler = new UniversalPrintSpoolerService(new MemoryPrintJobStore());
    await spooler.clear();
  });

  it("1. Enqueues a valid print job into the spooler queue", async () => {
    const job = new UniversalPrintJob({ jobId: "s1", templateId: "t1", printerId: "p1" });
    const res = await spooler.enqueue(job);

    expect(res.success).toBe(true);
    expect(res.isDuplicate).toBe(false);
    expect(spooler.getQueueLength()).toBe(1);
  });

  it("2. Dequeues jobs in strict FIFO order", async () => {
    const j1 = new UniversalPrintJob({ jobId: "s-first", templateId: "t1", printerId: "p1", renderedPayload: "1" });
    const j2 = new UniversalPrintJob({ jobId: "s-second", templateId: "t2", printerId: "p1", renderedPayload: "2" });

    await spooler.enqueue(j1);
    await spooler.enqueue(j2);

    const dequeued1 = await spooler.dequeue();
    expect(dequeued1?.jobId).toBe("s-first");

    const dequeued2 = await spooler.dequeue();
    expect(dequeued2?.jobId).toBe("s-second");
  });

  it("3. Detects and rejects duplicate job submission based on checksum deduplication", async () => {
    const j1 = new UniversalPrintJob({
      jobId: "dup-1",
      templateId: "t1",
      printerId: "p1",
      renderedPayload: "^XA^FD123^FS^XZ",
    });

    const j2 = new UniversalPrintJob({
      jobId: "dup-2",
      templateId: "t1",
      printerId: "p1",
      renderedPayload: "^XA^FD123^FS^XZ",
    });

    const res1 = await spooler.enqueue(j1);
    expect(res1.success).toBe(true);

    const res2 = await spooler.enqueue(j2);
    expect(res2.success).toBe(false);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.jobId).toBe("dup-1");
  });

  it("4. Cancels a queued job and removes it from queue", async () => {
    const job = new UniversalPrintJob({ jobId: "c1", templateId: "t1", printerId: "p1" });
    await spooler.enqueue(job);

    const cancelRes = await spooler.cancel("c1", "User cancelled");
    expect(cancelRes).toBe(true);

    const status = await spooler.getJobStatus("c1");
    expect(status).toBe("CANCELLED");
    expect(spooler.getQueueLength()).toBe(0);
  });

  it("5. Pause and resume controls spooler dequeue execution", async () => {
    const job = new UniversalPrintJob({ jobId: "p1", templateId: "t1", printerId: "p1" });
    await spooler.enqueue(job);

    spooler.pause();
    expect(spooler.isQueuePaused()).toBe(true);

    const dequeuedWhilePaused = await spooler.dequeue();
    expect(dequeuedWhilePaused).toBeNull();

    spooler.resume();
    expect(spooler.isQueuePaused()).toBe(false);

    const dequeuedResumed = await spooler.dequeue();
    expect(dequeuedResumed?.jobId).toBe("p1");
  });

  it("6. Marks job completed and updates store record", async () => {
    const job = new UniversalPrintJob({ jobId: "mc1", templateId: "t1", printerId: "p1" });
    await spooler.enqueue(job);
    await spooler.markJobCompleted("mc1");

    const status = await spooler.getJobStatus("mc1");
    expect(status).toBe("COMPLETED");
  });

  it("7. Handles retryable failure by incrementing attempt count and re-queuing", async () => {
    const job = new UniversalPrintJob({ jobId: "rf1", templateId: "t1", printerId: "p1", maxAttempts: 3 });
    await spooler.enqueue(job);
    await spooler.dequeue();

    await spooler.markJobFailed("rf1", "NETWORK_TIMEOUT", true);

    const retriedJob = await spooler.getJob("rf1");
    expect(retriedJob?.attempts).toBe(1);
    expect(retriedJob?.status).toBe("RETRYING");
    expect(spooler.getQueueLength()).toBe(1);
  });

  it("8. Marks job FAILED when max retry attempts are exceeded", async () => {
    const job = new UniversalPrintJob({ jobId: "max-retry", templateId: "t1", printerId: "p1", maxAttempts: 1 });
    await spooler.enqueue(job);
    await spooler.dequeue();

    await spooler.markJobFailed("max-retry", "NETWORK_TIMEOUT", true);

    const failedJob = await spooler.getJob("max-retry");
    expect(failedJob?.attempts).toBe(1);
    expect(failedJob?.status).toBe("FAILED");
  });

  it("9. Immediately marks non-retryable failure as FAILED without re-queuing", async () => {
    const job = new UniversalPrintJob({ jobId: "non-retry", templateId: "t1", printerId: "p1", maxAttempts: 5 });
    await spooler.enqueue(job);
    await spooler.dequeue();

    await spooler.markJobFailed("non-retry", "INVALID_FIELD_MAPPING", false);

    const failedJob = await spooler.getJob("non-retry");
    expect(failedJob?.status).toBe("FAILED");
    expect(spooler.getQueueLength()).toBe(0);
  });

  it("10. Returns NOT_FOUND for unknown job status lookup", async () => {
    const status = await spooler.getJobStatus("unknown-job-999");
    expect(status).toBe("NOT_FOUND");
  });

  it("11. Clears queue and store on spooler clear", async () => {
    await spooler.enqueue(new UniversalPrintJob({ jobId: "clear-1", templateId: "t1", printerId: "p1" }));
    await spooler.clear();

    expect(spooler.getQueueLength()).toBe(0);
  });

  it("12. Skips cancelled job during dequeue sequence", async () => {
    const j1 = new UniversalPrintJob({ jobId: "sk-1", templateId: "t1", printerId: "p1", renderedPayload: "A" });
    const j2 = new UniversalPrintJob({ jobId: "sk-2", templateId: "t2", printerId: "p1", renderedPayload: "B" });

    await spooler.enqueue(j1);
    await spooler.enqueue(j2);

    await spooler.cancel("sk-1");

    const dequeued = await spooler.dequeue();
    expect(dequeued?.jobId).toBe("sk-2");
  });

  it("13. Handles empty dequeue when queue is empty", async () => {
    const job = await spooler.dequeue();
    expect(job).toBeNull();
  });

  it("14. Preserves store abstraction with MemoryPrintJobStore", async () => {
    const store = new MemoryPrintJobStore();
    const job = new UniversalPrintJob({ jobId: "st-1", templateId: "t1", printerId: "p1" });

    await store.save(job);
    const retrieved = await store.get("st-1");

    expect(retrieved?.jobId).toBe("st-1");
  });

  it("15. Removes job from store by ID", async () => {
    const store = new MemoryPrintJobStore();
    const job = new UniversalPrintJob({ jobId: "rem-1", templateId: "t1", printerId: "p1" });

    await store.save(job);
    const removed = await store.remove("rem-1");

    expect(removed).toBe(true);
    expect(await store.get("rem-1")).toBeNull();
  });

  it("16. Retain job status tracking across state updates", async () => {
    const job = new UniversalPrintJob({ jobId: "tr-1", templateId: "t1", printerId: "p1" });
    await spooler.enqueue(job);

    expect(await spooler.getJobStatus("tr-1")).toBe("QUEUED");

    await spooler.dequeue();
    await spooler.markJobCompleted("tr-1");

    expect(await spooler.getJobStatus("tr-1")).toBe("COMPLETED");
  });

  it("17. Handles multiple jobs queued concurrently", async () => {
    for (let i = 0; i < 10; i++) {
      await spooler.enqueue(
        new UniversalPrintJob({ jobId: `c-job-${i}`, templateId: "t1", printerId: "p1", renderedPayload: `P-${i}` })
      );
    }

    expect(spooler.getQueueLength()).toBe(10);
  });

  it("18. Allows custom store injection into spooler service", async () => {
    const customStore = new MemoryPrintJobStore();
    const customSpooler = new UniversalPrintSpoolerService(customStore);

    const job = new UniversalPrintJob({ jobId: "cust-1", templateId: "t1", printerId: "p1" });
    await customSpooler.enqueue(job);

    expect(await customStore.get("cust-1")).toBeDefined();
  });

  it("19. Re-enqueuing completed job with identical checksum is flagged as duplicate", async () => {
    const j1 = new UniversalPrintJob({ jobId: "c-dup-1", templateId: "t1", printerId: "p1", renderedPayload: "SAME" });
    await spooler.enqueue(j1);
    await spooler.markJobCompleted("c-dup-1");

    const j2 = new UniversalPrintJob({ jobId: "c-dup-2", templateId: "t1", printerId: "p1", renderedPayload: "SAME" });
    const res = await spooler.enqueue(j2);

    expect(res.isDuplicate).toBe(true);
  });

  it("20. Returns false when cancelling non-existent job ID", async () => {
    const res = await spooler.cancel("non-existent-999");
    expect(res).toBe(false);
  });
});
