import { DocumentChannel, DocumentType, DocumentStatus } from '../domain/documentLifecycle';

export interface DocumentPolicyDefinition {
  policyName: string;
  documentType?: DocumentType;
  defaultChannels?: DocumentChannel[];
  numberingSeriesId?: string;
  workflowTemplate?: string;
  approvalPolicyId?: string;
  printTemplateId?: string;
  notificationPolicyId?: string;
  autoPublish?: boolean;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export class DocumentPolicyRegistryService {
  private readonly policies = new Map<string, DocumentPolicyDefinition>();

  public registerPolicy(policy: DocumentPolicyDefinition): void {
    const key = policy.policyName.toLowerCase();
    if (this.policies.has(key)) {
      throw new Error(`Document policy '${policy.policyName}' is already registered.`);
    }
    this.policies.set(key, { ...policy });
  }

  public getPolicy(policyName: string): DocumentPolicyDefinition {
    const policy = this.policies.get(policyName.toLowerCase());
    if (!policy) {
      throw new Error(`Document policy '${policyName}' is not registered.`);
    }
    return policy;
  }

  public listPolicies(): DocumentPolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  public clear(): void {
    this.policies.clear();
  }
}

export const DocumentPolicyRegistry = new DocumentPolicyRegistryService();

DocumentPolicyRegistry.registerPolicy({
  policyName: 'DefaultSalesInvoiceDocument',
  documentType: 'SalesInvoice',
  defaultChannels: ['Print', 'Email'],
  numberingSeriesId: 'SER-001',
  workflowTemplate: 'SalesInvoiceApproval',
  approvalPolicyId: 'policy.sales.invoice_approval',
  printTemplateId: 'print.sales.invoice.a4',
  notificationPolicyId: 'notification.sales.invoice.submitted',
  autoPublish: true,
  enabled: true,
  metadata: { description: 'Default document pipeline policy for sales invoices.' },
});

DocumentPolicyRegistry.registerPolicy({
  policyName: 'DefaultPurchaseInvoiceDocument',
  documentType: 'PurchaseInvoice',
  defaultChannels: ['Print', 'Email'],
  numberingSeriesId: 'PUR-001',
  workflowTemplate: 'PurchaseInvoiceApproval',
  approvalPolicyId: 'policy.purchase.invoice_approval',
  printTemplateId: 'print.purchase.invoice.a4',
  notificationPolicyId: 'notification.purchase.invoice.submitted',
  autoPublish: true,
  enabled: true,
  metadata: { description: 'Default document pipeline policy for purchase invoices.' },
});

DocumentPolicyRegistry.registerPolicy({
  policyName: 'DefaultSalesReturnDocument',
  documentType: 'SalesReturn',
  defaultChannels: ['Print', 'Email'],
  numberingSeriesId: 'SRET-001',
  workflowTemplate: 'SalesReturnApproval',
  approvalPolicyId: 'policy.sales.return_approval',
  printTemplateId: 'print.sales.return.a4',
  notificationPolicyId: 'notification.sales.return.submitted',
  autoPublish: true,
  enabled: true,
  metadata: { description: 'Default document policy for sales returns.' },
});

DocumentPolicyRegistry.registerPolicy({
  policyName: 'DefaultPurchaseReturnDocument',
  documentType: 'PurchaseReturn',
  defaultChannels: ['Print', 'Email'],
  numberingSeriesId: 'PRET-001',
  workflowTemplate: 'PurchaseReturnApproval',
  approvalPolicyId: 'policy.purchase.return_approval',
  printTemplateId: 'print.purchase.return.a4',
  notificationPolicyId: 'notification.purchase.return.submitted',
  autoPublish: true,
  enabled: true,
  metadata: { description: 'Default document policy for purchase returns.' },
});

DocumentPolicyRegistry.registerPolicy({
  policyName: 'DefaultStockTransferDocument',
  documentType: 'StockTransfer',
  defaultChannels: ['Print'],
  numberingSeriesId: 'STF-001',
  workflowTemplate: 'StockTransferApproval',
  approvalPolicyId: 'policy.stock.transfer_approval',
  printTemplateId: 'print.stock.transfer.a4',
  notificationPolicyId: 'notification.stock.transfer.submitted',
  autoPublish: false,
  enabled: true,
  metadata: { description: 'Default document policy for stock transfers.' },
});

DocumentPolicyRegistry.registerPolicy({
  policyName: 'DefaultPhysicalStockDocument',
  documentType: 'PhysicalStock',
  defaultChannels: ['Print'],
  numberingSeriesId: 'PHYS-001',
  workflowTemplate: 'PhysicalStockApproval',
  approvalPolicyId: 'policy.physical.stock_approval',
  printTemplateId: 'print.physical.stock.a4',
  notificationPolicyId: 'notification.physical.stock.submitted',
  autoPublish: false,
  enabled: true,
  metadata: { description: 'Default document policy for physical stock adjustments.' },
});
