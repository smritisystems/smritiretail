/**
 * Project      : SMRITI Retail OS
 * Component    : TaxResult & TaxItemBreakdown Models
 * Standard     : TG-001 — TG-006 (SMRITI Tax Governance Constitution)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface TaxItemBreakdown {
  itemId: string;
  itemCode: string;
  hsnCode: string;
  taxableAmount: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTaxAmount: number;
  lineTotalAmount: number;
  taxCategory: string;
  isExempt: boolean;
  resolutionRule: string;
}

export interface TaxResult {
  isResolved: boolean;
  supplyType: "INTRASTATE" | "INTERSTATE" | "EXPORT" | "SEZ" | "EXEMPT";
  taxProfileApplied: string;
  ruleVersion: string;
  totalTaxableAmount: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalIgstAmount: number;
  totalTaxAmount: number;
  grandTotalAmount: number;
  itemBreakdown: TaxItemBreakdown[];
  resolutionTrace: Record<string, unknown>;
  warnings: string[];
}
