import { ApprovalService } from '../../../workflow/approval/application/approvalService';
import { StockLedgerService } from '../../../inventory/stock-ledger/application/stockLedgerService';
import { PostingService } from '../../../finance/posting/application/postingService';
import { StockLedgerEntry } from '../../../inventory/stock-ledger/domain/stockLedger';
import { DocumentDefinitionRegistry } from '../../../document/application/documentDefinitionRegistry';
import { PipelineFactory } from '../../../commerce/application/pipelineFactory';
import { BusinessTransactionContext, PipelineStageResult } from '../../../commerce/contracts/businessTransaction';
import { TransactionStageImplementation } from '../../../commerce/application/transactionPolicyRegistry';

export interface StockTransferRequest {
  transferId: string;
  fromEntry: { itemId: string; quantity: number };
  toEntry: { itemId: string; quantity: number };
  amount: number;
}

export interface StockTransferContext extends BusinessTransactionContext {
  fromEntry: { itemId: string; quantity: number };
  toEntry: { itemId: string; quantity: number };
  amount: number;
  fromMovement?: StockLedgerEntry;
  toMovement?: StockLedgerEntry;
  journalEntry?: ReturnType<PostingService['postStockTransfer']>;
}

export interface StockTransferResult {
  fromEntry: StockLedgerEntry;
  toEntry: StockLedgerEntry;
  journalEntry: ReturnType<PostingService['postStockTransfer']>;
}

export class StockTransferService {
  private inventoryService = new StockLedgerService();
  private postingService = new PostingService();

  public executeTransfer(request: StockTransferRequest): StockTransferResult {
    const stageImplementations: TransactionStageImplementation<StockTransferContext> = {
      workflow: (context) => {
        let workflow = new ApprovalService().createWorkflow(context.transactionId, context.documentType);
        workflow = new ApprovalService().addStep(workflow, 'approval-1', 'Stock transfer approval', 1);
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
      movement: (context) => {
        const fromMovement = this.inventoryService.applyMovement(context.fromEntry, {
          id: `trf-${context.transactionId}-out`,
          quantity: context.fromEntry.quantity,
          type: 'out',
        });

        const toMovement = this.inventoryService.applyMovement(context.toEntry, {
          id: `trf-${context.transactionId}-in`,
          quantity: context.toEntry.quantity,
          type: 'in',
          unitCost: 0,
        });

        return {
          stage: 'movement',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { fromMovement, toMovement },
        };
      },
      posting: (context) => {
        const journalEntry = this.postingService.postStockTransfer(
          context.transactionId,
          context.fromEntry.itemId,
          context.toEntry.itemId,
          context.amount
        );

        return {
          stage: 'posting',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { journalEntry },
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

    const initialContext: StockTransferContext = {
      transactionId: request.transferId,
      transactionType: 'Purchase',
      partyId: request.fromEntry.itemId,
      partyType: 'supplier',
      documentId: request.transferId,
      documentType: 'StockTransfer',
      fromEntry: request.fromEntry,
      toEntry: request.toEntry,
      amount: request.amount,
      metadata: {},
    };

    const definition = DocumentDefinitionRegistry.getDefinition('StockTransfer');
    const pipeline = PipelineFactory.fromDocumentDefinition(definition, stageImplementations);
    const result = pipeline.execute(initialContext);
    const finalContext = result.context;

    return {
      fromEntry: finalContext.fromMovement!,
      toEntry: finalContext.toMovement!,
      journalEntry: finalContext.journalEntry!,
    };
  }
}
