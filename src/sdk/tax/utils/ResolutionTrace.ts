/**
 * Project      : SMRITI Retail OS
 * Component    : ResolutionTrace Utility (Explainable AI/Rule Resolution Trace Generator)
 * Standard     : TG-001 — TG-006 (SMRITI Tax Governance Constitution)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { TaxContext } from "../models/TaxContext";
import { TaxResult } from "../models/TaxResult";

export class ResolutionTrace {
  static generate(context: TaxContext, result: TaxResult, packName: string, packVersion: string): Record<string, unknown> {
    return {
      engineVersion: "STRE 1.0",
      taxPack: packName,
      taxPackVersion: packVersion,
      ruleVersion: "TG-001-TG-006",
      resolvedAt: new Date().toISOString(),
      inputs: {
        companyState: context.companyState,
        customerState: context.customerState,
        customerGstin: context.customerGstin,
        customerGroupTaxProfile: context.customerGroupTaxProfile,
        documentDate: context.documentDate,
        placeOfSupply: context.placeOfSupply,
        pricingPolicy: context.pricingPolicy,
        itemCount: context.items.length,
      },
      decisionTree: [
        {
          step: 1,
          name: "Legal / Statutory Rules Check",
          status: context.isExport ? "EXPORT_ZERO_RATED" : context.isSEZ ? "SEZ_ZERO_RATED" : "STANDARD_STATUTORY",
        },
        {
          step: 2,
          name: "Place of Supply Matching",
          supplyType: result.supplyType,
          matchedRule: result.supplyType === "INTRASTATE" ? "CGST (50%) + SGST (50%)" : "IGST (100%)",
        },
        {
          step: 3,
          name: "Customer Tax Profile Matching",
          appliedProfile: context.customerGroupTaxProfile,
        },
        {
          step: 4,
          name: "HSN / SAC Master Statutory Rate Matching",
          itemsEvaluated: context.items.map((i) => ({
            itemId: i.itemId,
            hsnCode: i.hsnCode || "UNASSIGNED",
          })),
        },
      ],
      output: {
        totalTaxableAmount: result.totalTaxableAmount,
        totalTaxAmount: result.totalTaxAmount,
        grandTotalAmount: result.grandTotalAmount,
        itemBreakdownCount: result.itemBreakdown.length,
      },
    };
  }
}
