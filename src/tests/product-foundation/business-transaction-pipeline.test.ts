import { describe, expect, it } from 'vitest';
import {
  BusinessTransactionContext,
  IBusinessPipelineStage,
  PipelineStageResult,
} from '../../product-foundation/commerce/contracts/businessTransaction';
import { BusinessTransactionPipeline } from '../../product-foundation/commerce/application/businessTransactionPipeline';
import { DomainEventBus } from '../../domains/events/DomainEventBus';

interface TestTransactionContext extends BusinessTransactionContext {
  payload?: string;
}

describe('BusinessTransactionPipeline', () => {
  it('executes named pipeline stages and emits stage events', () => {
    const steps: IBusinessPipelineStage<TestTransactionContext>[] = [
      {
        name: 'workflow',
        execute: (context) => ({
          stage: 'workflow',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { payload: 'initialized' },
        }),
      },
      {
        name: 'finalize',
        execute: (context) => ({
          stage: 'finalize',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { payload: `${context.payload}-finalized` },
        }),
      },
    ];

    const events: string[] = [];
    const unsubscribe = DomainEventBus.subscribe('WorkflowCompleted.v1', (event) => {
      events.push(event.eventType + ':' + event.payload.stage);
    });

    const pipeline = new BusinessTransactionPipeline<TestTransactionContext>(steps);
    const result = pipeline.execute({
      transactionId: 'txn-1',
      transactionType: 'Sales',
      partyId: 'cust-1',
      partyType: 'customer',
      documentId: 'doc-1',
      documentType: 'SalesInvoice',
    });

    unsubscribe();

    expect(result.context.payload).toBe('initialized-finalized');
    expect(events).toEqual(['WorkflowCompleted.v1:workflow']);
    expect(result.stageHistory.map((stage) => stage.stage)).toEqual(['workflow', 'finalize']);
    expect(result.success).toBe(true);
  });
});
