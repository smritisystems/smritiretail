/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.16
 * Created      : 2026-08-22
 * Modified     : 2026-10-29 (v6.99.16 — WMS Delivery Challan body portal & #root suppression print standard)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ENTERPRISE_BILLING_SUITE_VERSION_LABEL } from "../../config/version.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import { GlobalGridImportModal } from "../gridInput/GlobalGridImportModal.tsx";
import { StockExpiryModal } from "../warehouse/StockExpiryModal.tsx";
import { SmartReplenishmentModal } from "../inventory/SmartReplenishmentModal.tsx";
import { WarehouseWavePickingModal } from "../inventory/WarehouseWavePickingModal.tsx";
import { StockTransferStudioModal } from "../inventory/StockTransferStudioModal.tsx";
import { IPOStudioModal } from "../warehouse/IPOStudioModal.tsx";
import { RFIDFittingRoomStudioModal } from "../inventory/RFIDFittingRoomStudioModal.tsx";
import { LabelPrintModal } from "../warehouse/LabelPrintModal.tsx";
import { WarehouseLocationManager } from "./WarehouseLocationManager.tsx";
import { WmsRfScanTerminal } from "./WmsRfScanTerminal.tsx";
import { GRID_PROFILES } from "../../services/gridInput/gridProfiles.ts";
import type { ParsedGridRow, GridImportMode } from "../../services/gridInput/types.ts";
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
  X,
  Send,
  Store,
  Shirt,
  MapPin,
  Zap,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  RotateCcw
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

interface CycleCountItem {
  item_id: string;
  product_id: string;
  item_code: string;
  product_name: string;
  sku?: string;
  bin_location: string;
  zone?: string;
  aisle?: string;
  batch_no?: string;
  system_qty: number | null;
  counted_qty: number;
  variance_qty: number | null;
  variance_value: number | null;
  unit_cost: number;
  discrepancy_reason?: string;
  status: string;
  recount_count: number;
}

interface CycleCountPlan {
  plan_id: string;
  plan_no: string;
  warehouse_id: string;
  warehouse_code: string;
  plan_name: string;
  zone?: string;
  aisle?: string;
  is_blind: boolean;
  status: string;
  variance_threshold_value: number;
  variance_threshold_pct: number;
  total_bins: number;
  total_items: number;
  counted_items: number;
  matched_items: number;
  variance_items: number;
  requires_approval: boolean;
  created_at: string;
  completed_at?: string;
  items: CycleCountItem[];
  notes?: string;
}

interface DockDoor {
  id: string;
  code: string;
  name: string;
  zone: string;
  status: "AVAILABLE" | "OCCUPIED" | "LOADING" | "MAINTENANCE";
  assigned_vehicle?: string;
  staged_cartons_count: number;
  active_manifest_id?: string;
}

interface ManifestCarton {
  carton_barcode: string;
  wave_id?: string;
  gross_weight_kg: number;
  items_count: number;
  destination_branch?: string;
  destination_customer?: string;
  is_gate_scanned: boolean;
  scanned_at?: string;
}

interface DispatchManifest {
  manifest_id: string;
  manifest_no: string;
  warehouse_id: string;
  dock_door_code: string;
  transporter_name: string;
  vehicle_no: string;
  driver_name?: string;
  driver_phone?: string;
  lr_docket_no?: string;
  eway_bill_no?: string;
  destination?: string;
  status: "STAGED" | "LOADING" | "GATE_VERIFIED" | "DISPATCHED" | "CANCELLED";
  total_cartons: number;
  scanned_cartons: number;
  total_weight_kg: number;
  is_fully_scanned: boolean;
  created_at: string;
  dispatched_at?: string;
  gate_pass_no?: string;
  cartons: ManifestCarton[];
  notes?: string;
}

export const WmsStudioTab: React.FC<{
  currentUser?: any;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}> = ({ currentUser, onNotification }) => {
  const [activeSubTab, setActiveSubTab] = useState<"batches" | "transfers" | "inward" | "fefo" | "audit" | "locations" | "rf" | "dispatch">("batches");
  const [warehouses, setWarehouses] = useState<Godown[]>([]);
  const [binLocationManagementEnabled, setBinLocationManagementEnabled] = useState(false);
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
  const [grnSupplierId, setGrnSupplierId] = useState(""); // R-011: removed hardcoded test value
  const [grnWarehouseId, setGrnWarehouseId] = useState("");
  const [grnProductId, setGrnProductId] = useState("");
  const [grnBatchNo, setGrnBatchNo] = useState("");
  const [grnExpiryDate, setGrnExpiryDate] = useState("");
  const [grnQty, setGrnQty] = useState(0);
  const [grnCostPrice, setGrnCostPrice] = useState(0);
  const [grnLocationId, setGrnLocationId] = useState("");
  const [putawayAdviceLoading, setPutawayAdviceLoading] = useState(false);
  const [putawayAdvice, setPutawayAdvice] = useState<{
    code: string;
    location_id: string;
    name: string;
    rule: string;
    reason: string;
    headroom: number;
    capacity: number;
  } | null>(null);

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

  // WMS Phase 6: Physical Bin Cycle Count State
  const [auditMode, setAuditMode] = useState<"CYCLE_COUNT" | "BATCH_AUDIT">("CYCLE_COUNT");
  const [cycleCountPlans, setCycleCountPlans] = useState<CycleCountPlan[]>([]);
  const [selectedCycleCount, setSelectedCycleCount] = useState<CycleCountPlan | null>(null);
  const [cycleCountZone, setCycleCountZone] = useState<string>("ALL");
  const [cycleCountAisle, setCycleCountAisle] = useState<string>("");
  const [cycleCountBlind, setCycleCountBlind] = useState<boolean>(true);
  const [cycleCountThreshold, setCycleCountThreshold] = useState<number>(1000);
  const [isRevealedBlind, setIsRevealedBlind] = useState<boolean>(false);
  const [cycleCountScanInput, setCycleCountScanInput] = useState<string>("");

  // WMS Phase 7: Shipping Dock & Dispatch Manifests State
  const [dockDoors, setDockDoors] = useState<DockDoor[]>([]);
  const [dispatchManifests, setDispatchManifests] = useState<DispatchManifest[]>([]);
  const [selectedManifest, setSelectedManifest] = useState<DispatchManifest | null>(null);
  const [gateScanInput, setGateScanInput] = useState<string>("");
  const [isGateScanning, setIsGateScanning] = useState<boolean>(false);
  const [showCreateManifestModal, setShowCreateManifestModal] = useState<boolean>(false);
  const [newManifestDock, setNewManifestDock] = useState<string>("DOCK-01");
  const [newManifestTransporter, setNewManifestTransporter] = useState<string>("Blue Dart Express");
  const [newManifestVehicle, setNewManifestVehicle] = useState<string>("");
  const [newManifestDriver, setNewManifestDriver] = useState<string>("");
  const [newManifestPhone, setNewManifestPhone] = useState<string>("");
  const [newManifestCartonsText, setNewManifestCartonsText] = useState<string>("");
  const [newManifestDestination, setNewManifestDestination] = useState<string>("");

  // E-Way Bill & Delivery Challan Modal State
  const [viewingChallan, setViewingChallan] = useState<any | null>(null);

  useEffect(() => {
    if (!viewingChallan) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setViewingChallan(null);
      } else if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P"))) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingChallan]);
  const [viewingEwayBill, setViewingEwayBill] = useState<any | null>(null);
  const [transferStagingItems, setTransferStagingItems] = useState<StockTransferItem[]>([]);
  const [isGlobalTransferImportOpen, setIsGlobalTransferImportOpen] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [showReplenishModal, setShowReplenishModal] = useState(false);
  const [showWavePickingModal, setShowWavePickingModal] = useState(false);
  const [showStockTransferModal, setShowStockTransferModal] = useState(false);
  const [showIPOModal, setShowIPOModal] = useState(false);
  const [showFittingRoomModal, setShowFittingRoomModal] = useState(false);
  const [showLabelPrintModal, setShowLabelPrintModal] = useState(false);

  const fetchWmsData = async () => {
    setLoading(true);
    try {
      const [whRes, batchRes, transferRes, auditRes, featureFlags] = await Promise.all([
        apiFetchV1<Godown[]>("/wms/warehouses"),
        apiFetchV1<BatchStock[]>("/wms/batch-stocks"),
        apiFetchV1<StockTransfer[]>("/wms/transfers"),
        apiFetchV1<StockAudit[]>("/wms/audits").catch(() => []),
        apiFetchV1<Array<{ key: string; is_enabled_for_company: boolean }>>("/capabilities/feature-flags"),
      ]);
      const binLocationFlag = featureFlags.find((flag) => flag.key === "BIN_LOCATION_MANAGEMENT");
      setBinLocationManagementEnabled(binLocationFlag?.is_enabled_for_company ?? false);
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
        fetchCycleCounts(whRes[0].id);
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

  useEffect(() => {
    if (!binLocationManagementEnabled && activeSubTab === "locations") {
      setActiveSubTab("batches");
    }
  }, [activeSubTab, binLocationManagementEnabled]);

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

  // Handle Global Grid Import for Transfers
  const handleGlobalTransferImportCommit = (rows: ParsedGridRow[], mode: GridImportMode) => {
    const converted: StockTransferItem[] = rows.map((r, idx) => {
      const prod = r.resolvedProduct;
      return {
        id: `sto-import-${Date.now()}-${idx}`,
        product_id: prod?.productId || prod?.sku || r.identifier,
        batch_no: r.batch || "BATCH-DEFAULT",
        quantity: r.quantity || 1,
        unit_cost: r.rate ?? prod?.costPrice ?? 0,
      };
    });

    if (mode === "REPLACE") {
      setTransferStagingItems(converted);
    } else if (mode === "MERGE") {
      setTransferStagingItems((prev) => {
        const merged = [...prev];
        converted.forEach((newItem) => {
          const existing = merged.find(
            (m) => m.product_id === newItem.product_id && m.batch_no === newItem.batch_no
          );
          if (existing) {
            existing.quantity += newItem.quantity;
          } else {
            merged.push(newItem);
          }
        });
        return merged;
      });
    } else {
      // APPEND
      setTransferStagingItems((prev) => [...prev, ...converted]);
    }

    onNotification?.(
      "Items Staged",
      `Staged ${converted.length} line(s) for Stock Transfer Order.`,
      "success"
    );
  };

  // Add single item into staged list
  const handleAddSingleItemToTransfer = () => {
    if (!transferProductId || !transferBatchNo || transferQty <= 0) {
      onNotification?.("Validation Error", "Please provide product, batch, and positive quantity.", "error");
      return;
    }
    setTransferStagingItems((prev) => [
      ...prev,
      {
        id: `sto-single-${Date.now()}`,
        product_id: transferProductId,
        batch_no: transferBatchNo,
        quantity: transferQty,
      },
    ]);
    setTransferProductId("");
    setTransferBatchNo("");
    setTransferQty(1);
    onNotification?.("Item Added", "Item added to transfer staging list.", "success");
  };

  // Handle Transfer Creation
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceWh === destWh) {
      onNotification?.("Validation Error", "Source and destination warehouses must be different.", "error");
      return;
    }

    let itemsToSubmit: StockTransferItem[] = [...transferStagingItems];
    if (itemsToSubmit.length === 0) {
      if (!transferProductId || !transferBatchNo || transferQty <= 0) {
        onNotification?.("Validation Error", "Please add items to the transfer or import via Fast Import.", "error");
        return;
      }
      itemsToSubmit = [
        {
          product_id: transferProductId,
          batch_no: transferBatchNo,
          quantity: transferQty,
        },
      ];
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
          items: itemsToSubmit.map((it) => ({
            product_id: it.product_id,
            batch_no: it.batch_no,
            quantity: it.quantity,
            unit_cost: it.unit_cost || 0,
          })),
        }),
      });
      onNotification?.(
        "Transfer Created",
        `Stock Transfer Order with ${itemsToSubmit.length} line(s) generated in DRAFT state.`,
        "success"
      );
      setTransferStagingItems([]);
      setTransferProductId("");
      setTransferBatchNo("");
      setTransferQty(1);
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

  // Fetch Putaway recommendation for Inward GRN
  const handleGetPutawayAdvice = async () => {
    if (!grnWarehouseId) {
      onNotification?.("Validation Error", "Please select a target receiving Godown first.", "error");
      return;
    }
    if (!grnProductId.trim()) {
      onNotification?.("Validation Error", "Please provide a Product ID/Code to evaluate putaway rules.", "error");
      return;
    }

    setPutawayAdviceLoading(true);
    try {
      const res = await apiFetchV1<any>(`/wms/warehouses/${grnWarehouseId}/putaway-recommendation`, {
        method: "POST",
        body: JSON.stringify({
          product_id: grnProductId.trim(),
          quantity: grnQty > 0 ? grnQty : 1,
          batch_no: grnBatchNo.trim() || undefined,
          is_damaged: false,
        }),
      });

      if (res && res.recommended_location) {
        setPutawayAdvice({
          code: res.recommended_location.code,
          location_id: res.recommended_location.location_id,
          name: res.recommended_location.name,
          rule: res.rule_applied,
          reason: res.reason,
          headroom: res.recommended_location.available_headroom_units,
          capacity: res.recommended_location.max_capacity_units,
        });
        setGrnLocationId(res.recommended_location.location_id);
        onNotification?.(
          "Putaway Advice",
          `Optimal Bin: ${res.recommended_location.code} (${res.rule_applied})`,
          "success"
        );
      } else {
        setPutawayAdvice(null);
        onNotification?.("Putaway Advice", res?.reason || "No location available.", "info");
      }
    } catch (err: any) {
      onNotification?.("Putaway Error", err.message || "Failed to fetch putaway recommendation.", "error");
    } finally {
      setPutawayAdviceLoading(false);
    }
  };

  // Handle Inward GRN
  const handleCreateGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnSupplierId.trim()) {
      onNotification?.("Validation Error", "Please provide a Supplier ID.", "error");
      return;
    }
    if (!grnWarehouseId) {
      onNotification?.("Validation Error", "Please select a target Warehouse.", "error");
      return;
    }
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
              warehouse_location_id: grnLocationId || undefined,
            },
          ],
        }),
      });
      onNotification?.(
        "GRN Inward Complete",
        `Received ${grnQty} units into batch ${batchNo}${putawayAdvice ? ` (Putaway Bin: ${putawayAdvice.code})` : ""}.`,
        "success"
      );
      setPutawayAdvice(null);
      setGrnLocationId("");
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

  const fetchCycleCounts = async (whId: string) => {
    if (!whId) return;
    try {
      const res = await apiFetchV1<{ plans: CycleCountPlan[] }>(`/wms/warehouses/${whId}/cycle-counts`);
      setCycleCountPlans(res.plans || []);
      if (res.plans && res.plans.length > 0 && !selectedCycleCount) {
        handleSelectCycleCount(whId, res.plans[0].plan_id, false);
      }
    } catch {
      // fallback safe
    }
  };

  const handleCreateCycleCount = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetWh = auditWarehouseId || (warehouses[0]?.id || "");
    if (!targetWh) {
      onNotification?.("Validation Error", "Please select a warehouse.", "error");
      return;
    }
    try {
      setLoading(true);
      const res = await apiFetchV1<CycleCountPlan>(`/wms/warehouses/${targetWh}/cycle-counts`, {
        method: "POST",
        body: JSON.stringify({
          warehouse_id: targetWh,
          zone: cycleCountZone !== "ALL" ? cycleCountZone : undefined,
          aisle: cycleCountAisle.trim() || undefined,
          is_blind: cycleCountBlind,
          variance_threshold_value: cycleCountThreshold,
          variance_threshold_pct: 5.0,
          notes: auditNotes || undefined,
        }),
      });
      onNotification?.("Cycle Count Created", `Plan ${res.plan_no} generated with ${res.total_items} items across ${res.total_bins} bins.`, "success");
      setSelectedCycleCount(res);
      fetchCycleCounts(targetWh);
    } catch (err: any) {
      onNotification?.("Creation Error", err.message || "Failed creating cycle count plan", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCycleCount = async (whId: string, planId: string, reveal: boolean = false) => {
    try {
      setLoading(true);
      const res = await apiFetchV1<CycleCountPlan>(`/wms/warehouses/${whId}/cycle-counts/${planId}?reveal_blind=${reveal}`);
      setSelectedCycleCount(res);
      setIsRevealedBlind(reveal);
    } catch (err: any) {
      onNotification?.("Plan Error", err.message || "Failed loading cycle count details", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordCycleCountItem = async (itemId: string, countedQty: number, scannedBarcode?: string, reason?: string) => {
    if (!selectedCycleCount) return;
    const targetWh = selectedCycleCount.warehouse_id;
    try {
      const res = await apiFetchV1<any>(`/wms/warehouses/${targetWh}/cycle-counts/${selectedCycleCount.plan_id}/count`, {
        method: "POST",
        body: JSON.stringify({
          item_id: itemId,
          counted_qty: countedQty,
          scanned_barcode: scannedBarcode || undefined,
          discrepancy_reason: reason || undefined,
        }),
      });
      onNotification?.(
        "Count Recorded",
        `Counted ${countedQty} for ${res.bin_location}. Status: ${res.status}${res.requires_approval ? " (Approval Required)" : ""}`,
        res.requires_approval ? "warning" : "success"
      );
      handleSelectCycleCount(targetWh, selectedCycleCount.plan_id, isRevealedBlind);
      fetchCycleCounts(targetWh);
    } catch (err: any) {
      onNotification?.("Count Error", err.message || "Failed recording count", "error");
    }
  };

  const handleRecountCycleCount = async (itemId: string) => {
    if (!selectedCycleCount) return;
    const targetWh = selectedCycleCount.warehouse_id;
    try {
      await apiFetchV1(`/wms/warehouses/${targetWh}/cycle-counts/${selectedCycleCount.plan_id}/recount`, {
        method: "POST",
        body: JSON.stringify({
          item_id: itemId,
          reason: "Floor recount requested by supervisor",
        }),
      });
      onNotification?.("Recount Scheduled", "Item flagged for secondary recount.", "info");
      handleSelectCycleCount(targetWh, selectedCycleCount.plan_id, isRevealedBlind);
    } catch (err: any) {
      onNotification?.("Recount Error", err.message || "Failed requesting recount", "error");
    }
  };

  const handleApproveCycleCount = async () => {
    if (!selectedCycleCount) return;
    const targetWh = selectedCycleCount.warehouse_id;
    try {
      await apiFetchV1(`/wms/warehouses/${targetWh}/cycle-counts/${selectedCycleCount.plan_id}/approve`, {
        method: "POST",
        body: JSON.stringify({ supervisor_notes: "Approved by supervisor in WMS Studio" }),
      });
      onNotification?.("Variances Approved", `Plan ${selectedCycleCount.plan_no} approved. Ready for reconciliation.`, "success");
      handleSelectCycleCount(targetWh, selectedCycleCount.plan_id, isRevealedBlind);
      fetchCycleCounts(targetWh);
    } catch (err: any) {
      onNotification?.("Approval Error", err.message || "Failed approving plan", "error");
    }
  };

  const handleReconcileCycleCount = async () => {
    if (!selectedCycleCount) return;
    if (!confirm(`Are you sure you want to reconcile cycle count ${selectedCycleCount.plan_no}? This will post immutable StockMovement adjustments to the bin ledger.`)) {
      return;
    }
    const targetWh = selectedCycleCount.warehouse_id;
    try {
      setIsReconciling(true);
      const res = await apiFetchV1<any>(`/wms/warehouses/${targetWh}/cycle-counts/${selectedCycleCount.plan_id}/reconcile`, {
        method: "POST",
      });
      onNotification?.("Reconciliation Complete", `Plan ${selectedCycleCount.plan_no} reconciled. Posted ${res.adjustments_posted} bin movements.`, "success");
      handleSelectCycleCount(targetWh, selectedCycleCount.plan_id, true);
      fetchCycleCounts(targetWh);
    } catch (err: any) {
      onNotification?.("Reconciliation Error", err.message || "Failed reconciling plan", "error");
    } finally {
      setIsReconciling(false);
    }
  };

  // WMS Phase 7: Shipping Dock & Dispatch Manifest Handlers
  const fetchDockDoors = async (whId: string) => {
    if (!whId) return;
    try {
      const res = await apiFetchV1<DockDoor[]>(`/wms/warehouses/${whId}/docks`);
      setDockDoors(res || []);
    } catch {
      // fallback safe
    }
  };

  const fetchDispatchManifests = async (whId: string) => {
    if (!whId) return;
    try {
      const res = await apiFetchV1<{ manifests: DispatchManifest[] }>(`/wms/warehouses/${whId}/dispatch-manifests`);
      setDispatchManifests(res.manifests || []);
      if (res.manifests && res.manifests.length > 0 && !selectedManifest) {
        handleSelectManifest(whId, res.manifests[0].manifest_id);
      }
    } catch {
      // fallback safe
    }
  };

  const handleSelectManifest = async (whId: string, manifestId: string) => {
    try {
      const res = await apiFetchV1<DispatchManifest>(`/wms/warehouses/${whId}/dispatch-manifests/${manifestId}`);
      setSelectedManifest(res);
    } catch (err: any) {
      onNotification?.("Load Error", err.message || "Failed loading manifest", "error");
    }
  };

  const handleCreateManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetWh = auditWarehouseId || (warehouses[0]?.id || "");
    if (!targetWh) {
      onNotification?.("Validation Error", "Select a warehouse first.", "error");
      return;
    }
    const cartonList = newManifestCartonsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (cartonList.length === 0) {
      onNotification?.("Validation Error", "Please provide at least one carton barcode.", "error");
      return;
    }
    if (!newManifestVehicle.trim()) {
      onNotification?.("Validation Error", "Vehicle number is required.", "error");
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetchV1<DispatchManifest>(`/wms/warehouses/${targetWh}/dispatch-manifests`, {
        method: "POST",
        body: JSON.stringify({
          warehouse_id: targetWh,
          dock_door_code: newManifestDock,
          carton_barcodes: cartonList,
          transporter_name: newManifestTransporter,
          vehicle_no: newManifestVehicle.trim(),
          driver_name: newManifestDriver.trim() || undefined,
          driver_phone: newManifestPhone.trim() || undefined,
          destination: newManifestDestination.trim() || undefined,
        }),
      });
      onNotification?.("Manifest Created", `Manifest ${res.manifest_no} created with ${res.total_cartons} cartons at ${res.dock_door_code}.`, "success");
      setShowCreateManifestModal(false);
      setNewManifestCartonsText("");
      setNewManifestVehicle("");
      setNewManifestDriver("");
      setNewManifestPhone("");
      fetchDispatchManifests(targetWh);
      fetchDockDoors(targetWh);
      setSelectedManifest(res);
    } catch (err: any) {
      onNotification?.("Creation Error", err.message || "Failed creating dispatch manifest", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGateScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManifest || !gateScanInput.trim()) return;
    const targetWh = selectedManifest.warehouse_id;
    try {
      setIsGateScanning(true);
      const res = await apiFetchV1<any>(`/wms/warehouses/${targetWh}/dispatch-manifests/${selectedManifest.manifest_id}/gate-scan`, {
        method: "POST",
        body: JSON.stringify({
          carton_barcode: gateScanInput.trim(),
        }),
      });
      onNotification?.("Gate Scan Success", res.message, "success");
      setGateScanInput("");
      handleSelectManifest(targetWh, selectedManifest.manifest_id);
      fetchDispatchManifests(targetWh);
    } catch (err: any) {
      onNotification?.("Gate Scan Alert", err.message || "Carton not in manifest", "error");
    } finally {
      setIsGateScanning(false);
    }
  };

  const handleConfirmDispatch = async (supervisorOverride: boolean = false) => {
    if (!selectedManifest) return;
    const targetWh = selectedManifest.warehouse_id;
    if (
      !confirm(
        supervisorOverride
          ? `Authorize partial dispatch with supervisor override for Manifest ${selectedManifest.manifest_no}?`
          : `Confirm truck departure and dispatch Manifest ${selectedManifest.manifest_no}? This will finalize the Gate Pass.`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetchV1<any>(`/wms/warehouses/${targetWh}/dispatch-manifests/${selectedManifest.manifest_id}/dispatch`, {
        method: "POST",
        body: JSON.stringify({
          supervisor_override: supervisorOverride,
          override_reason: supervisorOverride ? "Authorized partial load by supervisor" : undefined,
        }),
      });
      onNotification?.("Dispatched Successfully", `Gate Pass: ${res.gate_pass_no} issued. Vehicle ${res.vehicle_no} authorized to depart.`, "success");
      handleSelectManifest(targetWh, selectedManifest.manifest_id);
      fetchDispatchManifests(targetWh);
      fetchDockDoors(targetWh);
    } catch (err: any) {
      onNotification?.("Dispatch Error", err.message || "Failed confirming dispatch", "error");
    } finally {
      setLoading(false);
    }
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
                {ENTERPRISE_BILLING_SUITE_VERSION_LABEL} Production Ready
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
            {binLocationManagementEnabled && (
              <button
                onClick={() => setActiveSubTab("locations")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeSubTab === "locations"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-theme-muted hover:text-theme-body"
                }`}
              >
                <MapPin className="w-4 h-4" />
                Locations & Replenish
              </button>
            )}
            <button
              onClick={() => setActiveSubTab("rf")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "rf"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-theme-muted hover:text-theme-body"
              }`}
            >
              <ScanLine className="w-4 h-4" />
              RF Terminal
            </button>
            <button
              onClick={() => {
                setActiveSubTab("dispatch");
                const targetWh = auditWarehouseId || warehouses[0]?.id || "";
                fetchDockDoors(targetWh);
                fetchDispatchManifests(targetWh);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "dispatch"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-theme-muted hover:text-theme-body"
              }`}
            >
              <Truck className="w-4 h-4" />
              Dock & Dispatch
            </button>
          </div>

          <button
            type="button"
            id="wms-stock-expiry-btn"
            onClick={() => setShowExpiryModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Inspect Batch Expiry, Quarantines & Recalls"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Stock Expiry</span>
          </button>

          <button
            type="button"
            id="wms-smart-replenish-btn"
            onClick={() => setShowReplenishModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Smart Replenishment Engine & Safety Stock Matrix"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Smart Replenish</span>
          </button>

          <button
            type="button"
            id="wms-wave-picking-btn"
            onClick={() => setShowWavePickingModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Automated Wave Picking, RFID Verification & Bin Allocation"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Wave Picking</span>
          </button>

          <button
            type="button"
            id="wms-stock-transfer-modal-btn"
            onClick={() => setShowStockTransferModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Inter-Branch Stock Transfer Requisition & Approval Matrix"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">STO Requisition</span>
          </button>

          <button
            type="button"
            id="wms-ipo-modal-btn"
            onClick={() => setShowIPOModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Inter-Store Purchase Orders, Picking & Auto-GRN"
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Inter-Store PO</span>
          </button>

          <button
            type="button"
            id="wms-rfid-fitting-btn"
            onClick={() => setShowFittingRoomModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Smart RFID Fitting Room Analytics & Cross-Sell Recommendations"
          >
            <Shirt className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Fitting Room</span>
          </button>

          <button
            type="button"
            id="wms-label-print-btn"
            onClick={() => setShowLabelPrintModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Batch Warehouse Barcode & Shelf Label Print Studio"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Print Labels</span>
          </button>

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
              <div className="flex items-center justify-between border-b border-theme-divider pb-3">
                <div className="flex items-center space-x-2">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-theme-text-primary">Initiate Stock Transfer (STO)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGlobalTransferImportOpen(true)}
                  className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Import Transfer Lines from Excel, PDT, or Scanner"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>Fast Import</span>
                </button>
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

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddSingleItemToTransfer}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body text-xs font-semibold transition-all cursor-pointer"
                  >
                    + Add Item to List
                  </button>
                </div>

                {transferStagingItems.length > 0 && (
                  <div className="space-y-2 border border-theme-divider/70 rounded-xl p-3 bg-theme-surface-2/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-theme-text-primary uppercase tracking-wider text-[10px]">
                        Staged Items ({transferStagingItems.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setTransferStagingItems([])}
                        className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-theme-divider/40 text-xs font-mono">
                      {transferStagingItems.map((item, idx) => (
                        <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                          <div className="truncate flex-1 pr-2">
                            <span className="text-theme-body font-semibold">{item.product_id}</span>
                            <span className="text-theme-muted text-[10px] ml-1.5">({item.batch_no})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-400">{item.quantity} units</span>
                            <button
                              type="button"
                              onClick={() => setTransferStagingItems((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full mt-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Create Transfer Order (STO) {transferStagingItems.length > 0 ? `(${transferStagingItems.length} Items)` : ""}
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

              {/* Putaway Recommendation Section */}
              <div className="bg-theme-surface-2/60 border border-theme-divider rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-theme-body">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Physical Putaway Bin Allocation</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGetPutawayAdvice}
                    disabled={putawayAdviceLoading}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${putawayAdviceLoading ? "animate-spin" : ""}`} />
                    <span>{putawayAdviceLoading ? "Calculating..." : "⚡ Get Putaway Advice"}</span>
                  </button>
                </div>

                {putawayAdvice ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-emerald-400">{putawayAdvice.code}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {putawayAdvice.rule}
                        </span>
                        <span className="text-theme-muted text-[11px]">({putawayAdvice.name})</span>
                      </div>
                      <p className="text-[11px] text-theme-muted mt-1">{putawayAdvice.reason}</p>
                    </div>
                    <div className="text-right text-[11px] font-mono">
                      <div className="text-emerald-400 font-bold">Headroom: {putawayAdvice.headroom.toFixed(0)} units</div>
                      <div className="text-theme-muted text-[10px]">Max Cap: {putawayAdvice.capacity} units</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-theme-muted">
                    Click <strong>Get Putaway Advice</strong> to evaluate the 4-tier engine rule cascade (Quarantine → Dedicated Bin → Co-located Stock → Nearest Empty Bin) for this product inwarding.
                  </p>
                )}
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
          <div className="space-y-4">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between pb-2 border-b border-theme-divider">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuditMode("CYCLE_COUNT")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    auditMode === "CYCLE_COUNT"
                      ? "bg-indigo-600 text-white shadow"
                      : "bg-theme-surface-2 text-theme-muted hover:text-theme-body"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Physical Bin Cycle Count (Phase 6)
                </button>
                <button
                  type="button"
                  onClick={() => setAuditMode("BATCH_AUDIT")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    auditMode === "BATCH_AUDIT"
                      ? "bg-indigo-600 text-white shadow"
                      : "bg-theme-surface-2 text-theme-muted hover:text-theme-body"
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Legacy Batch Stocktake
                </button>
              </div>

              {auditMode === "CYCLE_COUNT" && (
                <div className="text-[11px] text-theme-muted flex items-center gap-2 font-mono">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                    Spatial Bin Matrix
                  </span>
                  <span>Zone/Aisle Scoped Verification</span>
                </div>
              )}
            </div>

            {auditMode === "CYCLE_COUNT" ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column: Initiate Plan & History */}
                <div className="space-y-6">
                  {/* Create Cycle Count Plan Form */}
                  <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-4">
                    <div className="flex items-center space-x-2 border-b border-theme-divider pb-3">
                      <ClipboardCheck className="w-5 h-5 text-indigo-400" />
                      <h3 className="text-sm font-bold text-theme-text-primary">New Bin Cycle Count Plan</h3>
                    </div>

                    <form onSubmit={handleCreateCycleCount} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-theme-muted mb-1">Target Warehouse</label>
                        <select
                          value={auditWarehouseId}
                          onChange={(e) => {
                            setAuditWarehouseId(e.target.value);
                            fetchCycleCounts(e.target.value);
                          }}
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                        >
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-theme-muted mb-1">Zone Scope</label>
                          <select
                            value={cycleCountZone}
                            onChange={(e) => setCycleCountZone(e.target.value)}
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                          >
                            <option value="ALL">All Zones</option>
                            <option value="PICKING">PICKING</option>
                            <option value="BULK">BULK</option>
                            <option value="STORAGE">STORAGE</option>
                            <option value="QUARANTINE">QUARANTINE</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-theme-muted mb-1">Aisle (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. A-01"
                            value={cycleCountAisle}
                            onChange={(e) => setCycleCountAisle(e.target.value)}
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-theme-surface-2 border border-theme-divider">
                        <div>
                          <label className="block text-xs font-bold text-theme-text-primary">Blind Count Mode</label>
                          <span className="text-[10px] text-theme-muted block">Hides expected quantities from floor counters</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={cycleCountBlind}
                          onChange={(e) => setCycleCountBlind(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-theme-muted mb-1">Variance Threshold (₹)</label>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={cycleCountThreshold}
                          onChange={(e) => setCycleCountThreshold(Number(e.target.value))}
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-theme-muted mb-1">Audit Notes</label>
                        <input
                          type="text"
                          placeholder="e.g. Weekly Picking Bins Audit"
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
                        <Layers className="w-4 h-4" />
                        Generate Physical Bin Cycle Count Plan
                      </button>
                    </form>
                  </div>

                  {/* Cycle Count Plan History */}
                  <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-theme-muted">Cycle Count Plans</h4>
                    {cycleCountPlans.length === 0 ? (
                      <div className="text-center py-6 text-xs text-theme-muted">No cycle count plans created yet.</div>
                    ) : (
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {cycleCountPlans.map((p) => (
                          <div
                            key={p.plan_id}
                            onClick={() => handleSelectCycleCount(p.warehouse_id, p.plan_id, false)}
                            className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                              selectedCycleCount?.plan_id === p.plan_id
                                ? "bg-indigo-500/10 border-indigo-500 text-theme-text-primary"
                                : "bg-theme-surface-2/60 border-theme-divider hover:border-theme-divider-hover text-theme-muted"
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-bold text-indigo-400">{p.plan_no}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.status === "RECONCILED"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : p.status === "PENDING_APPROVAL"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : p.status === "APPROVED"
                                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                                }`}
                              >
                                {p.status}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[11px]">
                              <span>{p.plan_name}</span>
                              <span>{p.total_items} items • {p.total_bins} bins</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column (2 spans): Active Cycle Count Workspace */}
                <div className="xl:col-span-2 space-y-6">
                  {selectedCycleCount ? (
                    <div className="bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-5">
                      {/* Header Info & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-theme-divider">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-mono">
                            <h3 className="text-base font-bold text-theme-text-primary">{selectedCycleCount.plan_no}</h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                selectedCycleCount.status === "RECONCILED"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : selectedCycleCount.status === "PENDING_APPROVAL"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              }`}
                            >
                              {selectedCycleCount.status}
                            </span>
                            {selectedCycleCount.is_blind && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                <EyeOff className="w-3 h-3" /> Blind Mode
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-theme-muted">
                            Warehouse: <strong className="text-theme-body">{selectedCycleCount.warehouse_code}</strong> • Zone: {selectedCycleCount.zone || "All"} • Threshold: ₹{selectedCycleCount.variance_threshold_value}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {selectedCycleCount.is_blind && selectedCycleCount.status !== "RECONCILED" && (
                            <button
                              type="button"
                              onClick={() => handleSelectCycleCount(selectedCycleCount.warehouse_id, selectedCycleCount.plan_id, !isRevealedBlind)}
                              className="py-1.5 px-3 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-3 text-theme-body text-xs font-semibold border border-theme-divider transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              {isRevealedBlind ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              <span>{isRevealedBlind ? "Mask System Stock" : "Reveal System Stock (Supervisor)"}</span>
                            </button>
                          )}

                          {selectedCycleCount.requires_approval && selectedCycleCount.status === "PENDING_APPROVAL" && (
                            <button
                              type="button"
                              onClick={handleApproveCycleCount}
                              className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              <span>Approve Variances (Supervisor)</span>
                            </button>
                          )}

                          {selectedCycleCount.status !== "RECONCILED" && (
                            <button
                              type="button"
                              onClick={handleReconcileCycleCount}
                              disabled={isReconciling || (selectedCycleCount.requires_approval && selectedCycleCount.status !== "APPROVED")}
                              className="py-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{isReconciling ? "Reconciling..." : "Reconcile & Post Discrepancies"}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rapid Floor Scan Input */}
                      {selectedCycleCount.status !== "RECONCILED" && (
                        <div className="bg-theme-surface-2 p-3.5 rounded-xl border border-theme-divider flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <ScanLine className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder="Scan Bin Location / Item SKU to increment count (+1)..."
                              value={cycleCountScanInput}
                              onChange={(e) => setCycleCountScanInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && cycleCountScanInput.trim()) {
                                  e.preventDefault();
                                  const targetIt = selectedCycleCount.items.find(
                                    (it) => it.bin_location.toUpperCase() === cycleCountScanInput.trim().toUpperCase() ||
                                            (it.sku && it.sku.toUpperCase() === cycleCountScanInput.trim().toUpperCase())
                                  );
                                  if (targetIt) {
                                    handleRecordCycleCountItem(targetIt.item_id, targetIt.counted_qty + 1, cycleCountScanInput.trim());
                                  } else {
                                    onNotification?.("Scan Mismatch", `No item matching '${cycleCountScanInput}' found in plan.`, "error");
                                  }
                                  setCycleCountScanInput("");
                                }
                              }}
                              className="w-full bg-transparent text-xs text-theme-body placeholder:text-theme-muted focus:outline-none font-mono"
                            />
                          </div>
                          <span className="text-[10px] text-theme-muted font-mono">Press Enter to count</span>
                        </div>
                      )}

                      {/* KPI Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-theme-surface-2/60 rounded-xl border border-theme-divider">
                          <span className="text-[11px] text-theme-muted block">Bins Audited</span>
                          <span className="text-lg font-bold font-mono text-theme-text-primary">{selectedCycleCount.total_bins}</span>
                        </div>
                        <div className="p-3 bg-theme-surface-2/60 rounded-xl border border-theme-divider">
                          <span className="text-[11px] text-theme-muted block">Items in Scope</span>
                          <span className="text-lg font-bold font-mono text-indigo-400">{selectedCycleCount.total_items}</span>
                        </div>
                        <div className="p-3 bg-theme-surface-2/60 rounded-xl border border-theme-divider">
                          <span className="text-[11px] text-theme-muted block">Counted Items</span>
                          <span className="text-lg font-bold font-mono text-emerald-400">{selectedCycleCount.counted_items}</span>
                        </div>
                        <div className="p-3 bg-theme-surface-2/60 rounded-xl border border-theme-divider">
                          <span className="text-[11px] text-theme-muted block">Variance Items</span>
                          <span className="text-lg font-bold font-mono text-rose-400">{selectedCycleCount.variance_items}</span>
                        </div>
                      </div>

                      {/* Cycle Count Table */}
                      <div className="overflow-x-auto border border-theme-divider rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-theme-surface-2 text-theme-muted border-b border-theme-divider font-semibold">
                              <th className="p-3">Bin Location</th>
                              <th className="p-3">Product / SKU</th>
                              <th className="p-3 text-right">System Qty</th>
                              <th className="p-3 text-right">Physical Count</th>
                              <th className="p-3 text-right">Variance</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-theme-divider font-mono">
                            {selectedCycleCount.items.map((it) => {
                              const isMasked = it.system_qty === null;
                              return (
                                <tr key={it.item_id} className="hover:bg-theme-surface-2/40 transition-colors">
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                                      {it.bin_location}
                                    </span>
                                  </td>
                                  <td className="p-3 font-sans">
                                    <div className="font-bold text-theme-text-primary">{it.product_name}</div>
                                    <div className="text-[10px] text-theme-muted font-mono">{it.sku || it.item_code}</div>
                                  </td>
                                  <td className="p-3 text-right text-theme-body">
                                    {isMasked ? (
                                      <span className="text-theme-muted italic">*** (Blind)</span>
                                    ) : (
                                      Number(it.system_qty).toFixed(2)
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    {selectedCycleCount.status === "RECONCILED" ? (
                                      <span className="font-bold text-theme-text-primary">{Number(it.counted_qty).toFixed(2)}</span>
                                    ) : (
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        defaultValue={it.counted_qty}
                                        onBlur={(e) => handleRecordCycleCountItem(it.item_id, Number(e.target.value))}
                                        className="w-20 bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-right text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                                      />
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-bold">
                                    {isMasked ? (
                                      <span className="text-theme-muted">***</span>
                                    ) : (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[11px] ${
                                          it.variance_qty === 0
                                            ? "bg-emerald-500/10 text-emerald-400"
                                            : (it.variance_qty || 0) < 0
                                            ? "bg-rose-500/10 text-rose-400"
                                            : "bg-cyan-500/10 text-cyan-400"
                                        }`}
                                      >
                                        {(it.variance_qty || 0) > 0 ? `+${Number(it.variance_qty).toFixed(2)}` : Number(it.variance_qty || 0).toFixed(2)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        it.status === "MATCHED" || it.status === "RECONCILED" || it.status === "APPROVED"
                                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                          : it.status === "APPROVAL_REQUIRED"
                                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold animate-pulse"
                                          : it.status === "RECOUNT_REQUESTED"
                                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                          : "bg-slate-700/50 text-slate-400 border border-slate-600/30"
                                      }`}
                                    >
                                      {it.status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    {selectedCycleCount.status !== "RECONCILED" && (
                                      <button
                                        type="button"
                                        onClick={() => handleRecountCycleCount(it.item_id)}
                                        title="Request Floor Recount"
                                        className="p-1 rounded text-theme-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
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
                      <MapPin className="w-10 h-10 text-theme-muted mx-auto" />
                      <h4 className="text-sm font-bold text-theme-text-primary">No Cycle Count Plan Selected</h4>
                      <p className="text-xs text-theme-muted max-w-sm mx-auto">
                        Select an existing plan from the left list or generate a new physical bin cycle count to start scanning.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Legacy Batch Stocktake View */
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
          </div>
        )}

        {/* SUBTAB 6: PHYSICAL LOCATIONS & BINS */}
        {binLocationManagementEnabled && activeSubTab === "locations" && (
          <WarehouseLocationManager
            warehouses={warehouses}
            activeWarehouseId={selectedWarehouseFilter !== "ALL" ? selectedWarehouseFilter : (warehouses[0]?.id || "")}
            onSelectWarehouse={(id) => setSelectedWarehouseFilter(id)}
            onNotification={(title, msg, type) => onNotification?.(title, msg, type === "info" ? "success" : type)}
            onOpenLabelPrinter={() => setShowLabelPrintModal(true)}
          />
        )}

        {/* SUBTAB 7: RF GUN TERMINAL & MOBILE REPLENISHMENT */}
        {activeSubTab === "rf" && (
          <WmsRfScanTerminal
            warehouses={warehouses}
            currentUser={currentUser}
            onNotification={onNotification}
          />
        )}

        {/* SUBTAB 8: OUTBOUND SHIPPING DOCK & DISPATCH MANIFEST */}
        {activeSubTab === "dispatch" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Stat Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-theme-surface-1 rounded-2xl border border-theme-divider">
                <div className="flex items-center justify-between text-theme-muted text-xs font-semibold mb-1">
                  <span>Shipping Dock Doors</span>
                  <Warehouse className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-theme-text-primary">
                  {dockDoors.length || 4}
                </div>
                <div className="text-[11px] text-emerald-400 font-medium mt-1">
                  {dockDoors.filter((d) => d.status === "AVAILABLE").length} Available Bays
                </div>
              </div>

              <div className="p-4 bg-theme-surface-1 rounded-2xl border border-theme-divider">
                <div className="flex items-center justify-between text-theme-muted text-xs font-semibold mb-1">
                  <span>Staged Cartons at Docks</span>
                  <Boxes className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-cyan-400">
                  {dockDoors.reduce((acc, d) => acc + (d.staged_cartons_count || 0), 0)}
                </div>
                <div className="text-[11px] text-theme-muted font-medium mt-1">
                  Ready for Carrier Loading
                </div>
              </div>

              <div className="p-4 bg-theme-surface-1 rounded-2xl border border-theme-divider">
                <div className="flex items-center justify-between text-theme-muted text-xs font-semibold mb-1">
                  <span>Active Manifests</span>
                  <Truck className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-400">
                  {dispatchManifests.filter((m) => m.status !== "DISPATCHED").length}
                </div>
                <div className="text-[11px] text-amber-400/80 font-medium mt-1">
                  Loading & Staging
                </div>
              </div>

              <div className="p-4 bg-theme-surface-1 rounded-2xl border border-theme-divider">
                <div className="flex items-center justify-between text-theme-muted text-xs font-semibold mb-1">
                  <span>Dispatched Shipments</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {dispatchManifests.filter((m) => m.status === "DISPATCHED").length}
                </div>
                <div className="text-[11px] text-emerald-400/80 font-medium mt-1">
                  Gate Departures Confirmed
                </div>
              </div>
            </div>

            {/* Outbound Shipping Dock Doors Visual Matrix */}
            <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-theme-text-primary flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-400" />
                    Physical Outbound Dock Doors
                  </h3>
                  <p className="text-xs text-theme-muted">
                    Live bay occupancy, vehicle assignment, and staged shipping cartons
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateManifestModal(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <PackagePlus className="w-4 h-4" />
                  + Create Dispatch Manifest
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {dockDoors.map((dock) => {
                  const isOccupied = dock.status === "OCCUPIED" || dock.status === "LOADING";
                  return (
                    <div
                      key={dock.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isOccupied
                          ? "bg-indigo-500/5 border-indigo-500/30"
                          : "bg-theme-surface-2/40 border-theme-divider hover:border-theme-divider"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold text-sm text-theme-text-primary">{dock.code}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            dock.status === "AVAILABLE"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : dock.status === "LOADING"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          }`}
                        >
                          {dock.status}
                        </span>
                      </div>
                      <div className="text-xs text-theme-muted">{dock.name}</div>
                      <div className="mt-3 pt-3 border-t border-theme-divider flex items-center justify-between text-xs">
                        <span className="text-theme-muted">Staged Cartons:</span>
                        <span className="font-mono font-bold text-cyan-400">{dock.staged_cartons_count}</span>
                      </div>
                      {dock.assigned_vehicle && (
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-theme-muted">Vehicle:</span>
                          <span className="font-mono font-bold text-indigo-400">{dock.assigned_vehicle}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manifest Manager: 2-Column Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left Column: Manifests List */}
              <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-theme-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    Dispatch Manifests
                  </h4>
                  <span className="text-xs font-mono text-theme-muted">{dispatchManifests.length} total</span>
                </div>

                <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {dispatchManifests.length === 0 ? (
                    <div className="text-center py-10 text-xs text-theme-muted">
                      No dispatch manifests generated. Click "+ Create Dispatch Manifest" above to assemble packed cartons.
                    </div>
                  ) : (
                    dispatchManifests.map((m) => {
                      const isSel = selectedManifest?.manifest_id === m.manifest_id;
                      return (
                        <div
                          key={m.manifest_id}
                          onClick={() => handleSelectManifest(m.warehouse_id, m.manifest_id)}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                            isSel
                              ? "bg-indigo-600/10 border-indigo-500 text-theme-text-primary shadow-sm"
                              : "bg-theme-surface-2/40 border-theme-divider hover:bg-theme-surface-2 text-theme-body"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-bold text-xs text-indigo-400">{m.manifest_no}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.status === "DISPATCHED"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : m.status === "GATE_VERIFIED"
                                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                  : m.status === "LOADING"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                                  : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-theme-text-primary">{m.transporter_name}</div>
                          <div className="text-[11px] text-theme-muted font-mono mt-1 flex items-center justify-between">
                            <span>Veh: {m.vehicle_no}</span>
                            <span>{m.total_cartons} Cartons ({m.total_weight_kg} kg)</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column (2 spans): Selected Manifest Details & Gate Loading Station */}
              <div className="xl:col-span-2 space-y-6">
                {selectedManifest ? (
                  <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider space-y-5">
                    {/* Manifest Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-theme-divider">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold font-mono text-theme-text-primary">{selectedManifest.manifest_no}</h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              selectedManifest.status === "DISPATCHED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : selectedManifest.status === "GATE_VERIFIED"
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                            }`}
                          >
                            {selectedManifest.status}
                          </span>
                        </div>
                        <div className="text-xs text-theme-muted mt-1 flex items-center gap-3">
                          <span>Bay: <strong className="text-indigo-400 font-mono">{selectedManifest.dock_door_code}</strong></span>
                          <span>Transporter: <strong className="text-theme-text-primary">{selectedManifest.transporter_name}</strong></span>
                          <span>Vehicle: <strong className="text-theme-text-primary font-mono">{selectedManifest.vehicle_no}</strong></span>
                        </div>
                      </div>

                      {/* Action Button: Dispatch Confirm */}
                      {selectedManifest.status !== "DISPATCHED" && (
                        <div className="flex items-center gap-2">
                          {selectedManifest.is_fully_scanned ? (
                            <button
                              type="button"
                              onClick={() => handleConfirmDispatch(false)}
                              disabled={loading}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              Authorize Gate Departure & Dispatch
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleConfirmDispatch(true)}
                              disabled={loading}
                              className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Supervisor Override for Partial Load"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Supervisor Override (Partial Load)
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Gate Scan Loading Progress */}
                    <div className="p-4 bg-theme-surface-2/60 rounded-xl border border-theme-divider space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-theme-text-primary flex items-center gap-1.5">
                          <ScanLine className="w-4 h-4 text-indigo-400" />
                          Vehicle Loading Gate Scan Progress
                        </span>
                        <span className="font-mono font-bold text-indigo-400">
                          {selectedManifest.scanned_cartons} / {selectedManifest.total_cartons} Cartons Scanned
                        </span>
                      </div>
                      <div className="w-full bg-theme-base rounded-full h-2.5 overflow-hidden border border-theme-divider">
                        <div
                          className="bg-emerald-500 h-2.5 transition-all duration-300 rounded-full"
                          style={{
                            width: `${(selectedManifest.scanned_cartons / Math.max(1, selectedManifest.total_cartons)) * 100}%`,
                          }}
                        />
                      </div>

                      {/* Optical Barcode Scan Input */}
                      {selectedManifest.status !== "DISPATCHED" && (
                        <form onSubmit={handleGateScan} className="flex gap-2 pt-1">
                          <div className="relative flex-1">
                            <ScanLine className="w-4 h-4 text-theme-muted absolute left-3 top-2.5" />
                            <input
                              type="text"
                              value={gateScanInput}
                              onChange={(e) => setGateScanInput(e.target.value)}
                              placeholder="Scan carton barcode at truck tail (e.g., BOX-...) and press Enter"
                              disabled={isGateScanning}
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-theme-text-primary placeholder:text-theme-muted focus:outline-none focus:border-indigo-500 transition-all"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isGateScanning || !gateScanInput.trim()}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Verify Scan
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Itemized Cartons Manifest Table */}
                    <div className="overflow-x-auto border border-theme-divider rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-theme-surface-2 text-theme-muted border-b border-theme-divider font-semibold">
                            <th className="p-3">Carton Barcode</th>
                            <th className="p-3 text-right">Items Count</th>
                            <th className="p-3 text-right">Gross Wt (kg)</th>
                            <th className="p-3">Gate Scan Status</th>
                            <th className="p-3">Scanned Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme-divider font-mono">
                          {selectedManifest.cartons.map((c) => (
                            <tr key={c.carton_barcode} className="hover:bg-theme-surface-2/40 transition-colors">
                              <td className="p-3 font-bold text-indigo-400">{c.carton_barcode}</td>
                              <td className="p-3 text-right text-theme-body">{c.items_count}</td>
                              <td className="p-3 text-right text-theme-body">{c.gross_weight_kg.toFixed(2)}</td>
                              <td className="p-3 font-sans">
                                {c.is_gate_scanned ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <Check className="w-3 h-3" /> Loaded onto Truck
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-theme-surface-2 text-theme-muted">
                                    Pending Tail Scan
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-[11px] text-theme-muted font-sans">
                                {c.scanned_at ? new Date(c.scanned_at).toLocaleTimeString() : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Dispatched Summary & Gate Pass Reference */}
                    {selectedManifest.status === "DISPATCHED" && (
                      <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            Gate Departure Confirmed & Dispatched
                          </div>
                          <div className="text-[11px] text-theme-muted mt-0.5">
                            Gate Pass: <strong className="font-mono text-theme-text-primary">{selectedManifest.gate_pass_no}</strong> | Dispatched: {selectedManifest.dispatched_at ? new Date(selectedManifest.dispatched_at).toLocaleString() : ""}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-theme-surface-1 p-12 rounded-2xl border border-theme-divider text-center space-y-3">
                    <Truck className="w-10 h-10 text-theme-muted mx-auto" />
                    <h4 className="text-sm font-bold text-theme-text-primary">No Manifest Selected</h4>
                    <p className="text-xs text-theme-muted max-w-sm mx-auto">
                      Select an active dispatch manifest from the left list or create a new manifest to initiate gate loading.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Create Manifest Modal */}
            {showCreateManifestModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2/50">
                    <h3 className="text-sm font-bold text-theme-text-primary flex items-center gap-2">
                      <Truck className="w-4 h-4 text-indigo-400" />
                      Assemble Outbound Dispatch Manifest
                    </h3>
                    <button
                      onClick={() => setShowCreateManifestModal(false)}
                      className="p-1 rounded-lg hover:bg-theme-surface-hover text-theme-muted hover:text-theme-body"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateManifest} className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-theme-muted block mb-1">Dock Door Bay</label>
                        <select
                          value={newManifestDock}
                          onChange={(e) => setNewManifestDock(e.target.value)}
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
                        >
                          {dockDoors.map((d) => (
                            <option key={d.code} value={d.code}>
                              {d.code} ({d.name})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-theme-muted block mb-1">Transporter / Logistics</label>
                        <input
                          type="text"
                          value={newManifestTransporter}
                          onChange={(e) => setNewManifestTransporter(e.target.value)}
                          placeholder="e.g. Blue Dart, Safechem"
                          required
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-theme-muted block mb-1">Vehicle Number</label>
                        <input
                          type="text"
                          value={newManifestVehicle}
                          onChange={(e) => setNewManifestVehicle(e.target.value)}
                          placeholder="e.g. MH-04-AB-1234"
                          required
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs font-mono text-theme-body focus:outline-none focus:border-indigo-500 uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-theme-muted block mb-1">Destination Hub / Client</label>
                        <input
                          type="text"
                          value={newManifestDestination}
                          onChange={(e) => setNewManifestDestination(e.target.value)}
                          placeholder="e.g. Pune Regional Hub"
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-theme-muted block mb-1">Driver Name (Optional)</label>
                        <input
                          type="text"
                          value={newManifestDriver}
                          onChange={(e) => setNewManifestDriver(e.target.value)}
                          placeholder="e.g. Ramesh Kumar"
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-theme-muted block mb-1">Driver Mobile</label>
                        <input
                          type="tel"
                          value={newManifestPhone}
                          onChange={(e) => setNewManifestPhone(e.target.value)}
                          placeholder="+91..."
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-theme-muted block mb-1">
                        Shipping Carton Barcodes (comma or newline separated)
                      </label>
                      <textarea
                        value={newManifestCartonsText}
                        onChange={(e) => setNewManifestCartonsText(e.target.value)}
                        placeholder="e.g. BOX-20261028-001, BOX-20261028-002"
                        rows={4}
                        required
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs font-mono text-theme-body focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateManifestModal(false)}
                        className="px-4 py-2 border border-theme-divider rounded-xl text-xs text-theme-body hover:bg-theme-surface-2 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                      >
                        {loading ? "Generating..." : "Generate Manifest"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delivery Challan Modal (Rule 55 CGST Rules) */}
        {viewingChallan && (() => {
          const challanModal = (
            <div
              className="wms-challan-modal-root fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:static print:inset-auto print:h-auto print:w-full print:p-0 print:m-0 print:bg-white print:overflow-visible print:block"
              role="dialog"
              aria-modal="true"
              aria-label="Delivery Challan"
            >
              <style>{`
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 10mm 12mm 12mm 12mm;
                  }
                  #root {
                    display: none !important;
                  }
                  html, body {
                    height: auto !important;
                    min-height: 0 !important;
                    overflow: visible !important;
                    overflow-x: visible !important;
                    overflow-y: visible !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                  }
                  .wms-challan-modal-root {
                    position: static !important;
                    display: block !important;
                    width: 100% !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    background: white !important;
                  }
                  .wms-challan-toolbar,
                  .no-print {
                    display: none !important;
                  }
                  .wms-challan-sheet-wrapper {
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                    overflow: visible !important;
                    background: white !important;
                    color: black !important;
                  }
                  .wms-challan-printable-content {
                    display: block !important;
                    box-shadow: none !important;
                    border: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    visibility: visible !important;
                    background: white !important;
                    color: black !important;
                    width: 100% !important;
                  }
                }
              `}</style>
              <div className="wms-challan-sheet-wrapper bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:max-h-none print:shadow-none print:border-none print:w-full print:m-0 print:p-0 print:bg-white print:text-black print:block">
                <div className="wms-challan-toolbar p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2/50 print:hidden">
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

                <div className="wms-challan-printable-content p-6 overflow-y-auto space-y-6 text-xs font-sans print:p-0 print:space-y-6">
                  {/* Header info */}
                  <div className="grid grid-cols-2 gap-6 bg-theme-surface-2/40 p-4 rounded-xl border border-theme-divider print:bg-white print:border-slate-300">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Consignor (Dispatch From)</div>
                      <div className="text-sm font-bold text-theme-text-primary mt-1">{viewingChallan.company?.name}</div>
                      <div className="text-theme-muted text-[11px] mt-0.5">{viewingChallan.dispatch_from?.name} ({viewingChallan.dispatch_from?.code})</div>
                      <div className="text-theme-muted text-[11px]">{viewingChallan.dispatch_from?.address}</div>
                      <div className="mt-2 text-indigo-400 font-mono text-[11px] font-semibold print:text-indigo-700">GSTIN: {viewingChallan.company?.gstin}</div>
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
                  <div className="bg-theme-surface-2/20 p-3 rounded-lg border border-theme-divider grid grid-cols-3 gap-3 font-mono text-[11px] print:bg-slate-50 print:border-slate-300">
                    <div>
                      <span className="text-theme-muted text-[10px] block">Transporter:</span>
                      <span className="font-semibold text-theme-body">{viewingChallan.transport?.transporter_name || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-theme-muted text-[10px] block">Vehicle No:</span>
                      <span className="font-semibold text-amber-400 print:text-amber-700">{viewingChallan.transport?.vehicle_number || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-theme-muted text-[10px] block">LR / Docket No:</span>
                      <span className="font-semibold text-theme-body">{viewingChallan.transport?.lr_number || "N/A"}</span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-theme-divider text-[10px] uppercase font-bold text-theme-muted tracking-wider print:border-slate-400">
                        <th className="py-2 px-2">#</th>
                        <th className="py-2 px-2">Item Description</th>
                        <th className="py-2 px-2 font-mono">HSN</th>
                        <th className="py-2 px-2 font-mono">Batch No</th>
                        <th className="py-2 px-2 text-right">Qty Dispatched</th>
                        <th className="py-2 px-2 text-right">Unit Rate (₹)</th>
                        <th className="py-2 px-2 text-right">Taxable Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider text-xs print:divide-slate-200">
                      {viewingChallan.items?.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-theme-surface-2/30">
                          <td className="py-2.5 px-2 text-theme-muted">{idx + 1}</td>
                          <td className="py-2.5 px-2 font-semibold text-theme-body">{it.product_name}</td>
                          <td className="py-2.5 px-2 font-mono text-theme-muted">{it.hsn}</td>
                          <td className="py-2.5 px-2 font-mono text-indigo-400 font-bold print:text-indigo-700">{it.batch_no}</td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-400 print:text-emerald-700">{it.quantity}</td>
                          <td className="py-2.5 px-2 text-right font-mono">{it.rate.toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold">{it.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-theme-divider font-bold text-xs print:border-slate-400">
                        <td colSpan={4} className="py-3 px-2 text-theme-muted uppercase tracking-wider text-[10px]">
                          Total Consignment Summary
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-emerald-400 print:text-emerald-700">
                          {viewingChallan.summary?.total_quantity}
                        </td>
                        <td></td>
                        <td className="py-3 px-2 text-right font-mono text-indigo-400 text-sm print:text-indigo-700">
                          ₹{viewingChallan.summary?.total_value.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Statutory Non-Supply Declaration */}
                  <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20 text-[11px] text-theme-muted space-y-1 print:bg-slate-50 print:border-slate-300">
                    <div className="font-bold text-indigo-400 flex items-center gap-1.5 print:text-indigo-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 print:text-emerald-600" />
                      Statutory Rule 55 Declaration
                    </div>
                    <p>{viewingChallan.declaration}</p>
                  </div>
                </div>
              </div>
            </div>
          );

          if (typeof document === "undefined" || !document?.body || typeof (document.body as any).appendChild !== "function") {
            return challanModal;
          }

          return createPortal(challanModal, document.body);
        })()}

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

        <GlobalGridImportModal
          isOpen={isGlobalTransferImportOpen}
          onClose={() => setIsGlobalTransferImportOpen(false)}
          profile={GRID_PROFILES.STOCK_MOVEMENT}
          title="Stock Transfer Items Fast Import & Resolution"
          existingRowCount={transferStagingItems.length}
          onCommit={handleGlobalTransferImportCommit}
        />

        {showExpiryModal && (
          <StockExpiryModal
            isOpen={showExpiryModal}
            onClose={() => setShowExpiryModal(false)}
            onNotification={(title, msg, type) => onNotification?.(title, msg, type === "info" ? "success" : type)}
          />
        )}

        {showReplenishModal && (
          <SmartReplenishmentModal
            isOpen={showReplenishModal}
            onClose={() => setShowReplenishModal(false)}
            onNotification={(title, msg, type) => onNotification?.(title, msg, type === "info" ? "success" : type)}
          />
        )}

        {showWavePickingModal && (
          <WarehouseWavePickingModal
            isOpen={showWavePickingModal}
            onClose={() => setShowWavePickingModal(false)}
            warehouseId={selectedWarehouseFilter !== "ALL" ? selectedWarehouseFilter : (warehouses[0]?.id || undefined)}
            assignedWarehouse={selectedWarehouseFilter !== "ALL" ? getWarehouseName(selectedWarehouseFilter) : (warehouses[0]?.name || "Central Distribution Hub (WH-01)")}
            onNotification={onNotification}
          />
        )}

        {showStockTransferModal && (
          <StockTransferStudioModal
            isOpen={showStockTransferModal}
            onClose={() => setShowStockTransferModal(false)}
            onNotification={(title, msg, type) => onNotification?.(title, msg, type === "info" ? "success" : type)}
          />
        )}

        {showIPOModal && (
          <IPOStudioModal
            isOpen={showIPOModal}
            onClose={() => setShowIPOModal(false)}
            onNotification={(title, msg, type) => onNotification?.(title, msg, type === "info" ? "success" : type)}
          />
        )}

        {showFittingRoomModal && (
          <RFIDFittingRoomStudioModal
            isOpen={showFittingRoomModal}
            onClose={() => setShowFittingRoomModal(false)}
            onNotification={(title, msg, type) => onNotification?.(title, msg, type === "info" ? "success" : type)}
          />
        )}

        {showLabelPrintModal && (
          <LabelPrintModal
            isOpen={showLabelPrintModal}
            onClose={() => setShowLabelPrintModal(false)}
            onNotification={(title, msg, type) => onNotification?.(title, msg, type === "info" ? "success" : type)}
          />
        )}
      </div>
    </div>
  );
};
