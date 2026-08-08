import { describe, expect, it } from 'vitest';
import { SalesTransactionService } from '../../product-foundation/commerce/sales/application/salesTransactionService';

describe('Sales transaction pipeline', () => {
  it('executes an end-to-end retail sale through workflow, pricing, inventory, GST, posting, and invoice generation', () => {
    const service = new SalesTransactionService();

    const result = service.executeSale({
      saleId: 'sale-100',
      customerId: 'cust-100',
      customerTier: 'gold',
      items: [
        { itemId: 'sku-100', description: 'Retail Item X', quantity: 2, basePrice: 100, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-100', quantity: 10 },
      pricingRules: [
        { id: 'tier-gold', type: 'customerGroup', itemId: 'sku-100', priority: 1, customerTier: 'gold', amount: 90 },
      ],
      taxRules: [
        { id: 'gst-9', rate: 0.09 },
      ],
      taxRateId: 'gst-9',
    });

    expect(result.workflow.status).toBe('approved');
    expect(result.workflow.id).toBe('sale-100');

    expect(result.invoiceLines).toHaveLength(1);
    expect(result.invoiceLines[0].unitPrice).toBe(90);
    expect(result.invoiceLines[0].netAmount).toBe(180);

    expect(result.netAmount).toBe(180);
    expect(result.taxBreakdown.cgst).toBe(16.2);
    expect(result.taxBreakdown.sgst).toBe(16.2);
    expect(result.taxBreakdown.totalTax).toBe(32.4);

    expect(result.reservedInventory.quantity).toBe(8);
    expect(result.finalInventory.quantity).toBe(8);

    expect(result.journalEntry.lines.reduce((sum, line) => sum + line.debit, 0)).toBeCloseTo(
      result.journalEntry.lines.reduce((sum, line) => sum + line.credit, 0),
      2
    );
    expect(result.invoice.totalAmount).toBe(212.4);
    expect(result.invoice.receiptText).toContain('SMRITI RETAIL INVOICE');
  });
});
