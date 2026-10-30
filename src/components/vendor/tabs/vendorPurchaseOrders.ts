import type { VendorDetail } from "../../../types/vendor";

type PurchaseOrderRecord = {
  id?: string;
  order_no?: string;
  [key: string]: unknown;
};

type PurchaseOrderResponse = PurchaseOrderRecord[] | { items?: PurchaseOrderRecord[] } | null;

export type VendorPurchaseOrderLookupResult = {
  orders: PurchaseOrderRecord[];
  failedIdentifiers: string[];
  identifierCount: number;
};

export async function fetchVendorPurchaseOrders(
  vendor: Pick<VendorDetail, "id" | "code" | "legacySupplierId">,
  fetchBySupplier: (supplierId: string) => Promise<unknown>,
): Promise<VendorPurchaseOrderLookupResult> {
  const identifiers = [...new Set([
    vendor.id,
    vendor.legacySupplierId,
    vendor.code,
    vendor.code ? `sup-${vendor.code.toLowerCase()}` : "",
  ].map((identifier) => identifier?.trim()).filter((identifier): identifier is string => Boolean(identifier)))];
  const ordersById = new Map<string, PurchaseOrderRecord>();
  const failedIdentifiers: string[] = [];

  for (const identifier of identifiers) {
    try {
      const response = await fetchBySupplier(identifier) as PurchaseOrderResponse;
      const orders = Array.isArray(response) ? response : response?.items || [];
      orders.forEach((order, index) => {
        const key = order.id || order.order_no || `${identifier}-${index}`;
        if (!ordersById.has(key)) ordersById.set(key, order);
      });
    } catch {
      failedIdentifiers.push(identifier);
    }
  }

  return {
    orders: Array.from(ordersById.values()),
    failedIdentifiers,
    identifierCount: identifiers.length,
  };
}
