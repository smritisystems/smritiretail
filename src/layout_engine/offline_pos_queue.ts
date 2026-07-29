/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.3.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { useState, useEffect } from "react";

export interface OfflineInvoiceItem {
  client_invoice_id: string;
  invoice_number: string;
  grand_total: number;
  items_count: number;
  timestamp: string;
  status: "QUEUED" | "SYNCED" | "FAILED";
}

const OFFLINE_QUEUE_STORAGE_KEY = "smriti_pos_offline_queue";

class OfflinePOSQueue {
  private queue: OfflineInvoiceItem[] = [];
  private listeners: Set<() => void> = new Set();
  private isOnlineStatus: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      this.isOnlineStatus = navigator.onLine;
      const saved = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
      if (saved) {
        try {
          this.queue = JSON.parse(saved);
        } catch {
          this.queue = [];
        }
      }

      window.addEventListener("online", () => {
        this.isOnlineStatus = true;
        this.notify();
      });
      window.addEventListener("offline", () => {
        this.isOnlineStatus = false;
        this.notify();
      });
    }
  }

  public isOnline(): boolean {
    return this.isOnlineStatus;
  }

  public enqueue(invoice: Omit<OfflineInvoiceItem, "status" | "timestamp">) {
    const item: OfflineInvoiceItem = {
      ...invoice,
      timestamp: new Date().toISOString(),
      status: "QUEUED",
    };
    this.queue.push(item);
    this.save();
    this.notify();
  }

  public getQueue(): OfflineInvoiceItem[] {
    return this.queue;
  }

  public clearSynced() {
    this.queue = this.queue.filter((i) => i.status !== "SYNCED");
    this.save();
    this.notify();
  }

  public markBatchSynced(invoiceNumbers: string[]) {
    this.queue = this.queue.map((i) =>
      invoiceNumbers.includes(i.invoice_number) ? { ...i, status: "SYNCED" } : i
    );
    this.save();
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private save() {
    if (typeof window !== "undefined") {
      localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    }
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const offlinePOSQueue = new OfflinePOSQueue();

export function useOfflinePOSQueue() {
  const [queue, setQueueState] = useState<OfflineInvoiceItem[]>(offlinePOSQueue.getQueue());
  const [isOnline, setIsOnlineState] = useState<boolean>(offlinePOSQueue.isOnline());

  useEffect(() => {
    return offlinePOSQueue.subscribe(() => {
      setQueueState([...offlinePOSQueue.getQueue()]);
      setIsOnlineState(offlinePOSQueue.isOnline());
    });
  }, []);

  return {
    queue,
    isOnline,
    queuedCount: queue.filter((i) => i.status === "QUEUED").length,
    enqueue: (inv: Omit<OfflineInvoiceItem, "status" | "timestamp">) => offlinePOSQueue.enqueue(inv),
    markBatchSynced: (numbers: string[]) => offlinePOSQueue.markBatchSynced(numbers),
    clearSynced: () => offlinePOSQueue.clearSynced(),
  };
}
