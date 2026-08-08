export type PartyType = 'customer' | 'supplier';
export type TransactionType = 'invoice' | 'payment' | 'credit_note' | 'debit_note' | 'advance' | 'refund';

export interface LedgerTransaction {
  id: string;
  partyId: string;
  partyType: PartyType;
  transactionType: TransactionType;
  referenceId?: string;
  amount: number;
  description: string;
  date: string;
  outstandingAfter: number;
}

export interface LedgerTransactionRequest {
  id: string;
  partyId: string;
  partyType: PartyType;
  transactionType: TransactionType;
  referenceId?: string;
  amount: number;
  description: string;
}

function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

function outstandingDelta(transactionType: TransactionType, amount: number): number {
  switch (transactionType) {
    case 'invoice':
      return amount;
    case 'payment':
    case 'credit_note':
    case 'debit_note':
    case 'advance':
    case 'refund':
      return -amount;
    default:
      return 0;
  }
}

export class LedgerEngine {
  private readonly entries: LedgerTransaction[] = [];
  private readonly outstandingByParty = new Map<string, number>();

  public postTransaction(request: LedgerTransactionRequest): LedgerTransaction {
    const key = `${request.partyType}:${request.partyId}`;
    const currentOutstanding = this.outstandingByParty.get(key) ?? 0;
    const delta = outstandingDelta(request.transactionType, request.amount);
    const outstandingAfter = roundToTwo(currentOutstanding + delta);

    const transaction: LedgerTransaction = {
      ...request,
      outstandingAfter,
      date: new Date().toISOString(),
    };

    this.entries.push(transaction);
    this.outstandingByParty.set(key, outstandingAfter);
    return transaction;
  }

  public getOutstanding(partyType: PartyType, partyId: string): number {
    return this.outstandingByParty.get(`${partyType}:${partyId}`) ?? 0;
  }

  public getTransactions(partyType: PartyType, partyId: string): LedgerTransaction[] {
    return this.entries.filter((entry) => entry.partyType === partyType && entry.partyId === partyId);
  }
}
