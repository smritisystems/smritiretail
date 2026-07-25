/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Print Compliance Audit Service)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

export interface PrintAuditRecord {
  id: string;
  whoPrinted: string;
  when: string;
  printerName: string;
  templateName: string;
  clientIp: string;
  machineId: string;
  itemCount: number;
  totalLabels: number;
  durationSec: number;
  status: "SUCCESS" | "FAILED" | "CANCELLED";
}

const AUDIT_STORAGE_KEY = "smriti_print_audit_ledger_v1";

export const getPrintAuditLedger = (): PrintAuditRecord[] => {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const logPrintAuditRecord = (record: Omit<PrintAuditRecord, "id" | "when">): PrintAuditRecord => {
  const ledger = getPrintAuditLedger();
  const newRecord: PrintAuditRecord = {
    ...record,
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    when: new Date().toISOString()
  };

  ledger.unshift(newRecord);
  // Cap ledger to last 500 audit entries
  const trimmed = ledger.slice(0, 500);
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("Failed to save print audit record:", e);
  }

  return newRecord;
};
