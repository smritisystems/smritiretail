import { describe, expect, it } from 'vitest';
import { ApprovalService } from '../../product-foundation/workflow/approval/application/approvalService';
import { PricingService } from '../../product-foundation/commerce/pricing/application/pricingService';
import { StockLedgerService } from '../../product-foundation/inventory/stock-ledger/application/stockLedgerService';
import { GstService } from '../../product-foundation/finance/gst/application/gstService';

describe('retail transaction pipeline', () => {
  it('executes a sale transaction through workflow, pricing, reservation, and GST', () => {
    const approvalService = new ApprovalService();
    const workflow = approvalService.createWorkflow('sale-1', 'sales-invoice');
    const submitted = approvalService.submitWorkflow(workflow);
    const approved = approvalService.approveWorkflow(submitted);

    const pricingService = new PricingService();
    const price = pricingService.calculatePrice(
      { itemId: 'sku-1', baseAmount: 100, customerTier: 'gold' },
      [{ id: 'tier-1', type: 'customerGroup', itemId: 'sku-1', priority: 1, customerTier: 'gold', amount: 90 }]
    );

    const stockLedgerService = new StockLedgerService();
    const inventoryEntry = { itemId: 'sku-1', quantity: 20 };
    const reserved = stockLedgerService.reserve(inventoryEntry, 2);

    const gstService = new GstService();
    const taxed = gstService.calculateTotal({ itemId: 'sku-1', baseAmount: price, taxRateId: 'gst-18' }, [{ id: 'gst-18', rate: 0.18 }]);

    expect(approved.status).toBe('approved');
    expect(price).toBe(90);
    expect(reserved.quantity).toBe(18);
    expect(taxed).toBe(106.2);
  });
});
