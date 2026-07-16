/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.0.0
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { ISyncRepository } from "../interfaces/db.js";
import { SyncQueueItem } from "../domain/entities.js";

export class SyncEngine {
  private syncRepo: ISyncRepository;
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private deviceId: string;

  constructor(syncRepo: ISyncRepository, deviceId = "DESKTOP-POS-01") {
    this.syncRepo = syncRepo;
    this.deviceId = deviceId;
  }

  /**
   * Starts the background sync poll execution.
   */
  start(intervalMs = 30000) {
    if (this.syncInterval) return;
    console.log(`[SMRITI SyncEngine] Starting background sync worker (Interval: ${intervalMs}ms)...`);
    this.syncInterval = setInterval(() => this.processQueue(), intervalMs);
    // Trigger initial run asynchronously
    this.processQueue().catch(err => console.error("[SMRITI SyncEngine] Error in sync run:", err));
  }

  /**
   * Stops the background sync poll.
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log("[SMRITI SyncEngine] Sync worker stopped.");
    }
  }

  /**
   * Push a mutate operation into the sync queue.
   */
  async queueChange(module: string, operation: string, entity: string, payload: any): Promise<SyncQueueItem> {
    const uuid = `sync-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const syncItem = await this.syncRepo.enqueue({
      uuid,
      module,
      operation,
      entity,
      payload: JSON.stringify(payload),
      deviceId: this.deviceId
    });
    console.log(`[SMRITI SyncEngine] Enqueued sync change [${uuid}] for module: ${module}`);
    
    // Attempt fast replication trigger in the background
    this.processQueue().catch(err => console.error("[SMRITI SyncEngine] Async process queue error:", err));
    
    return syncItem;
  }

  /**
   * Process pending items in the synchronization queue.
   */
  async processQueue(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pendingItems = await this.syncRepo.getQueue();
      if (pendingItems.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[SMRITI SyncEngine] Processing ${pendingItems.length} pending items...`);

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          await this.syncRepo.updateStatus(item.id!, "synced");
          console.log(`[SMRITI SyncEngine] Successfully synced uuid: ${item.uuid}`);
        } catch (error) {
          console.error(`[SMRITI SyncEngine] Failed to sync uuid: ${item.uuid}. Error:`, error);
          await this.syncRepo.incrementRetry(item.id!);
          if (item.retryCount >= 5) {
            await this.syncRepo.updateStatus(item.id!, "failed", new Date().toISOString());
          }
        }
      }
    } catch (error) {
      console.error("[SMRITI SyncEngine] Critical error processing sync queue:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Transmit sync log row to HQ Cloud Node.
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    // If we're offline, simulated network failure will throw and trigger retries
    const isOffline = process.env.SYNC_FORCE_OFFLINE === "true";
    if (isOffline) {
      throw new Error("Simulated network offline - sync paused");
    }

    // In a full production deployment, this makes an HTTP POST request to the HQ central coordinator API.
    // Here we perform a mock fetch simulation that succeeds instantly.
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, 50);
    });
  }
}
