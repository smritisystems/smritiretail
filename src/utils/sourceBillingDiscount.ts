const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateSourceDiscountAmount(params: {
  unitPrice: number;
  quantity: number;
  discountPercent?: number;
  discountAmount?: number;
  discountQuantityBasis?: number;
  previouslyBilledQuantity?: number;
}): number {
  const {
    unitPrice,
    quantity,
    discountPercent = 0,
    discountAmount = 0,
    discountQuantityBasis = 0,
    previouslyBilledQuantity = 0,
  } = params;
  if (discountPercent > 0) {
    return roundCurrency(unitPrice * quantity * discountPercent / 100);
  }
  if (discountQuantityBasis <= 0 || discountAmount <= 0 || quantity <= 0) return 0;
  const billedBefore = Math.min(discountQuantityBasis, Math.max(0, previouslyBilledQuantity));
  const billedAfter = Math.min(discountQuantityBasis, billedBefore + quantity);
  const allocatedBefore = roundCurrency(discountAmount * billedBefore / discountQuantityBasis);
  const allocatedAfter = roundCurrency(discountAmount * billedAfter / discountQuantityBasis);
  return Math.max(0, allocatedAfter - allocatedBefore);
}
