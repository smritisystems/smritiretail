import { describe, expect, it } from 'vitest';
import { SalesTransactionService } from '../../product-foundation/commerce/sales/application/salesTransactionService';

describe('SalesTransactionService integration', () => {
  it('executes a full sale with workflow, pricing, reservation, stock deduction, GST, posting, and invoice generation', () => {
    const service = new SalesTransactionService();

    const result = service.executeSale({
      saleId: 'sale-001',
      customerId: 'cust-001',
      customerTier: 'gold',
      items: [
        { itemId: 'sku-101', description: 'Retail Item A', quantity: 2, basePrice: 100, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-101', quantity: 10 },
      pricingRules: [
        { id: 'tier-gold', type: 'customerGroup', itemId: 'sku-101', priority: 1, customerTier: 'gold', amount: 90 },
      ],
      taxRules: [
        { id: 'gst-9', rate: 0.09 },
      ],
      taxRateId: 'gst-9',
    });

    expect(result.workflow.status).toBe('approved');
    expect(result.invoiceLines).toHaveLength(1);
    expect(result.invoiceLines[0].unitPrice).toBe(90);
    expect(result.invoiceLines[0].netAmount).toBe(180);
    expect(result.netAmount).toBe(180);
    expect(result.reservedInventory.quantity).toBe(8);
    expect(result.finalInventory.quantity).toBe(8);
    expect(result.taxBreakdown.cgst).toBe(16.2);
    expect(result.taxBreakdown.sgst).toBe(16.2);
    expect(result.taxBreakdown.totalTax).toBe(32.4);
    expect(result.invoice.totalAmount).toBe(212.4);
    expect(result.invoice.receiptText).toContain('SMRITI RETAIL INVOICE');
  });

  it('applies customer payment and reduces outstanding via ledger on sale', () => {
    const service = new SalesTransactionService();

    const result = service.executeSale({
      saleId: 'sale-002',
      customerId: 'cust-002',
      customerTier: 'silver',
      items: [
        { itemId: 'sku-102', description: 'Retail Item B', quantity: 1, basePrice: 200, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-102', quantity: 5 },
      pricingRules: [
        { id: 'tier-silver', type: 'customerGroup', itemId: 'sku-102', priority: 1, customerTier: 'silver', amount: 190 },
      ],
      taxRules: [
        { id: 'gst-9', rate: 0.09 },
      ],
      taxRateId: 'gst-9',
      paymentLines: [
        { channel: 'CASH', amount: 100 },
        { channel: 'UPI', amount: 50 },
      ],
    });

    expect(result.paymentResult).toBeDefined();
    expect(result.paymentResult?.totalAmount).toBe(150);
    expect(result.outstanding).toBeCloseTo(74.2, 2);
    expect(result.paymentResult?.receiptText).toContain('Payment: pay-sale-002');
  });
});
