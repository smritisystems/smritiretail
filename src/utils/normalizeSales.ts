/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-26
 * Modified     : 2026-08-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { SalesOrder, SalesItemLine, SalesOrderInvoiceAllocation, Quotation } from "../types";
import { safeNumber } from "./formatters";

/**
 * Safely normalizes a Sales Order Item line, ensuring both camelCase and snake_case properties
 * and finite numeric values for arithmetic operations.
 */
export function normalizeSalesOrderItem(item: any, idx = 1): SalesItemLine {
  if (!item || typeof item !== "object") {
    return {
      productId: "",
      product_id: "",
      code: "ITEM",
      name: "Unknown Item",
      quantity: 1,
      price: 0,
      taxRate: 0,
      gstRate: 0,
      taxAmount: 0,
      totalAmount: 0,
      srNo: idx,
      sr_no: idx,
    };
  }

  const pid = String(item.productId || item.product_id || "");
  const qty = safeNumber(item.quantity, 1);
  const price = safeNumber(item.price, 0);
  const gstRate = safeNumber(item.gstRate ?? item.gst_rate ?? item.taxRate, 18);
  const taxAmt = safeNumber(item.taxAmount ?? item.tax_amount, 0);
  const totAmt = safeNumber(item.totalAmount ?? item.total_amount, qty * price + taxAmt);
  const srNo = safeNumber(item.srNo ?? item.sr_no, idx);

  return {
    ...item,
    productId: pid,
    product_id: pid,
    code: String(item.code || "ITEM"),
    name: String(item.name || "Unknown Item"),
    color: item.color ? String(item.color) : undefined,
    size: item.size ? String(item.size) : undefined,
    quantity: qty,
    price: price,
    taxRate: gstRate,
    gstRate: gstRate,
    gst_rate: gstRate,
    taxAmount: taxAmt,
    tax_amount: taxAmt,
    totalAmount: totAmt,
    total_amount: totAmt,

    // Extended PO fields
    srNo: srNo,
    sr_no: srNo,
    articleNo: item.articleNo || item.article_no,
    article_no: item.article_no || item.articleNo,
    ean: item.ean || item.barcode,
    barcode: item.barcode || item.ean,
    vendorStyle: item.vendorStyle || item.vendor_style,
    vendor_style: item.vendor_style || item.vendorStyle,
    uom: String(item.uom || "EA"),
    mrp: item.mrp != null ? safeNumber(item.mrp, 0) : undefined,
    baseCost: item.baseCost != null || item.base_cost != null ? safeNumber(item.baseCost ?? item.base_cost, 0) : undefined,
    base_cost: item.base_cost != null || item.baseCost != null ? safeNumber(item.base_cost ?? item.baseCost, 0) : undefined,
    taxableValue: safeNumber(item.taxableValue ?? item.taxable_value, qty * price),
    taxable_value: safeNumber(item.taxable_value ?? item.taxableValue, qty * price),
    igstAmount: safeNumber(item.igstAmount ?? item.igst_amount, 0),
    igst_amount: safeNumber(item.igst_amount ?? item.igstAmount, 0),
    cgstAmount: safeNumber(item.cgstAmount ?? item.cgst_amount, 0),
    cgst_amount: safeNumber(item.cgst_amount ?? item.cgstAmount, 0),
    sgstAmount: safeNumber(item.sgstAmount ?? item.sgst_amount, 0),
    sgst_amount: safeNumber(item.sgst_amount ?? item.sgstAmount, 0),
    lineTotal: safeNumber(item.lineTotal ?? item.line_total, totAmt),
    line_total: safeNumber(item.line_total ?? item.lineTotal, totAmt),
    deliveryDate: item.deliveryDate || item.delivery_date,
    delivery_date: item.delivery_date || item.deliveryDate,
    siteCode: item.siteCode || item.site_code,
    site_code: item.site_code || item.siteCode,
  };
}

/**
 * Safely normalizes an Invoice Allocation record.
 */
export function normalizeSalesOrderAllocation(alloc: any): SalesOrderInvoiceAllocation {
  if (!alloc || typeof alloc !== "object") {
    return {
      id: "",
      orderId: "",
      orderNo: "",
      poNumber: "",
      invoiceId: "",
      invoiceNo: "",
      invoiceDate: "",
      poQuantity: 0,
      poValue: 0,
      billedQuantity: 0,
      billedValue: 0,
      pendingQuantity: 0,
      pendingValue: 0,
      status: "ALLOCATED",
    };
  }

  const oid = String(alloc.orderId || alloc.order_id || "");
  const ono = String(alloc.orderNo || alloc.order_no || "");
  const pno = String(alloc.poNumber || alloc.po_number || "");
  const iid = String(alloc.invoiceId || alloc.invoice_id || "");
  const ino = String(alloc.invoiceNo || alloc.invoice_no || "");
  const idt = String(alloc.invoiceDate || alloc.invoice_date || "");

  const poQty = safeNumber(alloc.poQuantity ?? alloc.po_quantity, 0);
  const poVal = safeNumber(alloc.poValue ?? alloc.po_value, 0);
  const bQty = safeNumber(alloc.billedQuantity ?? alloc.billed_quantity, 0);
  const bVal = safeNumber(alloc.billedValue ?? alloc.billed_value, 0);
  const pQty = safeNumber(alloc.pendingQuantity ?? alloc.pending_quantity, Math.max(0, poQty - bQty));
  const pVal = safeNumber(alloc.pendingValue ?? alloc.pending_value, Math.max(0, poVal - bVal));

  return {
    ...alloc,
    id: String(alloc.id || ""),
    orderId: oid,
    order_id: oid,
    orderNo: ono,
    order_no: ono,
    poNumber: pno,
    po_number: pno,
    invoiceId: iid,
    invoice_id: iid,
    invoiceNo: ino,
    invoice_no: ino,
    invoiceDate: idt,
    invoice_date: idt,
    poQuantity: poQty,
    po_quantity: poQty,
    poValue: poVal,
    po_value: poVal,
    billedQuantity: bQty,
    billed_quantity: bQty,
    billedValue: bVal,
    billed_value: bVal,
    pendingQuantity: pQty,
    pending_quantity: pQty,
    pendingValue: pVal,
    pending_value: pVal,
    status: String(alloc.status || "ALLOCATED"),
    allocationMetadata: alloc.allocationMetadata || alloc.allocation_metadata || {},
    allocation_metadata: alloc.allocation_metadata || alloc.allocationMetadata || {},
  };
}

/**
 * Normalizes a single SalesOrder response object from FastAPI/Express.
 */
export function normalizeSalesOrder(so: any): SalesOrder {
  if (!so || typeof so !== "object") {
    return {
      id: "",
      orderNo: "SO",
      order_no: "SO",
      date: new Date().toISOString().split("T")[0],
      customerName: "",
      customer_name: "",
      items: [],
      taxTotal: 0,
      tax_total: 0,
      grandTotal: 0,
      grand_total: 0,
      status: "Draft",
    };
  }

  const orderNo = String(so.orderNo || so.order_no || "SO");
  const customerName = String(so.customerName || so.customer_name || "");
  const rawItems = Array.isArray(so.items) ? so.items : [];
  const normalizedItems = rawItems.map((it: any, idx: number) => normalizeSalesOrderItem(it, idx + 1));

  const taxTotal = safeNumber(so.taxTotal ?? so.tax_total, 0);
  const grandTotal = safeNumber(so.grandTotal ?? so.grand_total, 0);
  const totalQty = safeNumber(so.totalQty ?? so.total_qty, normalizedItems.reduce((acc: number, it: SalesItemLine) => acc + it.quantity, 0));
  const billedQty = safeNumber(so.billedQty ?? so.billed_qty, 0);
  const billedValue = safeNumber(so.billedValue ?? so.billed_value, 0);
  const pendingQty = safeNumber(so.pendingQty ?? so.pending_qty, Math.max(0, totalQty - billedQty));
  const pendingValue = safeNumber(so.pendingValue ?? so.pending_value, Math.max(0, grandTotal - billedValue));
  const rawAllocations = Array.isArray(so.allocations) ? so.allocations : [];

  return {
    ...so,
    id: String(so.id || ""),
    orderNo: orderNo,
    order_no: orderNo,
    date: String(so.date || ""),
    customerName: customerName,
    customer_name: customerName,
    taxTotal: taxTotal,
    tax_total: taxTotal,
    grandTotal: grandTotal,
    grand_total: grandTotal,
    status: String(so.status || "Draft"),
    sourceQuotationId: so.sourceQuotationId || so.source_quotation_id,
    source_quotation_id: so.source_quotation_id || so.sourceQuotationId,

    // Extended PO fields
    poNumber: so.poNumber || so.po_number,
    po_number: so.po_number || so.poNumber,
    poDate: so.poDate || so.po_date,
    po_date: so.po_date || so.poDate,
    deliveryDate: so.deliveryDate || so.delivery_date,
    delivery_date: so.delivery_date || so.deliveryDate,
    siteCode: so.siteCode || so.site_code,
    site_code: so.site_code || so.siteCode,
    siteName: so.siteName || so.site_name,
    site_name: so.site_name || so.siteName,
    deliveryAddress: so.deliveryAddress || so.delivery_address,
    delivery_address: so.delivery_address || so.deliveryAddress,
    vendorCode: so.vendorCode || so.vendor_code,
    vendor_code: so.vendor_code || so.vendorCode,
    customerId: so.customerId || so.customer_id,
    customer_id: so.customer_id || so.customerId,
    customerGstin: so.customerGstin || so.customer_gstin,
    customer_gstin: so.customer_gstin || so.customerGstin,
    basicTotal: safeNumber(so.basicTotal ?? so.basic_total, 0),
    basic_total: safeNumber(so.basic_total ?? so.basicTotal, 0),
    isInterstate: so.isInterstate ?? so.is_interstate ?? true,
    is_interstate: so.is_interstate ?? so.isInterstate ?? true,
    totalQty: totalQty,
    total_qty: totalQty,
    billedQty: billedQty,
    billed_qty: billedQty,
    billedValue: billedValue,
    billed_value: billedValue,
    pendingQty: pendingQty,
    pending_qty: pendingQty,
    pendingValue: pendingValue,
    pending_value: pendingValue,
    fulfillmentStatus: String(so.fulfillmentStatus || so.fulfillment_status || "UNFULFILLED"),
    fulfillment_status: String(so.fulfillment_status || so.fulfillmentStatus || "UNFULFILLED"),
    poMetadata: so.poMetadata || so.po_metadata || {},
    po_metadata: so.po_metadata || so.poMetadata || {},

    items: normalizedItems,
    allocations: rawAllocations.map(normalizeSalesOrderAllocation),
  };
}

/**
 * Normalizes an array of SalesOrder responses safely handling null/non-array input.
 */
export function normalizeSalesOrders(data: unknown): SalesOrder[] {
  if (!data) return [];
  if (!Array.isArray(data)) return [];
  return data.map(normalizeSalesOrder);
}

/**
 * Normalizes a single Quotation.
 */
export function normalizeQuotation(q: any): Quotation {
  if (!q || typeof q !== "object") {
    return {
      id: "",
      quotationNo: "QT",
      date: new Date().toISOString().split("T")[0],
      customerName: "",
      items: [],
      taxTotal: 0,
      grandTotal: 0,
      status: "Draft",
    };
  }

  const qNo = String(q.quotationNo || q.quotation_no || "QT");
  const cName = String(q.customerName || q.customer_name || "");
  const rawItems = Array.isArray(q.items) ? q.items : [];
  const normalizedItems = rawItems.map((it: any, idx: number) => normalizeSalesOrderItem(it, idx + 1));
  const taxTotal = safeNumber(q.taxTotal ?? q.tax_total, 0);
  const grandTotal = safeNumber(q.grandTotal ?? q.grand_total, 0);

  return {
    ...q,
    id: String(q.id || ""),
    quotationNo: qNo,
    quotation_no: qNo,
    date: String(q.date || ""),
    customerName: cName,
    customer_name: cName,
    items: normalizedItems,
    taxTotal: taxTotal,
    tax_total: taxTotal,
    grandTotal: grandTotal,
    grand_total: grandTotal,
    status: q.status || "Draft",
    salesOrderId: q.salesOrderId || q.sales_order_id,
    sales_order_id: q.sales_order_id || q.salesOrderId,
  };
}

export function normalizeQuotations(data: unknown): Quotation[] {
  if (!data || !Array.isArray(data)) return [];
  return data.map(normalizeQuotation);
}
