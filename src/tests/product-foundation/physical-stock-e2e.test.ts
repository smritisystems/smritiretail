import { describe, expect, it } from 'vitest';
import { PhysicalStockService } from '../../product-foundation/inventory/physical-stock/application/physicalStockService';

describe('Physical stock pipeline', () => {
  it('calculates variance and records an inventory adjustment journal', () => {
    const service = new PhysicalStockService();

    const result = service.executePhysicalStock({
      adjustmentId: 'adj-100',
      counts: [
        { itemId: 'sku-400', expectedQty: 20, actualQty: 18 },
        { itemId: 'sku-401', expectedQty: 15, actualQty: 17 },
      ],
    });

    expect(result.variances).toEqual([
      { itemId: 'sku-400', expectedQty: 20, actualQty: 18 },
      { itemId: 'sku-401', expectedQty: 15, actualQty: 17 },
    ]);
    expect(result.journalEntry.description).toContain('Physical stock adjustment');
    expect(result.journalEntry.description).toContain('no variance');
    expect(result.journalEntry.lines).toEqual([]);
  });
});
