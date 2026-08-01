import {
  BusinessTransactionContext,
  BusinessTransactionStageName,
  PipelineStageResult,
  StageErrorPolicy,
  TransactionStagePolicy,
} from '../contracts/businessTransaction';
import { BusinessTransactionPipelineBuilder } from './businessTransactionPipeline';
import { validateStageSequence, validateTransactionPolicy } from './businessTransactionStageRegistry';

export interface TransactionPolicyDefinition {
  policyName: string;
  stages: BusinessTransactionStageName[];
  stageRequirements?: TransactionStagePolicy;
  description?: string;
  metadata?: Record<string, unknown>;
}

export type TransactionStageImplementation<C extends BusinessTransactionContext> = Partial<
  Record<BusinessTransactionStageName, (context: C) => PipelineStageResult<C>>
>;

export interface TransactionStageOptions<C extends BusinessTransactionContext> {
  errorPolicy?: StageErrorPolicy;
  rollback?: (context: C) => void;
  compensate?: (context: C) => void;
}

export interface TransactionPolicyExecutionOptions<C extends BusinessTransactionContext> {
  stageOptions?: Partial<Record<BusinessTransactionStageName, TransactionStageOptions<C>>>;
}

export class TransactionPolicyRegistryService {
  private readonly policies = new Map<string, TransactionPolicyDefinition>();

  public registerPolicy(policy: TransactionPolicyDefinition): void {
    const key = policy.policyName.toLowerCase();
    if (this.policies.has(key)) {
      throw new Error(`Transaction policy '${policy.policyName}' is already registered.`);
    }

    validateStageSequence(policy.stages);
    if (policy.stageRequirements) {
      validateTransactionPolicy(policy.stageRequirements, policy.stages);
    }

    this.policies.set(key, policy);
  }

  public getPolicy(policyName: string): TransactionPolicyDefinition {
    const policy = this.policies.get(policyName.toLowerCase());
    if (!policy) {
      throw new Error(`Transaction policy '${policyName}' is not registered.`);
    }
    return policy;
  }

  public hasPolicy(policyName: string): boolean {
    return this.policies.has(policyName.toLowerCase());
  }

  public listPolicies(): TransactionPolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  public clear(): void {
    this.policies.clear();
  }
}

export const TransactionPolicyRegistry = new TransactionPolicyRegistryService();

export function buildPipelineFromPolicy<C extends BusinessTransactionContext>(
  policyName: string,
  stageImplementations: TransactionStageImplementation<C>,
  options?: TransactionPolicyExecutionOptions<C>
) {
  const policy = TransactionPolicyRegistry.getPolicy(policyName);
  const builder = BusinessTransactionPipelineBuilder.create<C>();

  for (const stageName of policy.stages) {
    const implementation = stageImplementations[stageName];
    const stageOptions = options?.stageOptions?.[stageName];
    const requirement = policy.stageRequirements?.[stageName];

    if (!implementation) {
      if (requirement === 'required') {
        throw new Error(`Transaction policy '${policyName}' requires implementation for stage '${stageName}'.`);
      }

      builder.use(
        stageName,
        (context) => ({
          stage: stageName,
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: {},
        }),
        {
          errorPolicy: stageOptions?.errorPolicy,
          rollback: stageOptions?.rollback,
          compensate: stageOptions?.compensate,
        }
      );
      continue;
    }

    builder.use(stageName, implementation, {
      errorPolicy: stageOptions?.errorPolicy,
      rollback: stageOptions?.rollback,
      compensate: stageOptions?.compensate,
    });
  }

  return builder.build(policy.stageRequirements);
}

export class TransactionPolicyExecutor<C extends BusinessTransactionContext> {
  public execute(
    policyName: string,
    initialContext: C,
    stageImplementations: TransactionStageImplementation<C>,
    options?: TransactionPolicyExecutionOptions<C>
  ) {
    const pipeline = buildPipelineFromPolicy(policyName, stageImplementations, options);
    return pipeline.execute(initialContext);
  }
}

TransactionPolicyRegistry.registerPolicy({
  policyName: 'SalesInvoice',
  stages: [
    'workflow',
    'pricing',
    'reservation',
    'movement',
    'tax',
    'posting',
    'document',
    'ledger',
    'payment',
    'print',
  ],
  stageRequirements: {
    workflow: 'required',
    pricing: 'required',
    reservation: 'required',
    movement: 'required',
    tax: 'required',
    posting: 'required',
    document: 'required',
    ledger: 'required',
    payment: 'optional',
    print: 'optional',
  },
  description: 'Sales invoice pipeline with optional payment and print stages.',
});

TransactionPolicyRegistry.registerPolicy({
  policyName: 'PurchaseInvoice',
  stages: ['workflow', 'pricing', 'reservation', 'movement', 'tax', 'posting', 'document', 'ledger', 'payment'],
  stageRequirements: {
    workflow: 'required',
    pricing: 'required',
    movement: 'required',
    tax: 'required',
    posting: 'required',
    document: 'required',
    ledger: 'required',
    payment: 'optional',
  },
  description: 'Purchase invoice pipeline with optional payment stage.',
});

TransactionPolicyRegistry.registerPolicy({
  policyName: 'SalesReturn',
  stages: ['workflow', 'pricing', 'reservation', 'movement', 'tax', 'posting', 'ledger', 'document', 'print', 'finalize'],
  stageRequirements: {
    workflow: 'required',
    pricing: 'required',
    movement: 'required',
    tax: 'required',
    posting: 'required',
    print: 'optional',
    finalize: 'optional',
  },
  description: 'Sales return pipeline with optional print and finalize stages.',
});

TransactionPolicyRegistry.registerPolicy({
  policyName: 'PurchaseReturn',
  stages: ['workflow', 'pricing', 'reservation', 'movement', 'tax', 'posting', 'ledger', 'document', 'print', 'finalize'],
  stageRequirements: {
    workflow: 'required',
    pricing: 'required',
    movement: 'required',
    tax: 'required',
    posting: 'required',
    print: 'optional',
    finalize: 'optional',
  },
  description: 'Purchase return pipeline with optional print and finalize stages.',
});

TransactionPolicyRegistry.registerPolicy({
  policyName: 'StockTransfer',
  stages: ['workflow', 'pricing', 'reservation', 'movement', 'tax', 'posting', 'ledger', 'document', 'finalize'],
  stageRequirements: {
    workflow: 'required',
    movement: 'required',
    posting: 'required',
    finalize: 'optional',
  },
  description: 'Stock transfer pipeline with movement and posting stages.',
});

TransactionPolicyRegistry.registerPolicy({
  policyName: 'PhysicalStock',
  stages: ['workflow', 'pricing', 'reservation', 'movement', 'tax', 'posting', 'ledger'],
  stageRequirements: {
    workflow: 'required',
    posting: 'required',
  },
  description: 'Physical stock adjustment pipeline with posting stage.',
});
