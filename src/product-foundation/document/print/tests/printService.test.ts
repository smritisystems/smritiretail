import { describe, expect, it } from 'vitest';
import { PrintService } from '../application/printService';

describe('Print service', () => {
  it('generates an invoice document with receipt text', () => {
    const service = new PrintService();
    const invoice = service.createInvoiceDocument(
      'INV-100',
      'cust-100',
      [
        { itemId: 'sku-100', description: 'Product 100', quantity: 1, unitPrice: 100, netAmount: 100 },
      ],
      { cgst: 9, sgst: 9, igst: 0, totalTax: 18 }
    );

    expect(invoice.invoiceId).toBe('INV-100');
    expect(invoice.totalAmount).toBe(118);
    expect(invoice.receiptText).toContain('SMRITI RETAIL INVOICE');
  });
});
