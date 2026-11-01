import type { SalesOrderFormData } from "../components/sales/SalesOrderFormPremium";

export function buildSalesOrderPayload(formData: SalesOrderFormData, orderNo: string) {
  const items = formData.items.map((item) => ({
    product_id: item.productId,
    item_id: item.itemId,
    variant_id: item.variantId,
    code: item.stockNo,
    name: item.description || item.stockNo,
    price: Number(item.rate || 0),
    quantity: Number(item.quantity || 0),
    discount_percent: Number(item.discPercent || 0),
    discount_amount: Number(item.discAmount || 0),
    hsn_code: item.hsn || undefined,
    gst_rate: Number(item.gstRate ?? item.taxPercent ?? 0),
    tax_amount: Number(item.taxAmount || 0),
    total_amount: Number(item.total || item.value || 0),
    ean: item.barcode || undefined,
    uom: item.uom || undefined,
  }));
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    order_no: orderNo,
    date: formData.docDate || new Date().toISOString().slice(0, 10),
    customer_id: formData.customerId,
    customer_name: formData.customerName,
    po_number: formData.referenceNo.trim() || null,
    status: formData.orderStatus || "Draft",
    tax_total: Number(formData.totalTax || 0),
    grand_total: Number(formData.netAmount || 0),
    basic_total: Number(formData.totalSalesValue || 0),
    total_qty: totalQuantity,
    fulfillment_status: "UNFULFILLED",
    items,
  };
}

export function createSalesOrderNumber(prefix = "SO", now = Date.now()): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${now.toString(36).toUpperCase()}-${suffix}`;
}
