import { BusinessTransactionPipelineBuilder } from './businessTransactionPipeline';
import {
  BusinessTransactionContext,
  BusinessTransactionStageName,
  StageErrorPolicy,
  TransactionStagePolicy,
} from '../contracts/businessTransaction';
import { DocumentDefinition } from '../../document/application/documentDefinitionRegistry';

export interface PipelineFactoryOptions<C extends BusinessTransactionContext> {
  stageOptions?: Partial<Record<BusinessTransactionStageName, {
    errorPolicy?: StageErrorPolicy;
    rollback?: (context: C) => void;
    compensate?: (context: C) => void;
  }>>;
  skipStages?: BusinessTransactionStageName[];
  dryRun?: boolean;
}

export class PipelineFactory {
  public static fromDefinition<C extends BusinessTransactionContext>(
    definition: DocumentDefinition,
    stageImplementations: Partial<Record<BusinessTransactionStageName, (context: C) => any>>,
    options?: PipelineFactoryOptions<C>
  ) {
    const builder = BusinessTransactionPipelineBuilder.create<C>();
    const skipStages = new Set(options?.skipStages ?? []);

    for (const stageName of definition.transactionPolicy.stages) {
      if (skipStages.has(stageName)) {
        continue;
      }

      const implementation = stageImplementations[stageName];
      const stageOptions = options?.stageOptions?.[stageName];
      const requirement = definition.transactionPolicy.stageRequirements?.[stageName] as TransactionStagePolicy[keyof TransactionStagePolicy];

      if (!implementation) {
        if (requirement === 'required') {
          throw new Error(`Document definition '${definition.id}' requires implementation for stage '${stageName}'.`);
        }

        builder.use(stageName as any, (context: C) => ({
          stage: stageName,
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: {},
        }), {
          errorPolicy: stageOptions?.errorPolicy,
          rollback: stageOptions?.rollback,
          compensate: stageOptions?.compensate,
        });
        continue;
      }

      if (options?.dryRun) {
        builder.use(stageName as any, (context: C) => ({
          stage: stageName,
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: context,
        }), {
          errorPolicy: stageOptions?.errorPolicy,
          rollback: stageOptions?.rollback,
          compensate: stageOptions?.compensate,
        });
      } else {
        builder.use(stageName as any, implementation, {
          errorPolicy: stageOptions?.errorPolicy,
          rollback: stageOptions?.rollback,
          compensate: stageOptions?.compensate,
        });
      }
    }

    return builder.build(definition.transactionPolicy.stageRequirements);
  }

  public static fromDocumentDefinition<C extends BusinessTransactionContext>(
    definition: DocumentDefinition,
    stageImplementations: Partial<Record<BusinessTransactionStageName, (context: C) => any>>,
    options?: PipelineFactoryOptions<C>
  ) {
    return PipelineFactory.fromDefinition(definition, stageImplementations, options);
  }
}
