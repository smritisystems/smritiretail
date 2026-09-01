import type { SalesLineItem, SalesTransaction } from "../../domain/sales/transaction";

export function calculateLineTotal(item: SalesLineItem): SalesLineItem {
  const qty = Number(item.qty || 0);
  const rate = Number(item.rate || 0);
  const value = qty * rate;

  const discAmt =
    item.discPercent != null && item.discPercent !== 0
      ? (value * Number(item.discPercent)) / 100
      : Number(item.discAmt || 0);

  const taxAmt =
    item.taxPercent != null && item.taxPercent !== 0
      ? ((value - discAmt) * Number(item.taxPercent)) / 100
      : Number(item.taxAmount || 0);

  return {
    ...item,
    value,
    discAmt,
    taxAmount: taxAmt,
    total: value - discAmt + taxAmt,
  };
}

export function recomputeTransaction(txn: SalesTransaction): SalesTransaction {
  const items = txn.items.map(calculateLineTotal);
  const subtotal = items.reduce((sum, item) => sum + (item.value || 0), 0);
  const discountTotal = items.reduce((sum, item) => sum + (item.discAmt || 0), 0);
  const taxTotal = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  const netAmount = subtotal - discountTotal + taxTotal;

  return {
    ...txn,
    items,
    subtotal,
    discountTotal,
    taxTotal,
    netAmount,
  };
}
