/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SMRITI Smart Tax Resolution Engine (STRE) Core Implementation
 * Standard     : SMRITI Tax Governance Constitution (TG-001 — TG-006)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import {
  ITaxResolutionEngine,
  TaxResolutionRequest,
  TaxLineBreakdown,
  DocumentTaxSnapshot
} from "../public/ITaxResolutionEngine.js";

export class TaxResolutionEngine implements ITaxResolutionEngine {
  private readonly ENGINE_VERSION = "STRE-v1.0.4";

  public resolveLineTax(req: TaxResolutionRequest): TaxLineBreakdown {
    /* TG-006: No Silent Fallbacks - Assert minimum mandatory parameters */
    if (!req.companyState || !req.companyState.trim()) {
      throw new Error("[TG-006 STRE Error] Company State is required for tax determination.");
    }
    if (!req.placeOfSupply || !req.placeOfSupply.trim()) {
      throw new Error("[TG-006 STRE Error] Place of Supply is required for tax determination.");
    }

    const gstRate = req.gstRateOverride !== undefined ? req.gstRateOverride : 18; // Default standard statutory rate

    const cleanCompanyState = req.companyState.trim().toLowerCase();
    const cleanPos = req.placeOfSupply.trim().toLowerCase();
    const isInterstate = cleanCompanyState !== cleanPos || req.transactionType === "INTER_STATE";

    const grossLineTotal = req.unitPrice * req.qty;
    let discAmount = req.discountAmount || 0;
    if (req.discountPct && req.discountPct > 0) {
      discAmount = (grossLineTotal * req.discountPct) / 100;
    }
    const netLineTotal = Math.max(0, grossLineTotal - discAmount);

    let taxableValue = netLineTotal;
    let totalTaxAmount = 0;

    if (req.isTaxInclusive) {
      // Taxable = NetTotal / (1 + Rate / 100)
      taxableValue = netLineTotal / (1 + gstRate / 100);
      totalTaxAmount = netLineTotal - taxableValue;
    } else {
      taxableValue = netLineTotal;
      totalTaxAmount = (taxableValue * gstRate) / 100;
    }

    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (isInterstate) {
      igstRate = gstRate;
      igstAmount = totalTaxAmount;
    } else {
      cgstRate = gstRate / 2;
      cgstAmount = totalTaxAmount / 2;
      sgstRate = gstRate / 2;
      sgstAmount = totalTaxAmount / 2;
    }

    return {
      hsnCode: req.hsnCode || "8471",
      taxableValue: Math.round(taxableValue * 100) / 100,
      gstPercentage: gstRate,
      cgstRate,
      cgstAmount: Math.round(cgstAmount * 100) / 100,
      sgstRate,
      sgstAmount: Math.round(sgstAmount * 100) / 100,
      igstRate,
      igstAmount: Math.round(igstAmount * 100) / 100,
      totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
      totalAmount: Math.round((taxableValue + totalTaxAmount) * 100) / 100,
      isInterstate
    };
  }

  public createDocumentTaxSnapshot(
    companyState: string,
    placeOfSupply: string,
    documentDate: string,
    lineRequests: TaxResolutionRequest[]
  ): DocumentTaxSnapshot {
    const lines: TaxLineBreakdown[] = lineRequests.map((req) =>
      this.resolveLineTax({
        ...req,
        companyState,
        placeOfSupply,
        documentDate
      })
    );

    let totalTaxableValue = 0;
    let totalCgstAmount = 0;
    let totalSgstAmount = 0;
    let totalIgstAmount = 0;
    let totalTaxAmount = 0;

    lines.forEach((l) => {
      totalTaxableValue += l.taxableValue;
      totalCgstAmount += l.cgstAmount;
      totalSgstAmount += l.sgstAmount;
      totalIgstAmount += l.igstAmount;
      totalTaxAmount += l.totalTaxAmount;
    });

    const isInterstate = companyState.trim().toLowerCase() !== placeOfSupply.trim().toLowerCase();

    return {
      snapshotId: `TXSNAP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ruleVersion: this.ENGINE_VERSION,
      resolvedAt: new Date().toISOString(),
      companyState,
      placeOfSupply,
      isInterstate,
      supplyType: isInterstate ? "INTERSTATE" : "INTRASTATE",
      totalTaxableValue: Math.round(totalTaxableValue * 100) / 100,
      totalCgstAmount: Math.round(totalCgstAmount * 100) / 100,
      totalSgstAmount: Math.round(totalSgstAmount * 100) / 100,
      totalIgstAmount: Math.round(totalIgstAmount * 100) / 100,
      totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
      lines
    };
  }
}
