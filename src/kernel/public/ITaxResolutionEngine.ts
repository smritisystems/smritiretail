/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : ITaxResolutionEngine Public Interface Contract
 * Standard     : SMRITI Tax Governance Constitution (TG-001 — TG-006)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface TaxResolutionRequest {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  hsnCode: string;
  gstRateOverride?: number;
  unitPrice: number;
  qty: number;
  discountPct?: number;
  discountAmount?: number;
  isTaxInclusive?: boolean;
  companyState: string;
  placeOfSupply: string;
  documentDate: string; // ISO YYYY-MM-DD
  transactionType: "B2C" | "B2B" | "INTER_STATE" | "EXPORT" | "SEZ";
}

export interface TaxLineBreakdown {
  hsnCode: string;
  taxableValue: number;
  gstPercentage: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  isInterstate: boolean;
}

export interface DocumentTaxSnapshot {
  snapshotId: string;
  ruleVersion: string;
  resolvedAt: string;
  companyState: string;
  placeOfSupply: string;
  isInterstate: boolean;
  supplyType: "INTRASTATE" | "INTERSTATE";
  totalTaxableValue: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalIgstAmount: number;
  totalTaxAmount: number;
  lines: TaxLineBreakdown[];
}

export interface ITaxResolutionEngine {
  /**
   * Resolve tax for a single line item
   */
  resolveLineTax(request: TaxResolutionRequest): TaxLineBreakdown;

  /**
   * Generate an immutable DocumentTaxSnapshot for an entire bill / invoice
   */
  createDocumentTaxSnapshot(
    companyState: string,
    placeOfSupply: string,
    documentDate: string,
    lineRequests: TaxResolutionRequest[]
  ): DocumentTaxSnapshot;
}
