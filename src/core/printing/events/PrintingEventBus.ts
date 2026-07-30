/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : PrintingEventBus (Platform Event Bus)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { PrintJob, PrinterCapability, PrintResult } from "../models/PrintDocument.js";

export type PrintingEventType =
  | "PRINTER_CONNECTED"
  | "PRINTER_DISCONNECTED"
  | "PRINTER_OFFLINE"
  | "JOB_QUEUED"
  | "JOB_STARTED"
  | "JOB_COMPLETED"
  | "JOB_FAILED"
  | "QUEUE_PAUSED"
  | "QUEUE_RESUMED";

export interface PrintingEventPayload {
  type: PrintingEventType;
  timestamp: string;
  printer?: PrinterCapability;
  job?: PrintJob;
  result?: PrintResult;
  message?: string;
}

type EventCallback = (payload: PrintingEventPayload) => void;

export class PrintingEventBus {
  private static listeners: Map<PrintingEventType, Set<EventCallback>> = new Map();

  static subscribe(event: PrintingEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  static publish(payload: PrintingEventPayload): void {
    const callbacks = this.listeners.get(payload.type);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error("[PrintingEventBus] Listener error:", e);
        }
      });
    }
  }
}
