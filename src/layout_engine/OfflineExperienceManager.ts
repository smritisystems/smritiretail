/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Offline Experience Manager (OEM)
 * Standard     : SXP Constitution v1.0 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Elevates the existing offline_pos_queue to a platform-wide service.
 * All studios register operations here — not in domain-specific stores.
 *
 * GOVERNANCE:
 *   No domain logic in this manager.
 *   Domain handlers registered via registerHandler().
 *   WorkspaceEventBus notifies UI of state changes (no polling).
 */

import { WorkspaceEventBus } from "./WorkspaceEventBus.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OfflineOperationType =
  | "sale"
  | "stock_receipt"
  | "stock_adjustment"
  | "stock_transfer"
  | "payment"
  | "custom";

export type OfflineOperationStatus = "pending" | "syncing" | "synced" | "failed";

export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  workspaceId: string;
  payload: unknown;
  status: OfflineOperationStatus;
  createdAt: string;
  attemptedAt?: string;
  failureReason?: string;
  retryCount: number;
}

export type OfflineSyncHandler = (operation: OfflineOperation) => Promise<{ success: boolean; error?: string }>;

// ── Storage key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "sxp_offline_queue_v1";
const MAX_RETRY = 3;

// ── Manager ───────────────────────────────────────────────────────────────────

class OfflineExperienceManagerService {
  private readonly handlers: Map<OfflineOperationType, OfflineSyncHandler> = new Map();
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private syncInProgress = false;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online",  () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());
    }
  }

  // ── Online / Offline state ─────────────────────────────────────────────────

  private handleOnline(): void {
    this.isOnline = true;
    WorkspaceEventBus.publish("OfflineStateChanged", { status: "online" }, "OfflineExperienceManager");
    this.syncAll();
  }

  private handleOffline(): void {
    this.isOnline = false;
    WorkspaceEventBus.publish("OfflineStateChanged", { status: "offline" }, "OfflineExperienceManager");
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  // ── Queue management ───────────────────────────────────────────────────────

  private readQueue(): OfflineOperation[] {
    if (typeof localStorage === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as OfflineOperation[];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: OfflineOperation[]): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }

  /**
   * Enqueue an operation for offline persistence.
   * Called by studio action handlers when the network is unavailable.
   */
  public enqueue(
    type: OfflineOperationType,
    workspaceId: string,
    payload: unknown
  ): OfflineOperation {
    const op: OfflineOperation = {
      id: `oem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      workspaceId,
      payload,
      status: "pending",
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    const queue = this.readQueue();
    queue.push(op);
    this.writeQueue(queue);

    WorkspaceEventBus.publish(
      "SyncCompleted",
      { queued: op.id, pendingCount: queue.filter((q) => q.status === "pending").length },
      "OfflineExperienceManager"
    );

    return op;
  }

  public getPendingCount(): number {
    return this.readQueue().filter((op) => op.status === "pending").length;
  }

  public getQueue(): ReadonlyArray<OfflineOperation> {
    return this.readQueue();
  }

  // ── Handler registration ───────────────────────────────────────────────────

  /**
   * Register a sync handler for a given operation type.
   * Called from studio manifests on module load.
   */
  public registerHandler(type: OfflineOperationType, handler: OfflineSyncHandler): void {
    this.handlers.set(type, handler);
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  /**
   * Attempt to sync all pending operations.
   * Called automatically on online event and manually on user request.
   * Only one sync pass runs at a time.
   */
  public async syncAll(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return;
    this.syncInProgress = true;

    const queue = this.readQueue();
    const pending = queue.filter((op) => op.status === "pending" || op.status === "failed");

    for (const op of pending) {
      if (op.retryCount >= MAX_RETRY) {
        op.status = "failed";
        op.failureReason = `Max retries (${MAX_RETRY}) exceeded`;
        continue;
      }

      const handler = this.handlers.get(op.type);
      if (!handler) {
        // No handler registered — skip but don't mark failed
        continue;
      }

      op.status = "syncing";
      op.attemptedAt = new Date().toISOString();
      op.retryCount++;
      this.writeQueue(queue);

      try {
        const result = await handler(op);
        op.status = result.success ? "synced" : "failed";
        if (!result.success) {
          op.failureReason = result.error ?? "Unknown error";
        }
      } catch (err: unknown) {
        op.status = "failed";
        op.failureReason = err instanceof Error ? err.message : "Unexpected error";
      }
    }

    this.writeQueue(queue);
    this.syncInProgress = false;

    const stillPending = queue.filter((q) => q.status === "pending" || q.status === "syncing").length;
    WorkspaceEventBus.publish(
      "SyncCompleted",
      {
        synced: queue.filter((q) => q.status === "synced").length,
        failed: queue.filter((q) => q.status === "failed").length,
        pending: stillPending,
      },
      "OfflineExperienceManager"
    );
  }

  /** Clear all synced operations from the queue (housekeeping) */
  public clearSynced(): void {
    const queue = this.readQueue().filter((op) => op.status !== "synced");
    this.writeQueue(queue);
  }
}

export const OfflineExperienceManager = new OfflineExperienceManagerService();
