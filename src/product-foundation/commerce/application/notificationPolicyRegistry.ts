import { BusinessTransactionType } from '../contracts/businessTransaction';
import { DocumentChannel } from '../../document/domain/documentLifecycle';

export interface NotificationPolicyDefinition {
  policyName: string;
  transactionType?: BusinessTransactionType;
  documentType?: string;
  eventTypes: string[];
  channels: DocumentChannel[];
  recipients?: string[];
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export class NotificationPolicyRegistryService {
  private readonly policies = new Map<string, NotificationPolicyDefinition>();

  public registerPolicy(policy: NotificationPolicyDefinition): void {
    const key = policy.policyName.toLowerCase();
    if (this.policies.has(key)) {
      throw new Error(`Notification policy '${policy.policyName}' is already registered.`);
    }
    this.policies.set(key, { ...policy });
  }

  public getPolicy(policyName: string): NotificationPolicyDefinition {
    const policy = this.policies.get(policyName.toLowerCase());
    if (!policy) {
      throw new Error(`Notification policy '${policyName}' is not registered.`);
    }
    return policy;
  }

  public listPolicies(): NotificationPolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  public clear(): void {
    this.policies.clear();
  }
}

export const NotificationPolicyRegistry = new NotificationPolicyRegistryService();

NotificationPolicyRegistry.registerPolicy({
  policyName: 'SalesInvoiceNotificationPolicy',
  transactionType: 'Sales',
  eventTypes: ['DocumentStageCompleted.v1', 'FinalizeStageCompleted.v1'],
  channels: ['Email', 'WhatsApp'],
  recipients: ['billing@company.com'],
  enabled: true,
  metadata: { description: 'Send notifications when sales invoice document and transaction finalize.' },
});

NotificationPolicyRegistry.registerPolicy({
  policyName: 'PurchaseInvoiceNotificationPolicy',
  transactionType: 'Purchase',
  eventTypes: ['DocumentStageCompleted.v1', 'FinalizeStageCompleted.v1'],
  channels: ['Email'],
  recipients: ['accounts@company.com'],
  enabled: true,
  metadata: { description: 'Send notifications when purchase invoice document and transaction finalize.' },
});

NotificationPolicyRegistry.registerPolicy({
  policyName: 'SalesReturnNotificationPolicy',
  transactionType: 'SalesReturn',
  eventTypes: ['FinalizeStageCompleted.v1'],
  channels: ['Email'],
  recipients: ['returns@company.com'],
  enabled: true,
  metadata: { description: 'Send notifications when sales return completes.' },
});

NotificationPolicyRegistry.registerPolicy({
  policyName: 'PurchaseReturnNotificationPolicy',
  transactionType: 'PurchaseReturn',
  eventTypes: ['FinalizeStageCompleted.v1'],
  channels: ['Email'],
  recipients: ['purchasing@company.com'],
  enabled: true,
  metadata: { description: 'Send notifications when purchase return completes.' },
});

NotificationPolicyRegistry.registerPolicy({
  policyName: 'StockTransferNotificationPolicy',
  transactionType: 'Purchase',
  documentType: 'StockTransfer',
  eventTypes: ['FinalizeStageCompleted.v1'],
  channels: ['Email'],
  recipients: ['inventory@company.com'],
  enabled: true,
  metadata: { description: 'Send notifications when stock transfer completes.' },
});

NotificationPolicyRegistry.registerPolicy({
  policyName: 'PhysicalStockNotificationPolicy',
  transactionType: 'Purchase',
  documentType: 'PhysicalStock',
  eventTypes: ['FinalizeStageCompleted.v1'],
  channels: ['Email'],
  recipients: ['inventory@company.com'],
  enabled: true,
  metadata: { description: 'Send notifications when physical stock adjustment completes.' },
});
