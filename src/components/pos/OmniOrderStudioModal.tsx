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

import React, { useState, useMemo } from "react";
import OmniOrderEngine, {
  OmniOrder,
  OrderStatus,
  OrderChannel,
  FulfilmentMode,
  CollectionSlot,
} from "../../utils/omniOrderEngine";

interface OmniOrderStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const CHANNEL_ICONS: Record<OrderChannel, string> = {
  POS: "point_of_sale", WEBSITE: "language", MOBILE_APP: "smartphone",
  WHATSAPP: "chat", PHONE: "phone",
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  PLACED:                "text-blue-300 bg-blue-500/20 border-blue-500/30",
  CONFIRMED:             "text-sky-300 bg-sky-500/20 border-sky-500/30",
  SLOT_RESERVED:         "text-violet-300 bg-violet-500/20 border-violet-500/30",
  PICKING:               "text-amber-300 bg-amber-500/20 border-amber-500/30",
  READY_FOR_PICKUP:      "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  DISPATCHED:            "text-teal-300 bg-teal-500/20 border-teal-500/30",
  DELIVERED:             "text-green-300 bg-green-600/20 border-green-500/30",
  CANCELLED:             "text-rose-300 bg-rose-500/20 border-rose-500/30",
  RETURNED:              "text-slate-400 bg-slate-700/30 border-slate-600/30",
};

const NEXT_ACTIONS: Partial<Record<OrderStatus, { label: string; next: OrderStatus; color: string }>> = {
  PLACED:           { label: "Confirm Order",       next: "CONFIRMED",        color: "bg-sky-600 hover:bg-sky-500" },
  CONFIRMED:        { label: "Start Picking",        next: "PICKING",          color: "bg-amber-600 hover:bg-amber-500" },
  SLOT_RESERVED:    { label: "Start Picking",        next: "PICKING",          color: "bg-amber-600 hover:bg-amber-500" },
  PICKING:          { label: "Mark Ready",           next: "READY_FOR_PICKUP", color: "bg-emerald-600 hover:bg-emerald-500" },
  READY_FOR_PICKUP: { label: "Dispatch / Hand Off",  next: "DISPATCHED",       color: "bg-teal-600 hover:bg-teal-500" },
  DISPATCHED:       { label: "Mark Delivered",       next: "DELIVERED",        color: "bg-green-600 hover:bg-green-500" },
};

const SAMPLE_SLOT: CollectionSlot = {
  slotId: "SLOT-MUM-11AM",
  date: "2026-08-28",
  startTime: "11:00",
  endTime: "12:00",
  branchCode: "BR-MUM-01",
  capacity: 10,
  booked: 4,
};

function makeSampleOrders(): OmniOrder[] {
  const o1 = OmniOrderEngine.placeOrder({
    channel: "WEBSITE", fulfilmentMode: "BOPIS",
    customerName: "Ravi Sharma", customerPhone: "9876543210", branchCode: "BR-MUM-01",
    lines: [
      { sku: "APP-POLO-NAVY-M", productName: "Polo Shirt Navy M", qty: 2, unitPrice: 1200 },
      { sku: "DNM-SLIM-BLK-32", productName: "Slim Denim Black 32", qty: 1, unitPrice: 1999 },
    ],
    placedBy: "WEB-CHECKOUT",
  });

  const o2 = (() => {
    let o = OmniOrderEngine.placeOrder({
      channel: "MOBILE_APP", fulfilmentMode: "HOME_DELIVERY",
      customerName: "Priya Nair", customerPhone: "9123456789", branchCode: "BR-MUM-01",
      lines: [{ sku: "FTW-SNEAKER-WHT-8", productName: "Sneakers White 8", qty: 1, unitPrice: 2800 }],
      placedBy: "APP-CHECKOUT",
    });
    o = OmniOrderEngine.transition(o, "CONFIRMED", "OPR-001");
    o = OmniOrderEngine.transition(o, "PICKING", "PICKER-01");
    return o;
  })();

  const o3 = (() => {
    let o = OmniOrderEngine.placeOrder({
      channel: "POS", fulfilmentMode: "BOPIS",
      customerName: "Arjun Mehta", customerPhone: "9988776655", branchCode: "BR-MUM-01",
      lines: [{ sku: "FRM-SHIRT-BLU-M", productName: "Formal Shirt Blue M", qty: 1, unitPrice: 1499 }],
      placedBy: "POS-TERMINAL-01",
    });
    o = OmniOrderEngine.transition(o, "CONFIRMED", "OPR-001");
    const res = OmniOrderEngine.reserveSlot(o, SAMPLE_SLOT, "BOPIS-SYS");
    return "error" in res ? o : res.order;
  })();

  return [o1, o2, o3];
}

export const OmniOrderStudioModal: React.FC<OmniOrderStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [orders, setOrders] = useState<OmniOrder[]>(makeSampleOrders);
  const [selectedId, setSelectedId] = useState<string>(orders[0]?.orderId ?? "");
  const [activeTab, setActiveTab] = useState<"QUEUE" | "METRICS">("QUEUE");

  const selected = orders.find((o) => o.orderId === selectedId);
  const metrics = useMemo(() => OmniOrderEngine.computeMetrics(orders, [SAMPLE_SLOT]), [orders]);

  if (!isOpen) return null;

  const handleTransition = (order: OmniOrder, next: OrderStatus) => {
    const updated = OmniOrderEngine.transition(order, next, "OPR-CONSOLE");
    setOrders((prev) => prev.map((o) => o.orderId === order.orderId ? updated : o));
    onNotification?.("Status Updated", `${order.orderId} → ${next}`, "success");
  };

  const FULFILMENT_ICON: Record<FulfilmentMode, string> = {
    BOPIS: "store", HOME_DELIVERY: "local_shipping", CURBSIDE: "directions_car", SHIP_FROM_STORE: "inventory",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <span className="material-symbols-outlined text-2xl">shopping_bag</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Omnichannel Order Management & Click-and-Collect Studio</h2>
              <p className="text-xs text-slate-400">POS · Web · App · WhatsApp — Unified Order Pool · BOPIS · Slot Reservation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["QUEUE", "METRICS"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {activeTab === "QUEUE" ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Order list */}
            <div className="w-64 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Order Queue ({orders.length})</p>
              {orders.map((o) => {
                const sc = STATUS_STYLE[o.status];
                return (
                  <button key={o.orderId} onClick={() => setSelectedId(o.orderId)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === o.orderId ? "bg-blue-950/20 border-blue-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-sm">{CHANNEL_ICONS[o.channel]}</span>
                      <span className="text-xs font-bold text-slate-200 font-mono truncate">{o.orderId}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{o.customerName} · ₹{o.orderTotal.toLocaleString("en-IN")}</div>
                    <span className={`inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${sc}`}>{o.status}</span>
                  </button>
                );
              })}
            </div>

            {/* Order detail */}
            {selected && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-100 font-mono">{selected.orderId}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="material-symbols-outlined text-slate-400 text-sm">{CHANNEL_ICONS[selected.channel]}</span>
                      <span className="text-xs text-slate-400">{selected.channel} · {selected.fulfilmentMode}</span>
                      <span className="material-symbols-outlined text-slate-400 text-sm">{FULFILMENT_ICON[selected.fulfilmentMode]}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                    {NEXT_ACTIONS[selected.status] && (
                      <button onClick={() => handleTransition(selected, NEXT_ACTIONS[selected.status]!.next)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg ${NEXT_ACTIONS[selected.status]!.color}`}>
                        {NEXT_ACTIONS[selected.status]!.label}
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer & Pickup Token */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Customer</p>
                    <p className="text-sm font-bold text-slate-200">{selected.customerName}</p>
                    <p className="text-xs text-slate-400 font-mono">{selected.customerPhone}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{selected.branchCode}</p>
                  </div>
                  {selected.pickupToken && (
                    <div className="bg-violet-950/20 border border-violet-500/30 rounded-xl p-4 text-center">
                      <p className="text-[10px] text-violet-400 uppercase tracking-wide mb-1">Pickup Token</p>
                      <p className="text-3xl font-black font-mono tracking-widest text-violet-300">{selected.pickupToken}</p>
                      {selected.slotId && <p className="text-[10px] text-slate-400 mt-1">Slot: {selected.slotId}</p>}
                    </div>
                  )}
                </div>

                {/* Lines */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Order Lines</p>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                        <th className="py-2 px-3">Product</th><th className="py-2 px-3 text-right">Qty</th><th className="py-2 px-3 text-right">Unit</th><th className="py-2 px-3 text-right">Total</th><th className="py-2 px-3 text-center">Picked</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selected.lines.map((line) => (
                          <tr key={line.lineId}>
                            <td className="py-2 px-3"><div className="text-slate-200 font-sans font-medium">{line.productName}</div><div className="text-[10px] text-slate-500">{line.sku}</div></td>
                            <td className="py-2 px-3 text-right text-slate-300">{line.qty}</td>
                            <td className="py-2 px-3 text-right text-slate-400">₹{line.unitPrice}</td>
                            <td className="py-2 px-3 text-right text-amber-400 font-bold">₹{line.lineTotal.toLocaleString("en-IN")}</td>
                            <td className="py-2 px-3 text-center">
                              {line.pickedQty !== undefined
                                ? <span className="text-emerald-400 font-bold">{line.pickedQty}/{line.qty} ?</span>
                                : <span className="text-slate-600">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="border-t border-slate-800 px-3 py-2 flex justify-end">
                      <span className="text-sm font-black text-slate-100 font-mono">₹{selected.orderTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {/* Audit Log */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Audit Trail</p>
                  <div className="space-y-2">
                    {[...selected.auditLog].reverse().map((e) => (
                      <div key={e.entryId} className="flex items-start gap-3 p-3 bg-slate-800/30 border border-slate-800/60 rounded-xl text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[e.toStatus]}`}>{e.toStatus}</span>
                            <span className="text-slate-500 text-[10px] ml-auto font-mono">{new Date(e.timestamp).toLocaleTimeString("en-IN")}</span>
                          </div>
                          {e.note && <p className="text-slate-400 mt-1">{e.note} <span className="text-slate-600">— {e.performedBy}</span></p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ?? METRICS ????????????????????????????????????????????????????? */
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Orders", value: metrics.totalOrders, color: "text-slate-300" },
                { label: "Avg Fulfilment", value: `${metrics.avgFulfilmentMinutes}m`, color: "text-amber-400" },
                { label: "Slot Utilisation", value: `${metrics.slotsUtilisationPct}%`, color: "text-violet-400" },
                { label: "Cancellation Rate", value: `${metrics.cancellationRate}%`, color: metrics.cancellationRate > 10 ? "text-rose-400" : "text-emerald-400" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-black font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-slate-400 mb-3">Orders by Channel</p>
                {Object.entries(metrics.byChannel ?? {}).map(([ch, cnt]) => (
                  <div key={ch} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/40 last:border-0">
                    <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-slate-400">{CHANNEL_ICONS[ch as OrderChannel]}</span><span className="text-slate-300">{ch}</span></div>
                    <span className="font-bold font-mono text-blue-400">{cnt}</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-slate-400 mb-3">Orders by Fulfilment Mode</p>
                {Object.entries(metrics.byFulfilmentMode ?? {}).map(([mode, cnt]) => (
                  <div key={mode} className="flex justify-between text-xs text-slate-300 py-1.5 border-b border-slate-800/40 last:border-0">
                    <span className="text-slate-400">{mode}</span>
                    <span className="font-bold font-mono text-teal-400">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default OmniOrderStudioModal;

