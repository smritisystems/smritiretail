/**
 * Project      : SMRITI Retail OS
 * Module       : PolicyRegistry (SCS-WSC-001 Standard)
 * Description  : Operational policies registry for governing business rules (e.g.
 *                negativeStockPolicy, maxDiscountPercent, priceOverrideAllowed,
 *                requireManagerApproval, cashDrawerPulse).
 * Standard     : SCS-WSC-001 — SMRITI Workspace Context & Resolver
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export interface WorkspaceOperationalPolicies {
  negativeStockPolicy: "block" | "warn" | "allow";
  maxDiscountPercent: number;
  priceOverrideAllowed: boolean;
  requireManagerApprovalOnReturn: boolean;
  allowCreditSales: boolean;
  autoPrintReceipt: boolean;
  cashDrawerPulseOnCheckout: boolean;
  receiptHeaderFooterText?: string;
}

const DEFAULT_POLICIES: WorkspaceOperationalPolicies = {
  negativeStockPolicy: "block",
  maxDiscountPercent: 20,
  priceOverrideAllowed: false,
  requireManagerApprovalOnReturn: true,
  allowCreditSales: true,
  autoPrintReceipt: true,
  cashDrawerPulseOnCheckout: true,
};

class PolicyRegistryService {
  private policies: WorkspaceOperationalPolicies = { ...DEFAULT_POLICIES };

  public get<K extends keyof WorkspaceOperationalPolicies>(policyKey: K): WorkspaceOperationalPolicies[K] {
    return this.policies[policyKey];
  }

  public getAll(): WorkspaceOperationalPolicies {
    return { ...this.policies };
  }

  public setPolicies(newPolicies: Partial<WorkspaceOperationalPolicies>): void {
    this.policies = { ...this.policies, ...newPolicies };
  }

  public resetToDefaults(): void {
    this.policies = { ...DEFAULT_POLICIES };
  }
}

export const PolicyRegistry = new PolicyRegistryService();
