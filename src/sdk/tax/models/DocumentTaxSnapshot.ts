/**
 * Project      : SMRITI Retail OS
 * Component    : DocumentTaxSnapshot Model (TG-003 Immutable Document Tax Snapshot)
 * Standard     : TG-001 — TG-006 (SMRITI Tax Governance Constitution)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { TaxResult } from "./TaxResult";

export interface DocumentTaxSnapshot {
  snapshotId: string;
  documentId: string;
  engineVersion: string;
  taxPack: string;
  taxPackVersion: string;
  ruleVersion: string;
  resolvedAt: string; // ISO Timestamp
  supplyType: string;
  companyState: string;
  customerState: string;
  customerGstin?: string;
  taxResult: TaxResult;
  resolutionTrace: Record<string, unknown>;
}
