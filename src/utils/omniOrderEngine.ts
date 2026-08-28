/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.93.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type OrderChannel = "POS" | "WEBSITE" | "MOBILE_APP" | "WHATSAPP" | "PHONE";
export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "SLOT_RESERVED"
  | "PICKING"
  | "READY_FOR_PICKUP"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";
export type FulfilmentMode = "BOPIS" | "HOME_DELIVERY" | "CURBSIDE" | "SHIP_FROM_STORE";

export interface CollectionSlot {
  slotId: string;
  date: string;           // ISO date "YYYY-MM-DD"
  startTime: string;      // "HH:MM"
  endTime: string;        // "HH:MM"
  branchCode: string;
  capacity: number;       // Max orders per slot
  booked: number;         // Current bookings
}

export interface OmniOrderLine {
  lineId: string;
  sku: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  pickedQty?: number;
  pickedAt?: string;
}

export interface OmniOrder {
  orderId: string;
  channel: OrderChannel;
  fulfilmentMode: FulfilmentMode;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  branchCode: string;
  lines: OmniOrderLine[];
  orderTotal: number;
  status: OrderStatus;
  slotId?: string;
  placedAt: string;
  confirmedAt?: string;
  slotReservedAt?: string;
  pickingStartedAt?: string;
  readyAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  pickupToken?: string;      // 6-digit OTP for customer pickup verification
  auditLog: OmniOrderAuditEntry[];
}

export interface OmniOrderAuditEntry {
  entryId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  performedBy: string;
  channel: string;
  timestamp: string;
  note?: string;
}

export interface ClickCollectMetrics {
  totalOrders: number;
  byChannel: Record<OrderChannel, number>;
  byFulfilmentMode: Record<FulfilmentMode, number>;
  byStatus: Record<OrderStatus, number>;
  avgFulfilmentMinutes: number;
  slotsUtilisationPct: number;
  cancellationRate: number;
}

export class OmniOrderEngine {
  /** Generate a 6-digit pickup OTP */
  private static generatePickupToken(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** Create a new omni-channel order */
  public static placeOrder(params: {
    channel: OrderChannel;
    fulfilmentMode: FulfilmentMode;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    branchCode: string;
    lines: Omit<OmniOrderLine, "lineId" | "lineTotal">[];
    placedBy: string;
  }): OmniOrder {
    const now = new Date().toISOString();
    const orderId = `OMO-${Date.now().toString().slice(-9)}`;

    const lines: OmniOrderLine[] = params.lines.map((l, i) => ({
      ...l,
      lineId: `LINE-${i + 1}`,
      lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100,
    }));
    const orderTotal = lines.reduce((s, l) => s + l.lineTotal, 0);

    const entry: OmniOrderAuditEntry = {
      entryId: `AUD-${Date.now()}`,
      fromStatus: "PLACED",
      toStatus: "PLACED",
      performedBy: params.placedBy,
      channel: params.channel,
      timestamp: now,
      note: `Order placed via ${params.channel}`,
    };

    return {
      orderId,
      channel: params.channel,
      fulfilmentMode: params.fulfilmentMode,
      customerId: params.customerId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      branchCode: params.branchCode,
      lines,
      orderTotal,
      status: "PLACED",
      placedAt: now,
      auditLog: [entry],
    };
  }

  /** Transition order to a new status with audit entry */
  public static transition(
    order: OmniOrder,
    newStatus: OrderStatus,
    performedBy: string,
    note?: string
  ): OmniOrder {
    const now = new Date().toISOString();
    const entry: OmniOrderAuditEntry = {
      entryId: `AUD-${Date.now()}`,
      fromStatus: order.status,
      toStatus: newStatus,
      performedBy,
      channel: "SYSTEM",
      timestamp: now,
      note,
    };

    const updated: OmniOrder = {
      ...order,
      status: newStatus,
      auditLog: [...order.auditLog, entry],
    };

    if (newStatus === "CONFIRMED") updated.confirmedAt = now;
    if (newStatus === "SLOT_RESERVED") { updated.slotReservedAt = now; updated.pickupToken = this.generatePickupToken(); }
    if (newStatus === "PICKING") updated.pickingStartedAt = now;
    if (newStatus === "READY_FOR_PICKUP") updated.readyAt = now;
    if (newStatus === "DISPATCHED") updated.dispatchedAt = now;
    if (newStatus === "DELIVERED") updated.deliveredAt = now;
    if (newStatus === "CANCELLED") { updated.cancelledAt = now; updated.cancelReason = note; }

    return updated;
  }

  /** Reserve a slot for a BOPIS/CURBSIDE order */
  public static reserveSlot(
    order: OmniOrder,
    slot: CollectionSlot,
    performedBy: string
  ): { order: OmniOrder; slot: CollectionSlot } | { error: string } {
    if (slot.booked >= slot.capacity) return { error: "Slot is fully booked" };
    if (slot.branchCode !== order.branchCode) return { error: "Slot branch mismatch" };

    const updatedSlot: CollectionSlot = { ...slot, booked: slot.booked + 1 };
    const updatedOrder = this.transition({ ...order, slotId: slot.slotId }, "SLOT_RESERVED", performedBy, `Slot ${slot.slotId} reserved for ${slot.date} ${slot.startTime}–${slot.endTime}`);

    return { order: updatedOrder, slot: updatedSlot };
  }

  /** Record picked qty for a line item */
  public static recordPick(
    order: OmniOrder,
    lineId: string,
    pickedQty: number,
    pickedBy: string
  ): OmniOrder {
    const now = new Date().toISOString();
    const updatedLines = order.lines.map((l) =>
      l.lineId === lineId ? { ...l, pickedQty, pickedAt: now } : l
    );
    const allPicked = updatedLines.every((l) => (l.pickedQty ?? 0) >= l.qty);

    const updated: OmniOrder = { ...order, lines: updatedLines };
    return allPicked ? this.transition(updated, "READY_FOR_PICKUP", pickedBy, "All lines picked — order ready") : updated;
  }

  /** Compute metrics across a set of orders */
  public static computeMetrics(orders: OmniOrder[], slots: CollectionSlot[]): ClickCollectMetrics {
    const byChannel: Record<string, number> = {};
    const byFulfilmentMode: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalFulfilmentMs = 0;
    let fulfilledCount = 0;
    let cancelled = 0;

    for (const o of orders) {
      byChannel[o.channel] = (byChannel[o.channel] ?? 0) + 1;
      byFulfilmentMode[o.fulfilmentMode] = (byFulfilmentMode[o.fulfilmentMode] ?? 0) + 1;
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      if (o.status === "CANCELLED") cancelled++;
      if ((o.status === "DELIVERED" || o.status === "READY_FOR_PICKUP") && o.readyAt) {
        totalFulfilmentMs += new Date(o.readyAt).getTime() - new Date(o.placedAt).getTime();
        fulfilledCount++;
      }
    }

    const totalSlotCapacity = slots.reduce((s, sl) => s + sl.capacity, 0);
    const totalSlotBooked = slots.reduce((s, sl) => s + sl.booked, 0);

    return {
      totalOrders: orders.length,
      byChannel: byChannel as Record<OrderChannel, number>,
      byFulfilmentMode: byFulfilmentMode as Record<FulfilmentMode, number>,
      byStatus: byStatus as Record<OrderStatus, number>,
      avgFulfilmentMinutes: fulfilledCount > 0 ? Math.round(totalFulfilmentMs / fulfilledCount / 60000) : 0,
      slotsUtilisationPct: totalSlotCapacity > 0 ? Math.round((totalSlotBooked / totalSlotCapacity) * 100) : 0,
      cancellationRate: orders.length > 0 ? Math.round((cancelled / orders.length) * 100) : 0,
    };
  }
}

export default OmniOrderEngine;
