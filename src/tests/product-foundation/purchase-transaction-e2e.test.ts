import { describe, expect, it } from 'vitest';
import { PurchaseTransactionService } from '../../product-foundation/commerce/purchase/application/purchaseTransactionService';

describe('Purchase transaction pipeline', () => {
  it('executes a complete purchase transaction through workflow, inventory, GST, posting, and purchase invoice generation', () => {
    const service = new PurchaseTransactionService();

    const result = service.executePurchase({
      purchaseId: 'pur-100',
      supplierId: 'supp-100',
      items: [
        { itemId: 'sku-200', description: 'Purchase Item Y', quantity: 5, unitCost: 50, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-200', quantity: 0 },
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
    });

    expect(result.workflow.status).toBe('approved');
    expect(result.workflow.id).toBe('pur-100');

    expect(result.invoiceLines).toHaveLength(1);
    expect(result.invoiceLines[0].netAmount).toBe(250);
    expect(result.netAmount).toBe(250);
    expect(result.taxBreakdown.cgst).toBe(22.5);
    expect(result.taxBreakdown.sgst).toBe(22.5);
    expect(result.taxBreakdown.totalTax).toBe(45);

    expect(result.invoice.totalAmount).toBe(295);
    expect(result.invoice.receiptText).toContain('SMRITI PURCHASE INVOICE');
    expect(result.inventoryEntry.quantity).toBe(5);
  });

  it('records supplier invoice, applies payment, and reduces outstanding in ledger', () => {
    const service = new PurchaseTransactionService();

    const result = service.executePurchase({
      purchaseId: 'pur-101',
      supplierId: 'supp-101',
      items: [
        { itemId: 'sku-201', description: 'Purchase Item Z', quantity: 2, unitCost: 200, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-201', quantity: 0 },
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
      paymentLines: [
        { channel: 'CASH', amount: 150 },
        { channel: 'UPI', amount: 150 },
      ],
    });

    expect(result.invoice.totalAmount).toBe(472);
    expect(result.paymentResult).toBeDefined();
    expect(result.paymentResult?.totalAmount).toBe(300);
    expect(result.outstanding).toBe(172);
    expect(result.paymentResult?.receiptText).toContain('Payment: pay-pur-101');
  });
});
