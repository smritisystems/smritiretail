import {
  AccountingEngine,
  PurchasePostingContext,
  SalesPostingContext,
  SalesReturnPostingContext,
  PurchaseReturnPostingContext,
  StockTransferPostingContext,
  InventoryAdjustmentPostingContext,
  CustomerReceiptPostingContext,
  SupplierPaymentPostingContext,
  TaxBreakdown,
} from '../domain/posting';

export class PostingService {
  private readonly engine = new AccountingEngine();

  public postSalesTransaction(
    saleId: string,
    customerId: string,
    description: string,
    netAmount: number,
    taxBreakdown: TaxBreakdown
  ) {
    const totalAmount = Number((netAmount + taxBreakdown.totalTax).toFixed(2));

    return this.engine.createSalesJournal({
      saleId,
      customerId,
      description,
      netAmount,
      totalAmount,
      taxBreakdown,
    });
  }

  public postPurchaseTransaction(
    purchaseId: string,
    supplierId: string,
    description: string,
    netAmount: number,
    taxBreakdown: TaxBreakdown
  ) {
    const totalAmount = Number((netAmount + taxBreakdown.totalTax).toFixed(2));

    return this.engine.createPurchaseJournal({
      purchaseId,
      supplierId,
      description,
      netAmount,
      totalAmount,
      taxBreakdown,
    });
  }

  public postSalesReturn(
    returnId: string,
    customerId: string,
    description: string,
    netAmount: number,
    taxBreakdown: TaxBreakdown
  ) {
    const totalAmount = Number((netAmount + taxBreakdown.totalTax).toFixed(2));
    return this.engine.createSalesReturnJournal({
      returnId,
      customerId,
      description,
      netAmount,
      totalAmount,
      taxBreakdown,
    });
  }

  public postPurchaseReturn(
    returnId: string,
    supplierId: string,
    description: string,
    netAmount: number,
    taxBreakdown: TaxBreakdown
  ) {
    const totalAmount = Number((netAmount + taxBreakdown.totalTax).toFixed(2));
    return this.engine.createPurchaseReturnJournal({
      returnId,
      supplierId,
      description,
      netAmount,
      totalAmount,
      taxBreakdown,
    });
  }

  public postCustomerReceipt(
    paymentId: string,
    customerId: string,
    description: string,
    paymentLines: { accountId: string; amount: number }[],
    totalAmount: number
  ) {
    return this.engine.createCustomerReceiptJournal({
      paymentId,
      customerId,
      description,
      paymentLines,
      totalAmount,
    });
  }

  public postSupplierPayment(
    paymentId: string,
    supplierId: string,
    description: string,
    paymentLines: { accountId: string; amount: number }[],
    totalAmount: number
  ) {
    return this.engine.createSupplierPaymentJournal({
      paymentId,
      supplierId,
      description,
      paymentLines,
      totalAmount,
    });
  }

  public postStockTransfer(
    transferId: string,
    fromLocation: string,
    toLocation: string,
    amount: number
  ) {
    return this.engine.createStockTransferJournal({
      transferId,
      fromLocation,
      toLocation,
      amount,
    });
  }

  public postInventoryAdjustment(
    adjustmentId: string,
    description: string,
    variance: number
  ) {
    return this.engine.createInventoryAdjustmentJournal({
      adjustmentId,
      description,
      variance,
    });
  }

  public getAccountBalance(accountId: string): number {
    return this.engine.getAccountBalance(accountId);
  }

  public getJournalEntries() {
    return this.engine.getJournalEntries();
  }
}
