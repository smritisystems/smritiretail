import { describe, expect, it } from 'vitest';
import { GstService } from '../../product-foundation/finance/gst/application/gstService';

describe('GST engine production hardening', () => {
  it('calculates exclusive GST with CGST and SGST split', () => {
    const service = new GstService();
    const rules = [{ id: 'gst-18', rate: 0.18 }];
    const breakdown = service.calculateBreakdown(
      {
        itemId: 'sku-1',
        baseAmount: 1000,
        taxRateId: 'gst-18',
        taxMode: 'exclusive',
        supplyType: 'intra-state',
      },
      rules
    );

    expect(breakdown.taxableAmount).toBe(1000);
    expect(breakdown.cgst).toBe(90);
    expect(breakdown.sgst).toBe(90);
    expect(breakdown.igst).toBe(0);
    expect(breakdown.totalTax).toBe(180);
    expect(breakdown.grandTotal).toBe(1180);
  });

  it('calculates inclusive GST correctly', () => {
    const service = new GstService();
    const rules = [{ id: 'gst-18', rate: 0.18 }];
    const breakdown = service.calculateBreakdown(
      {
        itemId: 'sku-1',
        baseAmount: 1180,
        taxRateId: 'gst-18',
        taxMode: 'inclusive',
        supplyType: 'intra-state',
      },
      rules
    );

    expect(breakdown.grandTotal).toBe(1180);
    expect(breakdown.taxableAmount).toBeCloseTo(1000, 2);
    expect(breakdown.cgst).toBeCloseTo(90, 2);
    expect(breakdown.sgst).toBeCloseTo(90, 2);
  });

  it('calculates inter-state IGST for exclusive taxable amount', () => {
    const service = new GstService();
    const rules = [{ id: 'gst-28', rate: 0.28 }];
    const breakdown = service.calculateBreakdown(
      {
        itemId: 'sku-2',
        baseAmount: 500,
        taxRateId: 'gst-28',
        taxMode: 'exclusive',
        supplyType: 'inter-state',
      },
      rules
    );

    expect(breakdown.cgst).toBe(0);
    expect(breakdown.sgst).toBe(0);
    expect(breakdown.igst).toBe(140);
    expect(breakdown.grandTotal).toBe(640);
  });

  it('applies cess and reverse charge correctly', () => {
    const service = new GstService();
    const rules = [{ id: 'gst-5-cess', rate: 0.05, cessRate: 0.02 }];
    const breakdown = service.calculateBreakdown(
      {
        itemId: 'sku-3',
        baseAmount: 1000,
        taxRateId: 'gst-5-cess',
        taxMode: 'exclusive',
        supplyType: 'intra-state',
        reverseCharge: true,
      },
      rules
    );

    expect(breakdown.cgst).toBe(25);
    expect(breakdown.sgst).toBe(25);
    expect(breakdown.cess).toBe(20);
    expect(breakdown.totalTax).toBe(70);
    expect(breakdown.reverseCharge).toBe(true);
    expect(breakdown.grandTotal).toBe(1070);
  });

  it('rejects invalid HSN/SAC codes', () => {
    const service = new GstService();
    expect(() =>
      service.calculateBreakdown(
        {
          itemId: 'sku-4',
          baseAmount: 100,
          taxRateId: 'gst-18',
          hsnCode: 'INVALID',
        },
        [{ id: 'gst-18', rate: 0.18 }]
      )
    ).toThrow('Invalid HSN/SAC code');
  });
});
