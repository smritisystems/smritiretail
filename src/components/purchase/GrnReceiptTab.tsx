/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.34.0
 * Created      : 2026-09-18
 * Modified     : 2026-09-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_RECEIPT")
 * Target UI    : SMRITI GRN Studio — Operator-First Inward Landed Cost, Freight & PPV Engine
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  PackageCheck,
  RefreshCw,
  Save,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Receipt,
  Plus,
  Truck,
  ArrowLeft,
  Search,
  Barcode,
  Trash2,
  HelpCircle,
  FileText,
  AlertCircle,
  Eye,
  Check,
  Printer,
  Sparkles,
  Building2,
  FolderOpen,
  Camera,
  Upload,
  Download,
  X,
} from "lucide-react";
import { CreateDebitNoteModal } from "../CreateDebitNoteDlg.tsx";
import { AddCostComponentModal } from "./AddCostComponentModal.tsx";
import { CostAllocationPreviewModal } from "./CostAllocationPreviewModal.tsx";
import { WhyThisCostModal } from "./WhyThisCostModal.tsx";
import { GrnPostedSuccessModal } from "./GrnPostedSuccessModal.tsx";
import { GrnPrintModal, GrnPrintReceiptData } from "./GrnPrintModal.tsx";
import { AddProductToGrnModal, SelectedGrnProduct } from "./AddProductToGrnModal.tsx";
import { GrnCameraScannerModal } from "./GrnCameraScannerModal.tsx";
import { GrnCsvImportModal, ParsedGrnCsvRow } from "./GrnCsvImportModal.tsx";
import { ThreeWayMatchingModal } from "./ThreeWayMatchingModal.tsx";
import { RMAManagementModal } from "./RMAManagementModal.tsx";
import {
  InwardCostItem,
  InwardCostTypeOption,
  AllocationPreviewResult,
  WhyThisCostData,
  GrnPostedSummary,
} from "./types/inwardCost.ts";
import {
  buildManualAllocationMatrix,
  calculateManualLineAllocations,
  getManualAllocationVariance,
  normalizeAllocationMethod,
} from "./manualAllocation.ts";
import {
  GRN_WORKFLOW_STEPS,
  type GrnWorkflowStepId,
  getNextWorkflowStep,
  getPreviousWorkflowStep,
} from "./grnWorkflow.ts";
import {
  ConfirmGrnPostModal,
  type GrnPostConfirmationDetails,
} from "./ConfirmGrnPostModal.tsx";
import {
  filterEligibleOrders,
  calculatePoPendingInward,
  getOverReceivingWarning,
  type PoPendingInwardMetrics,
} from "./grnPoEligibility.ts";

interface PurchaseOrderOption {
  id: string;
  order_no?: string;
  order_number?: string;
  supplier_id: string;
  supplier_name?: string;
  status: string;
  subtotal?: number;
  grand_total?: number;
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
  mrp?: number;
  size?: string;
  color?: string;
}

interface GrnLineRow {
  rowId: string;
  product_id: string;
  item_id: string;
  code: string;
  name: string;
  size: string;
  color: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_damaged: number;
  cost_price: number;       // Contract PO Rate
  invoice_rate: number;    // Supplier Invoice Billed Rate
  trade_discount: number;  // Item trade discount per unit
  gst_rate: number;
  mrp?: number;
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

  // Persistent GRN Header State
  const [grnNumber, setGrnNumber] = useState(
    () => `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [grnDate, setGrnDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [referencePo, setReferencePo] = useState("");
  const [overReceivingWarning, setOverReceivingWarning] = useState<string | null>(null);

  // Authoritative Single Workflow State Machine
  const [activeStep, setActiveStep] = useState<GrnWorkflowStepId>("PO_DETAILS");

  // Transport Details State
  const [transporterName, setTransporterName] = useState("");
  const [lrNumber, setLrNumber] = useState("");
  const [lrDate, setLrDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [weightCbm, setWeightCbm] = useState("");
  const [cartons, setCartons] = useState(0);

  // Inward Landed Cost Engine State
  const [costTypes, setCostTypes] = useState<InwardCostTypeOption[]>([]);
  const [costItems, setCostItems] = useState<InwardCostItem[]>([]);
  const [manualAllocations, setManualAllocations] = useState<Record<string, Record<string, number>>>({});
  const [allocationMethod, setAllocationMethod] = useState<"value" | "quantity" | "weight" | "manual">("value");

  // Live File Attachments State
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; size: string; type: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newItems = Array.from(files).map((f) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      size: `${(f.size / 1024).toFixed(0)} KB`,
      type: f.type || "application/pdf",
    }));
    setAttachments((prev) => [...prev, ...newItems]);
    onNotification?.("File Attached", `Attached ${newItems.length} document(s).`, "success");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const newItems = Array.from(files).map((f) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      size: `${(f.size / 1024).toFixed(0)} KB`,
      type: f.type || "application/pdf",
    }));
    setAttachments((prev) => [...prev, ...newItems]);
    onNotification?.("File Attached", `Attached ${newItems.length} document(s).`, "success");
  };

  // Modals State
  const [isAddCostOpen, setIsAddCostOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<AllocationPreviewResult | null>(null);
  const [isWhyThisCostOpen, setIsWhyThisCostOpen] = useState(false);
  const [whyThisCostData, setWhyThisCostData] = useState<WhyThisCostData | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [postedSummary, setPostedSummary] = useState<GrnPostedSummary | null>(null);
  const [latestPostedReceipt, setLatestPostedReceipt] = useState<GrnPrintReceiptData | null>(null);

  // Print & Add Product Modals State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState<GrnPrintReceiptData | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  // Barcode Scanner & CSV Inward State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [scanBarcodeInput, setScanBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanContinuous, setScanContinuous] = useState(true);
  const [scannerSound, setScannerSound] = useState(true);
  const [autoFocusLocked, setAutoFocusLocked] = useState(false);
  const [lastScannedRowId, setLastScannedRowId] = useState<string | null>(null);
  const [itemSearchFilter, setItemSearchFilter] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // History search and row expansion state
  const [historySearch, setHistorySearch] = useState("");
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);

  // Debit Note Modal State for PPV claims
  const [isDebitNoteOpen, setIsDebitNoteOpen] = useState(false);
  const [showThreeWayMatch, setShowThreeWayMatch] = useState(false);
  const [rmaTargetLine, setRmaTargetLine] = useState<{
    rowId: string;
    sku: string;
    productName: string;
    damagedQty: number;
    supplierId: string;
    poRef: string;
  } | null>(null);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);

  // Purchase Bill State
  const [selectedReceiptForBill, setSelectedReceiptForBill] = useState<any | null>(null);
  const [vendorBillNo, setVendorBillNo] = useState<string>("");
  const [billSaving, setBillSaving] = useState(false);

  // Load Inward Cost Component Types from Backend
  const loadCostTypes = useCallback(async () => {
    try {
      const res = await apiFetchV1("/purchase/inward-cost-types");
      if (Array.isArray(res) && res.length > 0) {
        setCostTypes(res);
      }
    } catch {
      // Keep silent fallback
    }
  }, []);

  const loadOrders = useCallback(async (supplier?: string) => {
    setOrdersLoading(true);
    try {
      const query = supplier ? `?pending_only=true&supplier_id=${encodeURIComponent(supplier)}` : `?pending_only=true`;
      const res = await apiFetchV1(`/purchase/orders/${query}`);
      const list: PurchaseOrderOption[] = Array.isArray(res) ? res : res?.items || [];
      setOrders(list.filter((o) => {
        const st = (o.status || "").toUpperCase();
        return st !== "CANCELLED" && st !== "RECEIVED" && st !== "COMPLETED" && st !== "DRAFT";
      }));
    } catch {
      // Keep existing sample
    } finally {
      setOrdersLoading(false);
    }
  }, []);

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
    loadCostTypes();
    loadOrders();
    loadReceipts();
    loadSuppliers();
  }, [loadCostTypes, loadOrders, loadReceipts, loadSuppliers]);

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
      setReferencePo("");
      return;
    }
    try {
      const order: PurchaseOrderOption = await apiFetchV1(`/purchase/orders/${orderId}`);
      setSelectedOrder(order);
      setSupplierId(order.supplier_id);
      setSupplierName(order.supplier_name || order.supplier_id);
      setReferencePo(order.order_no || order.order_number || order.id);

      // Aggregate previously received quantities from savedReceipts for this order
      const priorInwardMap = new Map<string, number>();
      savedReceipts
        .filter((r) => r.order_id === order.id || r.order_id === (order.order_no || order.id))
        .forEach((r) => {
          (r.items || []).forEach((it: any) => {
            const key = (it.code || it.product_id || it.item_id || "").trim().toLowerCase();
            if (key) {
              const prev = priorInwardMap.get(key) || 0;
              priorInwardMap.set(key, prev + Math.max(0, Number(it.quantity_received || 0)));
            }
          });
        });

      const lines: GrnLineRow[] = (order.items || []).map((item, idx) => {
        const qtyOrdered = Number(item.quantity) || 0;
        const key = (item.code || item.product_id || item.item_id || "").trim().toLowerCase();
        const previouslyReceived = key ? priorInwardMap.get(key) || 0 : 0;
        const pendingQty = Math.max(0, qtyOrdered - previouslyReceived);

        return {
          rowId: `row-${idx}-${Date.now()}`,
          product_id: item.product_id || item.item_id || item.id || `PROD-${idx + 1}`,
          item_id: item.item_id || item.id || "",
          code: item.code || `SKU-${idx + 1}`,
          name: item.name || item.description || `Item ${idx + 1}`,
          size: item.size || "M",
          color: item.color || "Standard",
          quantity_ordered: qtyOrdered,
          quantity_received: pendingQty,
          quantity_damaged: 0,
          cost_price: Number(item.cost_price || item.unit_price) || 100,
          invoice_rate: Number(item.cost_price || item.unit_price) || 100,
          trade_discount: 0,
          gst_rate: Number(item.gst_rate) || 18,
          mrp: Number(item.mrp) || Number(item.unit_price ? Number(item.unit_price) * 1.6 : 0) || 0,
        };
      });
      setGrnLines(lines);
      onNotification?.("Order Loaded", `Loaded ${lines.length} items from PO ${order.order_no || order.id}.`, "info");
    } catch {
      onNotification?.("Load Error", "Could not load order details.", "error");
    }
  };

  // Filter eligible orders based on selected supplier and inward eligibility
  const eligibleOrders: PoPendingInwardMetrics[] = useMemo(() => {
    return filterEligibleOrders(orders, supplierId, savedReceipts);
  }, [orders, supplierId, savedReceipts]);

  // Backward compatible alias
  const availableOrders = eligibleOrders;

  // Handle Supplier Selection with Automatic PO Resolution
  const handleSupplierChange = async (sid: string) => {
    setSupplierId(sid);
    const s = suppliersList.find((x) => x.id === sid);
    const sName = s ? (s.name || s.company_name || sid) : "";
    setSupplierName(sName);

    // Refresh orders for selected supplier (or all if none)
    loadOrders(sid || undefined);

    if (!sid) {
      setSelectedOrderId("");
      setSelectedOrder(null);
      setGrnLines([]);
      setReferencePo("");
      return;
    }

    const matching = filterEligibleOrders(orders, sid, savedReceipts);

    if (matching.length === 1) {
      await handleSelectOrder(matching[0].order_id);
      onNotification?.(
        "PO Auto-Selected",
        `Auto-loaded order ${matching[0].order_no} for ${sName}.`,
        "info"
      );
    } else if (matching.length > 1) {
      setSelectedOrderId("");
      setSelectedOrder(null);
      setGrnLines([]);
      setReferencePo("");
      onNotification?.(
        "Multiple POs Found",
        `Supplier ${sName} has ${matching.length} open purchase orders awaiting inward. Please select one.`,
        "info"
      );
    } else {
      setSelectedOrderId("");
      setSelectedOrder(null);
      setGrnLines([]);
      setReferencePo("");
    }
  };

  const handleInwardLatestOpenPo = async () => {
    if (eligibleOrders.length > 0) {
      await handleSelectOrder(eligibleOrders[0].order_id);
      setActiveStep("RECEIVE_VERIFY");
      onNotification?.(
        "Open PO Loaded",
        `Loaded confirmed order ${eligibleOrders[0].order_no} from database.`,
        "success"
      );
    } else {
      try {
        const res = await apiFetchV1("/purchase/orders/?pending_only=true");
        const list: PurchaseOrderOption[] = Array.isArray(res) ? res : res?.items || [];
        const eligible = filterEligibleOrders(list, supplierId, savedReceipts);
        if (eligible.length > 0) {
          setOrders(list);
          await handleSelectOrder(eligible[0].order_id);
          setActiveStep("RECEIVE_VERIFY");
          onNotification?.(
            "Open PO Loaded",
            `Loaded confirmed order ${eligible[0].order_no} from database.`,
            "success"
          );
        } else {
          onNotification?.("No Orders Available", "No open purchase orders found in database.", "warning");
        }
      } catch {
        onNotification?.("Error", "Could not fetch purchase orders from database.", "error");
      }
    }
  };

  const handleClearLines = () => {
    setGrnLines([]);
    setCostItems([]);
    setSelectedOrderId("");
    setSelectedOrder(null);
    setSupplierId("");
    setSupplierName("");
    setReferencePo("");
    setInvoiceNumber("");
    setTransporterName("");
    setLrNumber("");
    setVehicleNumber("");
    setWeightCbm("");
    setCartons(0);
    setNotes("");
    setAttachments([]);
    setGrnNumber(`GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`);
    setActiveStep("PO_DETAILS");
    onNotification?.("Workspace Reset", "Goods Receipt Note workspace reset to clean state.", "info");
  };

  const advanceWorkflow = () => {
    const nextStep = getNextWorkflowStep(activeStep);
    if (nextStep !== activeStep) {
      setActiveStep(nextStep);
    }
  };

  const retreatWorkflow = () => {
    const previousStep = getPreviousWorkflowStep(activeStep);
    if (previousStep !== activeStep) {
      setActiveStep(previousStep);
    }
  };

  const handleAddProduct = (prod: SelectedGrnProduct) => {
    const newLine: GrnLineRow = {
      rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product_id: prod.product_id,
      item_id: prod.product_id,
      code: prod.code,
      name: prod.name,
      size: prod.size,
      color: prod.color,
      quantity_ordered: 0,
      quantity_received: 1,
      quantity_damaged: 0,
      cost_price: prod.cost_price,
      invoice_rate: prod.invoice_rate,
      trade_discount: 0,
      gst_rate: prod.gst_rate,
      mrp: prod.mrp,
    };
    setGrnLines((prev) => [...prev, newLine]);
    onNotification?.("Product Added", `${prod.name} added to inward list.`, "success");
  };

  // Synthetic scanner chime
  const playScanTone = useCallback(
    (type: "success" | "warning" | "error" = "success") => {
      if (!scannerSound) return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === "success") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        } else if (type === "warning") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(660, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } else {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(220, ctx.currentTime);
          osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.4, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }
      } catch {
        // audio context blocked or unsupported
      }
    },
    [scannerSound]
  );

  // Scan & Inward Barcode Resolver
  const handleProcessBarcode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      setIsScanning(true);
      const codeLower = code.toLowerCase();

      // 1. Match against active grnLines
      const existingIdx = grnLines.findIndex(
        (r) =>
          r.code.toLowerCase() === codeLower ||
          r.product_id.toLowerCase() === codeLower ||
          r.item_id.toLowerCase() === codeLower ||
          r.name.toLowerCase() === codeLower
      );

      if (existingIdx !== -1) {
        const targetRow = grnLines[existingIdx];
        const increment = 1;
        const nextQty = targetRow.quantity_received + increment;
        setGrnLines((prev) =>
          prev.map((r, i) => (i === existingIdx ? { ...r, quantity_received: nextQty } : r))
        );
        setLastScannedRowId(targetRow.rowId);
        setTimeout(() => setLastScannedRowId(null), 1500);
        playScanTone("success");
        onNotification?.(
          "Item Counted (+1)",
          `${targetRow.name} (${targetRow.code}) received qty incremented to ${nextQty}.`,
          "success"
        );
        setIsScanning(false);
        setScanBarcodeInput("");
        if (autoFocusLocked) {
          barcodeInputRef.current?.focus();
        }
        return;
      }

      // 2. Query master inventory catalog in PostgreSQL
      try {
        const res = await apiFetchV1(`/inventory/?page=1&page_size=10&q=${encodeURIComponent(code)}`);
        const items = Array.isArray(res) ? res : res?.items || [];
        if (items.length > 0) {
          const match =
            items.find(
              (p: any) =>
                (p.barcode && p.barcode.toLowerCase() === codeLower) ||
                (p.sku && p.sku.toLowerCase() === codeLower) ||
                (p.code && p.code.toLowerCase() === codeLower) ||
                p.id === code
            ) || items[0];

          const cost = Number(match.cost_price || match.purchase_price || match.price || 100);
          const mrp = Number(match.mrp || (cost > 0 ? cost * 1.5 : 200));
          const gst = Number(match.gst_rate || 18);

          const newLine: GrnLineRow = {
            rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            product_id: match.id,
            item_id: match.id,
            code: match.sku || match.code || code,
            name: match.name || `Item ${code}`,
            size: match.size || "M",
            color: match.color || "Standard",
            quantity_ordered: 0,
            quantity_received: 1,
            quantity_damaged: 0,
            cost_price: cost,
            invoice_rate: cost,
            trade_discount: 0,
            gst_rate: gst,
            mrp: mrp,
          };

          setGrnLines((prev) => [...prev, newLine]);
          setLastScannedRowId(newLine.rowId);
          setTimeout(() => setLastScannedRowId(null), 1500);
          playScanTone("warning");
          onNotification?.(
            "Ad-hoc Item Added",
            `${newLine.name} (${newLine.code}) retrieved from master catalog and added to GRN (+1).`,
            "info"
          );
        } else {
          playScanTone("error");
          onNotification?.(
            "Scan Unmatched",
            `Barcode "${code}" was not found in active PO or inventory master catalog.`,
            "warning"
          );
        }
      } catch (err: any) {
        playScanTone("error");
        onNotification?.("Scan Lookup Error", err.message || "Failed to search product database.", "error");
      } finally {
        setIsScanning(false);
        setScanBarcodeInput("");
        if (autoFocusLocked) {
          barcodeInputRef.current?.focus();
        }
      }
    },
    [grnLines, playScanTone, onNotification, autoFocusLocked]
  );

  // Template Download Handler
  const handleDownloadTemplate = () => {
    const SAMPLE_CSV = `Barcode,SKU,Product Name,Size,Color,Received Qty,Damaged Qty,Invoice Rate,MRP,GST %\n8901234567890,SH-001,Runner Pro (Men's Running Shoes),8,Black,200,0,1450.00,2499.00,18\n8901234567891,SH-002,City Walk (Men's Casual Shoes),9,Brown,298,2,1300.00,2499.00,18\n8901234567892,SH-003,Trail Blazer (Outdoor Shoes),8,Olive,250,0,1650.00,2499.00,18\n8901234567893,SH-004,Kids Sport (Kids Shoes),4,Navy,482,8,850.00,1599.00,18\n`;
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grn_inward_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotification?.("Template Downloaded", "Sample inward CSV template downloaded.", "info");
  };

  // CSV Import Callback Handler
  const handleCsvImportConfirmed = useCallback(
    (rows: ParsedGrnCsvRow[], mode: "merge" | "append" | "replace") => {
      if (rows.length === 0) return;

      if (mode === "replace") {
        const newLines: GrnLineRow[] = rows.map((r, idx) => ({
          rowId: `row-csv-${idx}-${Date.now()}`,
          product_id: r.barcode || r.sku || `PROD-${idx + 1}`,
          item_id: r.sku || `ITEM-${idx + 1}`,
          code: r.sku || r.barcode || `SKU-${idx + 1}`,
          name: r.name || `Item ${idx + 1}`,
          size: r.size || "M",
          color: r.color || "Standard",
          quantity_ordered: r.quantity_received,
          quantity_received: r.quantity_received,
          quantity_damaged: r.quantity_damaged || 0,
          cost_price: r.cost_price || r.invoice_rate,
          invoice_rate: r.invoice_rate,
          trade_discount: 0,
          gst_rate: r.gst_rate || 18,
          mrp: r.mrp || r.invoice_rate * 1.5,
        }));
        setGrnLines(newLines);
        onNotification?.(
          "Workspace Replaced",
          `Imported ${newLines.length} lines (${newLines.reduce((s, l) => s + l.quantity_received, 0)} units) from CSV.`,
          "success"
        );
      } else if (mode === "append") {
        const newLines: GrnLineRow[] = rows.map((r, idx) => ({
          rowId: `row-csv-${idx}-${Date.now()}`,
          product_id: r.barcode || r.sku || `PROD-${idx + 1}`,
          item_id: r.sku || `ITEM-${idx + 1}`,
          code: r.sku || r.barcode || `SKU-${idx + 1}`,
          name: r.name || `Item ${idx + 1}`,
          size: r.size || "M",
          color: r.color || "Standard",
          quantity_ordered: 0,
          quantity_received: r.quantity_received,
          quantity_damaged: r.quantity_damaged || 0,
          cost_price: r.cost_price || r.invoice_rate,
          invoice_rate: r.invoice_rate,
          trade_discount: 0,
          gst_rate: r.gst_rate || 18,
          mrp: r.mrp || r.invoice_rate * 1.5,
        }));
        setGrnLines((prev) => [...prev, ...newLines]);
        onNotification?.(
          "Items Appended",
          `Appended ${newLines.length} lines from CSV to inward workspace.`,
          "success"
        );
      } else if (mode === "merge") {
        let updatedCount = 0;
        setGrnLines((prevLines) => {
          const matchedSet = new Set<string>();
          const updatedLines = prevLines.map((line) => {
            const match = rows.find(
              (r) =>
                r.sku.toLowerCase() === line.code.toLowerCase() ||
                (r.barcode && r.barcode.toLowerCase() === line.code.toLowerCase()) ||
                r.name.toLowerCase() === line.name.toLowerCase()
            );
            if (match) {
              matchedSet.add(match.sku);
              updatedCount++;
              return {
                ...line,
                quantity_received: match.quantity_received,
                quantity_damaged: match.quantity_damaged,
                invoice_rate: match.invoice_rate || line.invoice_rate,
              };
            }
            return line;
          });

          const extraLines: GrnLineRow[] = rows
            .filter((r) => !matchedSet.has(r.sku))
            .map((r, idx) => ({
              rowId: `row-extra-${idx}-${Date.now()}`,
              product_id: r.barcode || r.sku || `PROD-${idx + 1}`,
              item_id: r.sku || `ITEM-${idx + 1}`,
              code: r.sku || r.barcode || `SKU-${idx + 1}`,
              name: r.name || `Item ${idx + 1}`,
              size: r.size || "M",
              color: r.color || "Standard",
              quantity_ordered: 0,
              quantity_received: r.quantity_received,
              quantity_damaged: r.quantity_damaged || 0,
              cost_price: r.cost_price || r.invoice_rate,
              invoice_rate: r.invoice_rate,
              trade_discount: 0,
              gst_rate: r.gst_rate || 18,
              mrp: r.mrp || r.invoice_rate * 1.5,
            }));

          return [...updatedLines, ...extraLines];
        });

        onNotification?.(
          "PO Inward Reconciled",
          `Updated received counts for ${updatedCount} PO items from CSV.`,
          "success"
        );
      }
    },
    [onNotification]
  );

  const handleRemoveLine = (rowId: string) => {
    setGrnLines((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handlePrintFromHistory = async (receipt: any) => {
    let fullReceipt = receipt;
    if (!receipt.items || receipt.items.length === 0) {
      try {
        fullReceipt = await apiFetchV1(`/purchase/receipts/${receipt.id}`);
      } catch {
        // use available fields
      }
    }

    const printData: GrnPrintReceiptData = {
      id: fullReceipt.id,
      receipt_no: fullReceipt.receipt_no,
      date: fullReceipt.created_at ? new Date(fullReceipt.created_at).toLocaleDateString("en-IN") : undefined,
      created_at: fullReceipt.created_at,
      supplier_id: fullReceipt.supplier_id,
      supplier_name: fullReceipt.supplier_name || fullReceipt.supplier_id,
      order_id: fullReceipt.order_id,
      po_number: fullReceipt.order_id,
      invoice_number: fullReceipt.invoice_number,
      transporter_name: fullReceipt.transporter_name,
      lr_number: fullReceipt.lr_number,
      lr_date: fullReceipt.lr_date,
      vehicle_number: fullReceipt.vehicle_number,
      notes: fullReceipt.notes,
      items: (fullReceipt.items || []).map((i: any) => ({
        code: i.code || i.product_id,
        name: i.name || "Item",
        quantity_ordered: i.quantity_ordered,
        quantity_received: i.quantity_received,
        quantity_damaged: i.quantity_damaged,
        cost_price: i.cost_price,
        invoice_rate: i.cost_price,
        landed_cost: i.landed_cost,
        freight_allocated: i.freight_allocated,
        mrp: i.mrp,
        gst_rate: i.gst_rate,
      })),
      cost_components: (fullReceipt.cost_components || []).map((c: any) => ({
        component_type: c.component_type,
        description: c.description,
        amount: Number(c.amount || 0),
        allocation_method: c.allocation_method,
        transporter_name: c.transporter_name,
        document_no: c.document_no,
      })),
    };

    setPrintReceiptData(printData);
    setIsPrintModalOpen(true);
  };

  const updateLine = (rowId: string, field: keyof GrnLineRow, value: any) => {
    setGrnLines((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row))
    );
  };

  // Receiving Metrics
  const totalOrdered = useMemo(() => grnLines.reduce((s, r) => s + r.quantity_ordered, 0), [grnLines]);
  const totalReceived = useMemo(() => grnLines.reduce((s, r) => s + r.quantity_received, 0), [grnLines]);
  const totalDamaged = useMemo(() => grnLines.reduce((s, r) => s + r.quantity_damaged, 0), [grnLines]);
  const totalAcceptedUnits = useMemo(
    () => grnLines.reduce((s, r) => s + Math.max(0, r.quantity_received - r.quantity_damaged), 0),
    [grnLines]
  );

  // Total Capitalizable Inward Addon Costs
  const totalAddons = useMemo(
    () => costItems.reduce((s, c) => s + (c.is_capitalizable ? c.amount : 0), 0),
    [costItems]
  );

  const totalCostGst = useMemo(
    () => costItems.reduce((s, c) => s + (c.itc_eligible ? (c.tax_amount ?? (c.amount * (c.tax_rate || 0)) / 100) : 0), 0),
    [costItems]
  );

  // Line stats & Net Values
  const lineMetrics = useMemo(() => {
    return grnLines.map((row) => {
      const accepted = Math.max(0, row.quantity_received - row.quantity_damaged);
      const netRate = Math.max(0, row.invoice_rate - row.trade_discount);
      const lineNetVal = accepted * netRate;
      return { accepted, netRate, lineNetVal };
    });
  }, [grnLines]);

  const totalPurchaseValue = useMemo(
    () => lineMetrics.reduce((s, x) => s + x.lineNetVal, 0),
    [lineMetrics]
  );

  const defaultBaseMethod: "VALUE" | "QUANTITY" = allocationMethod === "quantity" ? "QUANTITY" : "VALUE";

  const manualAllocationMatrix = useMemo(
    () =>
      buildManualAllocationMatrix({
        grnLines,
        costItems,
        manualAllocations,
        defaultBaseMethod,
      }),
    [grnLines, costItems, manualAllocations, defaultBaseMethod]
  );

  const manualAllocationSummaries = useMemo(
    () =>
      costItems.map((costItem) => ({
        ...costItem,
        ...getManualAllocationVariance({
          costItem,
          grnLines,
          manualAllocations,
          defaultBaseMethod,
        }),
      })),
    [costItems, grnLines, manualAllocations, defaultBaseMethod]
  );

  const manualAllocationTotals = useMemo(() => {
    if (allocationMethod !== "manual") {
      return null;
    }
    const totalCost = costItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const allocated = Object.values(manualAllocationMatrix).reduce((sum, perRowMap) => {
      return sum + Object.values(perRowMap ?? {}).reduce((rowSum, value) => rowSum + (Number(value) || 0), 0);
    }, 0);
    const remaining = Math.round((totalCost - allocated) * 100) / 100;
    return {
      totalCost,
      allocated,
      remaining,
      isBalanced: Math.abs(remaining) <= 0.05,
    };
  }, [allocationMethod, costItems, manualAllocationMatrix]);

  const updateManualAllocation = useCallback((componentId: string, rowId: string, value: string) => {
    const parsed = Number(value);
    setManualAllocations((prev) => {
      const nextComponent = { ...(prev[componentId] ?? {}) };
      if (!Number.isFinite(parsed) || parsed < 0) {
        delete nextComponent[rowId];
      } else {
        nextComponent[rowId] = Math.round(parsed * 100) / 100;
      }
      return { ...prev, [componentId]: nextComponent };
    });
  }, []);

  // Allocation per line
  const lineAllocations = useMemo(() => {
    if (allocationMethod === "manual") {
      return calculateManualLineAllocations({
        grnLines,
        costItems,
        manualAllocations,
        defaultBaseMethod,
      });
    }

    if (totalAddons <= 0 || totalPurchaseValue <= 0) {
      return grnLines.map((r) => ({
        allocatedAmount: 0,
        addonPerUnit: 0,
        landedCost: r.invoice_rate - r.trade_discount,
      }));
    }

    return grnLines.map((row, idx) => {
      const { accepted, netRate, lineNetVal } = lineMetrics[idx];
      if (accepted <= 0) {
        return { allocatedAmount: 0, addonPerUnit: 0, landedCost: netRate };
      }

      let share = 0;
      if (allocationMethod === "quantity") {
        share = totalAcceptedUnits > 0 ? accepted / totalAcceptedUnits : 0;
      } else {
        share = totalPurchaseValue > 0 ? lineNetVal / totalPurchaseValue : 0;
      }

      const allocatedAmount = Math.round(totalAddons * share * 100) / 100;
      const addonPerUnit = Math.round((allocatedAmount / accepted) * 100) / 100;
      const landedCost = Math.round((netRate + addonPerUnit) * 100) / 100;

      return { allocatedAmount, addonPerUnit, landedCost };
    });
  }, [grnLines, totalAddons, totalPurchaseValue, lineMetrics, totalAcceptedUnits, allocationMethod, costItems, manualAllocations]);

  // Overall Inventory Acquisition Cost
  const finalInventoryCost = useMemo(() => totalPurchaseValue + totalAddons, [totalPurchaseValue, totalAddons]);
  const avgUnitLandedCost = useMemo(
    () => (totalAcceptedUnits > 0 ? finalInventoryCost / totalAcceptedUnits : 0),
    [finalInventoryCost, totalAcceptedUnits]
  );

  // Purchase Price Variance (PPV) calculation
  const ppvLines = useMemo(() => {
    return grnLines
      .map((row) => {
        const variancePerUnit = row.invoice_rate - row.cost_price;
        const accepted = Math.max(0, row.quantity_received - row.quantity_damaged);
        const totalPpv = variancePerUnit * accepted;
        return {
          row,
          variancePerUnit,
          totalPpv,
          accepted,
          hasVariance: Math.abs(variancePerUnit) > 0.001,
        };
      })
      .filter((x) => x.hasVariance);
  }, [grnLines]);

  const totalPpvAmount = useMemo(() => ppvLines.reduce((s, x) => s + x.totalPpv, 0), [ppvLines]);

  // Margin Preview
  const avgMrp = useMemo(() => {
    const totalMrp = grnLines.reduce((s, r) => s + (r.mrp || 0) * Math.max(0, r.quantity_received - r.quantity_damaged), 0);
    return totalAcceptedUnits > 0 ? totalMrp / totalAcceptedUnits : 0;
  }, [grnLines, totalAcceptedUnits]);

  const avgMarginPercent = useMemo(() => {
    if (avgMrp <= 0 || avgUnitLandedCost <= 0) return 0;
    return Math.max(0, ((avgMrp - avgUnitLandedCost) / avgMrp) * 100);
  }, [avgMrp, avgUnitLandedCost]);

  // Open Preview Modal
  const handleOpenPreview = async () => {
    const previewLines = grnLines.map((r, idx) => {
      const { accepted, netRate, lineNetVal } = lineMetrics[idx];
      const { allocatedAmount, addonPerUnit, landedCost } = lineAllocations[idx];
      const sharePct = totalPurchaseValue > 0 ? (lineNetVal / totalPurchaseValue) * 100 : 0;
      return {
        product_id: r.product_id,
        sku: r.code,
        product_name: r.name,
        quantity: accepted,
        rate: netRate,
        purchase_value: lineNetVal,
        share_percent: Math.round(sharePct * 100) / 100,
        allocated_amount: allocatedAmount,
        allocated_per_unit: addonPerUnit,
        net_landed_cost_per_unit: landedCost,
      };
    });

    const sumAllocated = previewLines.reduce((s, l) => s + l.allocated_amount, 0);
    const variance = Math.round((totalAddons - sumAllocated) * 100) / 100;

    setPreviewData({
      component_type: costItems.length > 0 ? costItems[0].component_type : "INWARD_EXPENSES",
      allocation_method: allocationMethod,
      total_component_amount: totalAddons,
      reconciled_total: sumAllocated,
      is_balanced: Math.abs(variance) <= 0.05,
      variance,
      lines: previewLines,
    });
    setIsPreviewOpen(true);
  };

  // Open WhyThisCost Modal
  const handleOpenWhyThisCost = (idx: number) => {
    const row = grnLines[idx];
    const { accepted, netRate } = lineMetrics[idx];
    const { addonPerUnit, landedCost } = lineAllocations[idx];

    const components = costItems.map((c) => {
      const compAddonTotal = c.amount;
      const share = totalPurchaseValue > 0 ? (row.invoice_rate * accepted) / totalPurchaseValue : 0;
      const compAllocated = compAddonTotal * share;
      const compAllocatedPerUnit = accepted > 0 ? compAllocated / accepted : 0;
      return {
        component_type: c.component_type,
        component_name: c.description || c.component_type,
        allocated_amount: compAllocated,
        allocated_per_unit: Math.round(compAllocatedPerUnit * 100) / 100,
        allocation_method: c.allocation_method,
        document_no: c.document_no || lrNumber,
        transporter_name: c.transporter_name || transporterName,
      };
    });

    const marginPct = row.mrp && row.mrp > 0 ? ((row.mrp - landedCost) / row.mrp) * 100 : undefined;

    setWhyThisCostData({
      sku: row.code,
      product_name: row.name,
      po_rate: row.cost_price,
      invoice_rate: row.invoice_rate,
      trade_discount_per_unit: row.trade_discount,
      net_purchase_rate: netRate,
      quantity: accepted,
      total_addon_per_unit: addonPerUnit,
      final_landed_cost: landedCost,
      mrp: row.mrp,
      margin_percent: marginPct,
      components,
    });
    setIsWhyThisCostOpen(true);
  };

  // Add Cost Item
  const handleAddCostItem = (item: InwardCostItem) => {
    setCostItems((prev) => [...prev, item]);
  };

  // Remove Cost Item
  const handleRemoveCostItem = (id: string) => {
    setCostItems((prev) => prev.filter((c) => c.id !== id));
  };

  // Final Post Confirmation Modal State
  const [isConfirmPostOpen, setIsConfirmPostOpen] = useState(false);
  const [isPostingGrn, setIsPostingGrn] = useState(false);

  const getValidationErrorsList = useCallback((): string[] => {
    const errs: string[] = [];
    const validLines = grnLines.filter((r) => r.quantity_received > 0);
    if (validLines.length === 0) {
      errs.push("At least one inward line with received quantity > 0 is required.");
    }
    const effSupplier = supplierId || selectedOrder?.supplier_id;
    if (!effSupplier) {
      errs.push("A valid supplier must be selected before posting.");
    }
    grnLines.forEach((r, idx) => {
      if (r.quantity_received < 0) {
        errs.push(`Line ${idx + 1} (${r.code}): Received quantity cannot be negative.`);
      }
      if (r.quantity_damaged < 0) {
        errs.push(`Line ${idx + 1} (${r.code}): Damaged quantity cannot be negative.`);
      }
      if (r.quantity_received - r.quantity_damaged < 0) {
        errs.push(`Line ${idx + 1} (${r.code}): Damaged quantity exceeds received quantity.`);
      }
    });
    if (allocationMethod === "manual" && manualAllocationTotals && !manualAllocationTotals.isBalanced) {
      errs.push(`Manual landed-cost allocation has an unresolved variance of ₹${manualAllocationTotals.remaining.toFixed(2)}.`);
    }
    return errs;
  }, [grnLines, supplierId, selectedOrder, allocationMethod, manualAllocationTotals]);

  const confirmationDetails: GrnPostConfirmationDetails | null = useMemo(() => {
    const validLines = grnLines.filter((r) => r.quantity_received > 0);
    const effSupplier = supplierId || selectedOrder?.supplier_id || "";
    const effSupplierName = supplierName || effSupplier;
    const errs = getValidationErrorsList();

    return {
      grnNumber: grnNumber.trim() || "Auto-Generated",
      inwardDate: grnDate,
      supplierId: effSupplier || "Not Selected",
      supplierName: effSupplierName || "Not Selected",
      referencePo: referencePo || (selectedOrder ? (selectedOrder.order_no || selectedOrder.id) : "Direct Inward (No PO)"),
      itemsCount: validLines.length,
      totalAcceptedQty: totalAcceptedUnits,
      totalDamagedQty: grnLines.reduce((acc, r) => acc + Number(r.quantity_damaged || 0), 0),
      purchaseValue: totalPurchaseValue,
      totalAddonCost: totalAddons,
      totalGst: totalCostGst,
      finalInventoryCost: finalInventoryCost,
      allocationMethod: allocationMethod,
      isManualAllocation: allocationMethod === "manual",
      manualAllocationBalanced: allocationMethod === "manual" ? (manualAllocationTotals?.isBalanced ?? true) : true,
      manualAllocationVariance: allocationMethod === "manual" ? (manualAllocationTotals?.remaining ?? 0) : 0,
      validationErrors: errs,
    };
  }, [
    grnLines,
    supplierId,
    selectedOrder,
    supplierName,
    grnNumber,
    grnDate,
    referencePo,
    totalAcceptedUnits,
    totalPurchaseValue,
    totalAddons,
    totalCostGst,
    finalInventoryCost,
    allocationMethod,
    manualAllocationTotals,
    getValidationErrorsList,
  ]);

  const handleOpenConfirmPost = () => {
    const errors = getValidationErrorsList();
    if (errors.length > 0) {
      onNotification?.("Validation Blocked", errors[0], "warning");
      return;
    }
    setIsConfirmPostOpen(true);
  };

  const handleExecuteConfirmPost = async () => {
    if (isPostingGrn || saving) return;
    const errors = getValidationErrorsList();
    if (errors.length > 0) {
      onNotification?.("Validation Blocked", errors[0], "warning");
      return;
    }
    setIsPostingGrn(true);
    try {
      await handleSubmitGRN();
      setIsConfirmPostOpen(false);
    } finally {
      setIsPostingGrn(false);
    }
  };

  // Submit Post GRN
  const handleSubmitGRN = async () => {
    const validLines = grnLines.filter((r) => r.quantity_received > 0);
    if (validLines.length === 0) {
      onNotification?.("Validation Error", "Enter at least one received quantity greater than zero.", "warning");
      return;
    }
    if (allocationMethod === "manual") {
      const brokenComponent = manualAllocationSummaries.find((entry) => !entry.isBalanced);
      if (brokenComponent) {
        onNotification?.(
          "Manual Allocation Reconciliation Failed",
          `Cost component ${brokenComponent.description || brokenComponent.component_type} is out of balance by ₹${Math.abs(brokenComponent.variance).toFixed(2)}. Reconcile the allocation before posting GRN.`,
          "warning"
        );
        return;
      }
    }
    const effSupplier = supplierId || selectedOrder?.supplier_id;
    if (!effSupplier) {
      onNotification?.("Supplier Required", "Please select a valid supplier from the database before posting GRN.", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplier_id: effSupplier,
        order_id: selectedOrderId || undefined,
        receipt_no: grnNumber.trim() ? grnNumber.trim() : undefined,
        notes: notes || undefined,
        transporter_name: transporterName || undefined,
        lr_number: lrNumber || undefined,
        lr_date: lrDate || undefined,
        vehicle_number: vehicleNumber || undefined,
        freight_amount: totalAddons > 0 ? totalAddons : 0,
        allocation_method: allocationMethod,
        cost_components: costItems.map((c) => ({
          component_type: c.component_type,
          description: c.description,
          amount: c.amount,
          taxable_amount: c.taxable_amount,
          tax_amount: c.tax_amount,
          tax_rate: c.tax_rate,
          total_amount: c.total_amount,
          itc_eligible: c.itc_eligible,
          is_capitalizable: c.is_capitalizable,
          allocation_method: c.allocation_method,
          transporter_name: c.transporter_name || transporterName,
          document_no: c.document_no || lrNumber,
          document_date: c.document_date || lrDate,
          vehicle_no: c.vehicle_no || vehicleNumber,
        })),
        items: validLines.map((r, idx) => {
          const { landedCost, allocatedAmount } = lineAllocations[idx];
          return {
            product_id: r.product_id,
            item_id: r.item_id || undefined,
            code: r.code,
            name: r.name,
            quantity_ordered: r.quantity_ordered,
            quantity_received: r.quantity_received,
            quantity_damaged: r.quantity_damaged,
            cost_price: r.invoice_rate,
            gst_rate: r.gst_rate,
            mrp: r.mrp || undefined,
            landed_cost: landedCost,
            freight_allocated: allocatedAmount,
          };
        }),
      };

      const receipt = await apiFetchV1("/purchase/receipts/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const finalReceiptNo = receipt?.receipt_no || grnNumber || "GRN-POSTED";
      const printData: GrnPrintReceiptData = {
        receipt_no: finalReceiptNo,
        supplier_id: effSupplier,
        supplier_name: supplierName || effSupplier,
        order_id: selectedOrderId || undefined,
        po_number: referencePo || undefined,
        invoice_number: invoiceNumber || undefined,
        invoice_date: invoiceDate,
        transporter_name: transporterName,
        lr_number: lrNumber,
        lr_date: lrDate,
        vehicle_number: vehicleNumber,
        weight_cbm: weightCbm,
        cartons: cartons,
        notes: notes,
        items: validLines.map((r, idx) => {
          const { landedCost, allocatedAmount } = lineAllocations[idx];
          return {
            code: r.code,
            name: r.name,
            size: r.size,
            color: r.color,
            quantity_ordered: r.quantity_ordered,
            quantity_received: r.quantity_received,
            quantity_damaged: r.quantity_damaged,
            cost_price: r.cost_price,
            invoice_rate: r.invoice_rate,
            landed_cost: landedCost,
            freight_allocated: allocatedAmount,
            mrp: r.mrp,
            gst_rate: r.gst_rate,
          };
        }),
        cost_components: costItems.map((c) => ({
          component_type: c.component_type,
          description: c.description,
          amount: c.amount,
          taxable_amount: c.taxable_amount,
          tax_amount: c.tax_amount,
          tax_rate: c.tax_rate,
          total_amount: c.total_amount,
          allocation_method: c.allocation_method,
          transporter_name: c.transporter_name,
          document_no: c.document_no,
        })),
      };

      setLatestPostedReceipt(printData);

      setPostedSummary({
        grn_no: finalReceiptNo,
        receipt_id: receipt?.id || "REC-001",
        supplier_name: supplierName || effSupplier,
        total_units: totalAcceptedUnits,
        purchase_cost: totalPurchaseValue,
        additional_landed_costs: totalAddons,
        total_inventory_cost: finalInventoryCost,
        cost_components_count: costItems.length,
      });

      setIsSuccessModalOpen(true);
      await loadReceipts();
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

  const validationMessages = useMemo<string[]>(() => {
    const messages: string[] = [];

    if (grnLines.length === 0) {
      messages.push("Add at least one received line before posting the GRN.");
    }

    const invalidQuantities = grnLines.filter(
      (row) => row.quantity_received < 0 || row.quantity_damaged < 0 || row.quantity_received < row.quantity_damaged
    );
    if (invalidQuantities.length > 0) {
      messages.push("Damaged quantity cannot exceed received quantity on any GRN line.");
    }

    if (totalAcceptedUnits <= 0) {
      messages.push("Accepted quantity must be greater than zero before posting.");
    }

    if (!supplierId && !selectedOrder?.supplier_id) {
      messages.push("Select a valid supplier before posting the GRN.");
    }

    if (allocationMethod === "manual" && manualAllocationTotals && !manualAllocationTotals.isBalanced) {
      messages.push(
        `Manual allocation is out of balance by ₹${Math.abs(manualAllocationTotals.remaining).toFixed(2)}. Reconcile it before posting.`
      );
    }

    return messages;
  }, [allocationMethod, grnLines, manualAllocationTotals, selectedOrder?.supplier_id, supplierId, totalAcceptedUnits]);

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

  // ==========================================
  // WORKSPACE RENDERERS (ONE FOR EACH STEP)
  // ==========================================

  // STEP 1 — PO & DETAILS
  const renderPoDetailsStep = () => (
    <div className="space-y-4" data-testid="workspace-po-details">
      {/* Selected Order Summary Card (if PO chosen) */}
      {selectedOrder && (
        <div className="bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold text-indigo-700 dark:text-indigo-300">Contract Selected</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">
                {selectedOrder.order_no || selectedOrder.order_number || selectedOrder.id}
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
              Supplier: <strong>{selectedOrder.supplier_name || selectedOrder.supplier_id}</strong> • Items: {selectedOrder.items?.length || grnLines.length} • Value: ₹{Number(selectedOrder.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedOrderId("");
                setSelectedOrder(null);
                setGrnLines([]);
                setReferencePo("");
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Clear / Change PO
            </button>
            <button
              type="button"
              onClick={() => setActiveStep("RECEIVE_VERIFY")}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
            >
              Proceed to Verification →
            </button>
          </div>
        </div>
      )}

      {/* Main Receiving Hub Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Goods Inward Receiving Hub</h3>
              <p className="text-xs text-slate-500">Select an open Purchase Order to inward against contract specs, or start Direct Inward without a PO.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInwardLatestOpenPo}
            className="px-3.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Inward Latest Open PO</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Open Purchase Orders Awaiting Inward ({eligibleOrders.length})
              </h4>
            </div>
            <button type="button" onClick={() => loadOrders(supplierId || undefined)} className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-medium">
              <RefreshCw className="w-3 h-3" />
              <span>Refresh POs</span>
            </button>
          </div>

          {ordersLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading open purchase orders from database...</div>
          ) : eligibleOrders.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                {supplierId
                  ? "No open purchase orders are currently awaiting inward for this supplier."
                  : "No open purchase orders are currently awaiting inward."}
              </p>
              <p>You can create a new PO in PO Studio or perform Direct Inward below.</p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">PO Number</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3 text-center">Pending Items</th>
                    <th className="py-2.5 px-3 text-right">Pending Qty</th>
                    <th className="py-2.5 px-3 text-right">Pending Value (₹)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {eligibleOrders.map((o) => (
                    <tr key={o.order_id} className="hover:bg-indigo-50/30 dark:hover:bg-slate-850/50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{o.order_no}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{o.supplier_name}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">{o.pending_items_count}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">{o.pending_quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300">₹{o.pending_value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          {o.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await handleSelectOrder(o.order_id);
                            setActiveStep("RECEIVE_VERIFY");
                          }}
                          className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
                        >
                          Inward PO →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Direct Inward / Ad-Hoc Option */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-white">Direct Inward / Ad-Hoc Receiving (Without PO)</h4>
            <p className="text-xs text-slate-500">Receive goods directly into stock from master inventory catalog without a pre-existing PO.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddProductOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-bold text-xs shadow-sm transition flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Products from Master Catalog</span>
          </button>
        </div>
      </div>
    </div>
  );

  // STEP 2 — RECEIVE & VERIFY
  const renderReceiveVerifyStep = () => (
    <div className="space-y-4" data-testid="workspace-receive-verify">
      {overReceivingWarning && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠ {overReceivingWarning}
        </div>
      )}
      {/* Inward Items Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden space-y-0">
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Inward Items</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {grnLines.length} {grnLines.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddProductOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 text-xs font-semibold shadow-xs hover:bg-indigo-50 dark:hover:bg-slate-800 transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
            <button
              type="button"
              onClick={() => {
                barcodeInputRef.current?.focus();
                onNotification?.("Scan Ready", "Barcode input focused. Scan label to inward.", "info");
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1"
            >
              <Barcode className="w-3.5 h-3.5 text-indigo-500" />
              <span>Focus Scanner</span>
            </button>
          </div>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={itemSearchFilter}
              onChange={(e) => setItemSearchFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && itemSearchFilter.trim()) {
                  handleProcessBarcode(itemSearchFilter);
                  setItemSearchFilter("");
                }
              }}
              placeholder="Search by SKU, name or scan barcode..."
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-2.5">#</th>
                <th className="py-2.5 px-3">SKU / Barcode</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-2 text-right">PO Qty</th>
                <th className="py-2.5 px-2 text-right">Recv Qty</th>
                <th className="py-2.5 px-2 text-right text-rose-500">Damaged</th>
                <th className="py-2.5 px-2 text-right font-bold text-slate-900 dark:text-white">Accepted</th>
                <th className="py-2.5 px-2 text-right">PO Rate (₹)</th>
                <th className="py-2.5 px-2 text-right">Inv. Rate (₹)</th>
                <th className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">Landed Cost (₹)</th>
                <th className="py-2.5 px-2 text-right">Margin</th>
                <th className="py-2.5 px-2 text-center">Status</th>
                <th className="py-2.5 px-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {grnLines.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-xs text-slate-500 space-y-2">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No inward items added yet.</p>
                    <p>Search by SKU, scan barcode below, import CSV, or select an open PO in Step 1.</p>
                    <button
                      type="button"
                      onClick={() => setIsAddProductOpen(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-1 mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Product from Catalog</span>
                    </button>
                  </td>
                </tr>
              ) : (
                grnLines
                  .filter((r) => {
                    if (!itemSearchFilter.trim()) return true;
                    const q = itemSearchFilter.toLowerCase();
                    return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || (r.color && r.color.toLowerCase().includes(q));
                  })
                  .map((row, idx) => {
                    const originalIdx = grnLines.findIndex((l) => l.rowId === row.rowId);
                    const { accepted } = lineMetrics[originalIdx >= 0 ? originalIdx : 0] || { accepted: row.quantity_received - row.quantity_damaged };
                    const { landedCost } = lineAllocations[originalIdx >= 0 ? originalIdx : 0] || { landedCost: row.invoice_rate };
                    const isPpv = Math.abs(row.invoice_rate - row.cost_price) > 0.001;
                    const marginPct = row.mrp && row.mrp > 0 ? ((row.mrp - landedCost) / row.mrp) * 100 : 0;
                    const isHighlighted = row.rowId === lastScannedRowId;

                    return (
                      <tr
                        key={row.rowId}
                        className={`transition-colors duration-200 ${
                          isHighlighted ? "bg-emerald-100/60 dark:bg-emerald-950/50" : "hover:bg-slate-50/60 dark:hover:bg-slate-850/50"
                        }`}
                      >
                        <td className="py-2.5 px-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="font-bold text-slate-900 dark:text-white block">{row.code}</span>
                          <span className="text-[10px] text-slate-400 block">{row.product_id}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">{row.name}</span>
                          <span className="text-[10px] text-slate-400 block">Size: {row.size} • Color: {row.color}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.quantity_ordered}</td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          <input
                            type="number"
                            min="0"
                            value={row.quantity_received}
                            onChange={(e) => {
                              const newQty = parseFloat(e.target.value) || 0;
                              setOverReceivingWarning(getOverReceivingWarning(newQty, row.quantity_ordered));
                              updateLine(row.rowId, "quantity_received", newQty);
                            }}
                            className="w-16 text-right bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                          <input
                            type="number"
                            min="0"
                            value={row.quantity_damaged}
                            onChange={(e) => updateLine(row.rowId, "quantity_damaged", parseFloat(e.target.value) || 0)}
                            className="w-14 text-right bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono text-rose-600"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">{accepted}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">₹{row.cost_price.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.invoice_rate}
                            onChange={(e) => updateLine(row.rowId, "invoice_rate", parseFloat(e.target.value) || 0)}
                            className={`w-20 text-right bg-slate-50 dark:bg-slate-800 border rounded px-1.5 py-0.5 font-mono ${
                              isPpv ? "border-amber-400 font-bold text-amber-700 dark:text-amber-300" : "border-slate-300 dark:border-slate-700"
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          <button
                            type="button"
                            onClick={() => handleOpenWhyThisCost(originalIdx >= 0 ? originalIdx : 0)}
                            className="hover:text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                            title="Click to view explainable landed cost breakdown"
                          >
                            <span>{landedCost.toFixed(2)}</span>
                            <HelpCircle className="w-3 h-3 text-indigo-400 inline" />
                          </button>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{marginPct.toFixed(1)}%</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {isPpv ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 inline-flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              <span>PPV</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 inline-flex items-center gap-0.5">
                              <Check className="w-3 h-3" />
                              <span>OK</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* RMAManagementModal trigger */}
                            {row.quantity_damaged > 0 && (
                              <button
                                type="button"
                                title="Damaged goods — create supplier RMA"
                                onClick={() => setRmaTargetLine({
                                  rowId: row.rowId,
                                  sku: row.code,
                                  productName: row.name,
                                  damagedQty: Number(row.quantity_damaged),
                                  supplierId,
                                  poRef: selectedOrderId || referencePo || grnNumber,
                                })}
                                className="p-1.5 rounded text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                              >
                                <span className="text-[11px] font-bold">RMA</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(row.rowId)}
                              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition"
                              title="Delete line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barcode Scanner & Inward Tools Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">Barcode Scanner &amp; Inward Tools</h4>
            <p className="text-[11px] text-slate-500">Scan barcodes to quickly increment received count (+1) or import manifest CSV</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleProcessBarcode(scanBarcodeInput);
            }}
            className="flex-1 min-w-[220px]"
          >
            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                value={scanBarcodeInput}
                onChange={(e) => setScanBarcodeInput(e.target.value)}
                placeholder="Scan barcode or type SKU..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </form>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready</span>
          </div>
          <button
            type="button"
            onClick={() => setScanContinuous((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition flex items-center gap-1.5 ${
              scanContinuous
                ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
            title="Increment count (+1) on each scan"
          >
            <span className={`w-2.5 h-2.5 rounded-full border border-white/60 ${scanContinuous ? "bg-white" : "bg-transparent"}`} />
            <span>+1 Mode</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCameraScannerOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Camera Scan</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCsvImportOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5 shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download Template</span>
          </button>
        </div>
      </div>

      {/* Summary Metric Pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono block">
            {totalOrdered.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-medium">Ordered (Units)</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 font-mono block">
            {totalReceived.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-medium">Received (Units)</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400 font-mono block">
            {totalDamaged.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-medium">Damaged (Units)</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3 shadow-sm bg-emerald-50/20">
          <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono block">
            {totalAcceptedUnits.toLocaleString()}
          </span>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Net Accepted (Units)</span>
        </div>
      </div>

      {/* Remarks & Document Attachments Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
          <label className="font-bold text-slate-800 dark:text-slate-200">Remarks &amp; Receiving Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any remarks, verification notes or special instructions..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800 dark:text-slate-200">
              Attachments ({attachments.length})
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.docx"
            />
          </div>
          <div className="flex gap-2">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropFiles}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-2 text-center flex flex-col items-center justify-center gap-1 hover:border-indigo-400 transition cursor-pointer"
            >
              <span className="text-[11px] text-slate-500">Drag &amp; drop files here</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800"
              >
                Browse Files
              </button>
            </div>
            <div className="space-y-1 text-[11px] font-mono flex-1 max-h-24 overflow-y-auto">
              {attachments.length === 0 ? (
                <div className="text-slate-400 text-[11px] italic p-2 text-center">
                  No files attached (e.g. Vendor Invoice, LR, Packing List)
                </div>
              ) : (
                attachments.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200 truncate font-sans text-xs">
                        {f.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-slate-400 text-[10px]">{f.size}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(f.id)}
                        className="text-slate-400 hover:text-rose-500 transition p-0.5"
                        title="Remove attachment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // STEP 3 — COMMERCIALS
  const renderCommercialsStep = () => (
    <div className="space-y-4" data-testid="workspace-commercials">
      {/* Commercial Overview Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Commercials &amp; Price Variance</h3>
            <p className="text-xs text-slate-500">Contract PO rates vs supplier billed invoice rates, purchase price variance (PPV) and trade discounts</p>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 text-[10px] font-bold">
            ● Commercial Engine
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Supplier</div>
            <div className="mt-1 font-bold text-slate-900 dark:text-white text-sm">{supplierName || "-- Select Supplier in Header --"}</div>
            <div className="mt-0.5 text-[11px] text-slate-500 font-mono">{supplierId || "No supplier ID selected"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">PO Source</div>
            <div className="mt-1 font-bold text-slate-900 dark:text-white text-sm">
              {selectedOrder ? (selectedOrder.order_no || selectedOrder.order_number || selectedOrder.id) : referencePo || "Direct Inward (Ad-hoc)"}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">{selectedOrder ? "Open PO Contract Linked" : "Ad-hoc Receipt Mode"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Vendor Invoice</div>
            <div className="mt-1 font-bold text-slate-900 dark:text-white text-sm font-mono">{invoiceNumber || "-- Not Specified --"}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">Date: {invoiceDate || grnDate}</div>
          </div>
        </div>

        {/* ThreeWayMatchingModal trigger */}
        {activeStep === "COMMERCIALS" && grnLines.length > 0 && (
          <button
            type="button"
            onClick={() => setShowThreeWayMatch(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
          >
            <span>⚖</span>
            <span>3-Way Match Verification</span>
          </button>
        )}

        {/* Commercial KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-3">
            <span className="text-xl font-extrabold text-rose-700 dark:text-rose-300 font-mono block">
              {ppvLines.length}
            </span>
            <span className="text-[11px] text-rose-700 dark:text-rose-300 font-bold">PPV Items</span>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
            <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono block">
              ₹ {totalPurchaseValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Purchase Value</span>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3">
            <span className="text-xl font-extrabold text-amber-700 dark:text-amber-300 font-mono block">
              ₹ {avgUnitLandedCost.toFixed(2)}
            </span>
            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">Avg. Landed Cost</span>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-3">
            <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono block">
              {avgMarginPercent.toFixed(1)}%
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">Avg. Margin</span>
          </div>
        </div>
      </div>

      {/* Purchase Price Variance (PPV) Card */}
      <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Purchase Price Variance (PPV)</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
            {ppvLines.length} {ppvLines.length === 1 ? "item" : "items"} with variance • Total ₹{totalPpvAmount.toFixed(2)}
          </span>
        </div>

        {ppvLines.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500">
            No purchase price variance detected across received items. Billed invoice rates match contract PO rates.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-900/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/80 dark:bg-rose-950/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-rose-200 dark:border-rose-900">
                <tr>
                  <th className="py-2 px-2.5">SKU</th>
                  <th className="py-2 px-2.5">Product</th>
                  <th className="py-2 px-2.5 text-right">PO Rate</th>
                  <th className="py-2 px-2.5 text-right">Invoice Rate</th>
                  <th className="py-2 px-2.5 text-right text-rose-600 font-bold">Variance (₹)</th>
                  <th className="py-2 px-2.5 text-right">Accepted</th>
                  <th className="py-2 px-2.5 text-right text-rose-600 font-bold">Total PPV (₹)</th>
                  <th className="py-2 px-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {ppvLines.map(({ row, variancePerUnit, totalPpv, accepted }) => (
                  <tr key={row.rowId || row.code} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/20">
                    <td className="py-2 px-2.5 font-bold text-slate-800 dark:text-slate-200">{row.code}</td>
                    <td className="py-2 px-2.5 font-sans text-slate-700 dark:text-slate-300">{row.name}</td>
                    <td className="py-2 px-2.5 text-right">₹{row.cost_price.toFixed(2)}</td>
                    <td className="py-2 px-2.5 text-right">₹{row.invoice_rate.toFixed(2)}</td>
                    <td className="py-2 px-2.5 text-right font-bold text-rose-600 dark:text-rose-400">
                      {variancePerUnit > 0 ? `+₹${variancePerUnit.toFixed(2)}` : `-₹${Math.abs(variancePerUnit).toFixed(2)}`}
                    </td>
                    <td className="py-2 px-2.5 text-right">{accepted}</td>
                    <td className="py-2 px-2.5 text-right font-bold text-rose-600 dark:text-rose-400">
                      ₹{totalPpv.toFixed(2)}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 font-sans">
                        <button
                          type="button"
                          onClick={() => onNotification?.("Variance Accepted", `Accepted ${variancePerUnit > 0 ? "+" : ""}₹${variancePerUnit.toFixed(2)} variance for ${row.code}`, "info")}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs transition"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDebitNoteOpen(true)}
                          className="px-2.5 py-1 rounded border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        >
                          Create Claim
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commercial Rates & Margin Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
          Commercial Rates &amp; Margin Breakdown ({grnLines.length} items)
        </h4>

        {grnLines.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No inward lines present. Items added in Step 2 will appear here for commercial reconciliation.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2 px-2.5">SKU</th>
                  <th className="py-2 px-2.5">Product Name</th>
                  <th className="py-2 px-2 text-right">PO Rate (₹)</th>
                  <th className="py-2 px-2 text-right">Billed Rate (₹)</th>
                  <th className="py-2 px-2 text-right">Trade Disc.</th>
                  <th className="py-2 px-2 text-center">GST %</th>
                  <th className="py-2 px-2 text-right">Net Landed (₹)</th>
                  <th className="py-2 px-2 text-right">MRP (₹)</th>
                  <th className="py-2 px-2 text-right">Margin</th>
                  <th className="py-2 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {grnLines.map((row, idx) => {
                  const { landedCost } = lineAllocations[idx] || { landedCost: row.invoice_rate };
                  const isPpv = Math.abs(row.invoice_rate - row.cost_price) > 0.001;
                  const marginPct = row.mrp && row.mrp > 0 ? ((row.mrp - landedCost) / row.mrp) * 100 : 0;

                  return (
                    <tr key={row.rowId} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50">
                      <td className="py-2 px-2.5 font-bold text-slate-800 dark:text-slate-200">{row.code}</td>
                      <td className="py-2 px-2.5 font-sans text-slate-700 dark:text-slate-300">{row.name}</td>
                      <td className="py-2 px-2 text-right">₹{row.cost_price.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.invoice_rate}
                          onChange={(e) => updateLine(row.rowId, "invoice_rate", parseFloat(e.target.value) || 0)}
                          className={`w-20 text-right bg-slate-50 dark:bg-slate-800 border rounded px-1.5 py-0.5 font-mono ${
                            isPpv ? "border-amber-400 font-bold text-amber-700 dark:text-amber-300" : "border-slate-300 dark:border-slate-700"
                          }`}
                        />
                      </td>
                      <td className="py-2 px-2 text-right">₹{row.trade_discount.toFixed(2)}</td>
                      <td className="py-2 px-2 text-center font-sans">{row.gst_rate}%</td>
                      <td className="py-2 px-2 text-right font-bold text-indigo-600 dark:text-indigo-400">₹{landedCost.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right">₹{Number(row.mrp || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{marginPct.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-center font-sans">
                        {isPpv ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            PPV
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // STEP 4 — COSTS & FREIGHT
  const renderCostsFreightStep = () => (
    <div className="space-y-4" data-testid="workspace-costs-freight">
      {/* Transport & Logistics Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Transport &amp; Freight Logistics</h3>
              <p className="text-xs text-slate-500">Carrier documentation, bilty numbers, consignment weights and container details</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Transporter Name</label>
            <input
              type="text"
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              placeholder="e.g. V-Trans / TCI Freight"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">LR / Bilty No.</label>
            <input
              type="text"
              value={lrNumber}
              onChange={(e) => setLrNumber(e.target.value)}
              placeholder="e.g. LR-908123"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">LR Date</label>
            <input
              type="date"
              value={lrDate}
              onChange={(e) => setLrDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Vehicle No.</label>
            <input
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. MH-04-AB-1234"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono uppercase text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Weight / CBM</label>
            <input
              type="text"
              value={weightCbm}
              onChange={(e) => setWeightCbm(e.target.value)}
              placeholder="e.g. 450 Kg / 3.2 CBM"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Cartons / Boxes</label>
            <input
              type="number"
              min="0"
              value={cartons}
              onChange={(e) => setCartons(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Cost Components Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Inward Cost Components ({costItems.length})
            </h3>
            <p className="text-xs text-slate-500">Freight, octroi, customs duty, transit insurance, and handling add-ons</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mr-2">
              Total Add-ons: ₹{totalAddons.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <button
              type="button"
              onClick={() => setIsAddCostOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Cost Component</span>
            </button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Cost Type</th>
                <th className="py-2.5 px-3 text-right">Base Amount (₹)</th>
                <th className="py-2.5 px-2 text-center">GST %</th>
                <th className="py-2.5 px-3 text-right">GST Amount (₹)</th>
                <th className="py-2.5 px-2 text-center">ITC</th>
                <th className="py-2.5 px-3 text-center">Allocation</th>
                <th className="py-2.5 px-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {costItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-slate-500 font-sans">
                    No cost components added yet. Click "+ Add Cost Component" to record freight or other add-ons.
                  </td>
                </tr>
              ) : (
                costItems.map((c, i) => {
                  const gstVal = c.tax_amount ?? (c.amount * (c.tax_rate || 0)) / 100;
                  const allocationLabel = normalizeAllocationMethod(c.allocation_method) === "MANUAL" ? "Manual" : normalizeAllocationMethod(c.allocation_method) === "QUANTITY" ? "Quantity" : normalizeAllocationMethod(c.allocation_method) === "WEIGHT" ? "Weight" : "Value";
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50">
                      <td className="py-2.5 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-3 font-sans font-medium capitalize text-slate-800 dark:text-slate-200">
                        {c.component_type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">₹{c.amount.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-center text-slate-500">{c.tax_rate}%</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">₹{gstVal.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-center font-sans">
                        {c.itc_eligible ? (
                          <span className="text-emerald-600 font-bold">Yes</span>
                        ) : (
                          <span className="text-rose-500 font-bold">No</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {allocationLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveCostItem(c.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                          title="Delete component"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation Method Selector Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
          Landed Cost Allocation Method
        </h3>
        <p className="text-xs text-slate-500">Determine how freight and inward charges are distributed into product inventory landed costs</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          <label className={`rounded-xl border p-3 cursor-pointer transition ${allocationMethod === "value" ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850"}`}>
            <div className="flex items-center gap-2">
              <input type="radio" name="allocMethodMain" checked={allocationMethod === "value"} onChange={() => setAllocationMethod("value")} className="text-indigo-600" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">By Value (Ad-Valorem)</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Pro-rata based on net line purchase amount.</p>
          </label>

          <label className={`rounded-xl border p-3 cursor-pointer transition ${allocationMethod === "quantity" ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850"}`}>
            <div className="flex items-center gap-2">
              <input type="radio" name="allocMethodMain" checked={allocationMethod === "quantity"} onChange={() => setAllocationMethod("quantity")} className="text-indigo-600" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">By Quantity (Per Unit)</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Evenly split across all accepted units.</p>
          </label>

          <label className={`rounded-xl border p-3 cursor-pointer transition ${allocationMethod === "weight" ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850"}`}>
            <div className="flex items-center gap-2">
              <input type="radio" name="allocMethodMain" checked={allocationMethod === "weight"} onChange={() => setAllocationMethod("weight")} className="text-indigo-600" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">By Weight / CBM</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Allocated proportional to consignment bulk.</p>
          </label>

          <label className={`rounded-xl border p-3 cursor-pointer transition ${allocationMethod === "manual" ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850"}`}>
            <div className="flex items-center gap-2">
              <input type="radio" name="allocMethodMain" checked={allocationMethod === "manual"} onChange={() => setAllocationMethod("manual")} className="text-indigo-600" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">Manual Allocation</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Direct component-to-line manual entries.</p>
          </label>
        </div>
      </div>

      {/* Manual Allocation Grid (Active when manual allocation is chosen) */}
      {allocationMethod === "manual" && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Manual Cost Allocation Reconciliation
              </h4>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                Allocate each cost component across accepted GRN lines. All components must be balanced before posting.
              </p>
            </div>
            {manualAllocationTotals && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                manualAllocationTotals.isBalanced
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              }`}>
                {manualAllocationTotals.isBalanced ? "✓ All Balanced" : `Variance ₹${Math.abs(manualAllocationTotals.remaining).toFixed(2)}`}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {costItems.map((component) => {
              const summary = manualAllocationSummaries.find((s) => s.id === component.id);
              const rowInputs = manualAllocationMatrix[component.id] ?? {};

              return (
                <div key={component.id} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-xs text-slate-900 dark:text-white capitalize">
                      {component.description || component.component_type} (Target: ₹{Number(component.amount || 0).toFixed(2)})
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      summary?.isBalanced ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                    }`}>
                      {summary?.isBalanced ? "Balanced" : `Variance ₹${Math.abs(summary?.variance ?? 0).toFixed(2)}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {grnLines
                      .filter((row) => Math.max(0, row.quantity_received - row.quantity_damaged) > 0)
                      .map((row) => {
                        const accepted = Math.max(0, row.quantity_received - row.quantity_damaged);
                        const val = rowInputs[row.rowId] ?? 0;

                        return (
                          <div key={`${component.id}-${row.rowId}`} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                            <div className="truncate">
                              <span className="font-bold text-xs block text-slate-900 dark:text-white truncate">{row.code}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{accepted} accepted</span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={val || ""}
                              onChange={(e) => updateManualAllocation(component.id, row.rowId, e.target.value)}
                              className="w-24 text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono"
                              placeholder="0.00"
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Landed Cost Allocation Preview Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Landed Cost Allocation Preview
            </h3>
            <p className="text-xs text-slate-500">Preview calculated unit landed costs prior to posting</p>
          </div>
          <button
            type="button"
            onClick={handleOpenPreview}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
          >
            Open Full Allocation Preview
          </button>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2 px-3">SKU</th>
                <th className="py-2 px-3">Product Name</th>
                <th className="py-2 px-2 text-right">Accepted Qty</th>
                <th className="py-2 px-2 text-right">Net Billed Rate (₹)</th>
                <th className="py-2 px-2 text-right text-indigo-600">Add-on / Unit (₹)</th>
                <th className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">Landed Cost (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {grnLines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-xs text-slate-500 font-sans">
                    No items inwarded yet.
                  </td>
                </tr>
              ) : (
                grnLines.map((row, idx) => {
                  const { accepted, netRate } = lineMetrics[idx];
                  const { addonPerUnit, landedCost } = lineAllocations[idx];

                  return (
                    <tr key={row.rowId} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50">
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{row.code}</td>
                      <td className="py-2 px-3 font-sans text-slate-700 dark:text-slate-300">{row.name}</td>
                      <td className="py-2 px-2 text-right">{accepted}</td>
                      <td className="py-2 px-2 text-right">₹{netRate.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-indigo-600">+₹{addonPerUnit.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-indigo-700 dark:text-indigo-400">₹{landedCost.toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // STEP 5 — REVIEW & POST
  const renderReviewPostStep = () => (
    <div className="space-y-4" data-testid="workspace-review-post">
      {/* Review Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Review &amp; Post Goods Receipt Note</h3>
            <p className="text-xs text-slate-500">Read-only final verification across quantities, commercials, landed costs and statutory compliance</p>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold">
            ● Read-only Final Review
          </div>
        </div>

        {/* Quantities 4-Pill Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
            <span className="text-lg font-extrabold font-mono text-slate-900 dark:text-white block">{totalOrdered.toLocaleString()}</span>
            <span className="text-[11px] text-slate-500">Ordered (Units)</span>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
            <span className="text-lg font-extrabold font-mono text-blue-600 dark:text-blue-400 block">{totalReceived.toLocaleString()}</span>
            <span className="text-[11px] text-slate-500">Received (Units)</span>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
            <span className="text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400 block">{totalDamaged.toLocaleString()}</span>
            <span className="text-[11px] text-slate-500">Damaged (Units)</span>
          </div>
          <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
            <span className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 block">{totalAcceptedUnits.toLocaleString()}</span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">Net Accepted (Units)</span>
          </div>
        </div>

        {/* Document Header Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400 text-[10px] block uppercase">GRN No.</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{grnNumber}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400 text-[10px] block uppercase">Supplier</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{supplierName || supplierId || "--"}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400 text-[10px] block uppercase">PO Contract</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedOrderId || referencePo || "Direct Inward"}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400 text-[10px] block uppercase">Vendor Invoice</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{invoiceNumber || "--"}</span>
          </div>
        </div>
      </div>

      {/* Financial & Landed Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
            Valuation &amp; Landed Cost Summary
          </h4>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span className="font-sans">Purchase Value (Accepted Qty)</span>
              <span>₹ {totalPurchaseValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span className="font-sans">Total Add-on Base (Freight &amp; Handling)</span>
              <span>₹ {totalAddons.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span className="font-sans">Total GST on Add-ons (ITC Eligible)</span>
              <span>₹ {totalCostGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
              <span className="font-sans font-extrabold text-indigo-900 dark:text-indigo-200">Final Inventory Acquisition Cost</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-base">
                ₹ {finalInventoryCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-xs text-slate-700 dark:text-slate-300">
              <span className="font-sans">Avg. Unit Landed Cost</span>
              <span className="font-bold">₹ {avgUnitLandedCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Validation & Guardrails Checklist */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
            Pre-flight Validation Guardrails
          </h4>

          {validationMessages.length === 0 ? (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">All Pre-flight Validation Checks Passed</span>
                <span className="text-[11px]">Quantities, supplier verification, and cost allocations are completely reconciled and ready for inventory posting.</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Posting Blocked ({validationMessages.length} issue(s))</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                {validationMessages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Allocation reconciliation status */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Allocation Method:</span>
              <span className="font-bold capitalize">{allocationMethod}</span>
            </div>
            {manualAllocationTotals && (
              <div className="flex justify-between">
                <span className="text-slate-500">Manual Allocation Variance:</span>
                <span className={`font-mono font-bold ${manualAllocationTotals.isBalanced ? "text-emerald-600" : "text-rose-600"}`}>
                  ₹{manualAllocationTotals.remaining.toFixed(2)} ({manualAllocationTotals.isBalanced ? "Balanced" : "Unbalanced"})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Read-Only Line Item Landed Cost Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200">
          Inward Line Items &amp; Final Unit Landed Valuation ({grnLines.length} lines)
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-2 px-3">#</th>
              <th className="py-2 px-3">SKU</th>
              <th className="py-2 px-3">Product Name</th>
              <th className="py-2 px-2 text-right">Accepted Qty</th>
              <th className="py-2 px-2 text-right">PO Rate</th>
              <th className="py-2 px-2 text-right">Billed Rate</th>
              <th className="py-2 px-2 text-right text-indigo-600">Add-on / Unit</th>
              <th className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">Unit Landed Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {grnLines.map((row, idx) => {
              const { accepted } = lineMetrics[idx];
              const { addonPerUnit, landedCost } = lineAllocations[idx];

              return (
                <tr key={row.rowId} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50">
                  <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                  <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{row.code}</td>
                  <td className="py-2 px-3 font-sans text-slate-700 dark:text-slate-300">{row.name}</td>
                  <td className="py-2 px-2 text-right">{accepted}</td>
                  <td className="py-2 px-2 text-right">₹{row.cost_price.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right">₹{row.invoice_rate.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-indigo-600">+₹{addonPerUnit.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-indigo-700 dark:text-indigo-400">₹{landedCost.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Step 5 Pre-Flight Action Card */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-xs text-slate-900 dark:text-white">Ready to Finalize Goods Receipt Note</h4>
          <p className="text-xs text-slate-500">
            Review the quantities and landed valuation above. Clicking Post GRN opens the final confirmation gate before ledger commitment.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenConfirmPost}
          disabled={saving || isPostingGrn || (allocationMethod === "manual" && !!manualAllocationTotals && !manualAllocationTotals.isBalanced)}
          data-testid="step5-post-grn-btn"
          className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-2 ${
            saving || isPostingGrn || (allocationMethod === "manual" && !!manualAllocationTotals && !manualAllocationTotals.isBalanced)
              ? "bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>
            {allocationMethod === "manual" && !!manualAllocationTotals && !manualAllocationTotals.isBalanced
              ? "Reconcile Manual Allocation"
              : isPostingGrn || saving
              ? "Posting GRN..."
              : "Post GRN to Ledger"}
          </span>
        </button>
      </div>
    </div>
  );

  // Authoritative Active Workspace Switcher
  const renderWorkflowWorkspace = () => {
    switch (activeStep) {
      case "PO_DETAILS":
        return renderPoDetailsStep();
      case "RECEIVE_VERIFY":
        return renderReceiveVerifyStep();
      case "COMMERCIALS":
        return renderCommercialsStep();
      case "COSTS_FREIGHT":
        return renderCostsFreightStep();
      case "REVIEW_POST":
        return renderReviewPostStep();
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans h-full flex flex-col overflow-hidden">
      {/* Modals */}
      <AddCostComponentModal
        isOpen={isAddCostOpen}
        onClose={() => setIsAddCostOpen(false)}
        onSave={handleAddCostItem}
        costTypes={costTypes}
        defaultTransporter={transporterName}
        defaultLrNumber={lrNumber}
        defaultVehicle={vehicleNumber}
      />

      <CostAllocationPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirm={() => onNotification?.("Allocation Confirmed", "Landed costs mapped to SKU batches.", "success")}
        previewData={previewData}
      />

      <WhyThisCostModal
        isOpen={isWhyThisCostOpen}
        onClose={() => setIsWhyThisCostOpen(false)}
        data={whyThisCostData}
      />

      <GrnPostedSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        summary={postedSummary}
        onViewGrn={() => {
          setIsSuccessModalOpen(false);
          setSubView("history");
        }}
        onPrintSlip={() => {
          setIsSuccessModalOpen(false);
          if (latestPostedReceipt) {
            setPrintReceiptData(latestPostedReceipt);
            setIsPrintModalOpen(true);
          }
        }}
      />

      <ConfirmGrnPostModal
        isOpen={isConfirmPostOpen}
        onClose={() => setIsConfirmPostOpen(false)}
        onConfirm={handleExecuteConfirmPost}
        details={confirmationDetails}
        isPosting={isPostingGrn || saving}
      />

      <AddProductToGrnModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSelectProduct={handleAddProduct}
      />

      <GrnCameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={handleProcessBarcode}
        audioFeedback={scannerSound}
      />

      <GrnCsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        onImport={handleCsvImportConfirmed}
        existingPoLines={grnLines.map((l) => ({
          code: l.code,
          product_id: l.product_id,
          name: l.name,
          size: l.size,
          color: l.color,
          cost_price: l.cost_price,
          quantity_ordered: l.quantity_ordered,
          mrp: l.mrp,
          gst_rate: l.gst_rate,
        }))}
      />

      <GrnPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        receiptData={printReceiptData}
      />

      <CreateDebitNoteModal
        isOpen={isDebitNoteOpen}
        onClose={() => setIsDebitNoteOpen(false)}
        suppliers={suppliersList}
        defaultSupplierId={supplierId}
        defaultClaimAmount={totalPpvAmount > 0 ? totalPpvAmount : undefined}
        defaultReason={
          ppvLines.length > 0
            ? `Price variance claim for SKU ${ppvLines[0].row.code}: PO Rate ₹${ppvLines[0].row.cost_price} vs Billed Rate ₹${ppvLines[0].row.invoice_rate}`
            : undefined
        }
        onSuccess={() => {
          onNotification?.("Debit Note Claim Issued", "Rate variance debit note recorded for supplier.", "success");
          setIsDebitNoteOpen(false);
        }}
      />

      <ThreeWayMatchingModal
        isOpen={showThreeWayMatch}
        onClose={() => setShowThreeWayMatch(false)}
        context={{
          po_no: selectedOrder?.order_no || selectedOrder?.order_number || referencePo || selectedOrderId || "DIRECT",
          po_date: (selectedOrder as PurchaseOrderOption & { created_at?: string })?.created_at || grnDate,
          grn_no: grnNumber,
          grn_date: grnDate,
          vendor_invoice_no: invoiceNumber,
          vendor_invoice_date: invoiceDate,
          vendor_name: supplierName,
          vendor_gstin: "",
          items: grnLines.map((line) => ({
            id: line.rowId,
            item_code: line.code,
            item_name: line.name,
            po_qty: line.quantity_ordered,
            po_rate: line.cost_price,
            grn_accepted_qty: Math.max(0, line.quantity_received - line.quantity_damaged),
            grn_damaged_qty: line.quantity_damaged,
            invoice_qty: line.quantity_received,
            invoice_rate: line.invoice_rate,
            gst_rate: line.gst_rate,
          })),
        }}
        onNotification={onNotification}
      />

      <RMAManagementModal
        isOpen={rmaTargetLine !== null}
        onClose={() => setRmaTargetLine(null)}
        onNotification={onNotification}
      />

      {/* Top Application Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">
                Goods Receipt Note (GRN) Studio
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                ● Inward Engine
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Procurement Inward, Physical Verification, Landed Cost &amp; WMS Batch Staging
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubView("create")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              subView === "create"
                ? "bg-indigo-600 text-white shadow"
                : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Inward Studio</span>
            {grnLines.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-200 text-indigo-900 font-mono">
                {grnLines.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setSubView("history");
              loadReceipts();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              subView === "history"
                ? "bg-indigo-600 text-white shadow"
                : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>GRN History</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono">
              {savedReceipts.length}
            </span>
          </button>
          <button
            onClick={() => setSubView("bill")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              subView === "bill"
                ? "bg-indigo-600 text-white shadow"
                : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750"
            }`}
          >
            <Receipt className="w-3.5 h-3.5 inline mr-1" />
            Purchase Bill
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 ml-2 shadow"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* View 1: GRN Studio (Authoritative 5-Step Workflow) */}
      {subView === "create" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. PERSISTENT GRN HEADER */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3" data-testid="persistent-grn-header">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600" onClick={onClose} />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Goods Receipt Note (GRN)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  ● Draft
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNotification?.("Draft Saved", "GRN draft state persisted.", "info")}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearLines}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Reset workspace to blank state"
                >
                  Reset
                </button>
                {activeStep === "REVIEW_POST" ? (
                  <button
                    type="button"
                    onClick={handleOpenConfirmPost}
                    disabled={saving || isPostingGrn || (allocationMethod === "manual" && !!manualAllocationTotals && !manualAllocationTotals.isBalanced)}
                    data-testid="header-post-grn"
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Post GRN</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveStep("REVIEW_POST")}
                    className="px-3.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                    title="Jump to Step 5 (Review & Post)"
                  >
                    <span>Review &amp; Post →</span>
                  </button>
                )}
              </div>
            </div>

            {/* Form Fields: GRN No, Inward Date, Supplier, PO Source, Vendor Invoice */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">GRN No.</label>
                <input
                  type="text"
                  placeholder="Auto-Generated"
                  value={grnNumber}
                  onChange={(e) => setGrnNumber(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-200 outline-none"
                  data-testid="header-grn-no"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Inward Date</label>
                <input
                  type="date"
                  value={grnDate}
                  onChange={(e) => setGrnDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none"
                  data-testid="header-inward-date"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">
                  Supplier <span className="text-rose-500">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none font-medium"
                  data-testid="header-supplier-select"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliersList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.company_name || s.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-500 font-medium">Purchase Order Source</label>
                  {supplierId && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {eligibleOrders.length} {eligibleOrders.length === 1 ? "Order" : "Orders"}
                    </span>
                  )}
                </div>
                <select
                  value={selectedOrderId}
                  onChange={(e) => handleSelectOrder(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none font-medium"
                  data-testid="header-po-select"
                >
                  <option value="">
                    {supplierId
                      ? eligibleOrders.length > 0
                        ? `-- Select Open PO (${eligibleOrders.length} Available) --`
                        : "-- Direct Inward / No Open PO --"
                      : "-- Direct Inward / All Open POs --"}
                  </option>
                  {eligibleOrders.map((o) => (
                    <option key={o.order_id} value={o.order_id}>
                      {o.order_no} — {o.supplier_name} ({o.pending_items_count} items, {o.pending_quantity} units pending)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Vendor Invoice No.</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-99"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 dark:text-slate-200 outline-none"
                  data-testid="header-vendor-invoice"
                />
              </div>
            </div>
          </div>

          {/* 2. ONE AUTHORITATIVE WORKFLOW STEPPER */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-sm" data-testid="workflow-stepper">
            <div className="flex items-center justify-between text-xs overflow-x-auto gap-2">
              {GRN_WORKFLOW_STEPS.map((step, index) => {
                const activeIndex = GRN_WORKFLOW_STEPS.findIndex((s) => s.id === activeStep);
                const isCurrent = activeStep === step.id;
                const isCompleted = activeIndex > index;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    data-testid={`step-button-${step.id}`}
                    className={`flex items-center gap-2 py-1.5 px-3 rounded-lg border font-semibold transition shrink-0 ${
                      isCurrent
                        ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs"
                        : isCompleted
                          ? "border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isCurrent
                          ? "bg-indigo-600 text-white"
                          : isCompleted
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {isCompleted ? "✓" : index + 1}
                    </span>
                    <span className="whitespace-nowrap">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. MAIN WORKSPACE + SUMMARY DOCK */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Left Column: ONLY Active Workflow Workspace (8 cols) */}
            <div className="xl:col-span-8 space-y-4 flex flex-col">
              <div className="w-full">
                {renderWorkflowWorkspace()}
              </div>

              {/* Sticky Workflow Navigation Controls (Never requires scrolling to page bottom) */}
              <div
                className="sticky bottom-0 z-20 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-md backdrop-blur-sm flex items-center justify-between text-xs"
                data-testid="sticky-workflow-nav"
              >
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold font-mono">
                    Step {GRN_WORKFLOW_STEPS.findIndex((s) => s.id === activeStep) + 1} of 5
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {GRN_WORKFLOW_STEPS.find((s) => s.id === activeStep)?.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {activeStep === "PO_DETAILS" && (
                    <button
                      type="button"
                      onClick={advanceWorkflow}
                      data-testid="nav-next"
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Next: Receive &amp; Verify →</span>
                    </button>
                  )}

                  {activeStep === "RECEIVE_VERIFY" && (
                    <>
                      <button
                        type="button"
                        onClick={retreatWorkflow}
                        data-testid="nav-back"
                        className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 font-semibold"
                      >
                        <span>← Back: PO &amp; Details</span>
                      </button>
                      <button
                        type="button"
                        onClick={advanceWorkflow}
                        data-testid="nav-next"
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <span>Next: Commercials →</span>
                      </button>
                    </>
                  )}

                  {activeStep === "COMMERCIALS" && (
                    <>
                      <button
                        type="button"
                        onClick={retreatWorkflow}
                        data-testid="nav-back"
                        className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 font-semibold"
                      >
                        <span>← Back: Receive &amp; Verify</span>
                      </button>
                      <button
                        type="button"
                        onClick={advanceWorkflow}
                        data-testid="nav-next"
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <span>Next: Costs &amp; Freight →</span>
                      </button>
                    </>
                  )}

                  {activeStep === "COSTS_FREIGHT" && (
                    <>
                      <button
                        type="button"
                        onClick={retreatWorkflow}
                        data-testid="nav-back"
                        className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 font-semibold"
                      >
                        <span>← Back: Commercials</span>
                      </button>
                      <button
                        type="button"
                        onClick={advanceWorkflow}
                        data-testid="nav-next"
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <span>Next: Review &amp; Post →</span>
                      </button>
                    </>
                  )}

                  {activeStep === "REVIEW_POST" && (
                    <>
                      <button
                        type="button"
                        onClick={retreatWorkflow}
                        data-testid="nav-back"
                        className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 font-semibold"
                      >
                        <span>← Back: Costs &amp; Freight</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenConfirmPost}
                        disabled={saving || isPostingGrn || (allocationMethod === "manual" && !!manualAllocationTotals && !manualAllocationTotals.isBalanced)}
                        data-testid="nav-post-grn"
                        className={`px-5 py-2 rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 ${
                          saving || isPostingGrn || (allocationMethod === "manual" && !!manualAllocationTotals && !manualAllocationTotals.isBalanced)
                            ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        }`}
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>
                          {allocationMethod === "manual" && !!manualAllocationTotals && !manualAllocationTotals.isBalanced
                            ? "Reconcile Manual Allocation"
                            : saving || isPostingGrn
                              ? "Posting..."
                              : "Post GRN"}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Persistent Live Valuation Context Dock (4 cols) */}
            <div className="xl:col-span-4 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden" data-testid="right-summary-dock">
                {/* Dock Header */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                      Live Inward Valuation Dock
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Total Add-ons</span>
                    <span className="font-mono font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                      ₹ {totalAddons.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Dock Body */}
                <div className="p-4 space-y-4 text-xs">
                  {/* Transport Summary */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                        Logistics Carrier
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {cartons > 0 ? `${cartons} Cartons` : "No cartons"}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Transporter:</span>
                        <span className="font-semibold">{transporterName || "--"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">LR / Bilty No:</span>
                        <span className="font-mono">{lrNumber || "--"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Vehicle No:</span>
                        <span className="font-mono uppercase">{vehicleNumber || "--"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Landed Cost Components Summary */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                        Cost Components ({costItems.length})
                      </span>
                      <span className="text-[10px] text-indigo-600 font-medium capitalize">
                        Method: {allocationMethod}
                      </span>
                    </div>

                    {costItems.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic p-2 text-center bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                        No add-on costs registered.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto font-mono">
                        {costItems.map((c) => (
                          <div key={c.id} className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <span className="font-sans capitalize text-slate-800 dark:text-slate-200 truncate">
                              {c.component_type.replace(/_/g, " ").toLowerCase()}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white shrink-0">
                              ₹{c.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Valuation Summary */}
                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800 font-mono">
                    <span className="font-sans font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider block">
                      Valuation Metrics
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span className="font-sans">Purchase Value</span>
                        <span>₹ {totalPurchaseValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span className="font-sans">Add-on Charges</span>
                        <span>₹ {totalAddons.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span className="font-sans">Tax (ITC Eligible)</span>
                        <span>₹ {totalCostGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                        <span className="font-sans font-extrabold text-indigo-900 dark:text-indigo-200">Total Inward Value</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-base">
                          ₹ {finalInventoryCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        <span className="font-sans">Avg. Unit Landed Cost</span>
                        <span className="font-bold">₹ {avgUnitLandedCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Preview */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-100 transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Live Allocation Preview</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View 2: GRN History */}
      {subView === "history" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Material Inward Goods Receipts ({savedReceipts.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Inspect verified receipts, view SKU landed cost allocations, and print statutory A4 audit slips
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Receipt No or Supplier..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadReceipts}
                  className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                  title="Refresh receipts"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {receiptsLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Loading goods receipt notes...
              </div>
            ) : savedReceipts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                <p className="font-semibold text-slate-700 dark:text-slate-300">No Goods Receipt Notes posted yet.</p>
                <p>Switch to GRN Studio to inward your first purchase order or direct consignment.</p>
                <button
                  type="button"
                  onClick={() => setSubView("create")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition inline-flex items-center gap-1.5 mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start Inward Receipt</span>
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Receipt No</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-center">Items</th>
                      <th className="py-2.5 px-3 text-right">Grand Total (₹)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {savedReceipts
                      .filter((r) => {
                        if (!historySearch.trim()) return true;
                        const q = historySearch.toLowerCase().trim();
                        return (
                          (r.receipt_no && r.receipt_no.toLowerCase().includes(q)) ||
                          (r.supplier_id && r.supplier_id.toLowerCase().includes(q)) ||
                          (r.supplier_name && r.supplier_name.toLowerCase().includes(q)) ||
                          (r.notes && r.notes.toLowerCase().includes(q))
                        );
                      })
                      .map((r) => {
                        const isExpanded = expandedReceiptId === r.id;
                        return (
                          <React.Fragment key={r.id}>
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition">
                              <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {r.receipt_no}
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                                {r.supplier_name || r.supplier_id}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-500">
                                {r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "--"}
                              </td>
                              <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                                {r.items ? r.items.length : "--"}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                ₹{Number(r.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  {r.status || "RECEIVED"}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handlePrintFromHistory(r)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition flex items-center gap-1 shadow-xs"
                                    title="Print statutory A4 slip"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Print A4</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setExpandedReceiptId(isExpanded ? null : r.id)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition flex items-center gap-1"
                                  >
                                    <span>{isExpanded ? "Hide" : "Details"}</span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCreateBillFromReceipt(r)}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-xs transition flex items-center gap-1"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                    <span>Bill</span>
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Detail Drawer */}
                            {isExpanded && (
                              <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                                <td colSpan={7} className="p-4 space-y-3">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                                      <span>Line Items Inwarded ({r.items?.length || 0})</span>
                                      {r.transporter_name && (
                                        <span className="font-normal text-slate-500 font-mono">
                                          Carrier: {r.transporter_name} {r.lr_number ? `(LR: ${r.lr_number})` : ""}
                                        </span>
                                      )}
                                    </div>

                                    {r.items && r.items.length > 0 ? (
                                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                        <table className="w-full text-left text-[11px]">
                                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                                            <tr>
                                              <th className="py-2 px-2.5">#</th>
                                              <th className="py-2 px-2.5">SKU / Item</th>
                                              <th className="py-2 px-2.5 text-right">Ordered</th>
                                              <th className="py-2 px-2.5 text-right">Received</th>
                                              <th className="py-2 px-2.5 text-right text-rose-600">Damaged</th>
                                              <th className="py-2 px-2.5 text-right font-bold text-emerald-600">Accepted</th>
                                              <th className="py-2 px-2.5 text-right">Billed Rate (₹)</th>
                                              <th className="py-2 px-2.5 text-right text-indigo-600">Allocated Freight (₹)</th>
                                              <th className="py-2 px-2.5 text-right font-bold text-indigo-700">Landed Cost (₹)</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                                            {r.items.map((it: any, iIdx: number) => {
                                              const accepted = Math.max(0, Number(it.quantity_received || 0) - Number(it.quantity_damaged || 0));
                                              return (
                                                <tr key={it.id || iIdx}>
                                                  <td className="py-1.5 px-2.5 text-slate-400">{iIdx + 1}</td>
                                                  <td className="py-1.5 px-2.5 font-sans font-medium text-slate-800 dark:text-slate-200">
                                                    {it.code || it.product_id} — {it.name || "Product"}
                                                  </td>
                                                  <td className="py-1.5 px-2.5 text-right">{Number(it.quantity_ordered || 0)}</td>
                                                  <td className="py-1.5 px-2.5 text-right text-slate-800 dark:text-slate-200">
                                                    {Number(it.quantity_received || 0)}
                                                  </td>
                                                  <td className="py-1.5 px-2.5 text-right text-rose-600">
                                                    {Number(it.quantity_damaged || 0)}
                                                  </td>
                                                  <td className="py-1.5 px-2.5 text-right font-bold text-emerald-600">
                                                    {accepted}
                                                  </td>
                                                  <td className="py-1.5 px-2.5 text-right">
                                                    ₹{Number(it.cost_price || 0).toFixed(2)}
                                                  </td>
                                                  <td className="py-1.5 px-2.5 text-right text-indigo-600">
                                                    ₹{Number(it.freight_allocated || 0).toFixed(2)}
                                                  </td>
                                                  <td className="py-1.5 px-2.5 text-right font-bold text-indigo-700">
                                                    ₹{Number(it.landed_cost || it.cost_price || 0).toFixed(2)}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400">No item details stored.</p>
                                    )}

                                    {/* Attached Inward Cost Components */}
                                    {r.cost_components && r.cost_components.length > 0 && (
                                      <div className="pt-2 space-y-1.5">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                          Landed Cost Components ({r.cost_components.length})
                                        </span>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                                          {r.cost_components.map((comp: any, cIdx: number) => (
                                            <div
                                              key={cIdx}
                                              className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900"
                                            >
                                              <div className="font-bold text-indigo-900 dark:text-indigo-200">
                                                {comp.component_type}
                                              </div>
                                              <div className="text-slate-600 dark:text-slate-400">
                                                ₹{Number(comp.amount || 0).toFixed(2)} • {comp.allocation_method || "VALUE"}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 3: Purchase Bill */}
      {subView === "bill" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 max-w-xl mx-auto space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              Record Supplier Purchase Bill
            </h3>
            {selectedReceiptForBill ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 font-mono space-y-1">
                  <div>GRN Reference: <strong>{selectedReceiptForBill.receipt_no}</strong></div>
                  <div>Supplier: <strong>{selectedReceiptForBill.supplier_id}</strong></div>
                  <div>Grand Total: <strong>₹{Number(selectedReceiptForBill.grand_total || 0).toFixed(2)}</strong></div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Vendor Tax Invoice / Bill No. <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vendorBillNo}
                    onChange={(e) => setVendorBillNo(e.target.value)}
                    placeholder="e.g. INV-2026-98102"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSubView("history")}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitPurchaseBill}
                    disabled={billSaving}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow"
                  >
                    {billSaving ? "Recording..." : "Record Purchase Bill"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">
                Select a GRN from GRN History first to record a purchase bill.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GrnReceiptTab;
