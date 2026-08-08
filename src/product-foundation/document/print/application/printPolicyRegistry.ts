import { DocumentChannel, DocumentStatus, DocumentType } from '../../domain/documentLifecycle';

export interface PrintPolicyDefinition {
  policyName: string;
  documentType?: DocumentType;
  templateName?: string;
  defaultChannels?: DocumentChannel[];
  autoPrint?: boolean;
  printOnStatus?: DocumentStatus[];
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export class PrintPolicyRegistryService {
  private readonly policies = new Map<string, PrintPolicyDefinition>();

  public registerPolicy(policy: PrintPolicyDefinition): void {
    const key = policy.policyName.toLowerCase();
    if (this.policies.has(key)) {
      throw new Error(`Print policy '${policy.policyName}' is already registered.`);
    }
    this.policies.set(key, { ...policy });
  }

  public getPolicy(policyName: string): PrintPolicyDefinition {
    const policy = this.policies.get(policyName.toLowerCase());
    if (!policy) {
      throw new Error(`Print policy '${policyName}' is not registered.`);
    }
    return policy;
  }

  public listPolicies(): PrintPolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  public clear(): void {
    this.policies.clear();
  }
}

export const PrintPolicyRegistry = new PrintPolicyRegistryService();

PrintPolicyRegistry.registerPolicy({
  policyName: 'SalesInvoicePrintPolicy',
  documentType: 'SalesInvoice',
  templateName: 'print.sales.invoice.a4',
  defaultChannels: ['Print'],
  autoPrint: false,
  printOnStatus: ['Approved'],
  enabled: true,
  metadata: { description: 'Default print policy for approved sales invoices.' },
});

PrintPolicyRegistry.registerPolicy({
  policyName: 'PurchaseInvoicePrintPolicy',
  documentType: 'PurchaseInvoice',
  templateName: 'print.purchase.invoice.a4',
  defaultChannels: ['Print'],
  autoPrint: false,
  printOnStatus: ['Approved'],
  enabled: true,
  metadata: { description: 'Default print policy for approved purchase invoices.' },
});

PrintPolicyRegistry.registerPolicy({
  policyName: 'SalesReturnPrintPolicy',
  documentType: 'SalesReturn',
  templateName: 'print.sales.return.a4',
  defaultChannels: ['Print'],
  autoPrint: false,
  printOnStatus: ['Approved'],
  enabled: true,
  metadata: { description: 'Default print policy for sales returns.' },
});

PrintPolicyRegistry.registerPolicy({
  policyName: 'PurchaseReturnPrintPolicy',
  documentType: 'PurchaseReturn',
  templateName: 'print.purchase.return.a4',
  defaultChannels: ['Print'],
  autoPrint: false,
  printOnStatus: ['Approved'],
  enabled: true,
  metadata: { description: 'Default print policy for purchase returns.' },
});

PrintPolicyRegistry.registerPolicy({
  policyName: 'StockTransferPrintPolicy',
  documentType: 'StockTransfer',
  templateName: 'print.stock.transfer.a4',
  defaultChannels: ['Print'],
  autoPrint: false,
  printOnStatus: ['Approved'],
  enabled: true,
  metadata: { description: 'Default print policy for stock transfers.' },
});

PrintPolicyRegistry.registerPolicy({
  policyName: 'PhysicalStockPrintPolicy',
  documentType: 'PhysicalStock',
  templateName: 'print.physical.stock.a4',
  defaultChannels: ['Print'],
  autoPrint: false,
  printOnStatus: ['Approved'],
  enabled: true,
  metadata: { description: 'Default print policy for physical stock.' },
});
