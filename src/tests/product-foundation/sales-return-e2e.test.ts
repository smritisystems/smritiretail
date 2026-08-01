import { describe, expect, it } from 'vitest';
import { SalesReturnService } from '../../product-foundation/commerce/sales-return/application/salesReturnService';

describe('Sales return pipeline', () => {
  it('executes a sales return, restores inventory, reverses GST, and generates a credit note', () => {
    const service = new SalesReturnService();

    const result = service.executeSalesReturn({
      returnId: 'sret-100',
      customerId: 'cust-200',
      items: [
        { itemId: 'sku-100', description: 'Return Item X', quantity: 1, unitPrice: 120, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-100', quantity: 5 },
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
    });

    expect(result.workflow.status).toBe('approved');
    expect(result.inventoryEntry.quantity).toBe(6);
    expect(result.netAmount).toBe(120);
    expect(result.taxBreakdown.totalTax).toBe(21.6);
    expect(result.creditNote.documentTitle).toBe('SMRITI CREDIT NOTE');
    expect(result.creditNote.totalAmount).toBe(141.6);
  });
});
