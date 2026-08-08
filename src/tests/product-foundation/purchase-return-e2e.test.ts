import { describe, expect, it } from 'vitest';
import { PurchaseReturnService } from '../../product-foundation/commerce/purchase-return/application/purchaseReturnService';

describe('Purchase return pipeline', () => {
  it('executes a purchase return, reduces inbound inventory, reverses GST, and records a supplier credit', () => {
    const service = new PurchaseReturnService();

    const result = service.executePurchaseReturn({
      returnId: 'pret-100',
      supplierId: 'supp-200',
      items: [
        { itemId: 'sku-200', description: 'Returned Purchase Item', quantity: 1, unitCost: 150, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-200', quantity: 10 },
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
    });

    expect(result.workflow.status).toBe('approved');
    expect(result.inventoryEntry.quantity).toBe(9);
    expect(result.netAmount).toBe(150);
    expect(result.taxBreakdown.totalTax).toBe(27);
    expect(result.debitNote.documentTitle).toBe('SMRITI DEBIT NOTE');
    expect(result.debitNote.totalAmount).toBe(177);
  });
});
