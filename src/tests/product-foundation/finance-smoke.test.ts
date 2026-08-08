import { describe, expect, it } from 'vitest';
import { SalesTransactionService } from '../../product-foundation/commerce/sales/application/salesTransactionService';
import { PurchaseTransactionService } from '../../product-foundation/commerce/purchase/application/purchaseTransactionService';
import { PaymentService } from '../../product-foundation/finance/payment/application/paymentService';
import { PostingService } from '../../product-foundation/finance/posting/application/postingService';
import { LedgerService } from '../../product-foundation/finance/ledger/application/ledgerService';

function sumPaymentLines(lines: { channel: string; amount: number }[]) {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

function sumJournalEntryAmount(entry: { lines: { debit: number; credit: number }[] }) {
  return entry.lines.reduce((sum, line) => sum + line.debit + line.credit, 0);
}

describe('Finance smoke test', () => {
  it('executes a full cash sale with GST, posting, payment, ledger settlement, and receipt generation', () => {
    const service = new SalesTransactionService();

    const result = service.executeSale({
      saleId: 'sale-smoke-001',
      customerId: 'cust-smoke-001',
      customerTier: 'gold',
      items: [
        { itemId: 'sku-smoke-001', description: 'Smoke Test Item', quantity: 1, basePrice: 100, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-smoke-001', quantity: 5 },
      pricingRules: [
        { id: 'tier-gold', type: 'customerGroup', itemId: 'sku-smoke-001', priority: 1, customerTier: 'gold', amount: 100 },
      ],
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
      paymentLines: [{ channel: 'CASH', amount: 118 }],
    });

    expect(result.workflow.status).toBe('approved');
    expect(result.invoice.totalAmount).toBe(118);
    expect(result.paymentResult).toBeDefined();
    expect(result.paymentResult?.totalAmount).toBe(118);
    expect(sumPaymentLines(result.paymentResult?.lines ?? [])).toBe(118);
    expect(result.outstanding).toBe(0);
    expect(result.paymentResult?.receiptText).toContain('Payment: pay-sale-smoke-001');
    expect(result.invoice.receiptText).toContain('SMRITI RETAIL INVOICE');
    expect(sumJournalEntryAmount(result.journalEntry)).toBe(236);
    expect(result.journalEntry.lines.reduce((sum, line) => sum + line.debit, 0)).toBeCloseTo(result.journalEntry.lines.reduce((sum, line) => sum + line.credit, 0), 2);
  });

  it('executes a credit sale with GST and leaves customer outstanding until payment', () => {
    const service = new SalesTransactionService();

    const result = service.executeSale({
      saleId: 'sale-smoke-002',
      customerId: 'cust-smoke-002',
      customerTier: 'silver',
      items: [
        { itemId: 'sku-smoke-002', description: 'Credit Sale Item', quantity: 1, basePrice: 150, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-smoke-002', quantity: 10 },
      pricingRules: [
        { id: 'tier-silver', type: 'customerGroup', itemId: 'sku-smoke-002', priority: 1, customerTier: 'silver', amount: 150 },
      ],
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
    });

    expect(result.paymentResult).toBeUndefined();
    expect(result.invoice.totalAmount).toBe(177);
    expect(result.outstanding).toBe(177);
    expect(sumJournalEntryAmount(result.journalEntry)).toBe(354);
    expect(result.journalEntry.lines.reduce((sum, line) => sum + line.debit, 0)).toBeCloseTo(result.journalEntry.lines.reduce((sum, line) => sum + line.credit, 0), 2);
  });

  it('executes a partial payment on a sale and reduces outstanding correctly', () => {
    const service = new SalesTransactionService();

    const result = service.executeSale({
      saleId: 'sale-smoke-003',
      customerId: 'cust-smoke-003',
      customerTier: 'silver',
      items: [
        { itemId: 'sku-smoke-003', description: 'Partial Payment Item', quantity: 1, basePrice: 200, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-smoke-003', quantity: 3 },
      pricingRules: [
        { id: 'tier-silver', type: 'customerGroup', itemId: 'sku-smoke-003', priority: 1, customerTier: 'silver', amount: 200 },
      ],
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
      paymentLines: [{ channel: 'CASH', amount: 100 }],
    });

    expect(result.invoice.totalAmount).toBe(236);
    expect(result.paymentResult?.totalAmount).toBe(100);
    expect(result.outstanding).toBe(136);
  });

  it('executes a split payment on a sale and fully settles the customer outstanding', () => {
    const service = new SalesTransactionService();

    const result = service.executeSale({
      saleId: 'sale-smoke-004',
      customerId: 'cust-smoke-004',
      customerTier: 'bronze',
      items: [
        { itemId: 'sku-smoke-004', description: 'Split Payment Item', quantity: 1, basePrice: 100, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-smoke-004', quantity: 4 },
      pricingRules: [
        { id: 'tier-bronze', type: 'customerGroup', itemId: 'sku-smoke-004', priority: 1, customerTier: 'bronze', amount: 100 },
      ],
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
      paymentLines: [
        { channel: 'CASH', amount: 60 },
        { channel: 'UPI', amount: 58 },
      ],
    });

    expect(result.invoice.totalAmount).toBe(118);
    expect(result.paymentResult?.totalAmount).toBe(118);
    expect(result.outstanding).toBe(0);
    expect(sumPaymentLines(result.paymentResult?.lines ?? [])).toBe(118);
  });

  it('executes a purchase on credit and records supplier outstanding', () => {
    const service = new PurchaseTransactionService();

    const result = service.executePurchase({
      purchaseId: 'pur-smoke-001',
      supplierId: 'supp-smoke-001',
      items: [
        { itemId: 'sku-smoke-005', description: 'Credit Purchase Item', quantity: 1, unitCost: 100, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-smoke-005', quantity: 0 },
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
    });

    expect(result.invoice.totalAmount).toBe(118);
    expect(result.paymentResult).toBeUndefined();
    expect(result.outstanding).toBe(118);
  });

  it('executes a supplier payment and reduces outstanding ledger correctly', () => {
    const service = new PurchaseTransactionService();

    const result = service.executePurchase({
      purchaseId: 'pur-smoke-002',
      supplierId: 'supp-smoke-002',
      items: [
        { itemId: 'sku-smoke-006', description: 'Supplier Payment Item', quantity: 1, unitCost: 200, taxRateId: 'gst-9' },
      ],
      inventoryEntry: { itemId: 'sku-smoke-006', quantity: 0 },
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
      paymentLines: [
        { channel: 'CASH', amount: 100 },
      ],
    });

    expect(result.invoice.totalAmount).toBe(236);
    expect(result.paymentResult?.totalAmount).toBe(100);
    expect(result.outstanding).toBe(136);
  });

  it('processes a refund payment and verifies reduced customer outstanding', () => {
    const postingService = new PostingService();
    const ledgerService = new LedgerService();
    const paymentService = new PaymentService(postingService, ledgerService);

    ledgerService.recordInvoice('customer', 'cust-smoke-refund', 'inv-smoke-refund', 118, 'Refund test invoice');

    const refundResult = paymentService.processPayment({
      paymentId: 'refund-smoke-001',
      partyId: 'cust-smoke-refund',
      partyType: 'customer',
      description: 'Customer refund settlement',
      lines: [{ channel: 'REFUND', amount: 50 }],
    });

    expect(refundResult.totalAmount).toBe(50);
    expect(refundResult.receiptText).toContain('REFUND: ₹50.00');
    expect(ledgerService.getOutstanding('customer', 'cust-smoke-refund')).toBe(68);
    expect(ledgerService.getStatement('customer', 'cust-smoke-refund')).toHaveLength(2);
    expect(refundResult.paymentId).toBe('refund-smoke-001');
  });
});
