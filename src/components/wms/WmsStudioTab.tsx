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
  Filter,
  FileText,
  Download,
  Printer,
  ClipboardCheck,
  ScanLine,
  X
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

interface StockAuditItem {
  id: string;
  audit_id: string;
  product_id: string;
  batch_no: string;
  system_qty: number;
  counted_qty: number;
  variance_qty: number;
  unit_cost: number;
  variance_value: number;
  discrepancy_reason?: string;
  is_reconciled: boolean;
  notes?: string;
  product?: any;
}

interface StockAudit {
  id: string;
  audit_no: string;
  warehouse_id: string;
  audit_date: string;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  audit_type: string;
  notes?: string;
  reconciled_at?: string;
  reconciled_by?: string;
  items: StockAuditItem[];
}

export const WmsStudioTab: React.FC<{
  currentUser?: any;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}> = ({ currentUser, onNotification }) => {
  const [activeSubTab, setActiveSubTab] = useState<"batches" | "transfers" | "inward" | "fefo" | "audit">("batches");
  const [warehouses, setWarehouses] = useState<Godown[]>([]);
  const [batchStocks, setBatchStocks] = useState<BatchStock[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<StockAudit | null>(null);
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

  // Stock Audit state
  const [auditWarehouseId, setAuditWarehouseId] = useState("");
  const [auditType, setAuditType] = useState("CYCLE_COUNT");
  const [auditNotes, setAuditNotes] = useState("");
  const [scanBarcodeInput, setScanBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // E-Way Bill & Delivery Challan Modal State
  const [viewingChallan, setViewingChallan] = useState<any | null>(null);
  const [viewingEwayBill, setViewingEwayBill] = useState<any | null>(null);

  const fetchWmsData = async () => {
    setLoading(true);
    try {
      const [whRes, batchRes, transferRes, auditRes] = await Promise.all([
        apiFetchV1<Godown[]>("/wms/warehouses"),
        apiFetchV1<BatchStock[]>("/wms/batch-stocks"),
        apiFetchV1<StockTransfer[]>("/wms/transfers"),
        apiFetchV1<StockAudit[]>("/wms/audits").catch(() => []),
      ]);
      setWarehouses(whRes || []);
      setBatchStocks(batchRes || []);
      setTransfers(transferRes || []);
      setAudits(auditRes || []);

      if (whRes && whRes.length > 0) {
        if (!sourceWh) setSourceWh(whRes[0].id);
        if (!destWh && whRes.length > 1) setDestWh(whRes[1].id);
        if (!grnWarehouseId) setGrnWarehouseId(whRes[0].id);
        if (!fefoWarehouseId) setFefoWarehouseId(whRes[0].id);
        if (!auditWarehouseId) setAuditWarehouseId(whRes[0].id);
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

  // Handle Delivery Challan View
  const handleViewChallan = async (transferId: string) => {
    try {
      const data = await apiFetchV1<any>(`/wms/transfers/${transferId}/delivery-challan`);
      setViewingChallan(data);
    } catch (err: any) {
      onNotification?.("Challan Error", err.message || "Failed loading delivery challan", "error");
    }
  };

  // Handle E-Way Bill JSON View / Download
  const handleViewEwayBill = async (transferId: string) => {
    try {
      const data = await apiFetchV1<any>(`/wms/transfers/${transferId}/eway-bill-payload`);
      setViewingEwayBill(data);
    } catch (err: any) {
      onNotification?.("E-Way Bill Error", err.message || "Failed generating E-Way Bill payload", "error");
    }
  };

  // Handle Physical Stock Audit Actions
  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditWarehouseId) {
      onNotification?.("Validation Error", "Please select a target warehouse for audit.", "error");
      return;
    }
    try {
      setLoading(true);
      const res = await apiFetchV1<StockAudit>("/wms/audits", {
        method: "POST",
        body: JSON.stringify({
          warehouse_id: auditWarehouseId,
          audit_type: auditType,
          notes: auditNotes || undefined,
        }),
      });
      onNotification?.("Stock Audit Initiated", `Audit ${res.audit_no} created with ${res.items?.length || 0} snapshotted batch lines.`, "success");
      setSelectedAudit(res);
      fetchWmsData();
    } catch (err: any) {
      onNotification?.("Audit Error", err.message || "Failed creating stock audit", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAudit = async (auditId: string) => {
    try {
      setLoading(true);
      const res = await apiFetchV1<StockAudit>(`/wms/audits/${auditId}`);
      setSelectedAudit(res);
    } catch (err: any) {
      onNotification?.("Audit Error", err.message || "Failed loading audit details", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAudit || !scanBarcodeInput.trim()) return;
    try {
      setIsScanning(true);
      const res = await apiFetchV1<any>(`/wms/audits/${selectedAudit.id}/scan`, {
        method: "POST",
        body: JSON.stringify({
          barcode_or_sku: scanBarcodeInput.trim(),
          qty_increment: 1.0,
        }),
      });
      onNotification?.("Scan Counted", `Scanned ${res.product_name} (${res.batch_no}): Counted = ${res.counted_qty}, Variance = ${res.variance_qty}`, "success");
      setScanBarcodeInput("");
      handleSelectAudit(selectedAudit.id);
    } catch (err: any) {
      onNotification?.("Scan Error", err.message || "Barcode scan failed", "error");
    } finally {
      setIsScanning(false);
    }
  };

  const handleRecordCount = async (itemId: string, countedQty: number, discrepancyReason?: string) => {
    if (!selectedAudit) return;
    try {
      await apiFetchV1(`/wms/audits/${selectedAudit.id}/count`, {
        method: "POST",
        body: JSON.stringify({
          item_id: itemId,
          counted_qty: countedQty,
          discrepancy_reason: discrepancyReason || undefined,
        }),
      });
      handleSelectAudit(selectedAudit.id);
    } catch (err: any) {
      onNotification?.("Count Update Error", err.message || "Failed updating item count", "error");
    }
  };

  const handleReconcileAudit = async (auditId: string) => {
    if (!confirm("Are you sure you want to reconcile this physical audit? This will post batch stock adjustments and write-off/surplus movements to the ledger.")) {
      return;
    }
    try {
      setIsReconciling(true);
      const res = await apiFetchV1<StockAudit>(`/wms/audits/${auditId}/reconcile`, {
        method: "POST",
      });
      onNotification?.("Reconciliation Complete", `Audit ${res.audit_no} finalized and ledger posted.`, "success");
      setSelectedAudit(res);
      fetchWmsData();
    } catch (err: any) {
      onNotification?.("Reconciliation Error", err.message || "Failed reconciling audit", "error");
    } finally {
      setIsReconciling(false);
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
            <button
              onClick={() => {
                setActiveSubTab("audit");
                if (audits.length > 0 && !selectedAudit) {
                  handleSelectAudit(audits[0].id);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "audit"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-theme-muted hover:text-theme-body"
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              Stock Audit & Recon
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
                          <button
                            onClick={() => handleViewChallan(t.id)}
                            className="px-2.5 py-1 bg-theme-surface-2 hover:bg-theme-surface-hover text-indigo-400 border border-indigo-500/20 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                            title="View / Print Rule 55 Delivery Challan"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Challan
                          </button>
                          <button
                            onClick={() => handleViewEwayBill(t.id)}
                            className="px-2.5 py-1 bg-theme-surface-2 hover:bg-theme-surface-hover text-emerald-400 border border-emerald-500/20 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                            title="View / Export NIC GST E-Way Bill JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                            E-Way JSON
                          </button>
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

        {/* SUBTAB 5: PHYSICAL STOCK AUDIT & RECONCILIATION */}
        {activeSubTab === "audit" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column: Initiate Audit & History */}
            <div className="space-y-6">
              {/* Initiate Form */}
              <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-4">
                <div className="flex items-center space-x-2 border-b border-theme-divider pb-3">
                  <ClipboardCheck className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-theme-text-primary">Initiate Godown Stock Audit</h3>
                </div>

                <form onSubmit={handleCreateAudit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-theme-muted mb-1">Target Godown</label>
                    <select
                      value={auditWarehouseId}
                      onChange={(e) => setAuditWarehouseId(e.target.value)}
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
                    <label className="block text-xs font-semibold text-theme-muted mb-1">Audit Type</label>
                    <select
                      value={auditType}
                      onChange={(e) => setAuditType(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                    >
                      <option value="CYCLE_COUNT">Cycle Count (Active Stock)</option>
                      <option value="FULL">Full Godown Stocktake</option>
                      <option value="SPOT_CHECK">Spot Discrepancy Check</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-muted mb-1">Audit Notes / Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Q3 Physical Stocktake"
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Snapshot Batch Baseline & Start Audit
                  </button>
                </form>
              </div>

              {/* Audit History List */}
              <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-theme-muted">Audit History & Cycles</h4>
                {audits.length === 0 ? (
                  <div className="text-center py-6 text-xs text-theme-muted">No stock audits initiated yet.</div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {audits.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => handleSelectAudit(a.id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                          selectedAudit?.id === a.id
                            ? "bg-indigo-500/10 border-indigo-500 text-theme-text-primary"
                            : "bg-theme-surface-2/60 border-theme-divider hover:border-theme-divider-hover text-theme-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-indigo-400">{a.audit_no}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              a.status === "COMPLETED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                            }`}
                          >
                            {a.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span>{getWarehouseName(a.warehouse_id)}</span>
                          <span>{new Date(a.audit_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (2 spans): Active Audit Workspace */}
            <div className="xl:col-span-2 space-y-6">
              {selectedAudit ? (
                <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-5">
                  {/* Audit Header Info & Reconciliation Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-theme-divider">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-mono">
                        <h3 className="text-base font-bold text-theme-text-primary">{selectedAudit.audit_no}</h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            selectedAudit.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          }`}
                        >
                          {selectedAudit.status}
                        </span>
                      </div>
                      <p className="text-xs text-theme-muted">
                        Godown: <span className="text-theme-body font-medium">{getWarehouseName(selectedAudit.warehouse_id)}</span> • Type: {selectedAudit.audit_type}
                      </p>
                    </div>

                    {selectedAudit.status !== "COMPLETED" && (
                      <button
                        onClick={() => handleReconcileAudit(selectedAudit.id)}
                        disabled={isReconciling}
                        className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isReconciling ? "Posting Ledger Adjustments..." : "Reconcile & Post Discrepancies"}
                      </button>
                    )}
                  </div>

                  {/* Barcode Scanner Input */}
                  {selectedAudit.status !== "COMPLETED" && (
                    <form onSubmit={handleBarcodeScan} className="bg-theme-surface-2 p-3.5 rounded-xl border border-theme-divider flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <ScanLine className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Scan Barcode / SKU / Product Code to increment count (+1)..."
                          value={scanBarcodeInput}
                          onChange={(e) => setScanBarcodeInput(e.target.value)}
                          disabled={isScanning}
                          className="w-full bg-transparent text-xs text-theme-body placeholder:text-theme-muted focus:outline-none font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isScanning || !scanBarcodeInput.trim()}
                        className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        {isScanning ? "Scanning..." : "Count +1"}
                      </button>
                    </form>
                  )}

                  {/* Discrepancy KPI Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-theme-surface-2/60 rounded-xl border border-theme-divider">
                      <span className="text-[11px] text-theme-muted block">Items Audited</span>
                      <span className="text-lg font-bold font-mono text-theme-text-primary">{selectedAudit.items?.length || 0}</span>
                    </div>
                    <div className="p-3 bg-theme-surface-2/60 rounded-xl border border-theme-divider">
                      <span className="text-[11px] text-theme-muted block">Matched Stocks</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {selectedAudit.items?.filter((it) => Number(it.variance_qty) === 0).length || 0}
                      </span>
                    </div>
                    <div className="p-3 bg-theme-surface-2/60 rounded-xl border border-theme-divider">
                      <span className="text-[11px] text-theme-muted block">Deficit / Loss Lines</span>
                      <span className="text-lg font-bold font-mono text-rose-400">
                        {selectedAudit.items?.filter((it) => Number(it.variance_qty) < 0).length || 0}
                      </span>
                    </div>
                    <div className="p-3 bg-theme-surface-2/60 rounded-xl border border-theme-divider">
                      <span className="text-[11px] text-theme-muted block">Surplus Lines</span>
                      <span className="text-lg font-bold font-mono text-cyan-400">
                        {selectedAudit.items?.filter((it) => Number(it.variance_qty) > 0).length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Variance Item Table */}
                  <div className="overflow-x-auto border border-theme-divider rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted border-b border-theme-divider font-semibold">
                          <th className="p-3">Product / Code</th>
                          <th className="p-3">Batch No</th>
                          <th className="p-3 text-right">System Qty</th>
                          <th className="p-3 text-right">Counted Qty</th>
                          <th className="p-3 text-right">Variance</th>
                          <th className="p-3 text-right">Unit Cost</th>
                          <th className="p-3">Discrepancy Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider font-mono">
                        {selectedAudit.items?.map((it) => {
                          const varQty = Number(it.variance_qty);
                          return (
                            <tr key={it.id} className="hover:bg-theme-surface-2/40 transition-colors">
                              <td className="p-3 font-sans">
                                <div className="font-bold text-theme-text-primary">{it.product?.name || it.product_id}</div>
                                <div className="text-[10px] text-theme-muted font-mono">{it.product?.code || it.product_id}</div>
                              </td>
                              <td className="p-3 font-bold text-indigo-400">{it.batch_no}</td>
                              <td className="p-3 text-right text-theme-body">{Number(it.system_qty).toFixed(2)}</td>
                              <td className="p-3 text-right">
                                {selectedAudit.status === "COMPLETED" ? (
                                  <span className="font-bold text-theme-text-primary">{Number(it.counted_qty).toFixed(2)}</span>
                                ) : (
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={it.counted_qty}
                                    onBlur={(e) => handleRecordCount(it.id, Number(e.target.value), it.discrepancy_reason)}
                                    className="w-20 bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-right text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                                  />
                                )}
                              </td>
                              <td className="p-3 text-right font-bold">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] ${
                                    varQty === 0
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : varQty < 0
                                      ? "bg-rose-500/10 text-rose-400"
                                      : "bg-cyan-500/10 text-cyan-400"
                                  }`}
                                >
                                  {varQty > 0 ? `+${varQty.toFixed(2)}` : varQty.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-3 text-right text-theme-muted">₹{Number(it.unit_cost).toFixed(2)}</td>
                              <td className="p-3 font-sans">
                                {selectedAudit.status === "COMPLETED" ? (
                                  <span className="text-[11px] text-theme-muted">{it.discrepancy_reason || "—"}</span>
                                ) : (
                                  <select
                                    value={it.discrepancy_reason || ""}
                                    onChange={(e) => handleRecordCount(it.id, Number(it.counted_qty), e.target.value)}
                                    className="bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-[11px] text-theme-body focus:outline-none focus:border-indigo-500"
                                  >
                                    <option value="MATCHED">Matched</option>
                                    <option value="DAMAGED">Damaged / Broken</option>
                                    <option value="EXPIRED">Expired Spoilage</option>
                                    <option value="THEFT_LOSS">Loss / Missing</option>
                                    <option value="SURPLUS_FOUND">Surplus Found</option>
                                    <option value="COUNTING_ERROR">Counting Adjustment</option>
                                  </select>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-theme-surface-1 p-12 rounded-xl border border-theme-divider text-center space-y-3">
                  <ClipboardCheck className="w-10 h-10 text-theme-muted mx-auto" />
                  <h4 className="text-sm font-bold text-theme-text-primary">No Audit Selected</h4>
                  <p className="text-xs text-theme-muted max-w-sm mx-auto">
                    Select an existing audit cycle from the left list or initiate a new godown stock audit to start scanning.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery Challan Modal (Rule 55 CGST Rules) */}
        {viewingChallan && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-theme-text-primary">
                      {viewingChallan.challan_title || "DELIVERY CHALLAN"}
                    </h3>
                    <p className="text-[10px] text-theme-muted">{viewingChallan.statutory_subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Challan
                  </button>
                  <button
                    onClick={() => setViewingChallan(null)}
                    className="p-1.5 rounded-lg hover:bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 text-xs font-sans">
                {/* Header info */}
                <div className="grid grid-cols-2 gap-6 bg-theme-surface-2/40 p-4 rounded-xl border border-theme-divider">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Consignor (Dispatch From)</div>
                    <div className="text-sm font-bold text-theme-text-primary mt-1">{viewingChallan.company?.name}</div>
                    <div className="text-theme-muted text-[11px] mt-0.5">{viewingChallan.dispatch_from?.name} ({viewingChallan.dispatch_from?.code})</div>
                    <div className="text-theme-muted text-[11px]">{viewingChallan.dispatch_from?.address}</div>
                    <div className="mt-2 text-indigo-400 font-mono text-[11px] font-semibold">GSTIN: {viewingChallan.company?.gstin}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Consignee (Dispatch To)</div>
                    <div className="text-sm font-bold text-theme-text-primary mt-1">{viewingChallan.dispatch_to?.name} ({viewingChallan.dispatch_to?.code})</div>
                    <div className="text-theme-muted text-[11px] mt-0.5">{viewingChallan.dispatch_to?.address}</div>
                    <div className="mt-2 text-theme-muted text-[11px]">
                      Challan No: <strong className="text-theme-body font-mono">{viewingChallan.challan_no}</strong>
                    </div>
                    <div className="text-theme-muted text-[11px]">
                      Date: <span className="text-theme-body font-mono">{viewingChallan.date}</span>
                    </div>
                  </div>
                </div>

                {/* Transport Info */}
                <div className="bg-theme-surface-2/20 p-3 rounded-lg border border-theme-divider grid grid-cols-3 gap-3 font-mono text-[11px]">
                  <div>
                    <span className="text-theme-muted text-[10px] block">Transporter:</span>
                    <span className="font-semibold text-theme-body">{viewingChallan.transport?.transporter_name || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-theme-muted text-[10px] block">Vehicle No:</span>
                    <span className="font-semibold text-amber-400">{viewingChallan.transport?.vehicle_number || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-theme-muted text-[10px] block">LR / Docket No:</span>
                    <span className="font-semibold text-theme-body">{viewingChallan.transport?.lr_number || "N/A"}</span>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-theme-divider text-[10px] uppercase font-bold text-theme-muted tracking-wider">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Item Description</th>
                      <th className="py-2 px-2 font-mono">HSN</th>
                      <th className="py-2 px-2 font-mono">Batch No</th>
                      <th className="py-2 px-2 text-right">Qty Dispatched</th>
                      <th className="py-2 px-2 text-right">Unit Rate (₹)</th>
                      <th className="py-2 px-2 text-right">Taxable Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-divider text-xs">
                    {viewingChallan.items?.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-theme-surface-2/30">
                        <td className="py-2.5 px-2 text-theme-muted">{idx + 1}</td>
                        <td className="py-2.5 px-2 font-semibold text-theme-body">{it.product_name}</td>
                        <td className="py-2.5 px-2 font-mono text-theme-muted">{it.hsn}</td>
                        <td className="py-2.5 px-2 font-mono text-indigo-400 font-bold">{it.batch_no}</td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-400">{it.quantity}</td>
                        <td className="py-2.5 px-2 text-right font-mono">{it.rate.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold">{it.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-theme-divider font-bold text-xs">
                      <td colSpan={4} className="py-3 px-2 text-theme-muted uppercase tracking-wider text-[10px]">
                        Total Consignment Summary
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-emerald-400">
                        {viewingChallan.summary?.total_quantity}
                      </td>
                      <td></td>
                      <td className="py-3 px-2 text-right font-mono text-indigo-400 text-sm">
                        ₹{viewingChallan.summary?.total_value.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Statutory Non-Supply Declaration */}
                <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20 text-[11px] text-theme-muted space-y-1">
                  <div className="font-bold text-indigo-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Statutory Rule 55 Declaration
                  </div>
                  <p>{viewingChallan.declaration}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* E-Way Bill JSON Modal */}
        {viewingEwayBill && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-theme-text-primary">
                      NIC GST E-Way Bill JSON Payload
                    </h3>
                    <p className="text-[10px] text-theme-muted">Official Schema v1.0.0 for Bulk Upload on ewaybillgst.gov.in</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(viewingEwayBill, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `eway_bill_${viewingEwayBill.billLists?.[0]?.docNo || "payload"}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download JSON
                  </button>
                  <button
                    onClick={() => setViewingEwayBill(null)}
                    className="p-1.5 rounded-lg hover:bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto">
                <pre className="p-4 bg-theme-surface-2 rounded-xl text-[11px] font-mono text-emerald-400 border border-theme-divider overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(viewingEwayBill, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
