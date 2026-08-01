import { describe, expect, it } from 'vitest';
import { PricingEngine } from '../../product-foundation/commerce/pricing/domain/pricing';

describe('Pricing engine', () => {
  it('resolves customer group price over sale and MRP with date-based overrides', () => {
    const engine = new PricingEngine();
    const result = engine.calculatePrice(
      {
        itemId: 'sku-100',
        baseAmount: 150,
        quantity: 1,
        customerTier: 'gold',
        storeId: 'store-1',
        date: '2026-08-01T00:00:00.000Z',
      },
      [
        { id: 'mrp', type: 'mrp', itemId: 'sku-100', amount: 150, priority: 1 },
        { id: 'sale', type: 'sale', itemId: 'sku-100', amount: 120, priority: 2 },
        { id: 'customer-gold', type: 'customerGroup', itemId: 'sku-100', customerTier: 'gold', amount: 110, priority: 3 },
        { id: 'date-sale', type: 'dateRange', itemId: 'sku-100', amount: 105, priority: 4, startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-31T23:59:59.999Z' },
      ]
    );

    expect(result).toBe(105);
  });

  it('applies flat and percentage discounts and coupon reduction', () => {
    const engine = new PricingEngine();
    const result = engine.calculatePrice(
      {
        itemId: 'sku-101',
        baseAmount: 200,
        quantity: 2,
        customerTier: 'silver',
        storeId: 'store-2',
        date: '2026-08-01T00:00:00.000Z',
        couponCode: 'SAVE20',
        loyaltyPoints: 10,
      },
      [
        { id: 'mrp', type: 'mrp', itemId: 'sku-101', amount: 200, priority: 1 },
        { id: 'flat-discount', type: 'flatDiscount', itemId: 'sku-101', amount: 20, priority: 1, minQuantity: 2 },
        { id: 'percent-discount', type: 'percentageDiscount', itemId: 'sku-101', amount: 10, priority: 2, minQuantity: 2 },
        { id: 'coupon-save20', type: 'coupon', itemId: 'sku-101', couponCode: 'SAVE20', amount: 20, priority: 3, minPurchase: 100, discountType: 'flat' },
        { id: 'loyalty', type: 'loyalty', itemId: 'sku-101', loyaltyPointsValue: 10, priority: 1 },
      ]
    );

    expect(result).toBe(145);
  });

  it('calculates effective unit price for buy X get Y promotions', () => {
    const engine = new PricingEngine();
    const result = engine.calculatePrice(
      {
        itemId: 'sku-102',
        baseAmount: 50,
        quantity: 6,
      },
      [
        { id: 'mrp', type: 'mrp', itemId: 'sku-102', amount: 50, priority: 1 },
        { id: 'buy2get1', type: 'buyXGetY', itemId: 'sku-102', buyQuantity: 2, getQuantity: 1, priority: 1 },
      ]
    );

    expect(result).toBe(33.33);
  });

  it('rounds prices according to rounding rules', () => {
    const engine = new PricingEngine();
    const result = engine.calculatePrice(
      {
        itemId: 'sku-103',
        baseAmount: 99.49,
        quantity: 1,
      },
      [
        { id: 'mrp', type: 'mrp', itemId: 'sku-103', amount: 99.49, priority: 1 },
        { id: 'rounding', type: 'rounding', itemId: 'sku-103', roundingRule: 'nearest1', priority: 1 },
      ]
    );

    expect(result).toBe(99);
  });
});
