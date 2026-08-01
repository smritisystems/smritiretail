import { describe, expect, it } from 'vitest';
import { PostingService } from '../../product-foundation/finance/posting/application/postingService';

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

    expect(journal.lines.reduce((sum, line) => sum + line.debit, 0)).toBeCloseTo(118, 2);
    expect(journal.lines.reduce((sum, line) => sum + line.credit, 0)).toBeCloseTo(118, 2);
    expect(posting.getAccountBalance('AccountsReceivable')).toBeCloseTo(118, 2);
    expect(posting.getAccountBalance('SalesRevenue')).toBeCloseTo(-100, 2);
    expect(posting.getAccountBalance('CGST Payable')).toBeCloseTo(-9, 2);
    expect(posting.getAccountBalance('SGST Payable')).toBeCloseTo(-9, 2);
  });
});
