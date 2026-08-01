import { describe, expect, it } from 'vitest';
import { PrintService } from '../../product-foundation/document/print/application/printService';

describe('Print service', () => {
  it('generates an invoice document with total amount and receipt text', () => {
    const printService = new PrintService();
    const invoice = printService.createInvoiceDocument(
      'INV-1001',
      'cust-010',
      [
        { itemId: 'sku-10', description: 'Test Item', quantity: 1, unitPrice: 150, netAmount: 150 },
      ],
      { cgst: 13.5, sgst: 13.5, igst: 0, totalTax: 27 }
    );

    expect(invoice.totalAmount).toBeCloseTo(177, 2);
    expect(invoice.receiptText).toContain('SMRITI RETAIL INVOICE');
    expect(invoice.lines).toHaveLength(1);
  });
});
