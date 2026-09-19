/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-18
 * Modified     : 2026-09-18
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_RECEIPT")
 * Target UI    : GRN / Material Receipt & Purchase Bill Entry - Go-Live Remediation Phase 3
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  PackageCheck,
  RefreshCw,
  Save,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  ChevronDown,
  Receipt,
  Plus
} from "lucide-react";
import { CreateDebitNoteModal } from "../CreateDebitNoteDlg.tsx";

interface PurchaseOrderOption {
  id: string;
  order_no?: string;
  order_number?: string;
  supplier_id: string;
  supplier_name?: string;
  status: string;
  total_amount?: number;
  items?: PurchaseOrderItemOption[];
}

interface PurchaseOrderItemOption {
  id: string;
  product_id?: string;
  item_id?: string;
  code?: string;
  name?: string;
  description?: string;
  quantity?: number;
  cost_price?: number;
  unit_price?: number;
  gst_rate?: number;
}

interface GrnLineRow {
  rowId: string;
  product_id: string;
  item_id: string;
  code: string;
  name: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_damaged: number;
  cost_price: number;
  gst_rate: number;
}

interface GrnReceiptTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
  onClose?: () => void;
  initialOrderId?: string;
}

export const GrnReceiptTab: React.FC<GrnReceiptTabProps> = ({
  currentUser,
  onNotification,
  onClose,
  initialOrderId,
}) => {
  const [orders, setOrders] = useState<PurchaseOrderOption[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderOption | null>(null);
  const [grnLines, setGrnLines] = useState<GrnLineRow[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [savedReceipts, setSavedReceipts] = useState<any[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [subView, setSubView] = useState<"create" | "history" | "bill">("create");

  // Debit Note Modal State
  const [isDebitNoteOpen, setIsDebitNoteOpen] = useState(false);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);

  // Purchase Bill State
  const [selectedReceiptForBill, setSelectedReceiptForBill] = useState<any | null>(null);
  const [vendorBillNo, setVendorBillNo] = useState<string>("");
  const [billSaving, setBillSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await apiFetchV1("/purchase/orders/");
      const list: PurchaseOrderOption[] = Array.isArray(res) ? res : res?.items || [];
      setOrders(list.filter((o) => o.status !== "Cancelled" && o.status !== "CANCELLED"));
    } catch {
      onNotification?.("Load Error", "Could not load purchase orders.", "error");
    } finally {
      setOrdersLoading(false);
    }
  }, [onNotification]);

  const loadReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const res = await apiFetchV1("/purchase/receipts/");
      setSavedReceipts(Array.isArray(res) ? res : res?.items || []);
    } catch {
      setSavedReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await apiFetchV1("/purchase/suppliers/");
      setSuppliersList(Array.isArray(res) ? res : res?.items || []);
    } catch {
      setSuppliersList([]);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadReceipts();
    loadSuppliers();
  }, [loadOrders, loadReceipts, loadSuppliers]);

  useEffect(() => {
    if (initialOrderId && orders.length > 0 && selectedOrderId !== initialOrderId) {
      handleSelectOrder(initialOrderId);
    }
  }, [initialOrderId, orders]);

  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    if (!orderId) {
      setSelectedOrder(null);
      setGrnLines([]);
      return;
    }
    try {
      const order: PurchaseOrderOption = await apiFetchV1(`/purchase/orders/${orderId}`);
      setSelectedOrder(order);
      const lines: GrnLineRow[] = (order.items || []).map((item, idx) => ({
        rowId: `row-${idx}`,
        product_id: item.product_id || item.item_id || item.id || `PROD-${idx + 1}`,
        item_id: item.item_id || item.id || "",
        code: item.code || `SKU-${idx + 1}`,
        name: item.name || item.description || `Item ${idx + 1}`,
        quantity_ordered: Number(item.quantity) || 0,
        quantity_received: Number(item.quantity) || 0,
        quantity_damaged: 0,
        cost_price: Number(item.cost_price || item.unit_price) || 100,
        gst_rate: Number(item.gst_rate) || 18,
      }));
      if (lines.length === 0) {
        lines.push({
          rowId: "row-0",
          product_id: "PROD-GEN",
          item_id: "",
          code: "SKU-GEN",
          name: "General Inward Material",
          quantity_ordered: 1,
          quantity_received: 1,
          quantity_damaged: 0,
          cost_price: 100,
          gst_rate: 18,
        });
      }
      setGrnLines(lines);
    } catch {
      onNotification?.("Load Error", "Could not load order details.", "error");
      setSelectedOrder(null);
      setGrnLines([]);
    }
  };

  const updateLine = (rowId: string, field: keyof GrnLineRow, value: number) => {
    setGrnLines((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row))
    );
  };

  const totalOrdered = grnLines.reduce((s, r) => s + r.quantity_ordered, 0);
  const totalReceived = grnLines.reduce((s, r) => s + r.quantity_received, 0);
  const totalDamaged = grnLines.reduce((s, r) => s + r.quantity_damaged, 0);
  const totalShort = Math.max(0, totalOrdered - totalReceived);

  const handleSubmitGRN = async () => {
    if (!selectedOrder) {
      onNotification?.("No Order Selected", "Select a purchase order first.", "warning");
      return;
    }
    const validLines = grnLines.filter((r) => r.quantity_received > 0);
    if (validLines.length === 0) {
      onNotification?.("Validation Error", "Enter at least one received quantity greater than zero.", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplier_id: selectedOrder.supplier_id,
        order_id: selectedOrderId,
        notes: notes || undefined,
        items: validLines.map((r) => ({
          product_id: r.product_id,
          item_id: r.item_id || undefined,
          code: r.code,
          name: r.name,
          quantity_ordered: r.quantity_ordered,
          quantity_received: r.quantity_received,
          quantity_damaged: r.quantity_damaged,
          cost_price: r.cost_price,
          gst_rate: r.gst_rate,
        })),
      };

      const receipt = await apiFetchV1("/purchase/receipts/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotification?.(
        "GRN Posted Successfully",
        `Receipt ${receipt?.receipt_no || ""} created. Received: ${totalReceived}, Short: ${totalShort}, Damaged: ${totalDamaged}.`,
        "success"
      );

      setSelectedOrderId("");
      setSelectedOrder(null);
      setGrnLines([]);
      setNotes("");
      await loadReceipts();
      setSubView("history");
    } catch (err: any) {
      onNotification?.("GRN Failed", err?.message || "Goods receipt could not be posted. Please retry.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBillFromReceipt = (receipt: any) => {
    setSelectedReceiptForBill(receipt);
    setVendorBillNo(`BILL-${Date.now().toString().slice(-6)}`);
    setSubView("bill");
  };

  const handleSubmitPurchaseBill = async () => {
    if (!selectedReceiptForBill) {
      onNotification?.("No GRN Selected", "Select a goods receipt note first.", "warning");
      return;
    }
    if (!vendorBillNo.trim()) {
      onNotification?.("Validation Error", "Vendor Bill/Invoice number is required.", "warning");
      return;
    }
    setBillSaving(true);
    try {
      const taxable = Number(selectedReceiptForBill.subtotal) || 0;
      const tax = Number(selectedReceiptForBill.tax_total) || 0;
      const total = Number(selectedReceiptForBill.grand_total) || (taxable + tax);

      const payload = {
        bill_no: vendorBillNo.trim(),
        supplier_id: selectedReceiptForBill.supplier_id,
        receipt_id: selectedReceiptForBill.id,
        order_id: selectedReceiptForBill.order_id || undefined,
        taxable_amount: taxable,
        tax_amount: tax,
        total_amount: total,
        notes: `Purchase Bill for GRN ${selectedReceiptForBill.receipt_no}`,
      };

      await apiFetchV1("/purchase/bills/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotification?.(
        "Purchase Bill Posted",
        `Supplier Bill ${vendorBillNo} recorded against GRN ${selectedReceiptForBill.receipt_no}.`,
        "success"
      );

      setSelectedReceiptForBill(null);
      setVendorBillNo("");
      setSubView("history");
    } catch (err: any) {
      onNotification?.("Bill Posting Failed", err?.message || "Unable to post purchase bill.", "error");
    } finally {
      setBillSaving(false);
    }
  };

  return (
    <div className="bg-[#faf9ff] text-[#1a1b20] font-sans h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#e9edff] border-b border-[#c4c6d4] px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <PackageCheck size={18} className="text-[#00296d]" />
          <h2 className="font-bold text-[#00296d] text-sm tracking-tight">
            GRN / Material Receipt &amp; Supplier Inward
          </h2>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setSubView("create")}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
              subView === "create"
                ? "bg-[#00296d] text-white"
                : "bg-white border border-[#c4c6d4] text-[#434652] hover:bg-[#e9edff]"
            }`}
          >
            <ClipboardList size={12} className="inline mr-1" />
            Post GRN
          </button>
          <button
            onClick={() => {
              setSubView("history");
              loadReceipts();
            }}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
              subView === "history"
                ? "bg-[#00296d] text-white"
                : "bg-white border border-[#c4c6d4] text-[#434652] hover:bg-[#e9edff]"
            }`}
          >
            <CheckCircle2 size={12} className="inline mr-1" />
            GRN History
          </button>
          <button
            onClick={() => setSubView("bill")}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
              subView === "bill"
                ? "bg-[#00296d] text-white"
                : "bg-white border border-[#c4c6d4] text-[#434652] hover:bg-[#e9edff]"
            }`}
          >
            <Receipt size={12} className="inline mr-1" />
            Post Purchase Bill
          </button>
          <button
            onClick={() => setIsDebitNoteOpen(true)}
            className="px-3 py-1 text-xs font-bold rounded bg-amber-600 text-white hover:bg-amber-700 ml-2"
          >
            <Plus size={12} className="inline mr-1" />
            Issue Debit Note
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs font-bold rounded bg-rose-600 text-white hover:bg-rose-700 ml-2 transition-colors"
              title="Close Goods Receipt Studio"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* View 1: Post GRN */}
      {subView === "create" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* 1. PO Selection */}
          <div className="bg-white border border-[#c4c6d4] rounded shadow-sm p-3">
            <h3 className="text-[10px] font-bold uppercase text-[#00296d] mb-2 tracking-wider">
              1. Select Purchase Order
            </h3>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <select
                  value={selectedOrderId}
                  onChange={(e) => handleSelectOrder(e.target.value)}
                  disabled={ordersLoading}
                  className="w-full border border-[#737685] rounded px-2 h-8 text-xs bg-white outline-none focus:ring-1 focus:ring-[#00296d] appearance-none pr-8 font-mono"
                >
                  <option value="">
                    {ordersLoading ? "Loading orders..." : "-- Select a Confirmed Purchase Order --"}
                  </option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_no || o.order_number || o.id} - {o.supplier_name || o.supplier_id} ({o.status})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737685] pointer-events-none"
                />
              </div>
              <button
                onClick={loadOrders}
                className="p-2 border border-[#c4c6d4] rounded hover:bg-[#e9edff] text-[#00296d]"
                title="Refresh POs"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            {selectedOrder && (
              <div className="mt-2 text-xs text-[#434652] grid grid-cols-3 gap-2 bg-[#f0f2ff] p-2 rounded border border-[#c4c6d4]">
                <span>
                  <b>Supplier ID:</b> {selectedOrder.supplier_id}
                </span>
                <span>
                  <b>PO Reference:</b> {selectedOrder.order_no || selectedOrder.order_number || selectedOrder.id}
                </span>
                <span>
                  <b>Status:</b> {selectedOrder.status}
                </span>
              </div>
            )}
          </div>

          {/* 2. Received Quantities Entry */}
          {grnLines.length > 0 && (
            <div className="bg-white border border-[#c4c6d4] rounded shadow-sm">
              <div className="flex justify-between items-center px-3 py-2 border-b border-[#c4c6d4]">
                <h3 className="text-[10px] font-bold uppercase text-[#00296d] tracking-wider">
                  2. Line Item Physical Verification
                </h3>
                <span className="text-[10px] text-[#737685]">
                  Ordered: <b>{totalOrdered}</b> | Received: <b>{totalReceived}</b>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#e9edff] text-[#00296d] font-bold">
                    <tr>
                      <th className="px-3 py-2 text-left w-8">#</th>
                      <th className="px-3 py-2 text-left">Item / Description</th>
                      <th className="px-3 py-2 text-left w-28">SKU Code</th>
                      <th className="px-3 py-2 text-right w-24">Ordered</th>
                      <th className="px-3 py-2 text-right w-28">Received Qty</th>
                      <th className="px-3 py-2 text-right w-28">Damaged Qty</th>
                      <th className="px-3 py-2 text-right w-24">Shortage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grnLines.map((row, idx) => {
                      const short = Math.max(0, row.quantity_ordered - row.quantity_received);
                      return (
                        <tr key={row.rowId} className="border-b border-[#f0f2ff] hover:bg-[#faf9ff]">
                          <td className="px-3 py-1.5 text-[#737685]">{idx + 1}</td>
                          <td className="px-3 py-1.5 font-medium">{row.name}</td>
                          <td className="px-3 py-1.5 font-mono text-[#737685]">{row.code}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{row.quantity_ordered}</td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min={0}
                              max={row.quantity_ordered}
                              value={row.quantity_received}
                              onChange={(e) =>
                                updateLine(row.rowId, "quantity_received", Number(e.target.value) || 0)
                              }
                              className="w-20 border border-[#737685] rounded px-2 h-6 font-mono text-right focus:ring-1 focus:ring-[#00296d] outline-none"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min={0}
                              value={row.quantity_damaged}
                              onChange={(e) =>
                                updateLine(row.rowId, "quantity_damaged", Number(e.target.value) || 0)
                              }
                              className="w-20 border border-[#c4c6d4] rounded px-2 h-6 font-mono text-right focus:ring-1 focus:ring-amber-400 outline-none"
                            />
                          </td>
                          <td
                            className={`px-3 py-1.5 text-right font-mono font-bold ${
                              short > 0 ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {short > 0 ? `-${short}` : "0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#e9edff] font-bold text-[#00296d]">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right">
                        Totals
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{totalOrdered}</td>
                      <td className="px-3 py-2 text-right font-mono">{totalReceived}</td>
                      <td className="px-3 py-2 text-right font-mono text-amber-700">{totalDamaged}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          totalShort > 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {totalShort > 0 ? `-${totalShort}` : "0"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 3. Shortage Alert & Submit */}
          {selectedOrder && (
            <div className="bg-white border border-[#c4c6d4] rounded shadow-sm p-3">
              <h3 className="text-[10px] font-bold uppercase text-[#00296d] mb-2 tracking-wider">
                3. Finalize &amp; Inward into WMS
              </h3>
              {totalShort > 0 && (
                <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    <span>
                      <b>Shortage Detected:</b> {totalShort} units short against PO. You can issue a Debit Note for this claim.
                    </span>
                  </div>
                  <button
                    onClick={() => setIsDebitNoteOpen(true)}
                    className="px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-bold hover:bg-amber-700"
                  >
                    Issue Debit Note
                  </button>
                </div>
              )}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional inspection remarks, delivery vehicle details, seal numbers..."
                rows={2}
                className="w-full border border-[#c4c6d4] rounded px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[#00296d] resize-none mb-3"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitGRN}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-[#00296d] text-white text-xs font-bold rounded hover:bg-[#003580] disabled:opacity-60 shadow-sm"
                >
                  <Save size={14} />
                  {saving ? "Inwarding into WMS..." : "Confirm & Post Goods Receipt (GRN)"}
                </button>
              </div>
            </div>
          )}

          {!selectedOrder && !ordersLoading && (
            <div className="text-center py-16 text-[#737685] text-xs">
              <PackageCheck size={36} className="mx-auto mb-2 text-[#c4c6d4]" />
              <p className="font-medium">Select a purchase order above to start physical material inward.</p>
            </div>
          )}
        </div>
      )}

      {/* View 2: GRN History */}
      {subView === "history" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-white border border-[#c4c6d4] rounded shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#c4c6d4]">
              <h3 className="text-[10px] font-bold uppercase text-[#00296d] tracking-wider">
                Confirmed Goods Receipts (GRN)
              </h3>
              <button
                onClick={loadReceipts}
                className="p-1 border border-[#c4c6d4] rounded hover:bg-[#e9edff] text-[#00296d]"
                title="Refresh Receipts"
              >
                <RefreshCw size={12} />
              </button>
            </div>
            {receiptsLoading ? (
              <div className="text-center py-8 text-xs text-[#737685]">Loading receipts...</div>
            ) : savedReceipts.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#737685]">No goods receipts posted yet.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-[#e9edff] text-[#00296d] font-bold">
                  <tr>
                    <th className="px-3 py-2 text-left">GRN Receipt No</th>
                    <th className="px-3 py-2 text-left">Supplier</th>
                    <th className="px-3 py-2 text-left">PO Reference</th>
                    <th className="px-3 py-2 text-right">Tax Total</th>
                    <th className="px-3 py-2 text-right">Grand Total</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedReceipts.map((r: any) => (
                    <tr key={r.id} className="border-b border-[#f0f2ff] hover:bg-[#faf9ff]">
                      <td className="px-3 py-2 font-mono font-bold text-[#00296d]">{r.receipt_no}</td>
                      <td className="px-3 py-2">{r.supplier_id}</td>
                      <td className="px-3 py-2 font-mono text-[#737685]">{r.order_id || "-"}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        INR {(Number(r.tax_total) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                        INR {(Number(r.grand_total) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                          {r.status || "RECEIVED"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleCreateBillFromReceipt(r)}
                            className="px-2 py-0.5 bg-[#00296d] text-white rounded text-[10px] font-bold hover:bg-[#003580]"
                            title="Generate Supplier Purchase Bill"
                          >
                            Post Bill
                          </button>
                          <button
                            onClick={() => setIsDebitNoteOpen(true)}
                            className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold hover:bg-amber-200"
                            title="Issue Debit Note for shortages"
                          >
                            Debit Note
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* View 3: Post Purchase Bill */}
      {subView === "bill" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-white border border-[#c4c6d4] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase text-[#00296d] mb-3 tracking-wider flex items-center gap-2">
              <Receipt size={16} />
              Supplier Bill / Purchase Invoice Booking
            </h3>

            {/* GRN Selection */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-[#434652] mb-1">Select Inward GRN:</label>
              <select
                value={selectedReceiptForBill?.id || ""}
                onChange={(e) => {
                  const r = savedReceipts.find((item) => item.id === e.target.value);
                  setSelectedReceiptForBill(r || null);
                  if (r && !vendorBillNo) {
                    setVendorBillNo(`BILL-${Date.now().toString().slice(-6)}`);
                  }
                }}
                className="w-full border border-[#737685] rounded px-3 h-8 text-xs bg-white outline-none focus:ring-1 focus:ring-[#00296d] font-mono"
              >
                <option value="">-- Select Inward GRN Receipt --</option>
                {savedReceipts.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.receipt_no} - Supplier: {r.supplier_id} (Total: INR {r.grand_total})
                  </option>
                ))}
              </select>
            </div>

            {selectedReceiptForBill ? (
              <div className="space-y-3 border-t border-[#c4c6d4] pt-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-[#434652] mb-1">Vendor Invoice / Bill No:</label>
                    <input
                      type="text"
                      value={vendorBillNo}
                      onChange={(e) => setVendorBillNo(e.target.value)}
                      placeholder="e.g. INV/2026/0892"
                      className="w-full border border-[#737685] rounded px-3 h-8 font-mono font-bold outline-none focus:ring-1 focus:ring-[#00296d]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#434652] mb-1">Supplier ID:</label>
                    <input
                      type="text"
                      disabled
                      value={selectedReceiptForBill.supplier_id}
                      className="w-full border border-[#c4c6d4] bg-[#f0f2ff] rounded px-3 h-8 text-[#737685] font-mono"
                    />
                  </div>
                </div>

                <div className="bg-[#f0f2ff] border border-[#c4c6d4] rounded p-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[#737685] block text-[10px] uppercase font-bold">Taxable Amount</span>
                    <span className="font-mono font-bold text-sm">
                      INR {(Number(selectedReceiptForBill.subtotal) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#737685] block text-[10px] uppercase font-bold">Tax Amount (GST)</span>
                    <span className="font-mono font-bold text-sm text-amber-700">
                      INR {(Number(selectedReceiptForBill.tax_total) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#737685] block text-[10px] uppercase font-bold">Total Bill Payable</span>
                    <span className="font-mono font-bold text-sm text-emerald-700">
                      INR {(Number(selectedReceiptForBill.grand_total) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSubmitPurchaseBill}
                    disabled={billSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-[#00296d] text-white text-xs font-bold rounded hover:bg-[#003580] disabled:opacity-60 shadow-sm"
                  >
                    <Save size={14} />
                    {billSaving ? "Posting Bill..." : "Post Purchase Bill to Payables Ledger"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-[#737685]">
                Please select a confirmed GRN to auto-populate supplier billing lines.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Debit Note */}
      <CreateDebitNoteModal
        isOpen={isDebitNoteOpen}
        onClose={() => setIsDebitNoteOpen(false)}
        onDebitNoteCreated={() => {
          onNotification?.("Debit Note Issued", "Debit note recorded and supplier balance adjusted.", "success");
          loadReceipts();
        }}
        suppliers={suppliersList}
      />
    </div>
  );
};

export default GrnReceiptTab;
