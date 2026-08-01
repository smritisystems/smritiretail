import { describe, expect, it } from 'vitest';
import { PaymentService } from '../application/paymentService';

describe('Payment service', () => {
  it('processes split payment correctly', () => {
    const service = new PaymentService();
    const result = service.processPayment({
      paymentId: 'pay-001',
      partyId: 'cust-123',
      partyType: 'customer',
      invoiceId: 'inv-101',
      description: 'Retail invoice payment',
      lines: [
        { channel: 'CASH', amount: 500 },
        { channel: 'UPI', amount: 500 },
        { channel: 'WALLET', amount: 200 },
      ],
    });

    expect(result.totalAmount).toBe(1200);
    expect(result.lines).toHaveLength(3);
    expect(result.receiptText).toContain('Payment: pay-001');
    expect(result.receiptText).toContain('Cash: ₹500.00');
    expect(result.receiptText).toContain('UPI: ₹500.00');
    expect(result.receiptText).toContain('WALLET: ₹200.00');
  });

  it('throws on unsupported channel', () => {
    const service = new PaymentService();
    expect(() =>
      service.processPayment({
        paymentId: 'pay-002',
        partyId: 'cust-123',
        partyType: 'customer',
        description: 'Invalid payment',
        lines: [{ channel: 'CREDIT' as any, amount: 0 }],
      })
    ).toThrow('Each payment line must have a positive amount');
  });
});
