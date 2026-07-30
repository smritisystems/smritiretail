/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : DecisionTableEngine (Universal Decision Table Engine v2.1)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.1.0
 */

export interface DecisionRule {
  id: string;
  minAmount: number;
  maxAmount: number;
  supplierType: "All" | "New" | "Verified";
  riskLevel: "Low" | "Medium" | "High";
  approvalPath: string[];
}

export const DECISION_RULES: DecisionRule[] = [
  {
    id: "RULE-01",
    minAmount: 0,
    maxAmount: 50000,
    supplierType: "All",
    riskLevel: "Low",
    approvalPath: ["StoreManager"]
  },
  {
    id: "RULE-02",
    minAmount: 50001,
    maxAmount: 500000,
    supplierType: "Verified",
    riskLevel: "Medium",
    approvalPath: ["PurchaseManager", "FinanceManager"]
  },
  {
    id: "RULE-03",
    minAmount: 500001,
    maxAmount: 10000000,
    supplierType: "All",
    riskLevel: "High",
    approvalPath: ["FinanceDirector", "CEO"]
  }
];

export class DecisionTableEngine {
  public static evaluate(amount: number, supplierType: "All" | "New" | "Verified" = "Verified", riskLevel: "Low" | "Medium" | "High" = "Medium"): string[] {
    const matched = DECISION_RULES.find(
      (r) => amount >= r.minAmount && amount <= r.maxAmount
    );
    return matched ? matched.approvalPath : ["CEO"];
  }
}
