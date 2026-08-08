export type NumberingMode = 'Auto' | 'Manual' | 'Hybrid';
export type ResetRule = 'Never' | 'Daily' | 'Monthly' | 'Quarterly' | 'Financial Year' | 'Calendar Year' | 'Branch';

export interface NumberingPolicyDefinition {
  policyName: string;
  documentType?: string;
  seriesId: string;
  mode?: NumberingMode;
  resetRule?: ResetRule;
  branchScope?: string;
  enforceGapless?: boolean;
  allowBackdated?: boolean;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export class NumberingPolicyRegistryService {
  private readonly policies = new Map<string, NumberingPolicyDefinition>();

  public registerPolicy(policy: NumberingPolicyDefinition): void {
    const key = policy.policyName.toLowerCase();
    if (this.policies.has(key)) {
      throw new Error(`Numbering policy '${policy.policyName}' is already registered.`);
    }
    this.policies.set(key, { ...policy });
  }

  public getPolicy(policyName: string): NumberingPolicyDefinition {
    const policy = this.policies.get(policyName.toLowerCase());
    if (!policy) {
      throw new Error(`Numbering policy '${policyName}' is not registered.`);
    }
    return policy;
  }

  public listPolicies(): NumberingPolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  public clear(): void {
    this.policies.clear();
  }
}

export const NumberingPolicyRegistry = new NumberingPolicyRegistryService();

NumberingPolicyRegistry.registerPolicy({
  policyName: 'SalesInvoiceNumberingPolicy',
  documentType: 'SalesInvoice',
  seriesId: 'SER-001',
  mode: 'Auto',
  resetRule: 'Financial Year',
  branchScope: 'All',
  enforceGapless: true,
  enabled: true,
  metadata: { description: 'Sales invoice numbering policy with gapless financial year reset.' },
});

NumberingPolicyRegistry.registerPolicy({
  policyName: 'PurchaseInvoiceNumberingPolicy',
  documentType: 'PurchaseInvoice',
  seriesId: 'PUR-001',
  mode: 'Auto',
  resetRule: 'Financial Year',
  branchScope: 'All',
  enforceGapless: true,
  enabled: true,
  metadata: { description: 'Purchase invoice numbering policy with gapless financial year reset.' },
});

NumberingPolicyRegistry.registerPolicy({
  policyName: 'SalesReturnNumberingPolicy',
  documentType: 'SalesReturn',
  seriesId: 'SRET-001',
  mode: 'Auto',
  resetRule: 'Financial Year',
  branchScope: 'All',
  enforceGapless: true,
  enabled: true,
  metadata: { description: 'Sales return numbering policy with financial year reset.' },
});

NumberingPolicyRegistry.registerPolicy({
  policyName: 'PurchaseReturnNumberingPolicy',
  documentType: 'PurchaseReturn',
  seriesId: 'PRET-001',
  mode: 'Auto',
  resetRule: 'Financial Year',
  branchScope: 'All',
  enforceGapless: true,
  enabled: true,
  metadata: { description: 'Purchase return numbering policy with financial year reset.' },
});

NumberingPolicyRegistry.registerPolicy({
  policyName: 'StockTransferNumberingPolicy',
  documentType: 'StockTransfer',
  seriesId: 'STF-001',
  mode: 'Auto',
  resetRule: 'Financial Year',
  branchScope: 'All',
  enforceGapless: false,
  enabled: true,
  metadata: { description: 'Stock transfer numbering policy.' },
});

NumberingPolicyRegistry.registerPolicy({
  policyName: 'PhysicalStockNumberingPolicy',
  documentType: 'PhysicalStock',
  seriesId: 'PHYS-001',
  mode: 'Auto',
  resetRule: 'Financial Year',
  branchScope: 'All',
  enforceGapless: false,
  enabled: true,
  metadata: { description: 'Physical stock document numbering policy.' },
});
