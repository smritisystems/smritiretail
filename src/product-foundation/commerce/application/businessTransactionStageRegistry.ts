import {
  BusinessTransactionContext,
  BusinessTransactionStageName,
  StageErrorPolicy,
  StageRequirement,
  TransactionStagePolicy,
} from '../contracts/businessTransaction';

export interface PipelineStageDefinition {
  name: BusinessTransactionStageName;
  dependencies: BusinessTransactionStageName[];
  provides: Array<keyof BusinessTransactionContext>;
  defaultPolicy: StageErrorPolicy;
  description: string;
}

export interface TransactionPolicy {
  transactionType: string;
  stageRequirements: TransactionStagePolicy;
}

export const PipelineStageRegistry: Record<BusinessTransactionStageName, PipelineStageDefinition> = {
  workflow: {
    name: 'workflow',
    dependencies: [],
    provides: ['workflow'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Approval and transaction workflow orchestration',
  },
  documentNumber: {
    name: 'documentNumber',
    dependencies: ['workflow'],
    provides: ['documentNumber'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Assign a unique document number before document creation',
  },
  pricing: {
    name: 'pricing',
    dependencies: ['workflow'],
    provides: ['invoiceLines', 'netAmount'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Calculate prices, discounts and line totals for the transaction',
  },
  reservation: {
    name: 'reservation',
    dependencies: ['pricing'],
    provides: ['reservedInventory'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Reserve stock for the transaction without committing movement',
  },
  availability: {
    name: 'availability',
    dependencies: ['reservation'],
    provides: [],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Validate inventory availability after reservation',
  },
  movement: {
    name: 'movement',
    dependencies: ['reservation'],
    provides: ['finalInventory'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Move stock once reservation and availability checks are complete',
  },
  costing: {
    name: 'costing',
    dependencies: ['movement'],
    provides: ['inventoryResult'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Calculate inventory costing impact and layer movements',
  },
  tax: {
    name: 'tax',
    dependencies: ['pricing', 'movement'],
    provides: ['taxBreakdown'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Compute tax obligations for the transaction',
  },
  document: {
    name: 'document',
    dependencies: ['posting'],
    provides: ['invoice', 'documentContext', 'documentLifecycleResult'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Create, submit, and approve business documents',
  },
  posting: {
    name: 'posting',
    dependencies: ['tax', 'movement', 'workflow'],
    provides: ['journalEntry'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Create accounting journal entries for the transaction',
  },
  ledger: {
    name: 'ledger',
    dependencies: ['posting'],
    provides: [],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Record outstanding balances to customer or supplier ledger',
  },
  payment: {
    name: 'payment',
    dependencies: ['ledger'],
    provides: ['paymentResult'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Process payment or settlement related to the transaction',
  },
  print: {
    name: 'print',
    dependencies: ['document'],
    provides: [],
    defaultPolicy: StageErrorPolicy.CONTINUE,
    description: 'Print transaction documents, non-blocking for core transaction success',
  },
  finalize: {
    name: 'finalize',
    dependencies: ['ledger', 'document'],
    provides: ['outstanding'],
    defaultPolicy: StageErrorPolicy.STOP,
    description: 'Finalize transaction state and publish completion audit',
  },
};

export function getPipelineStageDefinition(name: BusinessTransactionStageName): PipelineStageDefinition {
  return PipelineStageRegistry[name];
}

export function validateStageSequence(stageNames: BusinessTransactionStageName[]): void {
  const seen = new Set<BusinessTransactionStageName>();

  for (const stageName of stageNames) {
    const stage = getPipelineStageDefinition(stageName);
    for (const dependency of stage.dependencies) {
      if (!seen.has(dependency)) {
        throw new Error(`Stage '${stageName}' depends on '${dependency}' but it was not registered before it.`);
      }
    }
    seen.add(stageName);
  }
}

export function validateTransactionPolicy(policy: TransactionStagePolicy, stageNames: BusinessTransactionStageName[]): void {
  const included = new Set(stageNames);

  for (const stageName of Object.keys(policy) as BusinessTransactionStageName[]) {
    const requirement = policy[stageName];
    if (requirement === 'required' && !included.has(stageName)) {
      throw new Error(`Transaction policy requires stage '${stageName}' but it is missing from the pipeline.`);
    }
    if (requirement === 'disabled' && included.has(stageName)) {
      throw new Error(`Transaction policy marks stage '${stageName}' as disabled but it is present in the pipeline.`);
    }
  }
}
