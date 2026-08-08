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
import logger from "../../logging/logger.js";
import { PrintingEventBus } from "../events/PrintingEventBus.js";

export interface DispatchOptions {
  printerName?: string;
  printerIp?: string;
  printerPort?: number;
  driverId?: string; // e.g. "zpl", "tspl", "esc_pos", "epl", "raw"
  providerId?: string; // e.g. "qz_tray", "windows_spooler", "network"
  copies?: number;
  activeItem?: any;
  priority?: "HIGH" | "BILLING" | "KITCHEN" | "BARCODE" | "REPORTS" | "BACKGROUND";
  maxRetries?: number;
}

export class PrintOrchestrator {
  private static auditLogs: PrintResult[] = [];

  /**
   * Main entry point for all platform printing requests (Rule SUPP-001)
   */
  static async dispatchDocument(document: PrintDocument, options: DispatchOptions): Promise<PrintResult> {
    const copies = Math.max(1, options.copies || 1);
    const driverId = options.driverId || "zpl";
    const targetPrinter = options.printerName || "Zebra ZD420 (ZPL II)";
    const maxRetries = options.maxRetries ?? 2;

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
      printerName: targetPrinter,
      printerIp: options.printerIp,
      printerPort: options.printerPort,
      driverId,
      providerId: options.providerId || "qz_tray",
      priority: options.priority || "BARCODE",
      copies,
      payload: translatedPayload,
      retryCount: 0,
      maxRetries,
      status: "QUEUED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    PrintingEventBus.publish({ type: "JOB_QUEUED", timestamp: new Date().toISOString(), job });

    // 4. Transport Execution with Retry Policy & Automatic Fallback Chain (Rule SUPP-004)
    let result: PrintResult = {
      jobId: job.id,
      success: false,
      providerId: job.providerId,
      driverId: job.driverId,
      timestamp: new Date().toISOString(),
      executionTimeMs: 0,
    };

    const primaryProvider = PrintProviderRegistry.getProvider(job.providerId);
    PrintingEventBus.publish({ type: "JOB_STARTED", timestamp: new Date().toISOString(), job });

    // Primary Provider Execution with Retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      job.retryCount = attempt;
      job.status = attempt > 0 ? "RETRYING" : "PROCESSING";
      job.updatedAt = new Date().toISOString();

      result = await primaryProvider.sendJob(job);
      if (result.success) break;

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 200));
      }
    }

    // Automatic Provider Fallback Chain (Primary Provider Failed -> Windows Spooler Fallback)
    if (!result.success && job.providerId !== "windows_spooler") {
      logger.warn(`[PrintOrchestrator] Provider ${job.providerId} failed after ${maxRetries} retries. Initiating fallback to Windows Spooler.`, result);
      const fallbackProvider = PrintProviderRegistry.getProvider("windows_spooler");
      job.providerId = "windows_spooler";
      result = await fallbackProvider.sendJob(job);
    }

    // 5. Audit Logging & Event Publishing (Rule SUPP-006)
    job.status = result.success ? "COMPLETED" : "FAILED";
    job.updatedAt = new Date().toISOString();

    this.auditLogs.push(result);
    if (result.success) {
      PrintingEventBus.publish({ type: "JOB_COMPLETED", timestamp: new Date().toISOString(), job, result });
    } else {
      PrintingEventBus.publish({
        type: "JOB_FAILED",
        timestamp: new Date().toISOString(),
        job,
        result,
        message: result.error || "Execution failed across all hardware providers",
      });
    }

    return result;
  }

  /**
   * Retrieves complete compliance audit logs (Rule SUPP-006)
   */
  static getAuditLogs(): PrintResult[] {
    return [...this.auditLogs];
  }

  /**
   * Clears audit logs (for testing or session reset)
   */
  static clearAuditLogs(): void {
    this.auditLogs = [];
  }
}
