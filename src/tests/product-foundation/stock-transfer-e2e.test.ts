import { describe, expect, it } from 'vitest';
import { StockTransferService } from '../../product-foundation/inventory/stock-transfer/application/stockTransferService';

describe('Stock transfer pipeline', () => {
  it('executes a stock transfer and posts the stock movement journal', () => {
    const service = new StockTransferService();

    const result = service.executeTransfer({
      transferId: 'trf-100',
      fromEntry: { itemId: 'sku-300', quantity: 5 },
      toEntry: { itemId: 'sku-300', quantity: 5 },
      amount: 0,
    });

    expect(result.fromEntry.quantity).toBe(0);
    expect(result.toEntry.quantity).toBe(10);
    expect(result.journalEntry.description).toContain('Stock transfer');
  });
});
