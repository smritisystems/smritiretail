import { DocumentLifecycleContext, DocumentLifecycleResult, DocumentType } from '../../document/domain/documentLifecycle';
import { InvoiceDocument, InvoiceLine } from '../../document/print/domain/invoice';
import { JournalEntry, TaxBreakdown } from '../../finance/posting/domain/posting';
import { PaymentResult } from '../../finance/payment/domain/payment';
import { WorkflowContext } from '../../workflow/approval/domain/workflow';
import { StockLedgerEntry } from '../../inventory/stock-ledger/domain/stockLedger';

export type BusinessTransactionType = 'Sales' | 'Purchase' | 'SalesReturn' | 'PurchaseReturn' | 'StockTransfer' | 'PhysicalStock';
export type PartyType = 'customer' | 'supplier';

export type BusinessTransactionStageName =
  | 'workflow'
  | 'documentNumber'
  | 'pricing'
  | 'reservation'
  | 'availability'
  | 'movement'
  | 'costing'
  | 'tax'
  | 'document'
  | 'posting'
  | 'ledger'
  | 'payment'
  | 'print'
  | 'finalize';

export enum StageErrorPolicy {
  STOP = 'STOP',
  CONTINUE = 'CONTINUE',
  RETRY = 'RETRY',
  COMPENSATE = 'COMPENSATE',
}

export type StageRequirement = 'required' | 'optional' | 'disabled';

export type TransactionStagePolicy = Partial<Record<BusinessTransactionStageName, StageRequirement>>;

export interface PipelineStageTraceEntry {
  stage: BusinessTransactionStageName;
  status: 'started' | 'completed' | 'failed' | 'compensated';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  errors?: string[];
  warnings?: string[];
  provides?: Array<keyof BusinessTransactionContext>;
  dependencies?: BusinessTransactionStageName[];
}

export interface PipelineExecutionTrace {
  transactionId: string;
  transactionType: BusinessTransactionType;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  stages: PipelineStageTraceEntry[];
}

export interface PipelineStageResult<C extends BusinessTransactionContext = BusinessTransactionContext> {
  stage: BusinessTransactionStageName;
  success: boolean;
  warnings?: string[];
  errors?: string[];
  data?: Partial<C>;
  businessEvents?: Array<{ eventType: string; payload: unknown }>;
  audit?: Array<Record<string, unknown>>;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface IBusinessPipelineStage<C extends BusinessTransactionContext = BusinessTransactionContext> {
  name: BusinessTransactionStageName;
  execute(context: C): PipelineStageResult<C>;
  compensate?(context: C): void;
  rollback?(context: C): void;
}

export interface BusinessTransactionContext {
  transactionId: string;
  transactionType: BusinessTransactionType;
  partyId: string;
  partyType: PartyType;
  documentId: string;
  documentNumber?: string;
  documentType: DocumentType;
  branch?: string;
  financialYear?: string;
  metadata?: Record<string, unknown>;
  workflow?: WorkflowContext;
  invoiceLines?: InvoiceLine[];
  netAmount?: number;
  taxBreakdown?: TaxBreakdown;
  journalEntry?: JournalEntry;
  invoice?: InvoiceDocument;
  documentContext?: DocumentLifecycleContext;
  documentLifecycleResult?: DocumentLifecycleResult;
  paymentResult?: PaymentResult;
  inventoryResult?: StockLedgerEntry;
  reservedInventory?: StockLedgerEntry;
  finalInventory?: StockLedgerEntry;
  outstanding?: number;
}

export interface BusinessTransactionEventPayload {
  transactionId: string;
  transactionType: BusinessTransactionType;
  stage: string;
  stageStatus: 'started' | 'completed' | 'failed' | 'rolledBack' | 'compensated';
  timestamp: string;
  context: {
    workflowStatus?: string;
    documentStatus?: string;
    documentNumber?: string;
    totalAmount?: number;
    outstanding?: number;
  };
}

export interface BusinessTransactionResult<T extends BusinessTransactionContext = BusinessTransactionContext> {
  context: T;
  success: boolean;
  warnings?: string[];
  errors?: string[];
  stageHistory: PipelineStageResult<T>[];
  executionTrace?: PipelineExecutionTrace;
}
