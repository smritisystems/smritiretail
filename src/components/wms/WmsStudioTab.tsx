/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import { 
  Warehouse, 
  ArrowRightLeft, 
  PackagePlus, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Truck, 
  ShieldAlert, 
  Boxes, 
  Calendar,
  Layers,
  ChevronRight,
  Filter
} from "lucide-react";

interface Godown {
  id: string;
  code: string;
  name: string;
  address?: string;
  is_central_godown: boolean;
  is_transit: boolean;
  is_active: boolean;
}

interface BatchStock {
  id: string;
  warehouse_id: string;
  product_id: string;
  batch_no: string;
  mfg_date?: string;
  expiry_date?: string;
  quantity: number;
  reserved_quantity: number;
  damaged_quantity: number;
  available_quantity: number;
  mrp?: number;
  purchase_rate?: number;
  sale_rate?: number;
}

interface StockTransferItem {
  id?: string;
  product_id: string;
  batch_no: string;
  quantity: number;
  quantity_received?: number;
  quantity_shortage?: number;
  quantity_damaged?: number;
  unit_cost?: number;
}

interface StockTransfer {
  id: string;
  transfer_no: string;
  source_warehouse_id: string;
  dest_warehouse_id: string;
  status: "DRAFT" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
  transporter_name?: string;
  vehicle_number?: string;
  lr_number?: string;
  dispatch_date?: string;
  received_date?: string;
  items: StockTransferItem[];
}

export const WmsStudioTab: React.FC<{
  currentUser?: any;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}> = ({ currentUser, onNotification }) => {
  const [activeSubTab, setActiveSubTab] = useState<"batches" | "transfers" | "inward" | "fefo">("batches");
  const [warehouses, setWarehouses] = useState<Godown[]>([]);
  const [batchStocks, setBatchStocks] = useState<BatchStock[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>("ALL");

  // Transfer creation form state
  const [sourceWh, setSourceWh] = useState("");
  const [destWh, setDestWh] = useState("");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferBatchNo, setTransferBatchNo] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transporter, setTransporter] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");

  // Inward GRN form state
  const [grnSupplierId, setGrnSupplierId] = useState("sup-test-01");
  const [grnWarehouseId, setGrnWarehouseId] = useState("");
  const [grnProductId, setGrnProductId] = useState("");
  const [grnBatchNo, setGrnBatchNo] = useState("");
  const [grnExpiryDate, setGrnExpiryDate] = useState("");
  const [grnQty, setGrnQty] = useState(50);
  const [grnCostPrice, setGrnCostPrice] = useState(120);

  // FEFO Simulator state
  const [fefoProductId, setFefoProductId] = useState("");
  const [fefoWarehouseId, setFefoWarehouseId] = useState("");
  const [fefoQty, setFefoQty] = useState(10);
  const [fefoResults, setFefoResults] = useState<any[] | null>(null);

  const fetchWmsData = async () => {
    setLoading(true);
    try {
      const [whRes, batchRes, transferRes] = await Promise.all([
        apiFetchV1<Godown[]>("/wms/warehouses"),
        apiFetchV1<BatchStock[]>("/wms/batch-stocks"),
        apiFetchV1<StockTransfer[]>("/wms/transfers"),
      ]);
      setWarehouses(whRes || []);
      setBatchStocks(batchRes || []);
      setTransfers(transferRes || []);

      if (whRes && whRes.length > 0) {
        if (!sourceWh) setSourceWh(whRes[0].id);
        if (!destWh && whRes.length > 1) setDestWh(whRes[1].id);
        if (!grnWarehouseId) setGrnWarehouseId(whRes[0].id);
        if (!fefoWarehouseId) setFefoWarehouseId(whRes[0].id);
      }
    } catch (err: any) {
      onNotification?.("WMS Error", err.message || "Failed to load warehouse data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWmsData();
  }, []);

  // Filtered batches
  const filteredBatches = useMemo(() => {
    return batchStocks.filter((b) => {
      const matchWh = selectedWarehouseFilter === "ALL" || b.warehouse_id === selectedWarehouseFilter;
      const matchQuery =
        !searchQuery ||
        b.batch_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.product_id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchWh && matchQuery;
    });
  }, [batchStocks, selectedWarehouseFilter, searchQuery]);

  // Handle Transfer Creation
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceWh === destWh) {
      onNotification?.("Validation Error", "Source and destination warehouses must be different.", "error");
      return;
    }
    if (!transferProductId || !transferBatchNo || transferQty <= 0) {
      onNotification?.("Validation Error", "Please provide product, batch, and positive quantity.", "error");
      return;
    }

    try {
      const idempotencyKey = `IDEM-UI-${Date.now()}`;
      await apiFetchV1("/wms/transfers", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          source_warehouse_id: sourceWh,
          dest_warehouse_id: destWh,
          transporter_name: transporter || "Internal Fleet",
          vehicle_number: vehicleNo || "MH-04-TR-1000",
          items: [
            {
              product_id: transferProductId,
              batch_no: transferBatchNo,
              quantity: transferQty,
            },
          ],
        }),
      });
      onNotification?.("Transfer Created", "Stock Transfer Order generated in DRAFT state.", "success");
      fetchWmsData();
    } catch (err: any) {
      onNotification?.("Transfer Error", err.message || "Failed creating transfer", "error");
    }
  };

  // Handle Dispatch
  const handleDispatch = async (transferId: string) => {
    try {
      await apiFetchV1(`/wms/transfers/${transferId}/dispatch`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      onNotification?.("Dispatched", "Transfer status updated to IN_TRANSIT.", "success");
      fetchWmsData();
    } catch (err: any) {
      onNotification?.("Dispatch Error", err.message || "Failed dispatching transfer", "error");
    }
  };

  // Handle Receive
  const handleReceive = async (transfer: StockTransfer) => {
    try {
      const receiptDetails = transfer.items.map((i) => ({
        item_id: i.id,
        quantity_received: i.quantity,
        quantity_shortage: 0,
        quantity_damaged: 0,
      }));

      await apiFetchV1(`/wms/transfers/${transfer.id}/receive`, {
        method: "POST",
        body: JSON.stringify({ receipt_details: receiptDetails }),
      });
      onNotification?.("Received", "Transfer completed and stock credited to destination.", "success");
      fetchWmsData();
    } catch (err: any) {
      onNotification?.("Receive Error", err.message || "Failed receiving transfer", "error");
    }
  };

  // Handle Inward GRN
  const handleCreateGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnProductId || grnQty <= 0) {
      onNotification?.("Validation Error", "Please provide product and received quantity.", "error");
      return;
    }
    const receiptNo = `GRN-${Date.now()}`;
    const batchNo = grnBatchNo || `BATCH-GRN-${Date.now()}`;

    try {
      await apiFetchV1("/purchase/receipts", {
        method: "POST",
        body: JSON.stringify({
          id: `pr-${Date.now()}`,
          receipt_no: receiptNo,
          supplier_id: grnSupplierId,
          warehouse_id: grnWarehouseId,
          items: [
            {
              product_id: grnProductId,
              code: grnProductId,
              name: `Product ${grnProductId}`,
              batch_no: batchNo,
              expiry_date: grnExpiryDate || undefined,
              quantity_received: grnQty,
              cost_price: grnCostPrice,
              gst_rate: 18.0,
            },
          ],
        }),
      });
      onNotification?.("GRN Inward Complete", `Received ${grnQty} units into batch ${batchNo}.`, "success");
      fetchWmsData();
    } catch (err: any) {
      onNotification?.("GRN Error", err.message || "Failed inwarding goods receipt", "error");
    }
  };

  // Handle FEFO Simulator
  const handleSimulateFefo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fefoProductId || fefoQty <= 0) {
      onNotification?.("Validation Error", "Please enter product ID and requested quantity.", "error");
      return;
    }
    try {
      const res = await apiFetchV1<any[]>("/wms/allocate-fefo", {
        method: "POST",
        body: JSON.stringify({
          product_id: fefoProductId,
          warehouse_id: fefoWarehouseId,
          quantity: fefoQty,
        }),
      });
      setFefoResults(res || []);
      onNotification?.("FEFO Calculated", `Allocated across ${res?.length || 0} batch segments.`, "success");
    } catch (err: any) {
      setFefoResults(null);
      onNotification?.("FEFO Allocation Error", err.message || "Failed allocating stock", "error");
    }
  };

  const getWarehouseName = (id: string) => {
    const wh = warehouses.find((w) => w.id === id);
    return wh ? `${wh.name} (${wh.code})` : id;
  };

  return (
    <div className="flex flex-col h-full bg-theme-base text-theme-body font-sans select-none overflow-hidden">
      {/* Header Banner */}
      <div className="px-6 py-4 bg-theme-surface-1 border-b border-theme-divider flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-theme-text-primary tracking-wide flex items-center gap-2">
              Distributor & Warehouse Management System (WMS)
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                v6.16.0 Production Ready
              </span>
            </h2>
            <p className="text-xs text-theme-muted mt-0.5">
              Multi-godown batch inventory, FEFO order auto-allocation, inter-warehouse transfers & inward GRN
            </p>
          </div>
        </div>

        {/* Sub-tab Switcher & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-theme-surface-2 p-1 rounded-xl border border-theme-divider">
            <button
              onClick={() => setActiveSubTab("batches")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "batches"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-theme-muted hover:text-theme-body"
              }`}
            >
              <Boxes className="w-4 h-4" />
              Batch Matrix
            </button>
            <button
              onClick={() => setActiveSubTab("transfers")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "transfers"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-theme-muted hover:text-theme-body"
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Stock Transfers (STO)
            </button>
            <button
              onClick={() => setActiveSubTab("inward")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "inward"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-theme-muted hover:text-theme-body"
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              Inward GRN
            </button>
            <button
              onClick={() => setActiveSubTab("fefo")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "fefo"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-theme-muted hover:text-theme-body"
              }`}
            >
              <Clock className="w-4 h-4" />
              FEFO Simulator
            </button>
          </div>

          <button
            onClick={fetchWmsData}
            disabled={loading}
            className="p-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body transition-all cursor-pointer"
            title="Refresh Warehouse Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* SUBTAB 1: BATCH MATRIX */}
        {activeSubTab === "batches" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-4 bg-theme-surface-1 p-3 rounded-xl border border-theme-divider">
              <div className="flex items-center space-x-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-theme-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Product ID or Batch Number..."
                    className="w-full pl-9 pr-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-theme-muted" />
                  <select
                    value={selectedWarehouseFilter}
                    onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                    className="bg-theme-surface-2 border border-theme-divider rounded-lg text-xs px-3 py-1.5 text-theme-body focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Warehouses ({warehouses.length})</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-xs text-theme-muted font-mono">
                Showing {filteredBatches.length} of {batchStocks.length} batch records
              </div>
            </div>

            {/* Batch Table */}
            <div className="bg-theme-surface-1 rounded-xl border border-theme-divider overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-theme-surface-2/60 border-b border-theme-divider text-theme-muted font-semibold">
                      <th className="py-2.5 px-4">Godown</th>
                      <th className="py-2.5 px-4">Product ID</th>
                      <th className="py-2.5 px-4">Batch Number</th>
                      <th className="py-2.5 px-4">Expiry Date</th>
                      <th className="py-2.5 px-4 text-right">On Hand</th>
                      <th className="py-2.5 px-4 text-right">Reserved</th>
                      <th className="py-2.5 px-4 text-right">Damaged</th>
                      <th className="py-2.5 px-4 text-right">Available</th>
                      <th className="py-2.5 px-4 text-right">Purchase Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-divider/50">
                    {filteredBatches.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-theme-muted">
                          No batch stocks found matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredBatches.map((b) => {
                        const isExpired = b.expiry_date && new Date(b.expiry_date) < new Date();
                        const isAvailable = Number(b.available_quantity) > 0;
                        return (
                          <tr key={b.id} className="hover:bg-theme-surface-hover/30 transition-colors font-mono">
                            <td className="py-2.5 px-4 font-sans font-medium text-theme-text-primary">
                              {getWarehouseName(b.warehouse_id)}
                            </td>
                            <td className="py-2.5 px-4 text-indigo-400 font-semibold">{b.product_id}</td>
                            <td className="py-2.5 px-4 text-theme-body font-bold">{b.batch_no}</td>
                            <td className="py-2.5 px-4">
                              {b.expiry_date ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] ${
                                    isExpired
                                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  }`}
                                >
                                  {b.expiry_date}
                                </span>
                              ) : (
                                <span className="text-theme-muted text-[11px]">No Expiry</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right">{Number(b.quantity).toFixed(2)}</td>
                            <td className="py-2.5 px-4 text-right text-amber-400">
                              {Number(b.reserved_quantity).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-rose-400">
                              {Number(b.damaged_quantity).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                              {Number(b.available_quantity).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              ₹{Number(b.purchase_rate || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: STOCK TRANSFERS (STO) */}
        {activeSubTab === "transfers" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Transfer Form */}
            <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider h-fit space-y-4">
              <div className="flex items-center space-x-2 border-b border-theme-divider pb-3">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-theme-text-primary">Initiate Stock Transfer (STO)</h3>
              </div>

              <form onSubmit={handleCreateTransfer} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Source Godown</label>
                  <select
                    value={sourceWh}
                    onChange={(e) => setSourceWh(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Destination Godown</label>
                  <select
                    value={destWh}
                    onChange={(e) => setDestWh(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Product ID / Code</label>
                  <input
                    type="text"
                    value={transferProductId}
                    onChange={(e) => setTransferProductId(e.target.value)}
                    placeholder="e.g. PROD-7ce8e467"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Source Batch Number</label>
                  <input
                    type="text"
                    value={transferBatchNo}
                    onChange={(e) => setTransferBatchNo(e.target.value)}
                    placeholder="e.g. BATCH-OPENING"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-theme-muted mb-1">Transfer Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={transferQty}
                      onChange={(e) => setTransferQty(Number(e.target.value))}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-theme-muted mb-1">Vehicle No</label>
                    <input
                      type="text"
                      value={vehicleNo}
                      onChange={(e) => setVehicleNo(e.target.value)}
                      placeholder="MH-04-TR-9000"
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Create Transfer Order (STO)
                </button>
              </form>
            </div>

            {/* Transfer List & Dispatch/Receive Actions */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-theme-text-primary flex items-center gap-2">
                  Active Stock Transfer Orders ({transfers.length})
                </h3>
              </div>

              <div className="space-y-3">
                {transfers.length === 0 ? (
                  <div className="bg-theme-surface-1 p-8 rounded-xl border border-theme-divider text-center text-theme-muted text-xs">
                    No active stock transfers found.
                  </div>
                ) : (
                  transfers.map((t) => (
                    <div
                      key={t.id}
                      className="bg-theme-surface-1 p-4 rounded-xl border border-theme-divider hover:border-theme-divider/80 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <span className="text-xs font-bold text-indigo-400 font-mono">{t.transfer_no}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                              t.status === "RECEIVED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : t.status === "IN_TRANSIT"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center space-x-2">
                          {t.status === "DRAFT" && (
                            <button
                              onClick={() => handleDispatch(t.id)}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Dispatch Order
                            </button>
                          )}
                          {t.status === "IN_TRANSIT" && (
                            <button
                              onClick={() => handleReceive(t)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Receive Goods
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-theme-muted text-[11px]">From: </span>
                          <span className="font-semibold text-theme-body">{getWarehouseName(t.source_warehouse_id)}</span>
                        </div>
                        <div>
                          <span className="text-theme-muted text-[11px]">To: </span>
                          <span className="font-semibold text-theme-body">{getWarehouseName(t.dest_warehouse_id)}</span>
                        </div>
                      </div>

                      {/* Items list */}
                      <div className="bg-theme-surface-2/40 p-2.5 rounded-lg border border-theme-divider text-xs font-mono">
                        {t.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-theme-body">
                              Product: <strong className="text-indigo-400">{item.product_id}</strong> (Batch: {item.batch_no})
                            </span>
                            <span className="font-bold text-emerald-400">{item.quantity} units</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: INWARD GRN */}
        {activeSubTab === "inward" && (
          <div className="max-w-2xl mx-auto bg-theme-surface-1 p-6 rounded-xl border border-theme-divider space-y-5">
            <div className="flex items-center space-x-3 border-b border-theme-divider pb-4">
              <PackagePlus className="w-6 h-6 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-theme-text-primary">Goods Receipt Note (GRN) Inward Entry</h3>
                <p className="text-xs text-theme-muted">
                  Ingest supplier lot shipments into physical godown with batch numbers and expiry tracking.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateGrn} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Target Receiving Godown</label>
                  <select
                    value={grnWarehouseId}
                    onChange={(e) => setGrnWarehouseId(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Supplier ID</label>
                  <input
                    type="text"
                    value={grnSupplierId}
                    onChange={(e) => setGrnSupplierId(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Product ID / Code</label>
                  <input
                    type="text"
                    value={grnProductId}
                    onChange={(e) => setGrnProductId(e.target.value)}
                    placeholder="e.g. PROD-7ce8e467"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Lot / Batch Number</label>
                  <input
                    type="text"
                    value={grnBatchNo}
                    onChange={(e) => setGrnBatchNo(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={grnExpiryDate}
                    onChange={(e) => setGrnExpiryDate(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Received Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={grnQty}
                    onChange={(e) => setGrnQty(Number(e.target.value))}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={grnCostPrice}
                    onChange={(e) => setGrnCostPrice(Number(e.target.value))}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <PackagePlus className="w-4 h-4" />
                Post Goods Receipt & Inward Batch Stock
              </button>
            </form>
          </div>
        )}

        {/* SUBTAB 4: FEFO ALLOCATION SIMULATOR */}
        {activeSubTab === "fefo" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider h-fit space-y-4">
              <div className="flex items-center space-x-2 border-b border-theme-divider pb-3">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-theme-text-primary">Simulate FEFO Order Allocation</h3>
              </div>

              <form onSubmit={handleSimulateFefo} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Target Godown</label>
                  <select
                    value={fefoWarehouseId}
                    onChange={(e) => setFefoWarehouseId(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Product ID / Code</label>
                  <input
                    type="text"
                    value={fefoProductId}
                    onChange={(e) => setFefoProductId(e.target.value)}
                    placeholder="e.g. PROD-7ce8e467"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Requested Outward Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={fefoQty}
                    onChange={(e) => setFefoQty(Number(e.target.value))}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Run FEFO Calculation
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-4">
              <h3 className="text-sm font-bold text-theme-text-primary">Allocated Batch Segments</h3>
              {fefoResults === null ? (
                <div className="p-8 text-center text-theme-muted text-xs">
                  Run a calculation to see ordered FEFO batch fulfillment breakdown.
                </div>
              ) : fefoResults.length === 0 ? (
                <div className="p-8 text-center text-rose-400 text-xs">
                  Insufficient stock available for requested quantity.
                </div>
              ) : (
                <div className="space-y-2.5 font-mono">
                  {fefoResults.map((r, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-theme-surface-2/60 rounded-lg border border-theme-divider flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-indigo-400">{r.batch_no}</span>
                          {r.expiry_date && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Exp: {r.expiry_date}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-theme-muted">Segment #{idx + 1} Priority Fulfillment</div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-bold text-emerald-400">{r.allocated_quantity}</span> units
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
