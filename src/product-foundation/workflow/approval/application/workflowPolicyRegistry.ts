import { SlaPolicy } from '../domain/workflow';
import { DocumentType } from '../../../document/domain/documentLifecycle';

export interface WorkflowPolicyDefinition {
  policyName: string;
  documentType?: DocumentType;
  workflowTemplate?: string;
  approvalSteps?: string[];
  slaPolicy?: SlaPolicy;
  escalationRules?: Array<{ stepId: string; role: string; afterHours: number }>;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export class WorkflowPolicyRegistryService {
  private readonly policies = new Map<string, WorkflowPolicyDefinition>();

  public registerPolicy(policy: WorkflowPolicyDefinition): void {
    const key = policy.policyName.toLowerCase();
    if (this.policies.has(key)) {
      throw new Error(`Workflow policy '${policy.policyName}' is already registered.`);
    }
    this.policies.set(key, { ...policy });
  }

  public getPolicy(policyName: string): WorkflowPolicyDefinition {
    const policy = this.policies.get(policyName.toLowerCase());
    if (!policy) {
      throw new Error(`Workflow policy '${policyName}' is not registered.`);
    }
    return policy;
  }

  public listPolicies(): WorkflowPolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  public clear(): void {
    this.policies.clear();
  }
}

export const WorkflowPolicyRegistry = new WorkflowPolicyRegistryService();

WorkflowPolicyRegistry.registerPolicy({
  policyName: 'SalesInvoiceApprovalPolicy',
  documentType: 'SalesInvoice',
  workflowTemplate: 'SalesInvoiceApproval',
  approvalSteps: ['Draft', 'Submit', 'Approve'],
  slaPolicy: { id: 'sla-1', name: '24h Sales Approval', durationHours: 24, escalationRole: 'manager' },
  escalationRules: [{ stepId: 'approval-1', role: 'manager', afterHours: 24 }],
  enabled: true,
  metadata: { description: 'Approval workflow policy for sales invoices.' },
});

WorkflowPolicyRegistry.registerPolicy({
  policyName: 'PurchaseInvoiceApprovalPolicy',
  documentType: 'PurchaseInvoice',
  workflowTemplate: 'PurchaseInvoiceApproval',
  approvalSteps: ['Draft', 'Submit', 'Approve'],
  slaPolicy: { id: 'sla-2', name: '24h Purchase Approval', durationHours: 24, escalationRole: 'purchasing_manager' },
  escalationRules: [{ stepId: 'approval-1', role: 'purchasing_manager', afterHours: 24 }],
  enabled: true,
  metadata: { description: 'Approval workflow policy for purchase invoices.' },
});

WorkflowPolicyRegistry.registerPolicy({
  policyName: 'SalesReturnApprovalPolicy',
  documentType: 'SalesReturn',
  workflowTemplate: 'SalesReturnApproval',
  approvalSteps: ['Draft', 'Submit', 'Approve'],
  slaPolicy: { id: 'sla-3', name: '24h Sales Return Approval', durationHours: 24, escalationRole: 'returns_manager' },
  escalationRules: [{ stepId: 'approval-1', role: 'returns_manager', afterHours: 24 }],
  enabled: true,
  metadata: { description: 'Approval workflow policy for sales returns.' },
});

WorkflowPolicyRegistry.registerPolicy({
  policyName: 'PurchaseReturnApprovalPolicy',
  documentType: 'PurchaseReturn',
  workflowTemplate: 'PurchaseReturnApproval',
  approvalSteps: ['Draft', 'Submit', 'Approve'],
  slaPolicy: { id: 'sla-4', name: '24h Purchase Return Approval', durationHours: 24, escalationRole: 'returns_manager' },
  escalationRules: [{ stepId: 'approval-1', role: 'returns_manager', afterHours: 24 }],
  enabled: true,
  metadata: { description: 'Approval workflow policy for purchase returns.' },
});

WorkflowPolicyRegistry.registerPolicy({
  policyName: 'StockTransferApprovalPolicy',
  documentType: 'StockTransfer',
  workflowTemplate: 'StockTransferApproval',
  approvalSteps: ['Draft', 'Submit', 'Approve'],
  slaPolicy: { id: 'sla-5', name: '24h Stock Transfer Approval', durationHours: 24, escalationRole: 'inventory_manager' },
  escalationRules: [{ stepId: 'approval-1', role: 'inventory_manager', afterHours: 24 }],
  enabled: true,
  metadata: { description: 'Approval workflow policy for stock transfers.' },
});

WorkflowPolicyRegistry.registerPolicy({
  policyName: 'PhysicalStockApprovalPolicy',
  documentType: 'PhysicalStock',
  workflowTemplate: 'PhysicalStockApproval',
  approvalSteps: ['Draft', 'Submit', 'Approve'],
  slaPolicy: { id: 'sla-6', name: '24h Physical Stock Approval', durationHours: 24, escalationRole: 'inventory_manager' },
  escalationRules: [{ stepId: 'approval-1', role: 'inventory_manager', afterHours: 24 }],
  enabled: true,
  metadata: { description: 'Approval workflow policy for physical stock adjustments.' },
});
