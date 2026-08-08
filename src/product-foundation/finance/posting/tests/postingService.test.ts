import { describe, expect, it } from 'vitest';
import { PostingService } from '../application/postingService';

describe('Posting service', () => {
  it('creates a balanced sales journal entry and updates account balances', () => {
    const posting = new PostingService();
    const journal = posting.postSalesTransaction(
      'sale-222',
      'cust-010',
      'Retail sale SKU-222',
      100,
      { cgst: 9, sgst: 9, igst: 0, totalTax: 18 }
    );

    expect(journal.lines.reduce((sum, line) => sum + line.debit, 0)).toBe(118);
    expect(journal.lines.reduce((sum, line) => sum + line.credit, 0)).toBe(118);
    expect(posting.getAccountBalance('AccountsReceivable')).toBe(118);
    expect(posting.getAccountBalance('SalesRevenue')).toBe(-100);
    expect(posting.getAccountBalance('CGST Payable')).toBe(-9);
    expect(posting.getAccountBalance('SGST Payable')).toBe(-9);
  });
});
