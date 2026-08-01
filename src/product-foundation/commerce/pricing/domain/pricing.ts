export type PriceRuleType =
  | 'mrp'
  | 'sale'
  | 'wholesale'
  | 'customerGroup'
  | 'store'
  | 'dateRange'
  | 'flatDiscount'
  | 'percentageDiscount'
  | 'buyXGetY'
  | 'coupon'
  | 'loyalty'
  | 'promotion'
  | 'rounding';

export type RoundingRule = 'nearest1' | 'nearest5' | 'nearest10' | 'nearest0.5';

export interface PriceRule {
  id: string;
  type: PriceRuleType;
  itemId: string;
  priority: number;
  amount?: number;
  customerTier?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
  minQuantity?: number;
  buyQuantity?: number;
  getQuantity?: number;
  couponCode?: string;
  discountType?: 'flat' | 'percentage';
  minPurchase?: number;
  loyaltyPointsValue?: number;
  roundingRule?: RoundingRule;
  description?: string;
}

export interface PricingContext {
  itemId: string;
  baseAmount: number;
  quantity?: number;
  customerTier?: string;
  storeId?: string;
  date?: string;
  couponCode?: string;
  loyaltyPoints?: number;
}

function toNumber(value: number | undefined, fallback = 0): number {
  return Number((value ?? fallback).toFixed(2));
}

function isDateInRange(date: string, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) {
    return true;
  }

  const candidate = new Date(date).getTime();
  const from = startDate ? new Date(startDate).getTime() : -Infinity;
  const to = endDate ? new Date(endDate).getTime() : Infinity;

  return candidate >= from && candidate <= to;
}

export class PricingEngine {
  public calculatePrice(context: PricingContext, rules: PriceRule[]): number {
    const pricingContext = { ...context, quantity: context.quantity ?? 1 };
    const effectiveBasePrice = this.selectBasePrice(pricingContext, rules);
    const discountAmount = this.calculateDiscounts(pricingContext, effectiveBasePrice, rules);
    const adjustedPrice = Number(Math.max(effectiveBasePrice - discountAmount, 0).toFixed(2));
    return this.applyRounding(adjustedPrice, rules);
  }

  private selectBasePrice(context: PricingContext, rules: PriceRule[]): number {
    const applicablePriceRules = rules
      .filter((rule) => rule.itemId === context.itemId)
      .filter((rule) => ['mrp', 'sale', 'wholesale', 'customerGroup', 'store', 'dateRange', 'promotion'].includes(rule.type))
      .filter((rule) => (rule.customerTier ? rule.customerTier === context.customerTier : true))
      .filter((rule) => (rule.storeId ? rule.storeId === context.storeId : true))
      .filter((rule) => (rule.type === 'dateRange' ? context.date && isDateInRange(context.date, rule.startDate, rule.endDate) : true));

    if (applicablePriceRules.length === 0) {
      return context.baseAmount;
    }

    const sorted = applicablePriceRules.sort((a, b) => b.priority - a.priority);
    return toNumber(sorted[0].amount, context.baseAmount);
  }

  private calculateDiscounts(context: PricingContext, basePrice: number, rules: PriceRule[]): number {
    const quantity = context.quantity ?? 1;
    let discountTotal = 0;

    const discountRules = rules.filter((rule) => ['flatDiscount', 'percentageDiscount', 'coupon', 'loyalty', 'promotion', 'buyXGetY'].includes(rule.type));

    for (const rule of discountRules.sort((a, b) => b.priority - a.priority)) {
      if (rule.itemId !== context.itemId) {
        continue;
      }

      if (rule.minQuantity && quantity < rule.minQuantity) {
        continue;
      }

      switch (rule.type) {
        case 'flatDiscount': {
          discountTotal += toNumber(rule.amount) * quantity;
          break;
        }
        case 'percentageDiscount': {
          discountTotal += toNumber(rule.amount) * basePrice * quantity * 0.01;
          break;
        }
        case 'promotion': {
          if (rule.discountType === 'flat') {
            discountTotal += toNumber(rule.amount) * quantity;
          } else {
            discountTotal += toNumber(rule.amount) * basePrice * quantity * 0.01;
          }
          break;
        }
        case 'buyXGetY': {
          if (!rule.buyQuantity || !rule.getQuantity) {
            break;
          }
          const groupSize = rule.buyQuantity + rule.getQuantity;
          const freeGroups = Math.floor(quantity / groupSize);
          const freeUnits = freeGroups * rule.getQuantity;
          discountTotal += toNumber(basePrice) * freeUnits;
          break;
        }
        case 'coupon': {
          if (rule.couponCode !== context.couponCode) {
            break;
          }
          const lineTotal = basePrice * quantity - discountTotal;
          if (rule.minPurchase && lineTotal < rule.minPurchase) {
            break;
          }
          if (rule.discountType === 'percentage') {
            discountTotal += lineTotal * (toNumber(rule.amount) / 100);
          } else {
            discountTotal += toNumber(rule.amount);
          }
          break;
        }
        case 'loyalty': {
          if (context.loyaltyPoints && rule.loyaltyPointsValue) {
            const loyaltyValue = Math.min(context.loyaltyPoints, rule.loyaltyPointsValue);
            discountTotal += loyaltyValue;
          }
          break;
        }
      }
    }

    return Number(discountTotal.toFixed(2)) / quantity;
  }

  private applyRounding(price: number, rules: PriceRule[]): number {
    const roundingRule = rules
      .filter((rule) => rule.type === 'rounding')
      .sort((a, b) => b.priority - a.priority)[0];

    if (!roundingRule?.roundingRule) {
      return price;
    }

    switch (roundingRule.roundingRule) {
      case 'nearest1':
        return Number(Math.round(price).toFixed(2));
      case 'nearest5':
        return Number((Math.round(price / 5) * 5).toFixed(2));
      case 'nearest10':
        return Number((Math.round(price / 10) * 10).toFixed(2));
      case 'nearest0.5':
        return Number((Math.round(price * 2) / 2).toFixed(2));
      default:
        return price;
    }
  }
}
