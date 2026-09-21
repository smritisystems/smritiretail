export function normalizePurchaseStatus(status?: string | null): string {
  const clean = String(status || "").trim();
  if (!clean) return "Draft";
  const upper = clean.toUpperCase();
  if (upper === "DRAFT" || upper === "D") return "Draft";
  if (upper === "CONFIRMED" || upper === "SUBMITTED" || upper === "OPEN") return "Confirmed / Submitted";
  if (upper === "RECEIVED" || upper === "COMPLETED") return "Received / Completed";
  if (upper === "CANCELLED") return "Cancelled";
  return clean;
}

export function buildPurchaseOrderDetailUrl(orderNo?: string | null): string {
  if (!orderNo) return "/purchase/orders/";
  return `/purchase/orders/${encodeURIComponent(String(orderNo).trim())}`;
}

export function buildVendor360SelectionKey(supplierId?: string | null): string {
  return String(supplierId || "").trim();
}
