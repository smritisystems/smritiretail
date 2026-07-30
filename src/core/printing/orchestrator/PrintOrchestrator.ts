/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : PrintOrchestrator (Central Printing Engine — Rule SUPP-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Status       : FROZEN — APPROVED
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { PrintDocument, PrintJob, PrintResult } from "../models/PrintDocument.js";
import { PrintVariableResolver } from "../rendering/PrintVariableResolver.js";
import { PrintDriverRegistry } from "../drivers/PrintDriverRegistry.js";
import { PrintProviderRegistry } from "../providers/PrintProviderRegistry.js";
import { PrintingEventBus } from "../events/PrintingEventBus.js";

export interface DispatchOptions {
  printerName: string;
  driverId?: string; // e.g. "zpl", "tspl", "esc_pos"
  providerId?: string; // e.g. "qz_tray", "windows_spooler", "network"
  copies?: number;
  activeItem?: any;
}

export class PrintOrchestrator {
  private static auditLogs: PrintResult[] = [];

  /**
   * Main entry point for all platform printing requests (Rule SUPP-001)
   */
  static async dispatchDocument(document: PrintDocument, options: DispatchOptions): Promise<PrintResult> {
    const copies = Math.max(1, options.copies || 1);
    const driverId = options.driverId || "zpl";

    // 1. Variable Resolution via SMP-M (Rule SUPP-007 & SUPP-008)
    const resolvedScript = PrintVariableResolver.resolveDocument(document, options.activeItem || {});

    // 2. Command Language Translation via PrintDriverRegistry (Rule SUPP-003)
    const driver = PrintDriverRegistry.getDriver(driverId);
    const translatedPayload = driver.translate({ ...document, content: resolvedScript }, copies);

    // 3. Create PrintJob Instance (Rule SUPP-005)
    const job: PrintJob = {
      id: `JOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      documentId: document.id,
      document: { ...document, immutable: true },
      printerName: options.printerName,
      driverId,
      providerId: options.providerId || "qz_tray",
      priority: "BARCODE",
      copies,
      payload: translatedPayload,
      retryCount: 0,
      maxRetries: 3,
      status: "QUEUED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    PrintingEventBus.publish({ type: "JOB_QUEUED", timestamp: new Date().toISOString(), job });

    // 4. Transport Execution with Automatic Provider Fallback Chain (Rule SUPP-004)
    let result: PrintResult;
    const primaryProvider = PrintProviderRegistry.getProvider(job.providerId);
    
    PrintingEventBus.publish({ type: "JOB_STARTED", timestamp: new Date().toISOString(), job });
    result = await primaryProvider.sendJob(job);

    // Fallback if primary provider fails
    if (!result.success && job.providerId !== "windows_spooler") {
      const fallbackProvider = PrintProviderRegistry.getProvider("windows_spooler");
      result = await fallbackProvider.sendJob(job);
    }

    // 5. Audit Logging & Event Publishing (Rule SUPP-006)
    this.auditLogs.push(result);
    if (result.success) {
      PrintingEventBus.publish({ type: "JOB_COMPLETED", timestamp: new Date().toISOString(), job, result });
    } else {
      PrintingEventBus.publish({
        type: "JOB_FAILED",
        timestamp: new Date().toISOString(),
        job,
        result,
        message: result.error,
      });
    }

    return result;
  }

  static getAuditLogs(): PrintResult[] {
    return [...this.auditLogs];
  }
}
