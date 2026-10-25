const CURRENCY_SCALE = 100;

const toCents = (amount: number): number => Math.round(amount * CURRENCY_SCALE);

export function allocateProportionalDiscount(
  lineBases: readonly number[],
  requestedDiscount: number
): number[] {
  const baseCents = lineBases.map((base) => {
    if (!Number.isFinite(base) || base < 0) {
      throw new RangeError("Line bases must be finite, non-negative amounts.");
    }
    return toCents(base);
  });
  if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0) {
    throw new RangeError("Discount must be a finite, non-negative amount.");
  }

  const totalBaseCents = baseCents.reduce((total, base) => total + base, 0);
  if (!Number.isSafeInteger(totalBaseCents)) {
    throw new RangeError("Total line base exceeds safe currency precision.");
  }
  const discountCents = Math.min(toCents(requestedDiscount), totalBaseCents);
  if (totalBaseCents === 0 || discountCents === 0) {
    return baseCents.map(() => 0);
  }

  const totalBase = BigInt(totalBaseCents);
  const discount = BigInt(discountCents);
  const allocations = baseCents.map((base) =>
    Number((discount * BigInt(base)) / totalBase)
  );
  let remainingCents = discountCents - allocations.reduce((total, amount) => total + amount, 0);
  const remainderOrder = baseCents
    .map((base, index) => ({
      index,
      remainder: (discount * BigInt(base)) % totalBase,
    }))
    .sort((left, right) =>
      left.remainder === right.remainder
        ? left.index - right.index
        : left.remainder > right.remainder ? -1 : 1
    );

  for (const { index } of remainderOrder) {
    if (remainingCents === 0) break;
    if (allocations[index] < baseCents[index]) {
      allocations[index] += 1;
      remainingCents -= 1;
    }
  }

  return allocations.map((amount) => amount / CURRENCY_SCALE);
}
