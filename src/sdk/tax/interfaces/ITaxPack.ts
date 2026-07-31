/**
 * Project      : SMRITI Retail OS
 * Component    : ITaxPack Interface (STRE Tax Pack Protocol)
 * Standard     : TG-001 — TG-006 (SMRITI Tax Governance Constitution)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { TaxContext } from "../models/TaxContext";
import { TaxResult } from "../models/TaxResult";
import { DocumentTaxSnapshot } from "../models/DocumentTaxSnapshot";

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    code: string;
    field: string;
    message: string;
    actionableLink?: string;
  }>;
}

export interface ITaxPack {
  /**
   * Unique country/tax regime identifier (e.g. 'IndiaGSTPack', 'UAEVATPack')
   */
  readonly id: string;
  readonly name: string;
  readonly countryCode: string;
  readonly taxPackVersion: string;

  /**
   * Validates master data sufficiency before tax resolution (TG-006: No Silent Fallbacks)
   */
  validate(context: TaxContext): ValidationResult;

  /**
   * Resolves statutory tax rates and breakdown for a given transaction context
   */
  resolve(context: TaxContext): TaxResult;

  /**
   * Calculates net tax amounts, taxable values, and gross totals
   */
  calculate(context: TaxContext): TaxResult;

  /**
   * Explains rule decision tree and returns rich diagnostic resolution trace
   */
  explain(context: TaxContext): Record<string, unknown>;

  /**
   * Non-side-effect preview for POS billing, quotations, and print previews
   */
  preview(context: TaxContext): TaxResult;

  /**
   * Creates an immutable, versioned DocumentTaxSnapshot for posted transactions (TG-003)
   */
  createSnapshot(documentId: string, context: TaxContext, result: TaxResult): DocumentTaxSnapshot;
}
