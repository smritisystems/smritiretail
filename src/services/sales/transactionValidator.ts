import type { SalesTransaction } from "../../domain/sales/transaction";
import { validateSalesOrderItems } from "../../utils/salesOrderValidation";

export function validateSalesTransaction(txn: SalesTransaction): string[] {
  const errors: string[] = [];

  if (!txn.customerId && !txn.customerName) {
    errors.push("Customer is required");
  }

  if (!txn.items || txn.items.length === 0) {
    errors.push("At least one item is required");
  }

  const itemValidationError = validateSalesOrderItems(
    (txn.items || []).map((item, index) => ({
      id: item.id || `line-${index + 1}`,
      stockNo: item.stockNo || "",
      description: item.itemDescription || "",
      rate: Number(item.rate || 0),
      quantity: Number(item.qty || 0),
      value: Number(item.value || 0),
      total: Number(item.total || 0),
    }))
  );

  if (itemValidationError) {
    errors.push(itemValidationError);
  }

  txn.items.forEach((item, index) => {
    if ((item.qty ?? 0) <= 0) {
      errors.push(`Item ${index + 1} quantity must be greater than zero`);
    }

    if ((item.rate ?? 0) < 0) {
      errors.push(`Item ${index + 1} rate cannot be negative`);
    }
  });

  return errors;
}
