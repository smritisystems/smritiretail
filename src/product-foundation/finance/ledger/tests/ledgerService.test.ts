import { describe, expect, it } from 'vitest';
import { LedgerService } from '../application/ledgerService';

describe('Ledger service', () => {
  it('records invoices and payments and calculates outstanding amount', () => {
    const ledger = new LedgerService();

    ledger.recordInvoice('customer', 'cust-1', 'inv-1', 1000, 'Sales invoice');
    expect(ledger.getOutstanding('customer', 'cust-1')).toBe(1000);

    ledger.recordPayment('customer', 'cust-1', 'pay-1', 300, 'Customer payment');
    expect(ledger.getOutstanding('customer', 'cust-1')).toBe(700);

    const statement = ledger.getStatement('customer', 'cust-1');
    expect(statement).toHaveLength(2);
    expect(statement[0].transactionType).toBe('invoice');
    expect(statement[1].transactionType).toBe('payment');
  });
});
