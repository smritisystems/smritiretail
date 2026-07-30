/**
 * Project      : SMRITI Retail OS
 * Component    : TaxResolutionEngine (Central STRE Orchestrator)
 * Standard     : TG-001 — TG-006 (SMRITI Tax Governance Constitution)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ITaxPack, ValidationResult } from "./interfaces/ITaxPack";
import { IndiaGSTPack } from "./packs/IndiaGSTPack";
import { TaxContext } from "./models/TaxContext";
import { TaxResult } from "./models/TaxResult";
import { DocumentTaxSnapshot } from "./models/DocumentTaxSnapshot";

export class TaxResolutionEngine {
  private static instance: TaxResolutionEngine;
  private activeTaxPack: ITaxPack;
  private cache: Map<string, unknown> = new Map();

  private constructor() {
    // Default to Indian Statutory GST Tax Pack
    this.activeTaxPack = new IndiaGSTPack();
  }

  public static getInstance(): TaxResolutionEngine {
    if (!TaxResolutionEngine.instance) {
      TaxResolutionEngine.instance = new TaxResolutionEngine();
    }
    return TaxResolutionEngine.instance;
  }

  /**
   * Sets active tax pack (e.g. IndiaGSTPack, UAEVATPack)
   */
  public setTaxPack(pack: ITaxPack): void {
    this.activeTaxPack = pack;
    this.cache.clear();
  }

  public getActiveTaxPack(): ITaxPack {
    return this.activeTaxPack;
  }

  /**
   * TG-006: Validates input context before tax calculation
   */
  public validate(context: TaxContext): ValidationResult {
    return this.activeTaxPack.validate(context);
  }

  /**
   * TG-001 / TG-002: Centralized statutory tax resolution
   */
  public resolve(context: TaxContext): TaxResult {
    return this.activeTaxPack.resolve(context);
  }

  /**
   * Calculates net tax amounts, line totals, and grand total
   */
  public calculate(context: TaxContext): TaxResult {
    return this.activeTaxPack.calculate(context);
  }

  /**
   * Returns rich diagnostic resolution trace
   */
  public explain(context: TaxContext): Record<string, unknown> {
    return this.activeTaxPack.explain(context);
  }

  /**
   * Non-side-effect preview for POS billing, quotations, and live UI calculations
   */
  public preview(context: TaxContext): TaxResult {
    return this.activeTaxPack.preview(context);
  }

  /**
   * TG-003: Creates versioned, immutable DocumentTaxSnapshot for posted invoices
   */
  public createDocumentTaxSnapshot(documentId: string, context: TaxContext, result: TaxResult): DocumentTaxSnapshot {
    return this.activeTaxPack.createSnapshot(documentId, context, result);
  }
}

// Export singleton STRE alias for platform-wide usage
export const STRE = TaxResolutionEngine.getInstance();
