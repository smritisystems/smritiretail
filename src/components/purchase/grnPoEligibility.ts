/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.34.0
 * Created      : 2026-09-21
 * Modified     : 2026-09-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_PO_ELIGIBILITY")
 * Target UI    : SMRITI GRN Studio — Actionable PO Inward Eligibility & Supplier Scoping Engine
 */

export interface PoItemLike {
  id?: string;
  product_id?: string;
  item_id?: string;
  code?: string;
  name?: string;
  description?: string;
  quantity?: number;
  cost_price?: number;
  unit_price?: number;
  gst_rate?: number;
  mrp?: number;
}

export interface PurchaseOrderLike {
  id: string;
  order_no?: string;
  order_number?: string;
  supplier_id: string;
  supplier_name?: string;
  status: string;
  subtotal?: number;
  grand_total?: number;
  total_amount?: number;
  items?: PoItemLike[];
  created_at?: string;
}

export interface ReceiptItemLike {
  product_id?: string;
  item_id?: string;
  code?: string;
  quantity_received?: number;
  cost_price?: number;
}

export interface ReceiptLike {
  id?: string;
  receipt_no?: string;
  order_id?: string;
  status?: string;
  is_deleted?: boolean;
  items?: ReceiptItemLike[];
}

export interface PoPendingInwardMetrics {
  order_id: string;
  order_no: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  ordered_items_count: number;
  ordered_quantity: number;
  pending_items_count: number;
  pending_quantity: number;
  pending_value: number;
  original_value: number;
  is_eligible: boolean;
  ineligibility_reason?: string;
  raw_order: PurchaseOrderLike;
}

const INWARD_ELIGIBLE_STATUSES = new Set([
  "CONFIRMED",
  "APPROVED",
  "OPEN",
  "PARTIALLY_RECEIVED",
  "ISSUED",
  "Confirmed",
  "Approved",
  "Open",
  "Partially_Received",
  "Partially Received",
  "Issued",
]);

const INWARD_BLOCKED_STATUSES = new Set([
  "RECEIVED",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
  "DRAFT",
  "REJECTED",
  "Received",
  "Completed",
  "Closed",
  "Cancelled",
  "Draft",
  "Rejected",
]);

/**
 * Calculates line-level and aggregate pending quantities and values for a Purchase Order
 * against prior inward receipts.
 */
export function calculatePoPendingInward(
  order: PurchaseOrderLike,
  receipts: ReceiptLike[] = []
): PoPendingInwardMetrics {
  const orderId = order.id;
  const orderNo = order.order_no || order.order_number || order.id;
  const supplierId = order.supplier_id || "";
  const supplierName = order.supplier_name || order.supplier_id || "Unknown Supplier";
  const status = String(order.status || "CONFIRMED").trim();

  const originalValue = Number(order.grand_total ?? order.total_amount ?? order.subtotal ?? 0);
  const items = Array.isArray(order.items) ? order.items : [];

  // Check status eligibility
  const isStatusBlocked = INWARD_BLOCKED_STATUSES.has(status);
  const isStatusAllowed = INWARD_ELIGIBLE_STATUSES.has(status) && !isStatusBlocked;

  // Aggregate previously received quantities for this PO across all prior receipts
  const priorInwardMap = new Map<string, number>();

  receipts
    .filter((r) => {
      if (!r || r.is_deleted) return false;
      const rOrderId = r.order_id;
      return (
        rOrderId === orderId ||
        rOrderId === orderNo ||
        (r.receipt_no && rOrderId === order.order_no)
      );
    })
    .forEach((r) => {
      (r.items || []).forEach((it) => {
        const key = (it.code || it.product_id || it.item_id || "").trim().toLowerCase();
        if (key) {
          const prev = priorInwardMap.get(key) || 0;
          priorInwardMap.set(key, prev + Math.max(0, Number(it.quantity_received || 0)));
        }
      });
    });

  let orderedQtyTotal = 0;
  let pendingQtyTotal = 0;
  let pendingValueTotal = 0;
  let pendingItemsCount = 0;

  items.forEach((item) => {
    const qtyOrdered = Math.max(0, Number(item.quantity || 0));
    const rate = Math.max(0, Number(item.cost_price ?? item.unit_price ?? 0));
    orderedQtyTotal += qtyOrdered;

    const key = (item.code || item.product_id || item.item_id || "").trim().toLowerCase();
    const previouslyReceived = key ? priorInwardMap.get(key) || 0 : 0;

    const linePendingQty = Math.max(0, qtyOrdered - previouslyReceived);
    if (linePendingQty > 0) {
      pendingItemsCount += 1;
      pendingQtyTotal += linePendingQty;
      pendingValueTotal += linePendingQty * rate;
    }
  });

  // Fallback if items array was not eagerly loaded from DB but grand_total exists and status is open
  if (items.length === 0) {
    return {
      order_id: orderId,
      order_no: orderNo,
      supplier_id: supplierId,
      supplier_name: supplierName,
      status,
      ordered_items_count: 0,
      ordered_quantity: 0,
      pending_items_count: 0,
      pending_quantity: 0,
      pending_value: 0,
      original_value: originalValue,
      is_eligible: false,
      ineligibility_reason: "PO has zero line items in database.",
      raw_order: order,
    };
  }

  let ineligibilityReason: string | undefined;
  if (!isStatusAllowed) {
    ineligibilityReason = `PO status '${status}' is not eligible for inward (already received, completed or cancelled).`;
  } else if (pendingItemsCount === 0 || pendingQtyTotal <= 0) {
    ineligibilityReason = "All line items on this PO have already been fully inwarded.";
  }

  const isEligible = isStatusAllowed && pendingItemsCount > 0 && pendingQtyTotal > 0;

  return {
    order_id: orderId,
    order_no: orderNo,
    supplier_id: supplierId,
    supplier_name: supplierName,
    status,
    ordered_items_count: items.length,
    ordered_quantity: orderedQtyTotal,
    pending_items_count: pendingItemsCount,
    pending_quantity: pendingQtyTotal,
    pending_value: Math.round(pendingValueTotal * 100) / 100,
    original_value: originalValue,
    is_eligible: isEligible,
    ineligibility_reason: ineligibilityReason,
    raw_order: order,
  };
}

/**
 * Filters a list of Purchase Orders to only those that are:
 * 1. Supplier-scoped (if selectedSupplierId is specified and not empty)
 * 2. Inward-eligible (status allows inward, has line items, and pending quantity > 0)
 */
export function filterEligibleOrders(
  orders: PurchaseOrderLike[] = [],
  selectedSupplierId?: string | null,
  receipts: ReceiptLike[] = []
): PoPendingInwardMetrics[] {
  const normSupplier = (selectedSupplierId || "").trim();
  const hasSupplierFilter = normSupplier.length > 0 && normSupplier !== "-- Select Supplier --";

  const results: PoPendingInwardMetrics[] = [];

  for (const o of orders) {
    if (hasSupplierFilter && o.supplier_id !== normSupplier) {
      continue;
    }

    const metrics = calculatePoPendingInward(o, receipts);
    if (metrics.is_eligible) {
      results.push(metrics);
    }
  }

  return results;
}
