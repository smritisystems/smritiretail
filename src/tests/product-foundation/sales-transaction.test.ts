import { describe, expect, it } from 'vitest';
import { ApprovalService } from '../../product-foundation/workflow/approval/application/approvalService';
import { PricingService } from '../../product-foundation/commerce/pricing/application/pricingService';
import { StockLedgerService } from '../../product-foundation/inventory/stock-ledger/application/stockLedgerService';
import { GstService } from '../../product-foundation/finance/gst/application/gstService';
import { PostingService } from '../../product-foundation/finance/posting/application/postingService';
import { PrintService } from '../../product-foundation/document/print/application/printService';

describe('Sales transaction pipeline', () => {
  it('executes a complete sales transaction end to end', () => {
    const approvalService = new ApprovalService();
    const workflow = approvalService.createWorkflow('sale-123', 'sales-invoice');
    const submitted = approvalService.submitWorkflow(workflow);
    const approved = approvalService.approveWorkflow(submitted);

    const pricingService = new PricingService();
    const price = pricingService.calculatePrice(
      { itemId: 'sku-1', baseAmount: 100, customerTier: 'gold' },
      [
        { id: 'tier-gold', type: 'customerGroup', itemId: 'sku-1', priority: 1, customerTier: 'gold', amount: 90 },
        { id: 'promo-10', type: 'sale', itemId: 'sku-1', priority: 0, amount: 85 },
      ]
    );

    expect(price).toBe(90);

    const stockLedgerService = new StockLedgerService();
    const inventoryEntry = { itemId: 'sku-1', quantity: 10 };
    const reserved = stockLedgerService.reserve(inventoryEntry, 2);
    expect(reserved.quantity).toBe(8);

    const gstService = new GstService();
    const breakdown = {
      cgst: gstService.calculateTax({ itemId: 'sku-1', baseAmount: price, taxRateId: 'gst-9' }, [{ id: 'gst-9', rate: 0.09 }]),
      sgst: gstService.calculateTax({ itemId: 'sku-1', baseAmount: price, taxRateId: 'gst-9' }, [{ id: 'gst-9', rate: 0.09 }]),
      igst: 0,
      totalTax: 0,
    };
    breakdown.totalTax = Number((breakdown.cgst + breakdown.sgst + breakdown.igst).toFixed(2));

    expect(breakdown.cgst).toBe(8.1);
    expect(breakdown.sgst).toBe(8.1);
    expect(breakdown.totalTax).toBe(16.2);

    const postingService = new PostingService();
    const journal = postingService.postSalesTransaction(
      'sale-123',
      'cust-001',
      'Retail sale of SKU-1',
      price,
      breakdown
    );

    expect(journal.lines.reduce((sum, line) => sum + line.debit, 0)).toBeCloseTo(journal.lines.reduce((sum, line) => sum + line.credit, 0), 2);
    expect(postingService.getAccountBalance('AccountsReceivable')).toBeCloseTo(106.2, 2);
    expect(postingService.getAccountBalance('SalesRevenue')).toBeCloseTo(-90, 2);

    const printService = new PrintService();
    const invoice = printService.createInvoiceDocument(
      'INV-001',
      'cust-001',
      [
        { itemId: 'sku-1', description: 'SKU 1 Item', quantity: 2, unitPrice: 90, netAmount: 180 },
      ],
      breakdown
    );

    expect(invoice.totalAmount).toBe(196.2);
    expect(invoice.receiptText).toContain('SMRITI RETAIL INVOICE');
    expect(approved.status).toBe('approved');
  });
});
