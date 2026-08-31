/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.73.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProPosOfflineSyncEngine } from "../sync/ProPosOfflineSyncEngine";
import * as apiFetchModule from "../lib/apiFetchV1";

describe("ProPOS Offline-First Sync Engine & Edge Resiliency", () => {
  beforeEach(() => {
    ProPosOfflineSyncEngine.clearQueue();
    vi.restoreAllMocks();
  });

  it("STEP 1: should generate deterministic client transaction UUIDs", () => {
    const uuid1 = ProPosOfflineSyncEngine.generateClientTxUuid("POS-01");
    const uuid2 = ProPosOfflineSyncEngine.generateClientTxUuid("POS-02");

    expect(uuid1).toMatch(/^tx-pos-01-[a-z0-9]+-[a-z0-9]+$/);
    expect(uuid2).toMatch(/^tx-pos-02-[a-z0-9]+-[a-z0-9]+$/);
    expect(uuid1).not.toBe(uuid2);
  });

  it("STEP 2: should queue offline sales invoices with pending status", async () => {
    const payload = {
      invoiceNo: "OFF-INV-001",
      customerName: "Walk-in Retail Buyer",
      grandTotal: 3450.0,
      items: [{ itemCode: "SKU-99", qty: 2, rate: 1725.0 }],
    };

    const record = await ProPosOfflineSyncEngine.queueOfflineSale(payload, "POS-01", "OFF-INV-001");
    expect(record.client_tx_uuid).toBeDefined();
    expect(record.status).toBe("QUEUED");
    expect(record.retry_count).toBe(0);
    expect(record.document_number).toBe("OFF-INV-001");

    const queue = await ProPosOfflineSyncEngine.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].client_tx_uuid).toBe(record.client_tx_uuid);

    const stats = await ProPosOfflineSyncEngine.getStats();
    expect(stats.queued).toBe(1);
    expect(stats.synced).toBe(0);
    expect(stats.total).toBe(1);
  });

  it("STEP 3: should flush sync batch to FastAPI backend successfully", async () => {
    // Mock apiFetchV1 returning ACCEPTED result
    const spy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      batch_id: "batch-test-1",
      company_id: "COMP-001",
      accepted_count: 2,
      needs_review_count: 0,
      failed_count: 0,
      results: [
        { client_tx_uuid: "tx-1", status: "ACCEPTED" },
        { client_tx_uuid: "tx-2", status: "ACCEPTED_WARN" },
      ],
    });

    await ProPosOfflineSyncEngine.queueOfflineSale({ client_tx_uuid: "tx-1", invoiceNo: "INV-1" });
    await ProPosOfflineSyncEngine.queueOfflineSale({ client_tx_uuid: "tx-2", invoiceNo: "INV-2" });

    const flushResult = await ProPosOfflineSyncEngine.flushSyncBatch("COMP-001", "BR-MAIN-001");
    expect(flushResult.success).toBe(true);
    expect(flushResult.accepted_count).toBe(2);

    const stats = await ProPosOfflineSyncEngine.getStats();
    expect(stats.synced).toBe(2);
    expect(stats.queued).toBe(0);
    expect(stats.total).toBe(2);
  });

  it("STEP 4: should handle conflict resolution classifications (NEEDS_REVIEW)", async () => {
    vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      batch_id: "batch-test-2",
      accepted_count: 1,
      needs_review_count: 1,
      failed_count: 0,
      results: [
        { client_tx_uuid: "tx-ok", status: "ACCEPTED" },
        { client_tx_uuid: "tx-drift", status: "NEEDS_REVIEW", message: "Stock variance detected" },
      ],
    });

    await ProPosOfflineSyncEngine.queueOfflineSale({ client_tx_uuid: "tx-ok", invoiceNo: "INV-OK" });
    await ProPosOfflineSyncEngine.queueOfflineSale({ client_tx_uuid: "tx-drift", invoiceNo: "INV-DRIFT" });

    const flushResult = await ProPosOfflineSyncEngine.flushSyncBatch();
    expect(flushResult.success).toBe(true);

    const stats = await ProPosOfflineSyncEngine.getStats();
    expect(stats.synced).toBe(1);
    expect(stats.needs_review).toBe(1);
    expect(stats.queued).toBe(0);

    const queue = await ProPosOfflineSyncEngine.getQueue();
    const driftItem = queue.find((q) => q.client_tx_uuid === "tx-drift");
    expect(driftItem?.status).toBe("NEEDS_REVIEW");
    expect(driftItem?.error_message).toContain("Stock variance detected");
  });

  it("STEP 5: should handle network failure and preserve queue for retry", async () => {
    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValue(new Error("Offline network failure"));

    await ProPosOfflineSyncEngine.queueOfflineSale({ client_tx_uuid: "tx-net-1", invoiceNo: "INV-NET-1" });

    const flushResult = await ProPosOfflineSyncEngine.flushSyncBatch();
    expect(flushResult.success).toBe(false);

    const queue = await ProPosOfflineSyncEngine.getQueue();
    expect(queue[0].status).toBe("FAILED");
    expect(queue[0].retry_count).toBe(1);
    expect(queue[0].error_message).toContain("Offline network failure");
  });
});
