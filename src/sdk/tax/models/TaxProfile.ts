/**
 * Project      : SMRITI Retail OS
 * Component    : TaxProfile Master Model
 * Standard     : TG-001 — TG-006 (SMRITI Tax Governance Constitution)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface TaxProfile {
  id: string;
  code: string;
  name: string;
  description: string;
  isRegistered: boolean;
  isExport: boolean;
  isSEZ: boolean;
  isComposition: boolean;
  isGovernment: boolean;
  isExempt: boolean;
  isZeroRated: boolean;
  allowOverride: boolean;
  status: "ACTIVE" | "INACTIVE";
}
