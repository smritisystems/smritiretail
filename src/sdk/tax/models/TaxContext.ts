/**
 * Project      : SMRITI Retail OS
 * Component    : TaxContext Model (Immutable Input Context)
 * Standard     : TG-001 — TG-006 (SMRITI Tax Governance Constitution)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface TaxItemInput {
  itemId: string;
  itemCode: string;
  itemName: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  taxProfileOverrideId?: string;
  taxCategory?: string;
  isExempt?: boolean;
  reverseCharge?: boolean;
}

export interface TaxContext {
  companyState: string;
  companyGstin?: string;
  customerState: string;
  customerGstin?: string;
  customerGroupTaxProfile: string; // e.g., 'Retail Registered', 'Wholesale', 'Export', 'SEZ', 'Composition'
  customerTaxProfileOverrideId?: string;
  documentDate: string; // ISO format 'YYYY-MM-DD' for TG-005 Effective-dated tax rules
  placeOfSupply: string; // State code or Country
  pricingPolicy: "INCLUSIVE" | "EXCLUSIVE";
  currency: string;
  items: TaxItemInput[];
  isExport?: boolean;
  isSEZ?: boolean;
}
