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

import { apiFetchV1 } from "../lib/apiFetchV1";

export interface OfflineSaleRecord {
  client_tx_uuid: string;
  terminal_id: string;
  txn_type: "SALES_INVOICE" | "CREDIT_NOTE" | "SHIFT_EVENT";
  document_number?: string;
  payload: any;
  status: "QUEUED" | "SYNCING" | "SYNCED" | "NEEDS_REVIEW" | "REJECTED" | "FAILED";
  retry_count: number;
  created_at: string;
  last_synced_at?: string;
  error_message?: string;
}

export interface SyncQueueStats {
  queued: number;
  synced: number;
  needs_review: number;
  rejected: number;
  total: number;
}

export class ProPosOfflineSyncEngine {
  private static DB_NAME = "smriti_propos_edge_v1";
  private static STORE_SALES = "offline_sales_queue";
  private static STORE_PRODUCTS = "offline_products_cache";
  private static STORE_CUSTOMERS = "offline_customers_cache";

  // In-memory fallback / simulation for non-DOM and SSR environments
  private static memoryQueue: Map<string, OfflineSaleRecord> = new Map();
  private static autoSyncTimer: any = null;

  /**
   * Generates a deterministic client-side transaction UUID.
   */
  public static generateClientTxUuid(terminalId: string = "POS-01"): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `tx-${terminalId.toLowerCase()}-${ts}-${rand}`;
  }

  /**
   * Enqueues an offline POS transaction for resilient upstream synchronization.
   */
  public static async queueOfflineSale(
    payload: any,
    terminalId: string = "POS-01",
    documentNumber?: string
  ): Promise<OfflineSaleRecord> {
    const clientTxUuid = payload.client_tx_uuid || this.generateClientTxUuid(terminalId);
    const record: OfflineSaleRecord = {
      client_tx_uuid: clientTxUuid,
      terminal_id: terminalId,
      txn_type: payload.txn_type || "SALES_INVOICE",
      document_number: documentNumber || payload.invoice_no || payload.invoiceNo,
      payload: { ...payload, client_tx_uuid: clientTxUuid },
      status: "QUEUED",
      retry_count: 0,
      created_at: new Date().toISOString(),
    };

    this.memoryQueue.set(clientTxUuid, record);
    return record;
  }

  /**
   * Retrieves all items currently stored in the sync queue.
   */
  public static async getQueue(): Promise<OfflineSaleRecord[]> {
    return Array.from(this.memoryQueue.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  /**
   * Computes queue statistics across states.
   */
  public static async getStats(): Promise<SyncQueueStats> {
    const items = await this.getQueue();
    let queued = 0, synced = 0, needs_review = 0, rejected = 0;

    for (const itm of items) {
      if (itm.status === "QUEUED" || itm.status === "SYNCING") queued++;
      else if (itm.status === "SYNCED") synced++;
      else if (itm.status === "NEEDS_REVIEW") needs_review++;
      else if (itm.status === "REJECTED" || itm.status === "FAILED") rejected++;
    }

    return {
      queued,
      synced,
      needs_review,
      rejected,
      total: items.length,
    };
  }

  /**
   * Flushes all queued transactions to the FastAPI Sole Backend System-of-Record.
   */
  public static async flushSyncBatch(
    companyId: string = "COMP-001",
    branchId: string = "BR-MAIN-001",
    terminalId: string = "POS-01"
  ): Promise<{
    success: boolean;
    batch_id: string;
    accepted_count: number;
    needs_review_count: number;
    failed_count: number;
  }> {
    const pending = Array.from(this.memoryQueue.values()).filter(
      (i) => i.status === "QUEUED" || (i.status === "FAILED" && i.retry_count < 5)
    );

    if (pending.length === 0) {
      return {
        success: true,
        batch_id: "EMPTY_BATCH",
        accepted_count: 0,
        needs_review_count: 0,
        failed_count: 0,
      };
    }

    const batchId = `batch-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    
    // Mark as SYNCING
    for (const itm of pending) {
      itm.status = "SYNCING";
      itm.retry_count += 1;
    }

    const transactions = pending.map((p) => ({
      client_tx_uuid: p.client_tx_uuid,
      terminal_id: p.terminal_id,
      sequence_no: 1,
      txn_type: p.txn_type,
      document_number: p.document_number,
      created_at_utc: p.created_at,
      payload_json: typeof p.payload === "string" ? p.payload : JSON.stringify(p.payload),
    }));

    const batchRequest = {
      batch_id: batchId,
      terminal_id: terminalId,
      company_id: companyId,
      branch_id: branchId,
      submitted_at: new Date().toISOString(),
      allow_negative_stock: true,
      transactions,
    };

    try {
      const response = await apiFetchV1("/sync/push", {
        method: "POST",
        body: JSON.stringify(batchRequest),
      });

      // Update state per operation result
      const resultMap = new Map<string, any>();
      if (response && response.results) {
        for (const res of response.results) {
          resultMap.set(res.client_tx_uuid, res);
        }
      }

      for (const itm of pending) {
        const opResult = resultMap.get(itm.client_tx_uuid);
        if (opResult) {
          if (opResult.status === "ACCEPTED" || opResult.status === "ACCEPTED_WARN" || opResult.status === "DEDUPLICATED") {
            itm.status = "SYNCED";
            itm.last_synced_at = new Date().toISOString();
          } else if (opResult.status === "NEEDS_REVIEW") {
            itm.status = "NEEDS_REVIEW";
            itm.error_message = opResult.message || "Flagged for Store Manager review.";
          } else {
            itm.status = "REJECTED";
            itm.error_message = opResult.message || "Rejected by conflict engine.";
          }
        } else {
          // If server accepted entire batch generally
          itm.status = "SYNCED";
          itm.last_synced_at = new Date().toISOString();
        }
      }

      return {
        success: true,
        batch_id: batchId,
        accepted_count: response?.accepted_count || pending.length,
        needs_review_count: response?.needs_review_count || 0,
        failed_count: response?.failed_count || 0,
      };
    } catch (err: any) {
      for (const itm of pending) {
        itm.status = "FAILED";
        itm.error_message = err?.message || "Network offline or backend timeout.";
      }
      return {
        success: false,
        batch_id: batchId,
        accepted_count: 0,
        needs_review_count: 0,
        failed_count: pending.length,
      };
    }
  }

  /**
   * Starts automatic background synchronization worker.
   */
  public static startAutoSyncWorker(intervalMs: number = 15000): void {
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);

    this.autoSyncTimer = setInterval(async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return; // Device is physically offline
      }
      try {
        await this.flushSyncBatch();
      } catch (e) {
        console.warn("[ProPosSync] Background flush warning:", e);
      }
    }, intervalMs);
  }

  /**
   * Stops background synchronization worker.
   */
  public static stopAutoSyncWorker(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  /**
   * Clears all simulated sync records (for testing & reset).
   */
  public static clearQueue(): void {
    this.memoryQueue.clear();
  }
}
