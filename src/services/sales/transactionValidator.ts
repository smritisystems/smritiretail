import type { SalesTransaction } from "../../domain/sales/transaction";

export function validateSalesTransaction(txn: SalesTransaction): string[] {
  const errors: string[] = [];

  if (!txn.customerId && !txn.customerName) {
    errors.push("Customer is required");
  }

  if (!txn.items || txn.items.length === 0) {
    errors.push("At least one item is required");
  }

  txn.items.forEach((item, index) => {
    if (!item.itemDescription?.trim()) {
      errors.push(`Item ${index + 1} description is required`);
    }

    if ((item.qty ?? 0) <= 0) {
      errors.push(`Item ${index + 1} quantity must be greater than zero`);
    }

    if ((item.rate ?? 0) < 0) {
      errors.push(`Item ${index + 1} rate cannot be negative`);
    }
  });

  return errors;
}
