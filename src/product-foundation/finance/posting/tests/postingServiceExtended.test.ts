import { describe, expect, it } from 'vitest';
import { PostingService } from '../application/postingService';

describe('Extended posting service', () => {
  it('posts customer receipt and balances accounts correctly', () => {
    const posting = new PostingService();
    const journal = posting.postCustomerReceipt('pay-100', 'cust-100', 'Receipt for customer', [
      { accountId: 'Cash', amount: 500 },
      { accountId: 'UPI Account', amount: 300 },
    ], 800);

    expect(journal.lines.reduce((sum, line) => sum + line.debit, 0)).toBe(800);
    expect(journal.lines.reduce((sum, line) => sum + line.credit, 0)).toBe(800);
    expect(journal.lines.some((line) => line.accountId === 'Cash')).toBe(true);
    expect(journal.lines.some((line) => line.accountId === 'UPI Account')).toBe(true);
  });

  it('posts supplier payment and balances accounts correctly', () => {
    const posting = new PostingService();
    const journal = posting.postSupplierPayment('pay-200', 'sup-200', 'Supplier payment', [
      { accountId: 'Bank Account', amount: 1200 },
    ], 1200);

    expect(journal.lines.reduce((sum, line) => sum + line.debit, 0)).toBe(1200);
    expect(journal.lines.reduce((sum, line) => sum + line.credit, 0)).toBe(1200);
    expect(journal.lines.some((line) => line.accountId === 'AccountsPayable')).toBe(true);
  });
});
