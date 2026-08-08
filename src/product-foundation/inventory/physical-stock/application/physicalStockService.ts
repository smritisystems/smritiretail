import { ApprovalService } from '../../../workflow/approval/application/approvalService';
import { StockLedgerService } from '../../stock-ledger/application/stockLedgerService';
import { PostingService } from '../../../finance/posting/application/postingService';
import { DocumentDefinitionRegistry } from '../../../document/application/documentDefinitionRegistry';
import { PipelineFactory } from '../../../commerce/application/pipelineFactory';
import { BusinessTransactionContext, PipelineStageResult } from '../../../commerce/contracts/businessTransaction';
import { TransactionStageImplementation } from '../../../commerce/application/transactionPolicyRegistry';

export interface PhysicalStockCount {
  itemId: string;
  expectedQty: number;
  actualQty: number;
}

export interface PhysicalStockRequest {
  adjustmentId: string;
  counts: PhysicalStockCount[];
}

export interface PhysicalStockContext extends BusinessTransactionContext {
  counts: PhysicalStockCount[];
  variances?: PhysicalStockCount[];
  totalVariance?: number;
  journalEntry?: ReturnType<PostingService['postInventoryAdjustment']>;
}

export interface PhysicalStockResult {
  counts: PhysicalStockCount[];
  variances: PhysicalStockCount[];
  journalEntry: ReturnType<PostingService['postInventoryAdjustment']>;
}

export class PhysicalStockService {
  private inventoryService = new StockLedgerService();
  private postingService = new PostingService();

  public executePhysicalStock(request: PhysicalStockRequest): PhysicalStockResult {
    const stageImplementations: TransactionStageImplementation<PhysicalStockContext> = {
      workflow: (context) => {
        let workflow = new ApprovalService().createWorkflow(context.transactionId, context.documentType);
        workflow = new ApprovalService().addStep(workflow, 'approval-1', 'Physical stock adjustment approval', 1);
        const submitted = new ApprovalService().submitWorkflow(workflow);
        const currentStep = new ApprovalService().getCurrentStep(submitted);
        const approved = currentStep ? new ApprovalService().approveStep(submitted, currentStep.id) : submitted;

        return {
          stage: 'workflow',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { workflow: approved },
        };
      },
      posting: (context) => {
        const variances = context.counts.map((count) => ({
          itemId: count.itemId,
          expectedQty: count.expectedQty,
          actualQty: count.actualQty,
        }));

        const totalVariance = Number(
          variances.reduce((sum, variance) => sum + (variance.actualQty - variance.expectedQty), 0).toFixed(2)
        );

        const journalEntry = this.postingService.postInventoryAdjustment(
          context.transactionId,
          `Physical stock adjustment ${context.transactionId}`,
          totalVariance
        );

        return {
          stage: 'posting',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { variances, totalVariance, journalEntry },
        };
      },
      finalize: () => ({
        stage: 'finalize',
        success: true,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        data: {},
      }),
    };

    const initialContext: PhysicalStockContext = {
      transactionId: request.adjustmentId,
      transactionType: 'PhysicalStock',
      partyId: 'inventory',
      partyType: 'supplier',
      documentId: request.adjustmentId,
      documentType: 'PhysicalStock',
      counts: request.counts,
      metadata: {},
    };

    const definition = DocumentDefinitionRegistry.getDefinition('PhysicalStock');
    const pipeline = PipelineFactory.fromDocumentDefinition(definition, stageImplementations);
    const result = pipeline.execute(initialContext);
    const finalContext = result.context;

    return {
      counts: request.counts,
      variances: finalContext.variances ?? request.counts,
      journalEntry: finalContext.journalEntry!,
    };
  }
}
