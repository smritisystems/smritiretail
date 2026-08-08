import { LedgerEngine, LedgerTransaction, LedgerTransactionRequest, PartyType, TransactionType } from '../domain/ledger';

export class LedgerService {
  private readonly engine = new LedgerEngine();

  public recordTransaction(request: LedgerTransactionRequest): LedgerTransaction {
    return this.engine.postTransaction(request);
  }

  public recordInvoice(partyType: PartyType, partyId: string, invoiceId: string, amount: number, description: string) {
    return this.recordTransaction({
      id: `LDG-INV-${invoiceId}`,
      partyType,
      partyId,
      transactionType: 'invoice',
      referenceId: invoiceId,
      amount,
      description,
    });
  }

  public recordPayment(partyType: PartyType, partyId: string, paymentId: string, amount: number, description: string) {
    return this.recordTransaction({
      id: `LDG-PAY-${paymentId}`,
      partyType,
      partyId,
      transactionType: 'payment',
      referenceId: paymentId,
      amount,
      description,
    });
  }

  public getOutstanding(partyType: PartyType, partyId: string): number {
    return this.engine.getOutstanding(partyType, partyId);
  }

  public getStatement(partyType: PartyType, partyId: string): LedgerTransaction[] {
    return this.engine.getTransactions(partyType, partyId);
  }
}
