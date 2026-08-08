import { DomainEventBus } from '../../../domains/events/DomainEventBus';
import {
  BusinessTransactionContext,
  BusinessTransactionEventPayload,
  BusinessTransactionStageName,
  IBusinessPipelineStage,
  PipelineStageResult,
  BusinessTransactionResult,
  PipelineExecutionTrace,
  PipelineStageTraceEntry,
  StageErrorPolicy,
  TransactionStagePolicy,
} from '../contracts/businessTransaction';
import logger from '../../../core/logging/logger.js';
import {
  getPipelineStageDefinition,
  validateStageSequence,
  validateTransactionPolicy,
  PipelineStageDefinition,
} from './businessTransactionStageRegistry';

const stageTechnicalEventMap: Record<BusinessTransactionStageName, Record<'started' | 'completed' | 'failed' | 'rolledBack' | 'compensated', string>> = {
  workflow: {
    started: 'WorkflowStageStarted.v1',
    completed: 'WorkflowStageCompleted.v1',
    failed: 'WorkflowStageFailed.v1',
    rolledBack: 'WorkflowStageRolledBack.v1',
    compensated: 'WorkflowStageCompensated.v1',
  },
  documentNumber: {
    started: 'DocumentNumberStageStarted.v1',
    completed: 'DocumentNumberStageCompleted.v1',
    failed: 'DocumentNumberStageFailed.v1',
    rolledBack: 'DocumentNumberStageRolledBack.v1',
    compensated: 'DocumentNumberStageCompensated.v1',
  },
  pricing: {
    started: 'PricingStageStarted.v1',
    completed: 'PricingStageCompleted.v1',
    failed: 'PricingStageFailed.v1',
    rolledBack: 'PricingStageRolledBack.v1',
    compensated: 'PricingStageCompensated.v1',
  },
  reservation: {
    started: 'ReservationStageStarted.v1',
    completed: 'ReservationStageCompleted.v1',
    failed: 'ReservationStageFailed.v1',
    rolledBack: 'ReservationStageRolledBack.v1',
    compensated: 'ReservationStageCompensated.v1',
  },
  availability: {
    started: 'AvailabilityStageStarted.v1',
    completed: 'AvailabilityStageCompleted.v1',
    failed: 'AvailabilityStageFailed.v1',
    rolledBack: 'AvailabilityStageRolledBack.v1',
    compensated: 'AvailabilityStageCompensated.v1',
  },
  movement: {
    started: 'MovementStageStarted.v1',
    completed: 'MovementStageCompleted.v1',
    failed: 'MovementStageFailed.v1',
    rolledBack: 'MovementStageRolledBack.v1',
    compensated: 'MovementStageCompensated.v1',
  },
  costing: {
    started: 'CostingStageStarted.v1',
    completed: 'CostingStageCompleted.v1',
    failed: 'CostingStageFailed.v1',
    rolledBack: 'CostingStageRolledBack.v1',
    compensated: 'CostingStageCompensated.v1',
  },
  tax: {
    started: 'TaxStageStarted.v1',
    completed: 'TaxStageCompleted.v1',
    failed: 'TaxStageFailed.v1',
    rolledBack: 'TaxStageRolledBack.v1',
    compensated: 'TaxStageCompensated.v1',
  },
  document: {
    started: 'DocumentStageStarted.v1',
    completed: 'DocumentStageCompleted.v1',
    failed: 'DocumentStageFailed.v1',
    rolledBack: 'DocumentStageRolledBack.v1',
    compensated: 'DocumentStageCompensated.v1',
  },
  posting: {
    started: 'PostingStageStarted.v1',
    completed: 'PostingStageCompleted.v1',
    failed: 'PostingStageFailed.v1',
    rolledBack: 'PostingStageRolledBack.v1',
    compensated: 'PostingStageCompensated.v1',
  },
  ledger: {
    started: 'LedgerStageStarted.v1',
    completed: 'LedgerStageCompleted.v1',
    failed: 'LedgerStageFailed.v1',
    rolledBack: 'LedgerStageRolledBack.v1',
    compensated: 'LedgerStageCompensated.v1',
  },
  payment: {
    started: 'PaymentStageStarted.v1',
    completed: 'PaymentStageCompleted.v1',
    failed: 'PaymentStageFailed.v1',
    rolledBack: 'PaymentStageRolledBack.v1',
    compensated: 'PaymentStageCompensated.v1',
  },
  print: {
    started: 'PrintStageStarted.v1',
    completed: 'PrintStageCompleted.v1',
    failed: 'PrintStageFailed.v1',
    rolledBack: 'PrintStageRolledBack.v1',
    compensated: 'PrintStageCompensated.v1',
  },
  finalize: {
    started: 'FinalizeStageStarted.v1',
    completed: 'FinalizeStageCompleted.v1',
    failed: 'FinalizeStageFailed.v1',
    rolledBack: 'FinalizeStageRolledBack.v1',
    compensated: 'FinalizeStageCompensated.v1',
  },
};

export class BusinessTransactionPipeline<C extends BusinessTransactionContext> {
  constructor(private readonly stages: IBusinessPipelineStage<C>[] = []) {}

  public execute(initialContext: C): BusinessTransactionResult<C> {
    const stageHistory: PipelineStageResult<C>[] = [];
    const traceStages: PipelineStageTraceEntry[] = [];
    let context = initialContext;
    let success = true;
    const warnings: string[] = [];
    const errors: string[] = [];
    const executionStart = new Date();

    for (const stage of this.stages) {
      const stageDefinition = getPipelineStageDefinition(stage.name);
      this.publishTechnicalEvent(context, stage.name, 'started');
      const stageResult = stage.execute(context);
      stageHistory.push(stageResult);

      if (stageResult.data) {
        context = this.mergeContext(context, stageResult.data);
      }
      if (stageResult.warnings?.length) {
        warnings.push(...stageResult.warnings);
      }
      if (stageResult.businessEvents?.length) {
        stageResult.businessEvents.forEach((businessEvent) => {
          DomainEventBus.publish(businessEvent.eventType, businessEvent.payload);
        });
      }

      const traceEntry: PipelineStageTraceEntry = {
        stage: stage.name,
        status: stageResult.success ? 'completed' : 'failed',
        startedAt: stageResult.startedAt,
        completedAt: stageResult.completedAt,
        durationMs: stageResult.durationMs,
        errors: stageResult.errors,
        warnings: stageResult.warnings,
        provides: stageDefinition.provides,
        dependencies: stageDefinition.dependencies,
      };
      traceStages.push(traceEntry);

      if (stageResult.success) {
        this.publishTechnicalEvent(context, stage.name, 'completed');
      } else {
        success = false;
        errors.push(...(stageResult.errors ?? []));
        this.publishTechnicalEvent(context, stage.name, 'failed');
        this.handleFailure(context, stageHistory);
        break;
      }
    }

    const executionEnd = new Date();
    const executionTrace: PipelineExecutionTrace = {
      transactionId: context.transactionId,
      transactionType: context.transactionType,
      startedAt: executionStart.toISOString(),
      completedAt: executionEnd.toISOString(),
      durationMs: executionEnd.getTime() - executionStart.getTime(),
      success,
      stages: traceStages,
    };

    return {
      context,
      success,
      warnings: warnings.length ? warnings : undefined,
      errors: errors.length ? errors : undefined,
      stageHistory,
      executionTrace,
    };
  }

  private mergeContext(context: C, data: Partial<C>): C {
    return Object.freeze({ ...context, ...data }) as C;
  }

  private handleFailure(context: C, history: PipelineStageResult<C>[]): void {
    const failedStageName = history[history.length - 1].stage;
    const failedStage = this.stages.find((candidate) => candidate.name === failedStageName);
    const policy = (failedStage as any)?.errorPolicy ?? StageErrorPolicy.STOP;

    if (policy === StageErrorPolicy.COMPENSATE) {
      this.compensate(context, history);
    } else {
      this.rollback(context, history);
    }
  }

  private rollback(context: C, history: PipelineStageResult<C>[]): void {
    for (let i = history.length - 2; i >= 0; i -= 1) {
      const stageName = history[i].stage;
      const stage = this.stages.find((candidate) => candidate.name === stageName);
      if (stage?.rollback) {
        try {
          stage.rollback(context);
          this.publishTechnicalEvent(context, stageName, 'rolledBack');
        } catch (err) {
          logger.error(`Rollback failed for stage ${stageName}:`, err as unknown);
        }
      }
    }
  }

  private compensate(context: C, history: PipelineStageResult<C>[]): void {
    for (let i = history.length - 2; i >= 0; i -= 1) {
      const stageName = history[i].stage;
      const stage = this.stages.find((candidate) => candidate.name === stageName);
      if (stage?.compensate) {
        try {
          stage.compensate(context);
          this.publishTechnicalEvent(context, stageName, 'compensated');
        } catch (err) {
          logger.error(`Compensation failed for stage ${stageName}:`, err as unknown);
        }
      } else if (stage?.rollback) {
        try {
          stage.rollback(context);
          this.publishTechnicalEvent(context, stageName, 'rolledBack');
        } catch (err) {
          logger.error(`Fallback rollback failed for stage ${stageName}:`, err as unknown);
        }
      }
    }
  }

  private publishTechnicalEvent(
    context: C,
    stage: BusinessTransactionStageName,
    stageStatus: 'started' | 'completed' | 'failed' | 'rolledBack' | 'compensated'
  ): void {
    const eventType = stageTechnicalEventMap[stage]?.[stageStatus] ?? `PipelineStage.${stage}.${stageStatus}.v1`;
    const payload: BusinessTransactionEventPayload = {
      transactionId: context.transactionId,
      transactionType: context.transactionType,
      stage,
      stageStatus,
      timestamp: new Date().toISOString(),
      context: {
        workflowStatus: context.workflow?.status,
        documentStatus: context.documentContext?.status,
        documentNumber: context.documentNumber ?? context.documentContext?.documentNumber,
        totalAmount: context.invoice?.totalAmount,
        outstanding: context.outstanding,
      },
    };

    DomainEventBus.publish(eventType, payload);
    // Publish legacy alias without the 'Stage' token for backward compatibility
    try {
      const alias = eventType.replace('Stage', '');
      if (alias !== eventType) {
        DomainEventBus.publish(alias, payload);
      }
    } catch (err) {
      // no-op if aliasing fails
    }
  }
}

interface PipelineStageRegistration<C extends BusinessTransactionContext> extends IBusinessPipelineStage<C> {
  errorPolicy: StageErrorPolicy;
  definition: PipelineStageDefinition;
}

export class BusinessTransactionPipelineBuilder<C extends BusinessTransactionContext> {
  private readonly stages: Array<PipelineStageRegistration<C>> = [];

  public static create<C extends BusinessTransactionContext>(): BusinessTransactionPipelineBuilder<C> {
    return new BusinessTransactionPipelineBuilder<C>();
  }

  public use(
    name: BusinessTransactionStageName,
    executor: (context: C) => PipelineStageResult<C>,
    options?: {
      errorPolicy?: StageErrorPolicy;
      rollback?: (context: C) => void;
      compensate?: (context: C) => void;
    }
  ): BusinessTransactionPipelineBuilder<C> {
    if (this.stages.some((stage) => stage.name === name)) {
      throw new Error(`Stage '${name}' is already registered in the pipeline.`);
    }

    const definition = getPipelineStageDefinition(name);
    this.stages.push({
      name,
      execute: executor,
      rollback: options?.rollback,
      compensate: options?.compensate,
      errorPolicy: options?.errorPolicy ?? definition.defaultPolicy,
      definition,
    });

    return this;
  }

  public build(policy?: TransactionStagePolicy): BusinessTransactionPipeline<C> {
    validateStageSequence(this.stages.map((stage) => stage.name));
    if (policy) {
      validateTransactionPolicy(policy, this.stages.map((stage) => stage.name));
    }
    return new BusinessTransactionPipeline(this.stages);
  }
}
