/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.50
 * Created      : 2026-10-09
 * Modified     : 2026-10-09 (v6.70.50 — Smart Import batch history manager and date filter bridge)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export interface ImportBatchRecord {
  batchId: string;
  timestamp: string; // ISO string
  savedCount: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  itemCodes: string[];
  barcodes: string[];
  summary: string;
  strategy?: string;
  sourceFilename?: string;
}

const STORAGE_KEY = "smriti_recent_import_batches";
const MAX_BATCHES = 10;

export const ImportBatchManager = {
  recordBatch(batch: Omit<ImportBatchRecord, "timestamp"> & { timestamp?: string }): ImportBatchRecord {
    const fullRecord: ImportBatchRecord = {
      ...batch,
      timestamp: batch.timestamp || new Date().toISOString(),
    };

    try {
      const existing = this.getRecentBatches();
      const updated = [fullRecord, ...existing.filter(b => b.batchId !== fullRecord.batchId)].slice(0, MAX_BATCHES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // localStorage quota or private mode protection
    }

    return fullRecord;
  },

  getRecentBatches(): ImportBatchRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  getLatestBatch(): ImportBatchRecord | null {
    const batches = this.getRecentBatches();
    return batches.length > 0 ? batches[0] : null;
  },

  getBatchById(batchId: string): ImportBatchRecord | null {
    const batches = this.getRecentBatches();
    return batches.find(b => b.batchId === batchId) || null;
  },

  clearAllBatches(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
};
