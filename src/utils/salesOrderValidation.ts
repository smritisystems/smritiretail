export type SalesOrderLineValidationItem = {
  id?: string;
  stockNo?: string;
  description?: string;
  rate?: number;
  quantity?: number;
  value?: number;
  total?: number;
};

export function validateSalesOrderItems(items: SalesOrderLineValidationItem[] | null | undefined): string | null {
  if (!items || items.length === 0) {
    return "Please add at least one item";
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const stockNo = String(item?.stockNo ?? "").trim();
    const description = String(item?.description ?? "").trim();
    const quantity = Number(item?.quantity ?? 0);
    const rate = Number(item?.rate ?? 0);
    const value = Number(item?.value ?? 0);
    const total = Number(item?.total ?? 0);

    if (!stockNo) {
      return `Item ${index + 1}: stock number is required. Please enter a valid item code.`;
    }

    if (!description) {
      return `Item ${index + 1}: "${stockNo}" was not found in the database. Please select a valid item before saving.`;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return `Item ${index + 1}: quantity must be greater than zero.`;
    }

    if (!Number.isFinite(rate) || rate < 0) {
      return `Item ${index + 1}: rate is invalid.`;
    }

    if (!Number.isFinite(value) || value <= 0) {
      return `Item ${index + 1}: value is invalid. Please re-check the item details.`;
    }

    if (!Number.isFinite(total) || total <= 0) {
      return `Item ${index + 1}: total is invalid. Please re-check the item details.`;
    }
  }

  return null;
}
