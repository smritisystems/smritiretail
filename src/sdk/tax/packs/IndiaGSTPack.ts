/**
 * Project      : SMRITI Retail OS
 * Component    : IndiaGSTPack (Statutory Indian GST Tax Pack Implementation)
 * Standard     : TG-001 — TG-006 (SMRITI Tax Governance Constitution)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ITaxPack, ValidationResult } from "../interfaces/ITaxPack";
import { TaxContext } from "../models/TaxContext";
import { TaxResult, TaxItemBreakdown } from "../models/TaxResult";
import { DocumentTaxSnapshot } from "../models/DocumentTaxSnapshot";
import { ResolutionTrace } from "../utils/ResolutionTrace";

// Default HSN Master Registry with statutory default GST rates
const HSN_MASTER_REGISTRY: Record<string, { rate: number; isExempt?: boolean; description: string }> = {
  "6404": { rate: 18, description: "Footwear with outer soles of rubber/plastics" },
  "6402": { rate: 18, description: "Other footwear with outer soles" },
  "6403": { rate: 18, description: "Footwear with outer soles of leather" },
  "6109": { rate: 12, description: "T-shirts, singlets and other vests, knitted/crocheted" },
  "6203": { rate: 12, description: "Men's suits, ensembles, jackets, trousers" },
  "6204": { rate: 12, description: "Women's suits, ensembles, dresses" },
  "0401": { rate: 0, isExempt: true, description: "Fresh Milk / Unpackaged Dairy" },
  "1006": { rate: 5, description: "Rice in branded container" },
  "8471": { rate: 18, description: "Automatic data processing machines / POS Printers" },
  "8517": { rate: 18, description: "Telephone sets / Mobile POS terminals" },
  "9983": { rate: 18, description: "Other professional, technical and business services (SAC)" },
};

export class IndiaGSTPack implements ITaxPack {
  readonly id = "IndiaGSTPack";
  readonly name = "India Goods & Services Tax (GST) Pack";
  readonly countryCode = "IN";
  readonly taxPackVersion = "2026.07";

  /**
   * TG-006: No Silent Fallbacks — Validates input context before tax resolution
   */
  validate(context: TaxContext): ValidationResult {
    const errors: Array<{ code: string; field: string; message: string; actionableLink?: string }> = [];

    if (!context.companyState) {
      errors.push({
        code: "MISSING_COMPANY_STATE",
        field: "companyState",
        message: "Company State Code is missing in Company Tax Policy.",
        actionableLink: "company-setup",
      });
    }

    if (!context.customerState) {
      errors.push({
        code: "MISSING_CUSTOMER_STATE",
        field: "customerState",
        message: "Customer State Code / Place of Supply is missing.",
        actionableLink: "customers",
      });
    }

    context.items.forEach((item, index) => {
      if (!item.hsnCode && !item.isExempt) {
        errors.push({
          code: "MISSING_HSN_CODE",
          field: `items[${index}].hsnCode`,
          message: `Item "${item.itemName}" (${item.itemCode}) has no HSN/SAC Code assigned.`,
          actionableLink: "item-master",
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Determines supply type (INTRASTATE vs INTERSTATE vs EXPORT vs SEZ)
   */
  private getSupplyType(context: TaxContext): "INTRASTATE" | "INTERSTATE" | "EXPORT" | "SEZ" | "EXEMPT" {
    if (context.isExport) return "EXPORT";
    if (context.isSEZ) return "SEZ";

    // Compare Company State vs Place of Supply State
    const compState = context.companyState.toLowerCase().trim();
    const posState = (context.placeOfSupply || context.customerState).toLowerCase().trim();

    return compState === posState ? "INTRASTATE" : "INTERSTATE";
  }

  /**
   * TG-001 / TG-002: Statutory Tax Resolution
   */
  resolve(context: TaxContext): TaxResult {
    const validation = this.validate(context);
    const supplyType = this.getSupplyType(context);
    const itemBreakdown: TaxItemBreakdown[] = [];

    let totalTaxableAmount = 0;
    let totalCgstAmount = 0;
    let totalSgstAmount = 0;
    let totalIgstAmount = 0;
    let totalTaxAmount = 0;
    let grandTotalAmount = 0;

    context.items.forEach((item) => {
      const hsn = item.hsnCode || "6404";
      const hsnRecord = HSN_MASTER_REGISTRY[hsn] || { rate: 18, description: "General Retail Goods" };
      const isExempt = item.isExempt || hsnRecord.isExempt || false;
      const gstRate = isExempt ? 0 : hsnRecord.rate;

      const qty = item.quantity || 1;
      const price = item.unitPrice || 0;
      const grossLine = qty * price;

      let taxableAmount = grossLine;
      let lineTotalAmount = grossLine;

      // Pricing Policy Decoupling: Handle Inclusive vs Exclusive calculation
      if (context.pricingPolicy === "INCLUSIVE" && gstRate > 0) {
        taxableAmount = Number((grossLine / (1 + gstRate / 100)).toFixed(2));
      }

      let cgstRate = 0;
      let cgstAmount = 0;
      let sgstRate = 0;
      let sgstAmount = 0;
      let igstRate = 0;
      let igstAmount = 0;

      if (!isExempt && supplyType === "INTRASTATE") {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmount = Number(((taxableAmount * cgstRate) / 100).toFixed(2));
        sgstAmount = Number(((taxableAmount * sgstRate) / 100).toFixed(2));
      } else if (!isExempt && supplyType === "INTERSTATE") {
        igstRate = gstRate;
        igstAmount = Number(((taxableAmount * igstRate) / 100).toFixed(2));
      }

      const lineTax = cgstAmount + sgstAmount + igstAmount;
      if (context.pricingPolicy === "EXCLUSIVE") {
        lineTotalAmount = taxableAmount + lineTax;
      }

      totalTaxableAmount += taxableAmount;
      totalCgstAmount += cgstAmount;
      totalSgstAmount += sgstAmount;
      totalIgstAmount += igstAmount;
      totalTaxAmount += lineTax;
      grandTotalAmount += lineTotalAmount;

      itemBreakdown.push({
        itemId: item.itemId,
        itemCode: item.itemCode,
        hsnCode: hsn,
        taxableAmount,
        gstRate,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        totalTaxAmount: lineTax,
        lineTotalAmount,
        taxCategory: item.taxCategory || "STANDARD",
        isExempt,
        resolutionRule: `Statutory HSN ${hsn} (${gstRate}%) - ${supplyType}`,
      });
    });

    const result: TaxResult = {
      isResolved: validation.isValid,
      supplyType,
      taxProfileApplied: context.customerGroupTaxProfile || "Retail Registered",
      ruleVersion: `${this.id} v${this.taxPackVersion}`,
      totalTaxableAmount: Number(totalTaxableAmount.toFixed(2)),
      totalCgstAmount: Number(totalCgstAmount.toFixed(2)),
      totalSgstAmount: Number(totalSgstAmount.toFixed(2)),
      totalIgstAmount: Number(totalIgstAmount.toFixed(2)),
      totalTaxAmount: Number(totalTaxAmount.toFixed(2)),
      grandTotalAmount: Number(grandTotalAmount.toFixed(2)),
      itemBreakdown,
      resolutionTrace: {},
      warnings: validation.errors.map((e) => e.message),
    };

    result.resolutionTrace = ResolutionTrace.generate(context, result, this.id, this.taxPackVersion);
    return result;
  }

  calculate(context: TaxContext): TaxResult {
    return this.resolve(context);
  }

  explain(context: TaxContext): Record<string, unknown> {
    const res = this.resolve(context);
    return res.resolutionTrace;
  }

  preview(context: TaxContext): TaxResult {
    return this.resolve(context);
  }

  /**
   * TG-003: Creates immutable, versioned DocumentTaxSnapshot
   */
  createSnapshot(documentId: string, context: TaxContext, result: TaxResult): DocumentTaxSnapshot {
    return {
      snapshotId: `txsnap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      documentId,
      engineVersion: "STRE 1.0",
      taxPack: this.id,
      taxPackVersion: this.taxPackVersion,
      ruleVersion: "TG-001-TG-006",
      resolvedAt: new Date().toISOString(),
      supplyType: result.supplyType,
      companyState: context.companyState,
      customerState: context.customerState,
      customerGstin: context.customerGstin,
      taxResult: result,
      resolutionTrace: result.resolutionTrace,
    };
  }
}
