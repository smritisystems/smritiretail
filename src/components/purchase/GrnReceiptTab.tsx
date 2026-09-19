/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-09-18
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_RECEIPT")
 * Target UI    : SMRITI GRN Studio — Operator-First Inward Landed Cost, Freight & PPV Engine
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Calculator,
  Percent,
  ArrowLeft,
  Search,
  Barcode,
  Columns,
  Trash2,
  HelpCircle,
  TrendingUp,
  FileText,
  AlertCircle,
  Eye,
  Check,
  Scale,
  Printer,
  Sparkles,
  Building2,
  FolderOpen,
} from "lucide-react";
import { CreateDebitNoteModal } from "../CreateDebitNoteDlg.tsx";
import { AddCostComponentModal } from "./AddCostComponentModal.tsx";
import { CostAllocationPreviewModal } from "./CostAllocationPreviewModal.tsx";
import { WhyThisCostModal } from "./WhyThisCostModal.tsx";
import { GrnPostedSuccessModal } from "./GrnPostedSuccessModal.tsx";
import { GrnPrintModal, GrnPrintReceiptData } from "./GrnPrintModal.tsx";
import { AddProductToGrnModal, SelectedGrnProduct } from "./AddProductToGrnModal.tsx";
import {
  InwardCostItem,
  InwardCostTypeOption,
  AllocationPreviewResult,
  WhyThisCostData,
  GrnPostedSummary,
} from "./types/inwardCost.ts";

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

// Initial Footwear Sample lines matching canonical GRN-2026-00452 audit
const DEFAULT_SAMPLE_LINES: GrnLineRow[] = [
  {
    rowId: "row-1",
    product_id: "prd-sh-001",
    item_id: "item-sh-001",
    code: "SH-001",
    name: "Runner Pro (Men's Running Shoes)",
    size: "8",
    color: "Black",
    quantity_ordered: 200,
    quantity_received: 200,
    quantity_damaged: 0,
    cost_price: 1450.00,
    invoice_rate: 1450.00,
    trade_discount: 0,
    gst_rate: 18,
    mrp: 2499.00,
  },
  {
    rowId: "row-2",
    product_id: "prd-sh-002",
    item_id: "item-sh-002",
    code: "SH-002",
    name: "City Walk (Men's Casual Shoes)",
    size: "9",
    color: "Brown",
    quantity_ordered: 300,
    quantity_received: 298,
    quantity_damaged: 2,
    cost_price: 1250.00,
    invoice_rate: 1300.00, // +50 PPV
    trade_discount: 0,
    gst_rate: 18,
    mrp: 2499.00,
  },
  {
    rowId: "row-3",
    product_id: "prd-sh-003",
    item_id: "item-sh-003",
    code: "SH-003",
    name: "Trail Blazer (Outdoor Shoes)",
    size: "8",
    color: "Olive",
    quantity_ordered: 250,
    quantity_received: 250,
    quantity_damaged: 0,
    cost_price: 1650.00,
    invoice_rate: 1650.00,
    trade_discount: 0,
    gst_rate: 18,
    mrp: 2499.00,
  },
  {
    rowId: "row-4",
    product_id: "prd-sh-004",
    item_id: "item-sh-004",
    code: "SH-004",
    name: "Kids Sport (Kids Shoes)",
    size: "4",
    color: "Navy",
    quantity_ordered: 500,
    quantity_received: 482,
    quantity_damaged: 8,
    cost_price: 850.00,
    invoice_rate: 850.00,
    trade_discount: 0,
    gst_rate: 18,
    mrp: 1599.00,
  },
];

const DEFAULT_SAMPLE_COST_COMPONENTS: InwardCostItem[] = [
  {
    id: "icc-01",
    component_type: "FREIGHT",
    description: "Inward Linehaul Freight",
    amount: 2500,
    taxable_amount: 2500,
    tax_amount: 450,
    tax_rate: 18,
    total_amount: 2950,
    itc_eligible: true,
    is_capitalizable: true,
    allocation_method: "VALUE",
    transporter_name: "V-Trans Express",
    document_no: "VT-982142",
    status: "READY",
  },
  {
    id: "icc-02",
    component_type: "HANDLING",
    description: "Dock Unloading & Hamali",
    amount: 500,
    taxable_amount: 500,
    tax_amount: 90,
    tax_rate: 18,
    total_amount: 590,
    itc_eligible: true,
    is_capitalizable: true,
    allocation_method: "QUANTITY",
    status: "READY",
  },
  {
    id: "icc-03",
    component_type: "INSURANCE",
    description: "Marine / Transit Insurance",
    amount: 300,
    taxable_amount: 300,
    tax_amount: 54,
    tax_rate: 18,
    total_amount: 354,
    itc_eligible: true,
    is_capitalizable: true,
    allocation_method: "VALUE",
    status: "READY",
  },
  {
    id: "icc-04",
    component_type: "PACKING_FORWARDING",
    description: "Carton Packaging & Forwarding",
    amount: 200,
    taxable_amount: 200,
    tax_amount: 36,
    tax_rate: 18,
    total_amount: 236,
    itc_eligible: true,
    is_capitalizable: true,
    allocation_method: "VALUE",
    status: "READY",
  },
  {
    id: "icc-05",
    component_type: "DUTY_TOLL",
    description: "Highway / Municipal Toll",
    amount: 500,
    taxable_amount: 500,
    tax_amount: 0,
    tax_rate: 0,
    total_amount: 500,
    itc_eligible: false,
    is_capitalizable: true,
    allocation_method: "VALUE",
    status: "READY",
  },
];

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

  // Header State
  const [grnNumber, setGrnNumber] = useState("");
  const [grnDate, setGrnDate] = useState(new Date().toISOString().split("T")[0]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [referencePo, setReferencePo] = useState("");
  const [activeStep, setActiveStep] = useState(1);

  // Transport Details State
  const [transporterName, setTransporterName] = useState("");
  const [lrNumber, setLrNumber] = useState("");
  const [lrDate, setLrDate] = useState(new Date().toISOString().split("T")[0]);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [weightCbm, setWeightCbm] = useState("");
  const [cartons, setCartons] = useState(0);
  const [showRightDock, setShowRightDock] = useState(true);

  // Inward Landed Cost Engine State
  const [costTypes, setCostTypes] = useState<InwardCostTypeOption[]>([]);
  const [costItems, setCostItems] = useState<InwardCostItem[]>([]);
  const [allocationMethod, setAllocationMethod] = useState<"VALUE" | "QUANTITY" | "WEIGHT">("VALUE");

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

  // History search and row expansion state
  const [historySearch, setHistorySearch] = useState("");
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);

  // Debit Note Modal State for PPV claims
  const [isDebitNoteOpen, setIsDebitNoteOpen] = useState(false);
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

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await apiFetchV1("/purchase/orders/");
      const list: PurchaseOrderOption[] = Array.isArray(res) ? res : res?.items || [];
      setOrders(list.filter((o) => o.status !== "Cancelled" && o.status !== "CANCELLED"));
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

      const lines: GrnLineRow[] = (order.items || []).map((item, idx) => ({
        rowId: `row-${idx}-${Date.now()}`,
        product_id: item.product_id || item.item_id || item.id || `PROD-${idx + 1}`,
        item_id: item.item_id || item.id || "",
        code: item.code || `SKU-${idx + 1}`,
        name: item.name || item.description || `Item ${idx + 1}`,
        size: item.size || "M",
        color: item.color || "Standard",
        quantity_ordered: Number(item.quantity) || 0,
        quantity_received: Number(item.quantity) || 0,
        quantity_damaged: 0,
        cost_price: Number(item.cost_price || item.unit_price) || 100,
        invoice_rate: Number(item.cost_price || item.unit_price) || 100,
        trade_discount: 0,
        gst_rate: Number(item.gst_rate) || 18,
        mrp: Number(item.mrp) || Number(item.unit_price ? Number(item.unit_price) * 1.6 : 0) || 0,
      }));
      setGrnLines(lines);
      onNotification?.("Order Loaded", `Loaded ${lines.length} items from PO ${order.order_no || order.id}.`, "info");
    } catch {
      onNotification?.("Load Error", "Could not load order details.", "error");
    }
  };

  const handleLoadDemoSample = () => {
    setGrnNumber("GRN-2026-00452");
    setSupplierName("ABC Footwear Pvt. Ltd.");
    setSupplierId("SUP-001");
    setInvoiceNumber("INV-78452");
    setInvoiceDate("2026-09-18");
    setReferencePo("PO-2026-00321");
    setTransporterName("V-Trans Express");
    setLrNumber("VT-982142");
    setVehicleNumber("MH-12-Q-4021");
    setWeightCbm("180 Kg / 1.2");
    setCartons(10);
    setGrnLines(DEFAULT_SAMPLE_LINES);
    setCostItems(DEFAULT_SAMPLE_COST_COMPONENTS);
    onNotification?.("Demo Sample Loaded", "Loaded 4 footwear lines & 5 landed cost components.", "info");
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
    setGrnNumber("");
    setNotes("");
    onNotification?.("Workspace Cleared", "GRN lines and cost components reset.", "info");
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

  // Allocation per line
  const lineAllocations = useMemo(() => {
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
      if (allocationMethod === "QUANTITY") {
        share = totalAcceptedUnits > 0 ? accepted / totalAcceptedUnits : 0;
      } else {
        share = totalPurchaseValue > 0 ? lineNetVal / totalPurchaseValue : 0;
      }

      const allocatedAmount = Math.round(totalAddons * share * 100) / 100;
      const addonPerUnit = Math.round((allocatedAmount / accepted) * 100) / 100;
      const landedCost = Math.round((netRate + addonPerUnit) * 100) / 100;

      return { allocatedAmount, addonPerUnit, landedCost };
    });
  }, [grnLines, totalAddons, totalPurchaseValue, lineMetrics, totalAcceptedUnits, allocationMethod]);

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

    // Compute component shares
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

  // Submit Post GRN
  const handleSubmitGRN = async () => {
    const validLines = grnLines.filter((r) => r.quantity_received > 0);
    if (validLines.length === 0) {
      onNotification?.("Validation Error", "Enter at least one received quantity greater than zero.", "warning");
      return;
    }
    const effSupplier = supplierId || supplierName || (suppliersList.length > 0 ? suppliersList[0].id : "SUP-DIRECT");
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
            cost_price: r.invoice_rate, // Billed rate
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

      <AddProductToGrnModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSelectProduct={handleAddProduct}
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

      {/* View 1: GRN Studio */}
      {subView === "create" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Main 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Left Column: GRN Workspace (8 cols) */}
            <div className="xl:col-span-8 space-y-4">
              {/* Header Details Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
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
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitGRN}
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>{saving ? "Posting..." : "Post GRN"}</span>
                    </button>
                  </div>
                </div>

                {/* Form Fields Header */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">GRN No.</label>
                    <input
                      type="text"
                      placeholder="Auto-Generated"
                      value={grnNumber}
                      onChange={(e) => setGrnNumber(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Inward Date</label>
                    <input
                      type="date"
                      value={grnDate}
                      onChange={(e) => setGrnDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-slate-500 font-medium mb-1">
                      Purchase Order Source
                    </label>
                    <select
                      value={selectedOrderId}
                      onChange={(e) => handleSelectOrder(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none font-medium"
                    >
                      <option value="">-- Direct Inward / Ad-Hoc (No PO) --</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.order_no || o.order_number || o.id} — {o.supplier_name || o.supplier_id} ({o.items?.length || 0} items)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">
                      Supplier <span className="text-rose-500">*</span>
                    </label>
                    {selectedOrderId ? (
                      <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-xs truncate text-slate-800 dark:text-slate-200">
                        {supplierName || supplierId || "PO Supplier"}
                      </div>
                    ) : (
                      <select
                        value={supplierId}
                        onChange={(e) => {
                          const sid = e.target.value;
                          setSupplierId(sid);
                          const s = suppliersList.find((x) => x.id === sid);
                          if (s) setSupplierName(s.name || s.company_name || sid);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none font-medium"
                      >
                        <option value="">-- Direct Supplier --</option>
                        {suppliersList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name || s.company_name || s.id}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Vendor Invoice No.</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026-99"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                </div>

                {/* Process Step Wizard */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
                  {[
                    { step: 1, label: "PO & Details" },
                    { step: 2, label: "Receive & Verify" },
                    { step: 3, label: "Commercials" },
                    { step: 4, label: "Costs & Freight" },
                    { step: 5, label: "Review & Post" },
                  ].map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setActiveStep(s.step)}
                      className={`flex items-center gap-2 pb-1 border-b-2 font-semibold transition ${
                        activeStep === s.step
                          ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                          : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          activeStep === s.step
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {s.step}
                      </span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {grnLines.length === 0 ? (
                /* Inward Launchpad Hub */
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                  {/* Launchpad Welcome */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
                        <FolderOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          Goods Inward Receiving Hub
                        </h3>
                        <p className="text-xs text-slate-500">
                          Select an open Purchase Order to inward against contract specs, or start Direct Inward without a PO
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadDemoSample}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5 shrink-0 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Load Footwear Demo (4 SKUs)</span>
                    </button>
                  </div>

                  {/* Section 1: Open Confirmed POs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                          Open Purchase Orders Awaiting Inward ({orders.length})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={loadOrders}
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Refresh POs</span>
                      </button>
                    </div>

                    {ordersLoading ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Loading open purchase orders from database...
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 space-y-1">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">No open purchase orders pending receipt.</p>
                        <p>You can create a new PO in PO Studio or perform Direct Inward below.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="py-2.5 px-3">PO Number</th>
                              <th className="py-2.5 px-3">Supplier</th>
                              <th className="py-2.5 px-3 text-center">Items</th>
                              <th className="py-2.5 px-3 text-right">Order Value (₹)</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                              <th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {orders.slice(0, 6).map((o) => (
                              <tr key={o.id} className="hover:bg-indigo-50/30 dark:hover:bg-slate-850/50 transition">
                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {o.order_no || o.order_number || o.id}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                                  {o.supplier_name || o.supplier_id}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                                  {o.items ? o.items.length : "--"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                  ₹{Number(o.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                    {o.status || "CONFIRMED"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectOrder(o.id)}
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

                  {/* Section 2: Direct Inward / Ad-Hoc Material Receiving */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        Direct Inward / Ad-Hoc Receiving (Without PO)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Receive goods directly into stock from master inventory catalog.
                      </p>
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
              ) : (
                /* Full Receiving Workspace */
                <>
                  {/* Receiving Summary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
                      <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono block">
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
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Net Accepted</span>
                    </div>
                  </div>

                  {/* Item Details Grid */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          Inward Items ({grnLines.length})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddProductOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Product from Catalog</span>
                        </button>
                        {selectedOrderId && (
                          <button
                            type="button"
                            onClick={() => handleSelectOrder(selectedOrderId)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1"
                            title="Reset items from PO"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reload PO</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleClearLines}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-2.5">#</th>
                            <th className="py-2.5 px-2">SKU</th>
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-2">Size</th>
                            <th className="py-2.5 px-2">Color</th>
                            <th className="py-2.5 px-2 text-right">PO Qty</th>
                            <th className="py-2.5 px-2 text-right">Recv Qty</th>
                            <th className="py-2.5 px-2 text-right text-rose-500">Damage</th>
                            <th className="py-2.5 px-2 text-right font-bold text-emerald-600 dark:text-emerald-400">Accepted</th>
                            <th className="py-2.5 px-2 text-right">PO Rate (₹)</th>
                            <th className="py-2.5 px-2 text-right">Inv. Rate (₹)</th>
                            <th className="py-2.5 px-2 text-right">Net Rate (₹)</th>
                            <th className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                              Landed Cost (₹)
                            </th>
                            <th className="py-2.5 px-2 text-right">Margin</th>
                            <th className="py-2.5 px-2 text-center">Status</th>
                            <th className="py-2.5 px-2 text-center">Del</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {grnLines.map((row, idx) => {
                            const { accepted, netRate } = lineMetrics[idx];
                            const { landedCost } = lineAllocations[idx];
                            const isPpv = Math.abs(row.invoice_rate - row.cost_price) > 0.001;
                            const marginPct = row.mrp && row.mrp > 0 ? ((row.mrp - landedCost) / row.mrp) * 100 : 0;

                            return (
                              <tr key={row.rowId} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50">
                                <td className="py-2 px-2.5 text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {row.code}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-semibold text-slate-900 dark:text-white block">
                                    {row.name}
                                  </span>
                                </td>
                                <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-400">{row.size}</td>
                                <td className="py-2 px-2 text-slate-600 dark:text-slate-400">{row.color}</td>
                                <td className="py-2 px-2 text-right font-mono">{row.quantity_ordered}</td>
                                <td className="py-2 px-2 text-right font-mono">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.quantity_received}
                                    onChange={(e) => updateLine(row.rowId, "quantity_received", parseFloat(e.target.value) || 0)}
                                    className="w-16 text-right bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono"
                                  />
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.quantity_damaged}
                                    onChange={(e) => updateLine(row.rowId, "quantity_damaged", parseFloat(e.target.value) || 0)}
                                    className="w-14 text-right bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono text-rose-600"
                                  />
                                </td>
                                <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {accepted}
                                </td>
                                <td className="py-2 px-2 text-right font-mono">
                                  {row.cost_price.toFixed(2)}
                                </td>
                                <td className="py-2 px-2 text-right font-mono">
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
                                <td className="py-2 px-2 text-right font-mono font-medium">
                                  {netRate.toFixed(2)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenWhyThisCost(idx)}
                                    className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition inline-flex items-center gap-1"
                                    title="Click to view explainable landed cost breakdown"
                                  >
                                    <span>₹{landedCost.toFixed(2)}</span>
                                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                                  </button>
                                </td>
                                <td className="py-2 px-2 text-right font-mono">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                    {marginPct.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-center">
                                  {isPpv ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 inline-flex items-center gap-0.5">
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>PPV</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-0.5">
                                      <Check className="w-3 h-3" />
                                      <span>OK</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLine(row.rowId)}
                                    className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition"
                                    title="Delete line"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Purchase Price Variance (PPV) Card */}
                  {ppvLines.length > 0 && (
                    <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>Purchase Price Variance (PPV)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                          {ppvLines.length} item with variance
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-slate-500 font-medium">
                            <tr>
                              <th className="py-1 px-2">SKU</th>
                              <th className="py-1 px-2">Product</th>
                              <th className="py-1 px-2 text-right">PO Rate</th>
                              <th className="py-1 px-2 text-right">Invoice Rate</th>
                              <th className="py-1 px-2 text-right text-rose-600">Variance (₹)</th>
                              <th className="py-1 px-2 text-right">Qty</th>
                              <th className="py-1 px-2 text-right text-rose-600 font-bold">Total (₹)</th>
                              <th className="py-1 px-2 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rose-100 dark:divide-rose-900/40">
                            {ppvLines.map(({ row, variancePerUnit, totalPpv, accepted }) => (
                              <tr key={row.code}>
                                <td className="py-2 px-2 font-mono font-bold text-slate-800 dark:text-slate-200">{row.code}</td>
                                <td className="py-2 px-2 text-slate-700 dark:text-slate-300">{row.name}</td>
                                <td className="py-2 px-2 text-right font-mono">₹{row.cost_price.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right font-mono">₹{row.invoice_rate.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                  +{variancePerUnit.toFixed(2)}
                                </td>
                                <td className="py-2 px-2 text-right font-mono">{accepted}</td>
                                <td className="py-2 px-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                  ₹{totalPpv.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => onNotification?.("Variance Accepted", `Accepted +₹${variancePerUnit} variance for ${row.code}`, "info")}
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
                    </div>
                  )}

                  {/* Margin Preview Post GRN Box */}
                  <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-xs">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        <span>Margin Preview (Post GRN)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Based on accepted quantity and capitalized landed cost
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-right text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-medium">Avg. Landed Cost</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          ₹ {avgUnitLandedCost.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-medium">Avg. MRP</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          ₹ {avgMrp.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-medium">Avg. Margin</span>
                        <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-xs">
                          {avgMarginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Remarks & Document Attachments Footer */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Remarks */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                      <label className="font-bold text-slate-800 dark:text-slate-200">Remarks &amp; Notes</label>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any remarks, transport observations, packaging condition, or inspection notes..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Attachments */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                      <label className="font-bold text-slate-800 dark:text-slate-200">Statutory Attachments</label>
                      <div className="space-y-1.5">
                        {[
                          { name: "Vendor_Tax_Invoice.pdf", size: "245 KB" },
                          { name: "Transporter_LR_Slip.pdf", size: "120 KB" },
                          { name: "Physical_Packing_List.pdf", size: "98 KB" },
                        ].map((f) => (
                          <div
                            key={f.name}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="font-medium text-slate-800 dark:text-slate-200">{f.name}</span>
                            </div>
                            <span className="text-slate-400">{f.size}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Column: Transport & Inward Landed Cost Dock (4 cols) */}
            <div className="xl:col-span-4 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                {/* Dock Header */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                      Transport &amp; Inward Landed Cost
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Total Addons</span>
                    <span className="font-mono font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                      ₹ {totalAddons.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Dock Body */}
                <div className="p-4 space-y-4 text-xs">
                  {/* Transport Details Section */}
                  <div className="space-y-2.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider block">
                      Transport Details
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Transporter</label>
                        <input
                          type="text"
                          value={transporterName}
                          onChange={(e) => setTransporterName(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">LR / Bilty No.</label>
                        <input
                          type="text"
                          value={lrNumber}
                          onChange={(e) => setLrNumber(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-mono text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Date</label>
                        <input
                          type="date"
                          value={lrDate}
                          onChange={(e) => setLrDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Vehicle No.</label>
                        <input
                          type="text"
                          value={vehicleNumber}
                          onChange={(e) => setVehicleNumber(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-mono uppercase text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Weight / CBM</label>
                        <input
                          type="text"
                          value={weightCbm}
                          onChange={(e) => setWeightCbm(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Cartons</label>
                        <input
                          type="number"
                          value={cartons}
                          onChange={(e) => setCartons(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-mono text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cost Components Section */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                        Cost Components ({costItems.length})
                      </span>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2 px-2">#</th>
                            <th className="py-2 px-2">Cost Type</th>
                            <th className="py-2 px-2 text-right">Amount (₹)</th>
                            <th className="py-2 px-1 text-center">Tax</th>
                            <th className="py-2 px-2 text-center">Allocation</th>
                            <th className="py-2 px-1 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {costItems.map((c, i) => (
                            <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50">
                              <td className="py-1.5 px-2 text-slate-400">{i + 1}</td>
                              <td className="py-1.5 px-2 font-medium text-slate-800 dark:text-slate-200">{c.component_type}</td>
                              <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {c.amount.toFixed(2)}
                              </td>
                              <td className="py-1.5 px-1 text-center font-mono text-slate-500">{c.tax_rate}%</td>
                              <td className="py-1.5 px-2 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {c.allocation_method === "QUANTITY" ? "Quantity" : "Value"}
                                </span>
                              </td>
                              <td className="py-1.5 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCostItem(c.id)}
                                  className="text-slate-400 hover:text-rose-500 p-0.5 transition"
                                  title="Delete component"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddCostOpen(true)}
                      className="w-full py-1.5 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Cost Component</span>
                    </button>
                  </div>

                  {/* Allocation Method Radio Group */}
                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider block">
                      Allocation Method
                    </span>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="allocMethodSidebar"
                          checked={allocationMethod === "VALUE"}
                          onChange={() => setAllocationMethod("VALUE")}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium">By Value (Ad-Valorem)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="allocMethodSidebar"
                          checked={allocationMethod === "QUANTITY"}
                          onChange={() => setAllocationMethod("QUANTITY")}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium">By Quantity (Per Unit)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="allocMethodSidebar"
                          checked={allocationMethod === "WEIGHT"}
                          onChange={() => setAllocationMethod("WEIGHT")}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium">By Weight / CBM</span>
                      </label>
                    </div>

                    <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        Freight and other costs will be allocated based on each item's share of total invoice value.
                      </span>
                    </div>
                  </div>

                  {/* Cost Summary Section */}
                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800 font-mono">
                    <span className="font-sans font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider block">
                      Cost Summary
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Purchase Value (Accepted Qty)</span>
                        <span>₹{totalPurchaseValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
                        <span>Total Add-on Costs</span>
                        <span>₹{totalAddons.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                        <span>Final Inventory Cost</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ₹{finalInventoryCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        <span>Avg. Unit Landed Cost</span>
                        <span>₹{avgUnitLandedCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Preview Button */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-center">
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Scale className="w-4 h-4" />
                      <span>Preview Allocation</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="text-[11px] text-indigo-600 hover:underline inline-block font-semibold"
                    >
                      View Allocation Preview →
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
