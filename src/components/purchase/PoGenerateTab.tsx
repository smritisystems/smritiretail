/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.59.0
 * Created      : 2026-08-21
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Product } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  PurchaseOrderHeader,
  PurchaseOrderLineItem,
  PurchaseOrderSizePivotRow,
  PurchaseOrderSummaryTotals,
  POWorkflowState,
  POLineDecisionState,
  computePOIssues,
  POSubmitValidationResult,
  POVendorChangeResult,
} from "./types.ts";
import { GlobalGridImportModal } from "../gridInput/GlobalGridImportModal.tsx";
import { GRID_PROFILES } from "../../services/gridInput/gridProfiles.ts";
import type { ParsedGridRow, GridImportMode } from "../../services/gridInput/types.ts";
import { PurchBrowseDlg } from "./PurchBrowseDlg.tsx";
import { useF2Screen } from "../../context/F2DispatcherContext.tsx";
import type { LookupResult } from "../../context/F2DispatcherContext.tsx";
import { POProductExplainModal } from "./POProductExplainModal.tsx";
import { POApprovalReasonDialog } from "./POApprovalReasonDialog.tsx";
import { POVendorChangeDialog } from "./POVendorChangeDialog.tsx";
import { POValidationSummary } from "./POValidationSummary.tsx";
import { POVendorContext } from "./POVendorContext.tsx";
import { POIssuesSummaryBar } from "./POIssuesSummaryBar.tsx";
import { POProductStatusBadge } from "./POProductStatusBadge.tsx";
import type { POProductDecision } from "./POProductStatusBadge.tsx";
import { POPrintPreviewModal } from "./POPrintPreviewModal.tsx";
import { SupplierScorecardModal } from "./SupplierScorecardModal.tsx";
import { SupplierSelect, SupplierOption } from "../common/SupplierSelect.tsx";
import { CommercialDeliveryDrawer, CommercialDeliveryData, DEFAULT_BUSINESS_TERMS } from "./CommercialDeliveryDrawer.tsx";
import {
  normalizePurchaseStatus,
  buildPurchaseOrderDetailUrl,
} from "./poLifecycle.ts";
import {
  buildArticleCatalogIndex,
  getAvailableArticles,
  getAvailableColorsForArticle,
  getAvailableSizesForArticleAndColor,
  getArticleSummaryFromIndex,
  resolveVariantFromIndex,
  resolveByBarcodeOrSkuFromIndex,
} from "./articleFiltering.ts";

export interface PurchaseOrderGenerationTabProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  onClose?: () => void;
  onNavigateTab?: (tab: string) => void;
  initialLineItems?: PurchaseOrderLineItem[];
  initialHeader?: PurchaseOrderHeader;
  onLineItemsChange?: (items: PurchaseOrderLineItem[]) => void;
  onHeaderChange?: (header: PurchaseOrderHeader) => void;
}

const DEFAULT_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];
const UNITS_LIST = ["Pair", "Pcs", "Box", "Set", "Mtr", "Kg", "Dzn"];
const LEAD_TIME_OPTIONS = [3, 7, 10, 15, 30];

export const PURCHASER_FIELD_LABEL = "Purchaser";
export const PO_PRIMARY_SUBMIT_LABEL = "Submit PO";
export const formatLeadTimeLabel = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

const addDaysToDate = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

const calculateExactLeadTime = (orderDate: string, deliveryDate: string) => {
  const order = new Date(`${orderDate}T00:00:00`).getTime();
  const delivery = new Date(`${deliveryDate}T00:00:00`).getTime();
  if (!Number.isFinite(order) || !Number.isFinite(delivery)) return 7;
  return Math.max(0, Math.round((delivery - order) / 86400000));
};

/**
 * Maps parsed and resolved grid rows to canonical PurchaseOrderLineItem objects.
 */
export function mapParsedGridRowsToPOLineItems(
  rows: ParsedGridRow[],
  existingCount = 0,
  defaultTaxPercent = 5
): PurchaseOrderLineItem[] {
  return rows.map((r, idx) => {
    const p = r.resolvedProduct;
    const itemCode =
      p?.sku ||
      (p as any)?.code ||
      p?.productId ||
      r.mappedValues?.itemCode ||
      r.mappedValues?.stockNo ||
      r.mappedValues?.code ||
      r.identifier ||
      `ITEM-${existingCount + idx + 1}`;
    const barcode =
      p?.barcode ||
      r.mappedValues?.barcode ||
      (r.identifierType === "BARCODE" ? r.identifier : "") ||
      "";
    const productName =
      p?.name ||
      r.mappedValues?.product ||
      r.mappedValues?.name ||
      r.mappedValues?.description ||
      (r as any).name ||
      itemCode ||
      "Imported Item";
    const brand = p?.brand || r.mappedValues?.brand || (p as any)?.brand || "SMRITI";
    const style = (p as any)?.styleCode || (p as any)?.style || r.mappedValues?.style || "-";
    const shade = (p as any)?.color || (p as any)?.shade || r.mappedValues?.shade || r.mappedValues?.color || "-";
    const size = (p as any)?.size || r.mappedValues?.size || "-";
    const fibre = ((p as any)?.attributes as any)?.fabric_type || r.mappedValues?.fibre || "Cotton";
    const colourBase = (p as any)?.color || r.mappedValues?.colourBase || r.mappedValues?.color || "-";
    const styling = r.mappedValues?.styling || "Regular";

    const qty = Math.max(1, r.quantity || 1);
    const rate =
      r.rate ||
      r.costPrice ||
      p?.costPrice ||
      (p?.sellingPrice ? p.sellingPrice * 0.7 : 0) ||
      p?.sellingPrice ||
      (p as any)?.price ||
      0;
    const mrp = r.mrp || p?.mrp || (p as any)?.price || (rate > 0 ? rate * 1.3 : 0);
    const unit = p?.uom || (p as any)?.unit || r.uom || r.mappedValues?.unit || "Pair";
    const discountPercent = r.discount || (r as any).discountPercent || 0;
    const taxPercent =
      r.taxRate !== undefined
        ? r.taxRate
        : ((r as any).taxPercent !== undefined
        ? (r as any).taxPercent
        : (p?.taxRate ?? (p as any)?.taxPercent ?? defaultTaxPercent));

    const gross = rate * qty;
    const discountAmount = (gross * discountPercent) / 100;
    const value = Math.max(0, gross - discountAmount);
    const taxAmount = (value * taxPercent) / 100;
    const addOnPercent = 0;
    const addOnAmount = 0;
    const totalValue = value + taxAmount + addOnAmount;

    return {
      id: `line-${existingCount + idx + 1}`,
      sNo: existingCount + idx + 1,
      stockNo: itemCode,
      barcode,
      product: productName,
      brand,
      style,
      shade,
      size,
      fibre,
      colourBase,
      styling,
      mrp,
      rate,
      orderQty: qty,
      freeQty: 0,
      unit,
      discountPercent,
      discountAmount,
      value,
      stockOnHand: (p as any)?.stock ?? 0,
      taxPercent,
      taxAmount,
      addOnPercent,
      addOnAmount,
      totalValue,
      originalProduct: p ? (p as any as Product) : undefined,
    };
  });
}

/**
 * Merges existing PO lines with incoming lines according to GridImportMode:
 * - REPLACE: Discards all existing lines and returns incoming lines (re-indexed 1..N).
 * - APPEND: Keeps existing populated lines and appends incoming lines (re-indexed 1..N).
 * - MERGE: Matches lines on stockNo or barcode. If matched, accumulates orderQty and recalculates values.
 *          If not matched, appends line. Re-indexes 1..N.
 */
export function mergePOLineItems(
  existingLines: PurchaseOrderLineItem[],
  incomingLines: PurchaseOrderLineItem[],
  mode: GridImportMode
): PurchaseOrderLineItem[] {
  if (mode === "REPLACE") {
    return incomingLines.map((line, idx) => ({
      ...line,
      id: `line-${idx + 1}`,
      sNo: idx + 1,
    }));
  }

  // Filter out completely blank lines from existing lines
  const populated = existingLines.filter(
    (l) => Boolean(l.stockNo?.trim()) || l.orderQty > 0
  );

  if (mode === "APPEND") {
    return [...populated, ...incomingLines].map((line, idx) => ({
      ...line,
      id: `line-${idx + 1}`,
      sNo: idx + 1,
    }));
  }

  // MERGE mode
  const merged = populated.map((l) => ({ ...l }));

  incomingLines.forEach((inc) => {
    const incCode = inc.stockNo?.trim().toLowerCase();
    const incBarcode = inc.barcode?.trim().toLowerCase();

    const existingIdx = merged.findIndex((curr) => {
      const currCode = curr.stockNo?.trim().toLowerCase();
      const currBarcode = curr.barcode?.trim().toLowerCase();
      return (
        (incCode && currCode && incCode === currCode) ||
        (incBarcode && currBarcode && incBarcode === currBarcode)
      );
    });

    if (existingIdx >= 0) {
      const curr = merged[existingIdx];
      const newQty = curr.orderQty + inc.orderQty;
      const rate = inc.rate > 0 ? inc.rate : curr.rate;
      const discPercent = curr.discountPercent || 0;
      const gross = rate * newQty;
      const discountAmount = (gross * discPercent) / 100;
      const value = Math.max(0, gross - discountAmount);
      const taxPercent = curr.taxPercent ?? 5;
      const taxAmount = (value * taxPercent) / 100;
      const addOnAmount = (value * (curr.addOnPercent || 0)) / 100;
      const totalValue = value + taxAmount + addOnAmount;

      merged[existingIdx] = {
        ...curr,
        orderQty: newQty,
        rate,
        mrp: inc.mrp && inc.mrp > 0 ? inc.mrp : curr.mrp,
        discountAmount,
        value,
        taxAmount,
        addOnAmount,
        totalValue,
      };
    } else {
      merged.push({ ...inc });
    }
  });

  return merged.map((line, idx) => ({
    ...line,
    id: `line-${idx + 1}`,
    sNo: idx + 1,
  }));
}

export const PoGenerateTab: React.FC<PurchaseOrderGenerationTabProps> = ({
  products: initialProducts = [],
  currentUser,
  onNotification,
  onClose,
  onNavigateTab,
  initialLineItems,
  initialHeader,
  onLineItemsChange,
  onHeaderChange,
}) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const articleCatalogIndex = useMemo(() => buildArticleCatalogIndex(products), [products]);
  const [suppliersList, setSuppliersList] = useState<SupplierOption[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);

  // Top Tabs: "general" | "items" | "other" | "attachments" | "history" — Default to "items" per Decision A
  const [activeTab, setActiveTab] = useState<"general" | "items" | "other" | "attachments" | "history">("items");
  // Grid View Mode: "standard" | "compact" | "detailed" | "size_pivot"
  const [itemView, setItemView] = useState<"standard" | "compact" | "detailed" | "size_pivot">("compact");

  const [showF2Hint, setShowF2Hint] = useState(true);
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [toolbarSearch, setToolbarSearch] = useState("");
  const [copiedBarcodeIdx, setCopiedBarcodeIdx] = useState<number | null>(null);

  // 409 duplicate-number recovery banner
  const [duplicateOrderNo, setDuplicateOrderNo] = useState<string | null>(null);
  const [suggestedOrderNo, setSuggestedOrderNo] = useState<string | null>(null);
  // Post-save workflow prompt
  const [savedOrderNo, setSavedOrderNo] = useState<string | null>(null);
  const [openedOrder, setOpenedOrder] = useState<any | null>(null);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Vendor Policy State ───────────────────────────────────────────────────
  const [lineDecisions, setLineDecisions] = useState<Record<string, POLineDecisionState>>({});
  const [poWorkflowState, setPOWorkflowState] = useState<POWorkflowState>("NO_VENDOR");
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingRowIndex, setPendingRowIndex] = useState<number>(0);
  const [pendingDecision, setPendingDecision] = useState<POProductDecision | null>(null);

  // Dialogs
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showVendorChangeDialog, setShowVendorChangeDialog] = useState(false);
  const [pendingNewVendor, setPendingNewVendor] = useState<{ id: string; name: string } | null>(null);
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  const [submitValidating, setSubmitValidating] = useState(false);
  const [submitValidationResult, setSubmitValidationResult] = useState<POSubmitValidationResult | null>(null);
  const [showCommercialDrawer, setShowCommercialDrawer] = useState<boolean>(false);
  const [supplierCommercialDefaults, setSupplierCommercialDefaults] = useState<Partial<CommercialDeliveryData> | undefined>(undefined);
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [explainDecision, setExplainDecision] = useState<POProductDecision | null>(null);
  const [explainProductName, setExplainProductName] = useState("");
  const [_showPolicyConfig, setShowPolicyConfig] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // SMRITI Global Grid Input Standard State
  const [isGlobalImportOpen, setIsGlobalImportOpen] = useState(false);
  const [initialImportText, setInitialImportText] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelImportInputRef = useRef<HTMLInputElement>(null);
  const toolbarSearchInputRef = useRef<HTMLInputElement>(null);

  // Document & Supplier Header State
  const [header, setHeader] = useState<PurchaseOrderHeader>(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const defaultDelivery = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const base: PurchaseOrderHeader = {
      documentType: "Purchase Order",
      prefix: "PO",
      orderNumber: "PO013",
      orderDate: todayStr,
      supplierId: "",
      supplierName: "",
      billTo: "",
      deliveryDate: defaultDelivery,
      leadTimeDays: 7,
      deliveryLocation: "Main Store (MAIN)",
      commonTaxPercent: 5,
      pictureUrl: "",
      paymentTerms: "120 Days",
      businessTerms: DEFAULT_BUSINESS_TERMS,
      freightCharges: "Paid by Supplier",
      specialInstructions: "",
      supplierReference: "",
      currency: "INR - Indian Rupee",
      buyer: currentUser?.name ? `${currentUser.name} (${currentUser.role || "MANAGER"})` : "manager (MANAGER)",
      department: "General Purchase",
      priceIncludesTax: false,
      freightAmount: 0,
      otherCharges: 0,
      policyName: "General Retail",
      vendorStatus: "Active"
    };
    return initialHeader ? { ...base, ...initialHeader } : base;
  });

  // Standard Line Items (Default 15 rows with clean layout, or populated from initialLineItems)
  const [lineItems, setLineItems] = useState<PurchaseOrderLineItem[]>(() => {
    if (initialLineItems && initialLineItems.length > 0) {
      const activeCount = initialLineItems.length;
      const padding = activeCount < 15
        ? Array.from({ length: 15 - activeCount }, (_, idx) => ({
            id: `line-${activeCount + idx + 1}`,
            sNo: activeCount + idx + 1,
            stockNo: "",
            barcode: "",
            product: "",
            brand: "",
            style: "",
            shade: "",
            size: "",
            fibre: "",
            colourBase: "",
            styling: "",
            mrp: 0,
            rate: 0,
            orderQty: 0,
            freeQty: 0,
            unit: "Pair",
            discountPercent: 0,
            discountAmount: 0,
            value: 0,
            stockOnHand: 0,
            taxPercent: 5,
            taxAmount: 0,
            addOnPercent: 0,
            addOnAmount: 0,
            totalValue: 0
          }))
        : [];
      return [...initialLineItems, ...padding];
    }
    return Array.from({ length: 15 }, (_, idx) => ({
      id: `line-${idx + 1}`,
      sNo: idx + 1,
      stockNo: "",
      barcode: "",
      product: "",
      brand: "",
      style: "",
      shade: "",
      size: "",
      fibre: "",
      colourBase: "",
      styling: "",
      mrp: 0,
      rate: 0,
      orderQty: 0,
      freeQty: 0,
      unit: "Pair",
      discountPercent: 0,
      discountAmount: 0,
      value: 0,
      stockOnHand: 0,
      taxPercent: 5,
      taxAmount: 0,
      addOnPercent: 0,
      addOnAmount: 0,
      totalValue: 0
    }));
  });

  // Sync state back to parent
  const onLineItemsChangeRef = useRef(onLineItemsChange);
  useEffect(() => {
    onLineItemsChangeRef.current = onLineItemsChange;
  }, [onLineItemsChange]);

  useEffect(() => {
    if (onLineItemsChangeRef.current) {
      const activeLines = lineItems.filter(l => Boolean(l.stockNo?.trim()) || Boolean(l.barcode?.trim()) || l.orderQty > 0);
      onLineItemsChangeRef.current(activeLines);
    }
  }, [lineItems]);

  const onHeaderChangeRef = useRef(onHeaderChange);
  useEffect(() => {
    onHeaderChangeRef.current = onHeaderChange;
  }, [onHeaderChange]);

  useEffect(() => {
    onHeaderChangeRef.current?.(header);
  }, [header]);

  // Size Pivot Rows
  const [sizePivotRows, setSizePivotRows] = useState<PurchaseOrderSizePivotRow[]>(() =>
    Array.from({ length: 15 }, (_, idx) => ({
      id: `pivot-${idx + 1}`,
      sNo: idx + 1,
      articleNo: "",
      product: "",
      brand: "",
      style: "",
      color: "",
      sizeQuantities: DEFAULT_SIZES.reduce((acc, sz) => ({ ...acc, [sz]: 0 }), {}),
      rate: 0,
      totalQty: 0,
      gstPercent: 5,
      totalValue: 0
    }))
  );

  // Fetch products and suppliers on mount
  const loadPurchaseHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await apiFetchV1("/purchase/orders/");
      const list = Array.isArray(res) ? res : [];
      setHistoryOrders(list);
    } catch {
      setHistoryOrders([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadPurchaseHistory();
    }
  }, [activeTab, loadPurchaseHistory]);

  const openPersistedPurchaseOrder = useCallback(async (orderRef: string) => {
    const cleaned = String(orderRef || "").trim();
    if (!cleaned) return;
    try {
      const order = await apiFetchV1(buildPurchaseOrderDetailUrl(cleaned));
      setOpenedOrder(order);
      // Restore commercial terms from frozen snapshot or notes
      const commSnap = order.commercial_terms || order.rule_snapshots?.commercial_terms;
      let restoredPayment = commSnap?.payment_terms;
      let restoredFreight = commSnap?.freight_terms;
      let restoredCurrency = commSnap?.currency;
      let restoredBuyer = commSnap?.buyer;
      let restoredDepartment = commSnap?.department;
      let restoredInstructions = commSnap?.special_instructions;
      let restoredRef = commSnap?.supplier_reference;

      if (!commSnap && order.notes) {
        const parts = String(order.notes).split("|");
        for (const part of parts) {
          const idx = part.indexOf(":");
          if (idx > -1) {
            const k = part.substring(0, idx).trim().toLowerCase();
            const v = part.substring(idx + 1).trim();
            if (k.includes("payment")) restoredPayment = v;
            else if (k.includes("freight")) restoredFreight = v;
            else if (k.includes("currency")) restoredCurrency = v;
            else if (k.includes("buyer")) restoredBuyer = v;
            else if (k.includes("dept") || k.includes("department")) restoredDepartment = v;
            else if (k.includes("instruction")) restoredInstructions = v;
            else if (k.includes("ref")) restoredRef = v;
          }
        }
      }

      setHeader(h => ({
        ...h,
        supplierId: order.supplier_id || h.supplierId,
        supplierName: order.supplier_name || order.supplier || h.supplierName,
        paymentTerms: restoredPayment ?? h.paymentTerms,
        freightCharges: restoredFreight ?? h.freightCharges,
        currency: restoredCurrency ?? h.currency,
        buyer: restoredBuyer ?? h.buyer,
        department: restoredDepartment ?? h.department,
        specialInstructions: restoredInstructions ?? h.specialInstructions,
        supplierReference: restoredRef ?? h.supplierReference,
      }));

      setActiveTab("history");
      if (onNotification) onNotification("PO Opened", `Loaded ${order.order_no || cleaned}.`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load purchase order.";
      if (onNotification) onNotification("Open PO Failed", msg, "error");
    }
  }, [onNotification]);

  const loadData = async () => {
    setSuppliersLoading(true);
    setSuppliersError(null);
    try {
      try {
        const prodRes = await apiFetchV1("/inventory/?page=1&page_size=5000&sort=created_at&order=desc");
        const list = Array.isArray(prodRes) ? prodRes : prodRes?.items || [];
        if (list.length > 0) {
          setProducts(list.map((p: any) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            price: parseFloat(p.price || 0),
            costPrice: p.cost_price ? parseFloat(p.cost_price) : 0,
            mrp: p.mrp ? parseFloat(p.mrp) : parseFloat(p.price || 0),
            barcode: p.barcode,
            brand: p.brand,
            styleCode: p.style_code,
            color: p.color,
            size: p.size,
            stock: Number(p.stock || 0),
            category: p.category
          })));
        }
      } catch (err) {
        console.warn("[PoGenerateTab] Failed to load latest inventory:", err);
      }

      const supRes = await apiFetchV1("/purchase/suppliers/");
      const supList = Array.isArray(supRes) ? supRes : supRes?.items || [];
      if (supList.length > 0) {
        const suppliers = supList.map((s: any) => ({
          id: s.id,
          name: s.name,
          code: s.vendor_code || s.code,
          gstin: s.gstin || s.gst_number || s.tax_id || "",
          gst_number: s.gst_number || s.gstin || "",
          address: s.address || "",
          city: s.city || "",
          state: s.state || "",
          phone: s.mobile || s.phone || s.contact_number || "",
          mobile: s.mobile || s.phone || "",
          email: s.email || "",
          payment_terms: s.payment_terms || (s.payment_terms_days ? `${s.payment_terms_days} Days` : "120 Days"),
          payment_terms_days: s.payment_terms_days ?? 120,
          freight_terms: s.freight_terms || "Paid by Supplier",
          currency: s.currency || "INR - Indian Rupee",
          buyer: s.buyer || undefined,
          department: s.department || undefined,
          special_instructions: s.special_instructions || "",
          business_terms: s.business_terms || s.special_instructions || "",
          commercial_terms: s.commercial_terms || undefined,
        }));
        setSuppliersList(suppliers);
        setHeader(current => {
          const selected = suppliers.find((s: any) => s.id === current.supplierId) || suppliers[0];
          return {
            ...current,
            supplierId: selected.id,
            supplierName: selected.name,
            paymentTerms: current.paymentTerms || selected.payment_terms || "120 Days",
            freightCharges: current.freightCharges || selected.freight_terms || "Paid by Supplier",
            currency: current.currency || selected.currency || "INR - Indian Rupee",
            buyer: selected.buyer || current.buyer,
            department: selected.department || current.department,
            specialInstructions: selected.special_instructions !== undefined ? selected.special_instructions : current.specialInstructions,
            businessTerms: selected.business_terms || selected.special_instructions || current.businessTerms || DEFAULT_BUSINESS_TERMS,
          };
        });
      } else {
        // Fallback demo suppliers if db is fresh
        const fallbackSuppliers = [
          { id: "SUP-548042", name: "Apex Fabrics Ltd", code: "SUP-548042", gstin: "27AAAAC0553K1Z8", city: "Mumbai", state: "Maharashtra", phone: "+91 22 1234 5678", payment_terms: "30 Days", freight_terms: "Paid by Supplier", currency: "INR - Indian Rupee" },
          { id: "SUP-102941", name: "Campus Activewear Ltd", code: "SUP-102941", gstin: "07AAACC2914E1Z1", city: "Delhi", state: "Delhi", phone: "+91 11 9876 5432", payment_terms: "15 Days", freight_terms: "To Pay", currency: "INR - Indian Rupee" },
          { id: "SUP-309481", name: "Bata Footwear India Ltd", code: "SUP-309481", gstin: "19AABCB1234P1Z5", city: "Kolkata", state: "West Bengal", phone: "+91 33 4455 6677", payment_terms: "45 Days", freight_terms: "Paid by Supplier", currency: "INR - Indian Rupee" },
        ];
        setSuppliersList(fallbackSuppliers);
        setHeader(current => ({
          ...current,
          supplierId: current.supplierId || fallbackSuppliers[0].id,
          supplierName: current.supplierName || fallbackSuppliers[0].name
        }));
      }

      // Fetch next order number sequence
      try {
        const nextRes: any = await apiFetchV1(`/purchase/orders/next-number?prefix=${encodeURIComponent(header.prefix || "PO")}`);
        if (nextRes && nextRes.next_number) {
          setHeader(h => ({ ...h, orderNumber: String(nextRes.next_number) }));
        }
      } catch {
        // keep current value
      }
    } catch (error) {
      setSuppliersError(error instanceof Error ? error.message : "Supplier service is unavailable.");
    } finally {
      setSuppliersLoading(false);
    }
  };

  // Currently selected supplier details
  const selectedSupplier = useMemo(() => {
    return suppliersList.find(s => s.id === header.supplierId || s.name === header.supplierName);
  }, [suppliersList, header.supplierId, header.supplierName]);

  // Standard line items calculation
  const updateLineItem = (idx: number, updates: Partial<PurchaseOrderLineItem>) => {
    setLineItems(prev => {
      const copy = [...prev];
      const current = { ...copy[idx], ...updates };
      const rate = current.rate || 0;
      const qty = current.orderQty || 0;
      const discPercent = current.discountPercent || 0;
      const gross = rate * qty;
      const discAmount = (gross * discPercent) / 100;
      const value = Math.max(0, gross - discAmount); // taxable value after discount
      const taxPercent = current.taxPercent ?? 5;
      const taxAmount = (value * taxPercent) / 100;
      const addOnPercent = current.addOnPercent || 0;
      const addOnAmount = (value * addOnPercent) / 100;
      const totalValue = value + taxAmount + addOnAmount;

      copy[idx] = {
        ...current,
        discountAmount: discAmount,
        value,
        taxAmount,
        addOnAmount,
        totalValue
      };
      return copy;
    });
  };

  // ── Article-Based Dynamic Auto-Filtering Handlers ────────────────────────
  const handleStockNoOrArticleChange = (idx: number, val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      updateLineItem(idx, { stockNo: "", style: "", barcode: "" });
      return;
    }

    // 1. Check if barcode or SKU exact match
    const variant = resolveByBarcodeOrSkuFromIndex(articleCatalogIndex, trimmed);
    if (variant) {
      updateLineItem(idx, {
        barcode: variant.barcode,
        stockNo: variant.code,
        product: variant.name,
        brand: variant.brand || lineItems[idx]?.brand || "",
        style: variant.article,
        shade: variant.color,
        size: variant.size,
        mrp: variant.mrp,
        rate: variant.costPrice,
        taxPercent: variant.gstPercentage !== undefined ? variant.gstPercentage : (lineItems[idx]?.taxPercent ?? 5),
        unit: variant.unit || lineItems[idx]?.unit || "Pair",
        originalProduct: variant.originalProduct,
      });
      return;
    }

    // 2. Check if Article/Style match
    const summary = getArticleSummaryFromIndex(articleCatalogIndex, trimmed);
    if (summary) {
      const availableColors = getAvailableColorsForArticle(articleCatalogIndex, summary.article);
      const currColor = (lineItems[idx]?.shade || "").toUpperCase();
      const keepColor = availableColors.map(c => c.toUpperCase()).includes(currColor);
      const newShade = keepColor ? currColor : (availableColors.length === 1 ? availableColors[0] : "");

      const availableSizes = newShade
        ? getAvailableSizesForArticleAndColor(articleCatalogIndex, summary.article, newShade)
        : [];
      const currSize = (lineItems[idx]?.size || "").toUpperCase();
      const keepSize = availableSizes.map(s => s.toUpperCase()).includes(currSize);
      const newSize = keepSize ? currSize : (availableSizes.length === 1 ? availableSizes[0] : "");

      const matchedVariant = (newShade && newSize)
        ? resolveVariantFromIndex(articleCatalogIndex, summary.article, newShade, newSize)
        : undefined;

      updateLineItem(idx, {
        stockNo: trimmed,
        style: summary.article,
        brand: summary.brand || lineItems[idx]?.brand || "",
        product: summary.name || lineItems[idx]?.product || "",
        rate: matchedVariant?.costPrice || summary.costPrice || lineItems[idx]?.rate || 0,
        mrp: matchedVariant?.mrp || summary.mrp || lineItems[idx]?.mrp || 0,
        taxPercent: matchedVariant?.gstPercentage !== undefined
          ? matchedVariant.gstPercentage
          : (summary.gstPercentage !== undefined ? summary.gstPercentage : (lineItems[idx]?.taxPercent ?? 5)),
        unit: matchedVariant?.unit || summary.unit || lineItems[idx]?.unit || "Pair",
        shade: newShade,
        size: newSize,
        barcode: matchedVariant?.barcode || (newShade && newSize ? "" : lineItems[idx]?.barcode || ""),
        originalProduct: matchedVariant?.originalProduct || lineItems[idx]?.originalProduct,
      });
      return;
    }

    // 3. Fallback free-text update
    updateLineItem(idx, { stockNo: val, style: val });
  };

  const handleStyleChange = (idx: number, val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      updateLineItem(idx, { style: "" });
      return;
    }

    const summary = getArticleSummaryFromIndex(articleCatalogIndex, trimmed);
    if (summary) {
      const availableColors = getAvailableColorsForArticle(articleCatalogIndex, summary.article);
      const currColor = (lineItems[idx]?.shade || "").toUpperCase();
      const keepColor = availableColors.map(c => c.toUpperCase()).includes(currColor);
      const newShade = keepColor ? currColor : (availableColors.length === 1 ? availableColors[0] : "");

      const availableSizes = newShade
        ? getAvailableSizesForArticleAndColor(articleCatalogIndex, summary.article, newShade)
        : [];
      const currSize = (lineItems[idx]?.size || "").toUpperCase();
      const keepSize = availableSizes.map(s => s.toUpperCase()).includes(currSize);
      const newSize = keepSize ? currSize : (availableSizes.length === 1 ? availableSizes[0] : "");

      const matchedVariant = (newShade && newSize)
        ? resolveVariantFromIndex(articleCatalogIndex, summary.article, newShade, newSize)
        : undefined;

      updateLineItem(idx, {
        style: summary.article,
        stockNo: lineItems[idx]?.stockNo || summary.article,
        brand: summary.brand || lineItems[idx]?.brand || "",
        product: summary.name || lineItems[idx]?.product || "",
        rate: matchedVariant?.costPrice || summary.costPrice || lineItems[idx]?.rate || 0,
        mrp: matchedVariant?.mrp || summary.mrp || lineItems[idx]?.mrp || 0,
        taxPercent: matchedVariant?.gstPercentage !== undefined
          ? matchedVariant.gstPercentage
          : (summary.gstPercentage !== undefined ? summary.gstPercentage : (lineItems[idx]?.taxPercent ?? 5)),
        unit: matchedVariant?.unit || summary.unit || lineItems[idx]?.unit || "Pair",
        shade: newShade,
        size: newSize,
        barcode: matchedVariant?.barcode || (newShade && newSize ? "" : lineItems[idx]?.barcode || ""),
        originalProduct: matchedVariant?.originalProduct || lineItems[idx]?.originalProduct,
      });
      return;
    }

    updateLineItem(idx, { style: val });
  };

  const handleColorChange = (idx: number, val: string) => {
    const colorVal = val.trim().toUpperCase();
    const art = lineItems[idx]?.style || lineItems[idx]?.stockNo || "";
    const availableSizes = art && colorVal
      ? getAvailableSizesForArticleAndColor(articleCatalogIndex, art, colorVal)
      : [];
    const currSize = (lineItems[idx]?.size || "").toUpperCase();
    const keepSize = availableSizes.map(s => s.toUpperCase()).includes(currSize);
    const newSize = keepSize ? currSize : (availableSizes.length === 1 ? availableSizes[0] : "");

    const matchedVariant = (art && colorVal && newSize)
      ? resolveVariantFromIndex(articleCatalogIndex, art, colorVal, newSize)
      : undefined;

    updateLineItem(idx, {
      shade: colorVal,
      size: newSize,
      ...(matchedVariant ? {
        barcode: matchedVariant.barcode,
        stockNo: matchedVariant.code || lineItems[idx]?.stockNo,
        rate: matchedVariant.costPrice || lineItems[idx]?.rate,
        mrp: matchedVariant.mrp || lineItems[idx]?.mrp,
        taxPercent: matchedVariant.gstPercentage !== undefined ? matchedVariant.gstPercentage : lineItems[idx]?.taxPercent,
        unit: matchedVariant.unit || lineItems[idx]?.unit,
        originalProduct: matchedVariant.originalProduct,
      } : {
        barcode: newSize ? lineItems[idx]?.barcode : "",
      }),
    });
  };

  const handleSizeChange = (idx: number, val: string) => {
    const sizeVal = val.trim().toUpperCase();
    const art = lineItems[idx]?.style || lineItems[idx]?.stockNo || "";
    const color = lineItems[idx]?.shade || "";

    const matchedVariant = (art && color && sizeVal)
      ? resolveVariantFromIndex(articleCatalogIndex, art, color, sizeVal)
      : undefined;

    updateLineItem(idx, {
      size: sizeVal,
      ...(matchedVariant ? {
        barcode: matchedVariant.barcode,
        stockNo: matchedVariant.code || lineItems[idx]?.stockNo,
        rate: matchedVariant.costPrice || lineItems[idx]?.rate,
        mrp: matchedVariant.mrp || lineItems[idx]?.mrp,
        taxPercent: matchedVariant.gstPercentage !== undefined ? matchedVariant.gstPercentage : lineItems[idx]?.taxPercent,
        unit: matchedVariant.unit || lineItems[idx]?.unit,
        originalProduct: matchedVariant.originalProduct,
      } : {}),
    });
  };

  const handleBarcodeChange = (idx: number, val: string) => {
    const trimmed = val.trim();
    const variant = resolveByBarcodeOrSkuFromIndex(articleCatalogIndex, trimmed);
    if (variant) {
      updateLineItem(idx, {
        barcode: variant.barcode,
        stockNo: variant.code,
        product: variant.name,
        brand: variant.brand || lineItems[idx]?.brand || "",
        style: variant.article,
        shade: variant.color,
        size: variant.size,
        mrp: variant.mrp,
        rate: variant.costPrice,
        taxPercent: variant.gstPercentage !== undefined ? variant.gstPercentage : (lineItems[idx]?.taxPercent ?? 5),
        unit: variant.unit || lineItems[idx]?.unit || "Pair",
        originalProduct: variant.originalProduct,
      });
    } else {
      updateLineItem(idx, { barcode: val });
    }
  };

  // Size Pivot row calculation
  const updatePivotSizeQty = (rowIdx: number, size: string, qty: number) => {
    setSizePivotRows(prev => {
      const copy = [...prev];
      const current = copy[rowIdx];
      const updatedQuantities = { ...current.sizeQuantities, [size]: Math.max(0, qty || 0) };
      const totalQty = Object.values(updatedQuantities).reduce((a, b) => a + b, 0);
      const totalValue = totalQty * (current.rate || 0);

      copy[rowIdx] = {
        ...current,
        sizeQuantities: updatedQuantities,
        totalQty,
        totalValue
      };
      return copy;
    });
  };

  const updatePivotRow = (rowIdx: number, updates: Partial<PurchaseOrderSizePivotRow>) => {
    setSizePivotRows(prev => {
      const copy = [...prev];
      const current = { ...copy[rowIdx], ...updates };
      const totalQty = Object.values(current.sizeQuantities || {}).reduce((a, b) => a + b, 0);
      const totalValue = totalQty * (current.rate || 0);
      copy[rowIdx] = { ...current, totalQty, totalValue };
      return copy;
    });
  };

  // Helper: evaluate product for vendor policy
  const evaluateProductForVendor = useCallback(async (
    product: Product,
    rowIndex: number,
    entryPath: POLineDecisionState["entryPath"],
  ): Promise<POProductDecision | null> => {
    if (!header.supplierId) return null;
    try {
      setPOWorkflowState("PRODUCT_EVALUATING");
      const res = await apiFetchV1("/purchase/evaluate-product", {
        method: "POST",
        body: JSON.stringify({
          vendor_id: header.supplierId,
          product_ref: product.barcode || product.code || product.id,
          transaction_date: header.orderDate,
        }),
      }) as POProductDecision;

      const lineId = lineItems[rowIndex]?.id || `line-${rowIndex + 1}`;
      const lineDec: POLineDecisionState = {
        lineId,
        productRef: product.barcode || product.code || product.id || "",
        status: res.status,
        action: res.action,
        approvalRequired: res.approval_required,
        explanation: res.explanation,
        decisionLogId: res.decision_log_id,
        decisionVersion: res.policy_version || "",
        evaluatedAt: res.evaluated_at || new Date().toISOString(),
        entryPath,
        isStale: false,
      };
      setLineDecisions(prev => ({ ...prev, [lineId]: lineDec }));
      setPOWorkflowState("PRODUCT_DECIDED");
      return res;
    } catch {
      setPOWorkflowState("VENDOR_SELECTED");
      return null;
    }
  }, [header.supplierId, header.orderDate, lineItems]);

  // Product addition logic
  const _addProductToLine = (
    product: Product,
    rowIndex: number,
    isReadOnly = false,
    approvalReasonCode?: string,
    approvalReasonNote?: string,
  ) => {
    const rate = product.costPrice || (product.price ? product.price * 0.7 : 0) || product.price || 0;
    const mrp = product.mrp || product.price || 0;

    if (itemView !== "size_pivot") {
      updateLineItem(rowIndex, {
        stockNo: product.code || product.barcode || "",
        barcode: product.barcode || "",
        product: product.name || "",
        brand: product.brand || "SMRITI",
        style: product.styleCode || "-",
        shade: product.color || "-",
        size: product.size || "-",
        fibre: (product.attributes as any)?.fabric_type || "Cotton",
        colourBase: product.color || "-",
        styling: "Regular",
        mrp: mrp,
        rate: rate,
        orderQty: 1,
        freeQty: 0,
        unit: (product as any).unit || "Pair",
        discountPercent: 0,
        discountAmount: 0,
        stockOnHand: product.stock ?? 0,
        originalProduct: product,
        isReadOnly,
        approvalReasonCode,
        approvalReasonNote,
      });
    } else {
      updatePivotRow(rowIndex, {
        articleNo: product.code || product.barcode,
        product: product.name,
        brand: product.brand || "SMRITI",
        style: product.styleCode || "-",
        color: product.color || "-",
        gstPercent: (product as any).taxPercent ?? 5,
        rate: rate,
        originalProduct: product,
        isReadOnly,
      });
    }
    setPOWorkflowState("LINE_ADDED");
  };

  const evaluateAndAddProduct = async (product: Product, rowIndex: number, entryPath: POLineDecisionState["entryPath"]) => {
    // Duplicate product detection
    const productRef = product.barcode || product.code || product.id || "";
    if (header.supplierId && productRef) {
      const existingRefs = lineItems
        .filter((l, i) => i !== rowIndex && l.stockNo?.trim())
        .map(l => l.stockNo);
      if (existingRefs.includes(productRef)) {
        if (!window.confirm(
          `"${product.name}" is already in the PO (line ${existingRefs.indexOf(productRef) + 1}).\n\nAdd it again?`
        )) return;
      }
    }

    const decision = await evaluateProductForVendor(product, rowIndex, entryPath);
    if (decision?.action === "BLOCK") {
      setExplainDecision(decision);
      setExplainProductName(product.name);
      setShowExplainModal(true);
      setPOWorkflowState("VENDOR_SELECTED");
      return;
    }

    if (decision?.action === "APPROVAL_REQUIRED") {
      setPendingProduct(product);
      setPendingRowIndex(rowIndex);
      setPendingDecision(decision);
      setShowApprovalDialog(true);
      return;
    }

    const isRO = decision?.action === "READ_ONLY";
    _addProductToLine(product, rowIndex, isRO);
  };

  const handleSelectProduct = async (product: Product) => {
    await evaluateAndAddProduct(product, activeRowIndex, "BROWSE");
  };

  const handleApprovalConfirmed = (reasonCode: string, _reasonLabel: string, note: string) => {
    setShowApprovalDialog(false);
    if (!pendingProduct) return;
    const lineId = lineItems[pendingRowIndex]?.id || `line-${pendingRowIndex + 1}`;
    setLineDecisions(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], approvalReasonCode: reasonCode, approvalReasonNote: note },
    }));
    _addProductToLine(pendingProduct, pendingRowIndex, false, reasonCode, note);
    setPendingProduct(null);
    setPendingDecision(null);
  };

  // Barcode / Search submit handler
  const handleBarcodeOrSearchSubmit = async (query: string) => {
    if (!query.trim()) return;
    const trimmed = query.trim().toLowerCase();
    const found = products.find(p =>
      (p.barcode && p.barcode.toLowerCase() === trimmed) ||
      (p.code && p.code.toLowerCase() === trimmed) ||
      (p.name && p.name.toLowerCase().includes(trimmed))
    );

    if (found) {
      let targetIndex = lineItems.findIndex(l => !l.stockNo && l.orderQty === 0);
      if (targetIndex === -1) {
        targetIndex = lineItems.length;
        handleAddNewBlankRow();
      }
      setActiveRowIndex(targetIndex);
      await evaluateAndAddProduct(found, targetIndex, "BARCODE");
      setToolbarSearch("");
      setTimeout(() => {
        const qtyInput = document.getElementById(`po-qty-input-${targetIndex}`);
        qtyInput?.focus();
      }, 50);
    } else {
      if (onNotification) onNotification("Product Not Found", `No item matching "${query}". Press F2 to browse catalog.`, "warning");
    }
  };

  // Add new blank row
  const handleAddNewBlankRow = () => {
    const newIdx = lineItems.length;
    setLineItems(prev => [
      ...prev,
      {
        id: `line-${prev.length + 1}`,
        sNo: prev.length + 1,
        stockNo: "",
        barcode: "",
        product: "",
        brand: "",
        style: "",
        shade: "",
        size: "",
        fibre: "",
        colourBase: "",
        styling: "",
        mrp: 0,
        rate: 0,
        orderQty: 0,
        freeQty: 0,
        unit: "Pair",
        discountPercent: 0,
        discountAmount: 0,
        value: 0,
        stockOnHand: 0,
        taxPercent: header.commonTaxPercent || 5,
        taxAmount: 0,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 0
      }
    ]);
    setActiveRowIndex(newIdx);
    setTimeout(() => {
      const codeInput = document.getElementById(`pogen-gen-stockno-${newIdx + 1}`);
      codeInput?.focus();
    }, 50);
  };

  // Delete line item
  const handleDeleteRow = (idx: number) => {
    setLineItems(prev => {
      const filtered = prev.filter((_, i) => i !== idx);
      return filtered.map((item, i) => ({ ...item, sNo: i + 1 }));
    });
  };

  // ── SMRITI Global Grid Input & Resolution Standard Handlers ──────────────
  const handleGlobalGridImportCommit = (
    committedRows: ParsedGridRow[],
    mode: GridImportMode
  ) => {
    const existingCount =
      mode === "REPLACE"
        ? 0
        : lineItems.filter((l) => Boolean(l.stockNo?.trim()) || l.orderQty > 0).length;

    const incomingLines = mapParsedGridRowsToPOLineItems(
      committedRows,
      existingCount,
      header.commonTaxPercent
    );

    const merged = mergePOLineItems(lineItems, incomingLines, mode);
    setLineItems(merged);
    setIsGlobalImportOpen(false);
    setInitialImportText(undefined);
    setPOWorkflowState("LINE_ADDED");
    if (onNotification) {
      onNotification(
        "Import Complete",
        `Successfully imported ${committedRows.length} item(s) into Purchase Order (${mode} mode).`,
        "success"
      );
    }
  };

  // Legacy file picker adapter: route file text directly to GlobalGridImportModal
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setInitialImportText(text);
        setIsGlobalImportOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Intercept table clipboard paste (Ctrl+V) for multi-line or delimited text
  const handleTableContainerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === "input" || targetTag === "textarea") {
      return;
    }
    const pastedText = e.clipboardData?.getData("text/plain");
    if (!pastedText) return;

    const isMultiLine = pastedText.includes("\n") || pastedText.includes("\r");
    const isDelimited =
      pastedText.includes("\t") ||
      pastedText.includes(",") ||
      pastedText.includes("~") ||
      pastedText.includes("|");

    if (isMultiLine || isDelimited) {
      e.preventDefault();
      setInitialImportText(pastedText);
      setIsGlobalImportOpen(true);
    }
  };

  // Summary Totals Calculation with Full Retail Breakdown
  const totals: PurchaseOrderSummaryTotals = useMemo(() => {
    if (itemView !== "size_pivot") {
      const validLines = lineItems.filter(l => l.stockNo && l.orderQty > 0);
      const totalItems = validLines.length;
      const totalQty = validLines.reduce((sum, l) => sum + (l.orderQty || 0), 0);
      const freeQty = validLines.reduce((sum, l) => sum + (l.freeQty || 0), 0);
      const grossValue = validLines.reduce((sum, l) => sum + ((l.rate || 0) * (l.orderQty || 0)), 0);
      const itemDiscount = validLines.reduce((sum, l) => sum + (l.discountAmount || 0), 0);
      const taxableAmount = Math.max(0, grossValue - itemDiscount);
      const totalTax = validLines.reduce((sum, l) => sum + (l.taxAmount || 0), 0);
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;
      const igst = 0;
      const freightCharges = header.freightAmount || 0;
      const otherCharges = header.otherCharges || 0;
      const totalAddOn = validLines.reduce((sum, l) => sum + (l.addOnAmount || 0), 0);
      const rawNet = taxableAmount + totalTax + freightCharges + otherCharges + totalAddOn;
      const roundedNet = Math.round(rawNet);
      const roundOff = +(roundedNet - rawNet).toFixed(2);
      const totalValue = roundedNet;

      return {
        totalItems,
        totalQty,
        freeQty,
        grossValue,
        itemDiscount,
        taxableAmount,
        totalTax,
        cgst,
        sgst,
        igst,
        freightCharges,
        otherCharges,
        totalAddOn,
        roundOff,
        totalValue,
        netOrderValue: totalValue
      };
    } else {
      const validRows = sizePivotRows.filter(r => r.articleNo && r.totalQty > 0);
      const totalItems = validRows.length;
      const totalQty = validRows.reduce((sum, r) => sum + r.totalQty, 0);
      const grossValue = validRows.reduce((sum, r) => sum + r.totalValue, 0);
      const gstVal = validRows.reduce((sum, r) => sum + (r.totalValue * (r.gstPercent || 0) / 100), 0);
      const freightCharges = header.freightAmount || 0;
      const otherCharges = header.otherCharges || 0;
      const rawNet = grossValue + gstVal + freightCharges + otherCharges;
      const roundedNet = Math.round(rawNet);
      const roundOff = +(roundedNet - rawNet).toFixed(2);
      return {
        totalItems,
        totalQty,
        freeQty: 0,
        grossValue,
        itemDiscount: 0,
        taxableAmount: grossValue,
        totalTax: gstVal,
        cgst: gstVal / 2,
        sgst: gstVal / 2,
        igst: 0,
        freightCharges,
        otherCharges,
        totalAddOn: 0,
        roundOff,
        totalValue: roundedNet,
        netOrderValue: roundedNet
      };
    }
  }, [lineItems, sizePivotRows, itemView, header.freightAmount, header.otherCharges]);

  // F2 Universal Lookup Architecture v2 Screen Registration
  useF2Screen({
    screenId: "PoGenerateTab",
    defaultEntity: "variant",
    adapter: (result: LookupResult) => {
      if (result.entity !== "variant" && result.entity !== "item" && result.entity !== "item_barcode") {
        return;
      }
      const stockVal  = (result.record?.stock_no as string)
                     || (result.record?.style_code as string)
                     || result.returnValue || "";
      const nameVal   = result.displayValue || (result.record?.name as string) || "";
      const brandVal  = (result.record?.brand as string) || "SMRITI";
      const styleVal  = (result.record?.style_code as string) || "-";
      const colorVal  = (result.record?.color as string) || "-";
      const sizeVal   = (result.record?.size as string) || "-";
      const mrpVal    = (result.record?.mrp as number) || (result.record?.selling_price as number) || 0;
      const rateVal   = (result.record?.cost_price as number)
                     || (result.record?.selling_price ? (result.record.selling_price as number) * 0.7 : 0)
                     || (mrpVal ? mrpVal * 0.7 : 0) || 0;
      const stockQty  = (result.record?.stock_qty as number) ?? 0;

      setShowF2Hint(false);
      if (itemView !== "size_pivot") {
        updateLineItem(activeRowIndex, {
          stockNo: stockVal,
          barcode: (result.record?.barcode as string) || stockVal,
          product: nameVal,
          brand:   brandVal,
          style:   styleVal,
          shade:   colorVal,
          size:    sizeVal,
          mrp:     mrpVal,
          rate:    rateVal,
          orderQty: 1,
          freeQty: 0,
          unit: "Pair",
          stockOnHand: stockQty,
        });
      } else {
        updatePivotRow(activeRowIndex, {
          articleNo: stockVal,
          product:   nameVal,
          brand:     brandVal,
          style:     styleVal,
          color:     colorVal,
          rate:      rateVal,
        });
      }
    }
  });

  // Keyboard Shortcuts (Ctrl+S, F9, F4, F6, F2)
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSubmitGate();
        return;
      }
      if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        setShowCommercialDrawer(prev => !prev);
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        setShowPrintPreview(true);
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        if (itemView !== "size_pivot") {
          updateLineItem(activeRowIndex, { stockNo: "", barcode: "", product: "", orderQty: 0, freeQty: 0, mrp: 0, rate: 0, value: 0 });
        } else {
          updatePivotRow(activeRowIndex, { articleNo: "", product: "", rate: 0, sizeQuantities: DEFAULT_SIZES.reduce((a, s) => ({ ...a, [s]: 0 }), {}) });
        }
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        if (activeRowIndex > 0) {
          if (itemView !== "size_pivot") {
            const prevRow = lineItems[activeRowIndex - 1];
            updateLineItem(activeRowIndex, {
              ...prevRow,
              id: lineItems[activeRowIndex].id,
              sNo: activeRowIndex + 1,
              isReadOnly: false,
              approvalReasonCode: undefined,
              approvalReasonNote: undefined,
            });
            const copiedLineId = lineItems[activeRowIndex - 1].id;
            const prevDec = lineDecisions[copiedLineId];
            if (prevDec) {
              const newLineId = lineItems[activeRowIndex].id;
              setLineDecisions(prev => ({
                ...prev,
                [newLineId]: { ...prevDec, lineId: newLineId, isStale: true, entryPath: "COPY" },
              }));
            }
          } else {
            const prevRow = sizePivotRows[activeRowIndex - 1];
            updatePivotRow(activeRowIndex, { ...prevRow, id: sizePivotRows[activeRowIndex].id, sNo: activeRowIndex + 1, isReadOnly: false });
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [activeRowIndex, itemView, lineItems, sizePivotRows, header, saving]);

  // Submit gate validation
  const handleSubmitGate = async () => {
    setSubmitValidating(true);
    setShowValidationSummary(true);
    setSubmitValidationResult(null);

    // ── Gap 4 fix: include size_pivot rows in validation (never skip policy gate) ──
    const activeLines = itemView !== "size_pivot"
      ? lineItems.filter(l => l.stockNo && l.orderQty > 0)
      : sizePivotRows
          .filter(r => r.articleNo && r.totalQty > 0)
          .map(r => ({
            stockNo: r.articleNo,
            orderQty: r.totalQty,
            rate: r.rate,
            vendorDecision: r.vendorDecision,
          } as Pick<PurchaseOrderLineItem, "stockNo" | "orderQty" | "rate" | "vendorDecision">));

    if (!header.supplierId || activeLines.length === 0) {
      handleSavePO();
      setShowValidationSummary(false);
      setSubmitValidating(false);
      return;
    }

    try {
      const result = await apiFetchV1("/purchase/validate-po-submit", {
        method: "POST",
        body: JSON.stringify({
          vendor_id: header.supplierId,
          transaction_date: header.orderDate || undefined,
          // ── Gap 1 fix: include purchase_order_id for audit trail when PO already exists ──
          purchase_order_id: openedOrder?.id ?? undefined,
          lines: activeLines.map((l, i) => ({
            product_ref: l.stockNo,
            quantity: l.orderQty,
            rate: l.rate,
            line_index: i,
            decision_log_id: l.vendorDecision?.decision_log_id,
          })),
        }),
      }) as POSubmitValidationResult;

      setSubmitValidationResult(result);
      if (result.stale_lines?.length > 0) {
        result.line_results.filter(r => r.stale).forEach(r => {
          const line = activeLines[r.line_index];
          if (!line) return;
          const lineId = lineItems.find(l => l.stockNo === line.stockNo)?.id;
          if (lineId) {
            setLineDecisions(prev => ({
              ...prev,
              [lineId]: { ...prev[lineId], isStale: true },
            }));
          }
        });
      }
    } catch {
      setSubmitValidationResult(null);
    } finally {
      setSubmitValidating(false);
    }
  };

  // Vendor change guard
  const handleVendorChangeRequest = (newId: string, newName: string, sel?: SupplierOption) => {
    const matchedSupplier = sel || suppliersList.find(s => s.id === newId);
    const defaults: Partial<CommercialDeliveryData> = {
      paymentTerms: matchedSupplier?.payment_terms || (matchedSupplier?.payment_terms_days ? `${matchedSupplier.payment_terms_days} Days` : undefined),
      freightCharges: matchedSupplier?.freight_terms,
      currency: matchedSupplier?.currency,
      buyer: matchedSupplier?.buyer,
      department: matchedSupplier?.department,
      specialInstructions: matchedSupplier?.special_instructions !== undefined ? matchedSupplier.special_instructions : undefined,
      businessTerms: (matchedSupplier as any)?.business_terms || matchedSupplier?.special_instructions || undefined,
    };
    setSupplierCommercialDefaults(defaults);
    const applyCommercialTerms = (prevHeader: PurchaseOrderHeader, s?: SupplierOption) => {
      if (!s) return prevHeader;
      return {
        ...prevHeader,
        paymentTerms: s.payment_terms || (s.payment_terms_days ? `${s.payment_terms_days} Days` : prevHeader.paymentTerms),
        freightCharges: s.freight_terms || prevHeader.freightCharges,
        currency: s.currency || prevHeader.currency,
        buyer: s.buyer || prevHeader.buyer,
        department: s.department || prevHeader.department,
        specialInstructions: s.special_instructions !== undefined ? s.special_instructions : prevHeader.specialInstructions,
        businessTerms: (s as any)?.business_terms || s?.special_instructions || prevHeader.businessTerms,
      };
    };

    const hasLines = lineItems.some(l => l.stockNo?.trim());
    if (!hasLines) {
      setHeader(h => applyCommercialTerms({ ...h, supplierId: newId, supplierName: newName }, matchedSupplier));
      setLineDecisions({});
      setPOWorkflowState("VENDOR_SELECTED");
      return;
    }
    setPendingNewVendor({ id: newId, name: newName });
    setShowVendorChangeDialog(true);
  };

  const handleVendorChangeConfirmed = (result: POVendorChangeResult) => {
    setShowVendorChangeDialog(false);
    if (!pendingNewVendor) return;
    const sel = suppliersList.find(s => s.id === pendingNewVendor.id);
    setHeader(h => ({
      ...h,
      supplierId: pendingNewVendor.id,
      supplierName: pendingNewVendor.name,
      paymentTerms: sel?.payment_terms || (sel?.payment_terms_days ? `${sel.payment_terms_days} Days` : h.paymentTerms),
      freightCharges: sel?.freight_terms || h.freightCharges,
      currency: sel?.currency || h.currency,
      buyer: sel?.buyer || h.buyer,
      department: sel?.department || h.department,
      specialInstructions: sel?.special_instructions !== undefined ? sel.special_instructions : h.specialInstructions,
      businessTerms: (sel as any)?.business_terms || sel?.special_instructions || h.businessTerms,
    }));
    const newDecisions: Record<string, POLineDecisionState> = {};
    result.decisions.forEach(d => {
      const line = lineItems[d.line_index];
      if (!line) return;
      newDecisions[line.id] = {
        lineId: line.id,
        productRef: d.product_ref,
        status: d.status,
        action: d.action,
        approvalRequired: d.approval_required,
        explanation: d.explanation,
        decisionVersion: "",
        evaluatedAt: result.evaluated_at as unknown as string,
        entryPath: "EDIT",
        isStale: false,
      };
      updateLineItem(d.line_index, { isReadOnly: d.action === "READ_ONLY" });
    });
    setLineDecisions(newDecisions);
    setPendingNewVendor(null);
    setPOWorkflowState("VENDOR_SELECTED");
  };

  const issuesSummary = useMemo(() => computePOIssues(lineDecisions), [lineDecisions]);

  // Save / Commit PO to backend
  const handleSavePO = async () => {
    setDuplicateOrderNo(null);
    setSuggestedOrderNo(null);

    const activeLines = itemView !== "size_pivot"
      ? lineItems.filter(l => l.stockNo && l.orderQty > 0)
      : sizePivotRows.filter(r => r.articleNo && r.totalQty > 0);

    if (!header.supplierId || suppliersLoading || suppliersError) {
      if (onNotification) onNotification("Supplier Required", "Load and select a supplier from the backend before saving the purchase order.", "error");
      return;
    }

    if (activeLines.length === 0) {
      if (onNotification) onNotification("Validation Error", "Please enter at least one line item with quantity.", "error");
      return;
    }

    setSaving(true);
    try {
      const orderNo = `${header.prefix.trim()}-${header.orderNumber.trim()}`;
      const notesArr: string[] = [];
      if (header.specialInstructions) notesArr.push(`Instructions: ${header.specialInstructions}`);
      if (header.paymentTerms) notesArr.push(`Payment: ${header.paymentTerms}`);
      if (header.freightCharges) notesArr.push(`Freight: ${header.freightCharges}`);
      if (header.currency) notesArr.push(`Currency: ${header.currency}`);
      if (header.buyer) notesArr.push(`Buyer: ${header.buyer}`);
      if (header.department) notesArr.push(`Department: ${header.department}`);
      if (header.supplierReference) notesArr.push(`Ref: ${header.supplierReference}`);

      const commercialTerms = {
        payment_terms: header.paymentTerms,
        freight_terms: header.freightCharges,
        currency: header.currency,
        buyer: header.buyer,
        department: header.department,
        special_instructions: header.specialInstructions,
        supplier_reference: header.supplierReference,
        business_terms: header.businessTerms,
      };

      const payload = {
        order_no: orderNo,
        order_date: header.orderDate || new Date().toISOString().split("T")[0],
        supplier_id: header.supplierId,
        supplier_name: header.supplierName,
        delivery_date: header.deliveryDate || new Date(Date.now() + header.leadTimeDays * 86400000).toISOString().split("T")[0],
        commercial_terms: commercialTerms,
        rule_snapshots: {
          commercial_terms: commercialTerms,
        },
        notes: notesArr.length > 0 ? notesArr.join(" | ") : undefined,
        total_amount: totals.totalValue,
        status: "Draft",
        created_by: currentUser?.name || undefined,
        items: itemView !== "size_pivot"
          ? lineItems.filter(l => (Boolean(l.stockNo?.trim()) || Boolean(l.barcode?.trim())) && l.orderQty > 0).map(l => ({
              product_id: l.originalProduct?.id || l.stockNo || l.barcode,
              variant_id: (l.originalProduct as any)?.item_variant_id || (l.originalProduct as any)?.variant_id || undefined,
              item_id: (l.originalProduct as any)?.item_id || undefined,
              barcode: l.barcode || undefined,
              code: l.stockNo || l.barcode,
              name: l.product || l.stockNo || l.barcode,
              quantity: l.orderQty,
              cost_price: l.rate,
              gst_rate: l.taxPercent || 5.0
            }))
          : sizePivotRows.filter(r => r.articleNo && r.totalQty > 0).map(r => ({
              product_id: r.originalProduct?.id || r.articleNo,
              variant_id: (r.originalProduct as any)?.item_variant_id || (r.originalProduct as any)?.variant_id || undefined,
              item_id: (r.originalProduct as any)?.item_id || undefined,
              code: r.articleNo,
              name: r.product || r.articleNo,
              quantity: r.totalQty,
              cost_price: r.rate,
              gst_rate: r.gstPercent || 5.0
            }))
      };

      await apiFetchV1("/purchase/orders/", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setSavedOrderNo(orderNo);

      // Advance sequence
      const nextRes: any = await apiFetchV1(
        `/purchase/orders/next-number?prefix=${encodeURIComponent(header.prefix.trim())}`
      ).catch(() => null);
      if (nextRes && nextRes.next_number) {
        setHeader(h => ({ ...h, orderNumber: String(nextRes.next_number) }));
      } else {
        const cur = parseInt(header.orderNumber.replace(/\D/g, ""), 10);
        if (!isNaN(cur)) setHeader(h => ({ ...h, orderNumber: `PO${String(cur + 1).padStart(3, "0")}` }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to commit Purchase Order to backend.";
      if (msg.includes("already exists") || (err as any)?.status === 409) {
        const orderNo = `${header.prefix.trim()}-${header.orderNumber.trim()}`;
        setDuplicateOrderNo(orderNo);
        apiFetchV1(`/purchase/orders/next-number?prefix=${encodeURIComponent(header.prefix.trim())}`).
          then((r: any) => { if (r?.next_order_no) setSuggestedOrderNo(r.next_order_no); }).
          catch(() => {});
      } else {
        if (onNotification) onNotification("PO Save Error", msg, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setLineItems(prev => prev.map((l) => ({
      ...l,
      stockNo: "",
      barcode: "",
      product: "",
      brand: "",
      style: "",
      shade: "",
      size: "",
      mrp: 0,
      rate: 0,
      orderQty: 0,
      freeQty: 0,
      discountPercent: 0,
      discountAmount: 0,
      value: 0,
      totalValue: 0
    })));
    setSizePivotRows(prev => prev.map((r) => ({
      ...r,
      articleNo: "",
      product: "",
      brand: "",
      style: "",
      color: "",
      sizeQuantities: DEFAULT_SIZES.reduce((a, s) => ({ ...a, [s]: 0 }), {}),
      rate: 0,
      totalQty: 0,
      totalValue: 0
    })));
    if (onNotification) onNotification("Cleared", "All line items reset.", "info");
  };

  const activeLineCount = lineItems.filter(l => l.stockNo && l.orderQty > 0).length;

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-900 text-[#1e293b] dark:text-slate-100 font-sans h-full flex flex-col antialiased select-none overflow-y-auto custom-scrollbar relative">
      {/* ── 1. Top Breadcrumb & Header ────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 shrink-0 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Title & Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                  Purchase Order
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 uppercase tracking-wider">
                  Draft
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Create purchase order to request goods from supplier
              </p>
            </div>
          </div>

          {/* Top-Right Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="pogen-header-commercial-drawer-btn"
              onClick={() => setShowCommercialDrawer(prev => !prev)}
              className="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Open Commercial & Delivery terms drawer (Alt+C)"
            >
              <span className="material-symbols-outlined text-[16px] text-indigo-600">receipt_long</span>
              <span>Commercial Terms</span>
              <kbd className="text-[9px] font-mono px-1 py-0.2 bg-indigo-200/60 text-indigo-800 rounded font-bold">Alt+C</kbd>
            </button>

            <button
              type="button"
              onClick={handleSavePO}
              disabled={saving}
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{saving ? "Saving…" : "Save Draft"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span>Preview (F9)</span>
            </button>

            <button
              type="button"
              onClick={handleSubmitGate}
              disabled={saving || submitValidating}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>{PO_PRIMARY_SUBMIT_LABEL}</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu(m => !m)}
                className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs flex items-center"
              >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>
              {showMoreMenu && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden py-1"
                  onMouseLeave={() => setShowMoreMenu(false)}
                >
                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); excelImportInputRef.current?.click(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">upload_file</span>
                    Import from Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); handleAddNewBlankRow(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-blue-600">add</span>
                    Add Blank Row
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); handleClear(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                    Clear All Rows
                  </button>
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onNavigateTab("grn-studio"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-t border-slate-100 dark:border-slate-700"
                    >
                      <span className="material-symbols-outlined text-[16px] text-indigo-600">local_shipping</span>
                      Goods Receipt Studio
                    </button>
                  )}
                  {onClose && (
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onClose(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-t border-slate-100 dark:border-slate-700"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                      Close Tab
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-6 mt-3 border-t border-slate-100 dark:border-slate-800 pt-2 text-xs">
          {[
            { id: "general", label: "General" },
            { id: "items", label: `Items (${activeLineCount})` },
            { id: "other", label: "Other Details" },
            { id: "attachments", label: "Attachments" },
            { id: "history", label: "History" },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              id={`pogen-tab-${tab.id}`}
              data-testid={`pogen-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-1 font-semibold transition-all relative ${
                activeTab === tab.id
                  ? "text-blue-600"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* ── 2A. Items Tab: 1-Line Sticky Document Overview Strip ──────────────── */}
      {activeTab === "items" && (
        <header aria-label="Document Overview" className="px-6 pt-3 pb-1 shrink-0">
          <div className="bg-slate-900 text-white px-4 py-2 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono font-bold text-[10px] uppercase tracking-wider">
                {header.documentType}
              </span>
              <span className="font-mono font-bold text-blue-300 text-xs">
                {header.prefix}-{header.orderNumber}
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                <span>{selectedSupplier?.name || header.supplierName || "No Supplier"}</span>
                {selectedSupplier?.code && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 border border-slate-700">
                    {selectedSupplier.code}
                  </span>
                )}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px]">Date: <strong className="text-white">{header.orderDate}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px]">Del: <strong className="text-white">{header.deliveryDate}</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-slate-800/90 px-3 py-1 rounded-lg border border-slate-700 font-mono text-[11px] flex items-center gap-2">
                <span className="text-slate-400">Items: <strong className="text-white">{totals.totalItems || 0}</strong></span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">Qty: <strong className="text-amber-300">{totals.totalQty || 0}</strong></span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">Net: <strong className="text-emerald-400">₹{(totals.netOrderValue || totals.totalValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              </div>
              <button
                type="button"
                id="pogen-open-commercial-drawer-btn"
                onClick={() => setShowCommercialDrawer(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition"
                title="Open Commercial & Delivery terms drawer (Alt+C)"
              >
                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                <span>Terms & Delivery</span>
                <kbd className="text-[9px] font-mono px-1 py-0.2 bg-indigo-800/80 text-indigo-100 rounded font-bold">Alt+C</kbd>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── 2B. General Section: 4 Compact Information Cards ──────────────── */}
      {activeTab === "general" && (
        <section className="px-6 pt-4 pb-2 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 text-xs">
            {/* Card 1: Document Information */}
            <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">receipt_long</span>
                <h2 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Document Information
                </h2>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1 text-[11px]">
                    Document Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={header.documentType}
                    onChange={(e) => setHeader({ ...header, documentType: e.target.value as any })}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 font-medium"
                  >
                    <option value="Purchase Order">Purchase Order</option>
                    <option value="Indent">Indent</option>
                  </select>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1 text-[11px]">Prefix</label>
                    <input
                      type="text"
                      value={header.prefix}
                      onChange={(e) => setHeader({ ...header, prefix: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold outline-none focus:border-blue-600 text-center"
                    />
                  </div>
                  <div className="col-span-8">
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1 text-[11px]">
                      PO Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={header.orderNumber}
                        onChange={(e) => setHeader({ ...header, orderNumber: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-2.5 pr-7 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        title="Configure sequence"
                        onClick={() => {
                          const cur = parseInt(header.orderNumber.replace(/\D/g, ""), 10) || 1;
                          setHeader(h => ({ ...h, orderNumber: `PO${String(cur + 1).padStart(3, "0")}` }));
                        }}
                        className="absolute right-1.5 text-slate-400 hover:text-blue-600"
                      >
                        <span className="material-symbols-outlined text-[15px]">settings</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1 text-[11px]">
                    PO Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={header.orderDate}
                    onChange={(e) => {
                      const orderDate = e.target.value;
                      setHeader((current) => ({
                        ...current,
                        orderDate,
                        deliveryDate: addDaysToDate(orderDate, current.leadTimeDays || 7),
                      }));
                    }}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Supplier & Delivery */}
            <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">local_shipping</span>
                  <h2 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                    Supplier &amp; Delivery
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("suppliers") || onNotification?.("New Supplier", "Navigate to Suppliers tab to onboard.", "info")}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  <span>+ New Supplier</span>
                </button>
              </div>
              <div className="space-y-1.5">
                {/* Searchable Supplier */}
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-0.5 text-[11px]">
                    Supplier / Vendor <span className="text-rose-500">*</span>
                  </label>
                  <SupplierSelect
                    id="pogen-supplier-select"
                    suppliers={suppliersList}
                    value={header.supplierId}
                    disabled={suppliersLoading}
                    compact={true}
                    placeholder={suppliersLoading ? "Loading suppliers..." : "Select or search vendor..."}
                    onChange={(supplierId, sel) => {
                      handleVendorChangeRequest(supplierId, sel?.name ?? sel?.company_name ?? header.supplierName, sel);
                    }}
                  />
                </div>

                {/* Selected Supplier Details Pill */}
                {selectedSupplier && (
                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{selectedSupplier.name}</span>
                      <button
                        type="button"
                        onClick={() => setIsScorecardOpen(true)}
                        className="text-[10px] text-blue-600 hover:underline font-semibold shrink-0"
                      >
                        View Details
                      </button>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 truncate text-[10px]">
                      GSTIN: {selectedSupplier.gstin || "27AAAAC0553K1Z8"} | {selectedSupplier.city || "Mumbai"}, {selectedSupplier.state || "Maharashtra"}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">{selectedSupplier.phone || "+91 22 1234 5678"}</div>
                  </div>
                )}

                <div className="grid grid-cols-12 gap-2 pt-0.5">
                  <div className="col-span-7">
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-0.5 text-[11px]">Delivery Date</label>
                    <input
                      type="date"
                      value={header.deliveryDate}
                      onChange={(e) => {
                        const deliveryDate = e.target.value;
                        setHeader((current) => ({
                          ...current,
                          deliveryDate,
                          leadTimeDays: calculateExactLeadTime(current.orderDate, deliveryDate),
                        }));
                      }}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono outline-none focus:border-blue-600 text-xs"
                    />
                  </div>
                  <div className="col-span-5">
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-0.5 text-[11px]">Lead Time</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      list="po-lead-time-options"
                      value={header.leadTimeDays}
                      onChange={(e) => {
                        const leadTimeDays = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setHeader((current) => ({
                          ...current,
                          leadTimeDays,
                          deliveryDate: addDaysToDate(current.orderDate, leadTimeDays),
                        }));
                      }}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold outline-none focus:border-blue-600 text-xs"
                    />
                    <datalist id="po-lead-time-options">
                      {LEAD_TIME_OPTIONS.map((days) => <option key={days} value={days}>{formatLeadTimeLabel(days)}</option>)}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-0.5 text-[11px]">Delivery Location</label>
                  <input
                    type="text"
                    value={header.deliveryLocation}
                    onChange={(e) => setHeader({ ...header, deliveryLocation: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Terms & Reference */}
            <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">handshake</span>
                <h2 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Terms &amp; Reference
                </h2>
              </div>
              <div className="space-y-1.5">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-slate-400 mb-0.5 text-[11px]">Supplier Reference</label>
                  <input
                    id="std-terms-ref-supplier-ref-input"
                    type="text"
                    placeholder="Supplier PO / Quotation No."
                    value={header.supplierReference || ""}
                    onChange={(e) => setHeader({ ...header, supplierReference: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-0.5 text-[11px]">Payment Terms</label>
                    <select
                      id="std-terms-ref-payment-terms-select"
                      value={header.paymentTerms}
                      onChange={(e) => setHeader({ ...header, paymentTerms: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium outline-none focus:border-blue-600 text-xs"
                    >
                      <option value="Immediate">Immediate</option>
                      <option value="15 Days">15 Days</option>
                      <option value="30 Days">30 Days</option>
                      <option value="45 Days">45 Days</option>
                      <option value="60 Days">60 Days</option>
                      <option value="Cash on Delivery">Cash on Delivery</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-0.5 text-[11px]">Currency</label>
                    <select
                      id="std-terms-ref-currency-select"
                      value={header.currency || "INR - Indian Rupee"}
                      onChange={(e) => setHeader({ ...header, currency: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium outline-none focus:border-blue-600 text-xs"
                    >
                      <option value="INR - Indian Rupee">INR - Rupee</option>
                      <option value="USD - US Dollar">USD - Dollar</option>
                      <option value="EUR - Euro">EUR - Euro</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-0.5 text-[11px]">{PURCHASER_FIELD_LABEL}</label>
                    <input
                      id="std-terms-ref-buyer-input"
                      type="text"
                      value={header.buyer || "manager"}
                      onChange={(e) => setHeader({ ...header, buyer: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 text-xs truncate"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-0.5 text-[11px]">Project / Dept</label>
                    <input
                      id="std-terms-ref-department-input"
                      type="text"
                      value={header.department || "General Purchase"}
                      onChange={(e) => setHeader({ ...header, department: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 h-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 text-xs truncate"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="font-medium text-slate-600 text-[11px]">Price Includes Tax</span>
                  <input
                    type="checkbox"
                    checked={header.priceIncludesTax || false}
                    onChange={(e) => setHeader({ ...header, priceIncludesTax: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Card 4: Status & Policy */}
            <div className="bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">verified_user</span>
                <h2 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Status &amp; Policy
                </h2>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Document Status</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Draft
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Vendor Status</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Policy</span>
                  <button
                    type="button"
                    onClick={() => setShowPolicyConfig(true)}
                    className="font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                  >
                    <span>General Retail</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Credit Limit</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">₹ 5,00,000</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Outstanding</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">₹ 1,25,430</span>
                  </div>
                </div>

                {/* Status Guidance Banner */}
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-[11px]">
                  <span className="material-symbols-outlined text-emerald-600 text-[16px] shrink-0">check_circle</span>
                  <span className="leading-tight">You can add items below or press F2 to browse products.</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Other Details Tab Content */}
      {activeTab === "other" && (
        <section className="px-6 py-4 max-w-4xl space-y-4 text-xs">
          <div className="bg-white dark:bg-slate-800/90 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-3">Commercial Terms &amp; Logistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-600 mb-1">Payment Terms</label>
                <input
                  id="std-other-payment-terms-input"
                  type="text"
                  value={header.paymentTerms}
                  onChange={(e) => setHeader({ ...header, paymentTerms: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Freight Charges Terms</label>
                <input
                  id="std-other-freight-terms-input"
                  type="text"
                  value={header.freightCharges}
                  onChange={(e) => setHeader({ ...header, freightCharges: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 h-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/90 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-3">Special Instructions &amp; Notes</h3>
            <textarea
              id="std-other-special-instructions-input"
              rows={4}
              value={header.specialInstructions}
              onChange={(e) => setHeader({ ...header, specialInstructions: e.target.value })}
              placeholder="e.g. Ensure all cartons carry barcodes and dispatch directly to Main Store."
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600"
            />
          </div>
        </section>
      )}

      {/* Attachments Tab Content */}
      {activeTab === "attachments" && (
        <section className="px-6 py-4 max-w-xl space-y-4 text-xs">
          <div className="bg-white dark:bg-slate-800/90 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[32px]">attach_file</span>
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">Supplier Quotation &amp; Specification Files</h3>
            <p className="text-slate-500 text-xs max-w-sm mb-4">
              Upload PDF invoices, Excel quotation sheets, or supplier catalogs associated with this order.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition shadow-xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">upload</span>
              Choose File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && onNotification) onNotification("File Attached", `Attached ${f.name} to purchase order.`, "success");
              }}
            />
          </div>
        </section>
      )}

      {/* History Tab Content */}
      {activeTab === "history" && (
        <section className="px-6 py-4 text-xs">
          <div className="bg-white dark:bg-slate-800/90 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-4">
            {openedOrder ? (
              <>
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Purchase Order Detail</div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-1">{openedOrder.order_no || "PO"}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-1">{normalizePurchaseStatus(openedOrder.status)}</span>
                    <button
                      type="button"
                      onClick={() => setOpenedOrder(null)}
                      className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      Back to history
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div className="space-y-2">
                    <div><span className="text-slate-500 dark:text-slate-400">PO number:</span> <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{openedOrder.order_no}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">PO date:</span> <span className="font-mono text-slate-700 dark:text-slate-300">{openedOrder.order_date || openedOrder.created_at || header.orderDate}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">Supplier:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{openedOrder.supplier_name || openedOrder.supplier_id}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">Supplier code:</span> <span className="font-mono text-slate-700 dark:text-slate-300">{openedOrder.supplier_id}</span></div>
                  </div>
                  <div className="space-y-2">
                    <div><span className="text-slate-500 dark:text-slate-400">Status:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{normalizePurchaseStatus(openedOrder.status)}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">Items:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{openedOrder.items?.length || 0}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">Subtotal:</span> <span className="font-mono text-slate-700 dark:text-slate-300">₹{Number(openedOrder.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">Grand total:</span> <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">₹{Number(openedOrder.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">Line Items</div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {(openedOrder.items || []).length === 0 ? (
                      <div className="px-3 py-4 text-slate-500 dark:text-slate-400">No item lines returned for this purchase order.</div>
                    ) : (
                      (openedOrder.items || []).map((item: any, idx: number) => (
                        <div key={item.id || `${openedOrder.order_no}-${idx}`} className="px-3 py-2 grid grid-cols-6 gap-2 text-[11px]">
                          <span className="font-mono text-slate-500 dark:text-slate-400">{idx + 1}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{item.name || item.code || "Item"}</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">{item.code || item.product_id || "-"}</span>
                          <span className="font-mono text-right text-slate-700 dark:text-slate-300">Qty {Number(item.quantity || 0)}</span>
                          <span className="font-mono text-right text-slate-700 dark:text-slate-300">Rate ₹{Number(item.cost_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          <span className="font-mono text-right font-bold text-emerald-700 dark:text-emerald-400">₹{Number(item.line_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateTab) {
                        onNavigateTab("supplier-mgmt");
                      } else {
                        onNotification?.("Vendor 360", `Open canonical vendor view for ${openedOrder.supplier_id || openedOrder.supplier_name || "supplier"}.`, "info");
                      }
                    }}
                    className="rounded-lg bg-slate-900 dark:bg-slate-700 text-white px-3 py-2 text-[10px] font-bold hover:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    View Vendor 360 ↗
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrintPreview(true)}
                    className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-3 py-2 text-[10px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    Print PO
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Purchase Order History</h3>
                  <button
                    type="button"
                    onClick={() => loadPurchaseHistory()}
                    className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Refresh
                  </button>
                </div>

                {historyLoading ? (
                  <div className="text-slate-500 dark:text-slate-400 py-8 text-center">Loading purchase orders...</div>
                ) : historyOrders.length === 0 ? (
                  <div className="text-slate-500 dark:text-slate-400 py-8 text-center">No purchase orders found in the persisted backend list.</div>
                ) : (
                  <div className="space-y-2">
                    {historyOrders.map((po: any) => (
                      <button
                        key={po.id}
                        type="button"
                        onClick={() => openPersistedPurchaseOrder(po.order_no || po.id)}
                        className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 p-3 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">{po.order_no || po.id}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{po.supplier_name || po.supplier_id || "Supplier"}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold">{normalizePurchaseStatus(po.status)}</div>
                            <div className="mt-1 font-mono text-[10px] text-slate-600 dark:text-slate-400">₹{Number(po.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ── 3. ITEM GRID WORKSPACE (PRIMARY WORKING SURFACE) ──────────────── */}
      {(activeTab === "general" || activeTab === "items") && (
        <main className="px-6 pt-2 pb-1 flex-1 flex flex-col min-h-0">
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs overflow-hidden flex flex-col flex-1">
            {/* ── ITEM TOOLBAR (TOP CONTROL SURFACE) ── */}
            <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 text-xs">
              {/* Left: Box Icon, Search/Scan input, and Primary Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Items</span>
                    <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                      Scan barcode, search or press F2 to browse products.
                    </span>
                  </div>
                </div>

                {/* Barcode / Search Input */}
                <div className="relative flex items-center min-w-[280px]">
                  <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[16px]">search</span>
                  <input
                    ref={toolbarSearchInputRef}
                    type="text"
                    placeholder="Scan barcode or search item (Press F2)"
                    value={toolbarSearch}
                    onChange={(e) => setToolbarSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleBarcodeOrSearchSubmit(toolbarSearch);
                      }
                    }}
                    className="w-full pl-8 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs font-medium outline-none focus:border-blue-600 shadow-2xs"
                  />
                  {toolbarSearch && (
                    <button
                      type="button"
                      onClick={() => setToolbarSearch("")}
                      className="absolute right-2 text-slate-400 hover:text-slate-600"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* + Add Item */}
                <button
                  type="button"
                  onClick={handleAddNewBlankRow}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Add Item</span>
                </button>

                {/* Browse Items (F2) */}
                <button
                  type="button"
                  onClick={() => setShowBrowseModal(true)}
                  className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-blue-600">manage_search</span>
                  <span>Browse Items (F2)</span>
                </button>

                {/* Fast Import (CSV / TSV / Excel / Clipboard) */}
                <button
                  type="button"
                  onClick={() => {
                    setInitialImportText(undefined);
                    setIsGlobalImportOpen(true);
                  }}
                  className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs flex items-center gap-1.5"
                  title="Import from Excel, CSV, TSV or paste spreadsheet data"
                >
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">table_view</span>
                  <span>Fast Import</span>
                </button>
                <input
                  ref={excelImportInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls, .tsv, .txt"
                  onChange={handleExcelImport}
                  className="hidden"
                />

                {/* More [...] dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu(m => !m)}
                    className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold px-2 py-1.5 rounded-lg text-xs transition shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                  </button>
                </div>
              </div>

              {/* Right: Item View Mode Selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium text-[11px]">Item View:</span>
                <select
                  value={itemView}
                  onChange={(e) => setItemView(e.target.value as any)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
                >
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                  <option value="size_pivot">Size Pivot Matrix</option>
                </select>
              </div>
            </div>

            {/* Scrollable Table Container */}
            <div
              onPaste={handleTableContainerPaste}
              tabIndex={0}
              className="overflow-x-auto custom-scrollbar flex-1 min-h-[440px] max-h-[calc(100vh-250px)] relative focus:outline-none"
              title="Click here and press Ctrl+V to paste table rows from Excel/Sheets"
            >
              {/* Floating F2 Hint */}
              {showF2Hint && activeLineCount === 0 && (
                <div
                  onClick={() => setShowF2Hint(false)}
                  className="absolute top-4 left-1/3 z-20 cursor-pointer animate-bounce"
                  title="Click to dismiss"
                >
                  <div className="bg-blue-600 text-white rounded-lg shadow-lg px-3.5 py-1.5 flex items-center gap-2 text-xs font-bold">
                    <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                    <span>Press <strong>F2</strong> to browse products or scan a barcode below</span>
                  </div>
                </div>
              )}

              {/* View Mode Switching: Compact vs Standard vs Size Pivot Matrix */}
              {itemView === "compact" ? (
                <table className="w-full text-left border-collapse text-xs min-w-[1080px]">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2 px-2.5 w-48 min-w-[180px] border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">Barcode</th>
                      <th className="p-2 w-8 text-center border-r border-slate-200 dark:border-slate-700">#</th>
                      <th className="p-2 px-2.5 w-28 min-w-[100px] border-r border-slate-200 dark:border-slate-700">Item Code</th>
                      <th className="p-2 px-3 min-w-[160px] flex-1 border-r border-slate-200 dark:border-slate-700">Product Name</th>
                      <th className="p-2 px-2.5 w-24 min-w-[80px] border-r border-slate-200 dark:border-slate-700">Color</th>
                      <th className="p-2 px-2 w-14 min-w-[50px] text-center border-r border-slate-200 dark:border-slate-700">Size</th>
                      <th className="p-2 px-2.5 w-24 min-w-[85px] text-right border-r border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-950/40 font-bold text-blue-900 dark:text-blue-300">
                        MRP (₹)
                      </th>
                      <th className="p-2 px-2 w-16 min-w-[65px] text-right border-r border-slate-200 dark:border-slate-700 font-bold text-blue-600 dark:text-blue-400">Qty</th>
                      <th className="p-2 px-2.5 w-24 min-w-[85px] text-right border-r border-slate-200 dark:border-slate-700 font-bold">Rate (₹)</th>
                      <th className="p-2 px-2 w-14 min-w-[55px] text-right border-r border-slate-200 dark:border-slate-700">Tax (%)</th>
                      <th className="p-2 px-3 w-28 min-w-[100px] text-right border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                        Amount (₹)
                      </th>
                      <th className="p-2 w-14 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                    {lineItems.map((item, idx) => {
                      const isSelected = idx === activeRowIndex;
                      const hasItem = !!item.stockNo;
                      return (
                        <tr
                          key={item.id ? `${item.id}-${idx}` : `pogen-row-c-${idx}`}
                          onClick={() => {
                            setActiveRowIndex(idx);
                            setShowF2Hint(false);
                          }}
                          className={`transition-colors ${
                            isSelected
                              ? "bg-blue-50/60"
                              : hasItem
                              ? "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                              : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40 opacity-80 hover:opacity-100"
                          }`}
                        >
                          {/* 1. Barcode (Column 1 per Decision C) */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
                            <div className="flex items-center gap-1 px-1 group">
                              <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">barcode_scanner</span>
                              <input
                                type="text"
                                id={`pogen-gen-barcode-${idx + 1}`}
                                value={item.barcode || ""}
                                placeholder="Scan / Barcode"
                                title={item.barcode || "Barcode"}
                                onFocus={() => setActiveRowIndex(idx)}
                                onChange={(e) => handleBarcodeChange(idx, e.target.value)}
                                className="w-full bg-transparent border-none p-0 h-6 font-mono font-semibold text-slate-800 dark:text-slate-200 text-xs outline-none"
                              />
                              {item.barcode && (
                                <button
                                  type="button"
                                  title={`Copy barcode ${item.barcode}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.barcode) navigator.clipboard.writeText(item.barcode);
                                    setCopiedBarcodeIdx(idx);
                                    setTimeout(() => setCopiedBarcodeIdx(null), 1500);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition shrink-0"
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    {copiedBarcodeIdx === idx ? "check" : "content_copy"}
                                  </span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 2. SNo (Column 2) */}
                          <td className="p-2 text-center text-slate-400 font-mono font-medium border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            {item.sNo}
                          </td>

                          {/* 3. Item Code / Article */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <input
                              type="text"
                              id={`pogen-gen-stockno-${idx + 1}`}
                              list="pogen-articles-datalist"
                              value={item.stockNo}
                              placeholder="F2 to browse / Article"
                              onFocus={() => { setActiveRowIndex(idx); setShowF2Hint(false); }}
                              onChange={(e) => handleStockNoOrArticleChange(idx, e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 rounded px-2 h-7 font-mono font-bold text-xs outline-none text-slate-800 dark:text-slate-100"
                            />
                          </td>

                          {/* 4. Product Name */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <input
                              type="text"
                              value={item.product}
                              placeholder="Product description"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { product: e.target.value })}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 rounded px-2 h-7 font-medium text-xs outline-none text-slate-800 dark:text-slate-100"
                            />
                          </td>

                          {/* 5. Color */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <input
                              type="text"
                              id={`pogen-gen-color-${idx + 1}`}
                              list={`pogen-colors-list-${idx + 1}`}
                              value={item.shade}
                              placeholder="Color"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => handleColorChange(idx, e.target.value)}
                              className="w-full bg-transparent border-none px-2 h-6 text-xs outline-none text-slate-600 dark:text-slate-300 uppercase"
                            />
                            <datalist id={`pogen-colors-list-${idx + 1}`}>
                              {getAvailableColorsForArticle(articleCatalogIndex, item.style || item.stockNo).map(c => (
                                <option key={c} value={c} />
                              ))}
                            </datalist>
                          </td>

                          {/* 6. Size */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-center">
                            <input
                              type="text"
                              id={`pogen-gen-size-${idx + 1}`}
                              list={`pogen-sizes-list-${idx + 1}`}
                              value={item.size}
                              placeholder="Size"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => handleSizeChange(idx, e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-center h-6 font-bold text-xs outline-none text-slate-800 dark:text-slate-100 uppercase"
                            />
                            <datalist id={`pogen-sizes-list-${idx + 1}`}>
                              {getAvailableSizesForArticleAndColor(articleCatalogIndex, item.style || item.stockNo, item.shade).map(sz => (
                                <option key={sz} value={sz} />
                              ))}
                            </datalist>
                          </td>

                          {/* 7. MRP (₹) */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-950/20 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.mrp || ""}
                              placeholder="0.00"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { mrp: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 rounded px-2 h-7 font-mono font-bold text-xs text-right outline-none text-blue-900 dark:text-blue-300"
                            />
                          </td>

                          {/* 8. Qty */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                            <input
                              type="number"
                              id={`po-qty-input-${idx}`}
                              min="0"
                              value={item.orderQty || ""}
                              placeholder="0"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { orderQty: parseInt(e.target.value, 10) || 0 })}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white rounded px-2 h-7 font-mono font-bold text-xs text-right outline-none text-blue-600"
                            />
                          </td>

                          {/* 9. Rate (₹) */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.rate || ""}
                              placeholder="0.00"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { rate: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 rounded px-2 h-7 font-mono font-bold text-xs text-right outline-none text-slate-800 dark:text-slate-100"
                            />
                          </td>

                          {/* 10. Tax (%) */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.taxPercent ?? 5}
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { taxPercent: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent border-none text-right px-2 h-6 font-mono text-xs outline-none text-slate-600 dark:text-slate-300"
                            />
                          </td>

                          {/* 11. Amount (₹) */}
                          <td className="p-2 px-3 border-r border-slate-100 dark:border-slate-800 text-right font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-800/30">
                            ₹{item.totalValue ? item.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                          </td>

                          {/* 12. Actions */}
                          <td className="p-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                title="Browse/Edit (F2)"
                                onClick={() => { setActiveRowIndex(idx); setShowBrowseModal(true); }}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button
                                type="button"
                                title="Delete row"
                                onClick={() => handleDeleteRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : itemView !== "size_pivot" ? (
                <table className="w-full text-left border-collapse text-xs min-w-[1450px]">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2 px-2.5 w-48 min-w-[180px] border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">Barcode</th>
                      <th className="p-2 w-10 text-center border-r border-slate-200 dark:border-slate-700">#</th>
                      <th className="p-2 px-2.5 min-w-[110px] border-r border-slate-200 dark:border-slate-700">Item Code</th>
                      <th className="p-2 px-3 min-w-[180px] border-r border-slate-200 dark:border-slate-700">Product Name</th>
                      <th className="p-2 px-2.5 min-w-[90px] border-r border-slate-200 dark:border-slate-700">Brand</th>
                      <th className="p-2 px-2.5 min-w-[80px] border-r border-slate-200 dark:border-slate-700">Style</th>
                      <th className="p-2 px-2.5 min-w-[90px] border-r border-slate-200 dark:border-slate-700">Shade / Color</th>
                      <th className="p-2 px-2 min-w-[60px] text-center border-r border-slate-200 dark:border-slate-700">Size</th>
                      <th className="p-2 px-2.5 min-w-[90px] text-right border-r border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-950/40 font-bold text-blue-900 dark:text-blue-300">
                        MRP (₹)
                      </th>
                      <th className="p-2 px-2 min-w-[65px] text-right border-r border-slate-200 dark:border-slate-700">Qty</th>
                      <th className="p-2 px-2 min-w-[60px] text-right border-r border-slate-200 dark:border-slate-700">Free</th>
                      <th className="p-2 px-2 min-w-[70px] text-center border-r border-slate-200 dark:border-slate-700">Unit</th>
                      <th className="p-2 px-2.5 min-w-[90px] text-right border-r border-slate-200 dark:border-slate-700 font-bold">Rate (₹)</th>
                      <th className="p-2 px-2 min-w-[65px] text-right border-r border-slate-200 dark:border-slate-700">Disc. (%)</th>
                      <th className="p-2 px-2 min-w-[65px] text-right border-r border-slate-200 dark:border-slate-700">Tax (%)</th>
                      <th className="p-2 px-3 min-w-[110px] text-right border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                        Amount (₹)
                      </th>
                      <th className="p-2 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                    {lineItems.map((item, idx) => {
                      const isSelected = idx === activeRowIndex;
                      const hasItem = !!item.stockNo;
                      return (
                        <tr
                          key={item.id ? `${item.id}-${idx}` : `pogen-row-d-${idx}`}
                          onClick={() => {
                            setActiveRowIndex(idx);
                            setShowF2Hint(false);
                          }}
                          className={`transition-colors ${
                            isSelected
                              ? "bg-blue-50/60"
                              : hasItem
                              ? "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                              : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40 opacity-80 hover:opacity-100"
                          }`}
                        >
                          {/* 1. Barcode (Column 1 per Decision C) */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 min-w-[180px] bg-slate-50/30 dark:bg-slate-800/30">
                            <div className="flex items-center gap-1 px-1 group">
                              <span className="material-symbols-outlined text-[15px] text-slate-400 shrink-0">barcode_scanner</span>
                              <input
                                type="text"
                                id={`pogen-gen-barcode-${idx + 1}`}
                                value={item.barcode || ""}
                                placeholder="Scan / Barcode"
                                title={item.barcode || "Barcode"}
                                onFocus={() => setActiveRowIndex(idx)}
                                onChange={(e) => handleBarcodeChange(idx, e.target.value)}
                                className="w-full bg-transparent border-none p-0 h-6 font-mono font-semibold text-slate-800 dark:text-slate-200 text-xs outline-none"
                              />
                              {item.barcode && (
                                <button
                                  type="button"
                                  title={`Copy barcode ${item.barcode}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.barcode) navigator.clipboard.writeText(item.barcode);
                                    setCopiedBarcodeIdx(idx);
                                    setTimeout(() => setCopiedBarcodeIdx(null), 1500);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition shrink-0"
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    {copiedBarcodeIdx === idx ? "check" : "content_copy"}
                                  </span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 2. SNo (Column 2) */}
                          <td className="p-2 text-center text-slate-400 font-mono font-medium border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            {item.sNo}
                          </td>

                          {/* 3. Item Code / Article (Column 3) */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <input
                              type="text"
                              id={`pogen-gen-stockno-${idx + 1}`}
                              list="pogen-articles-datalist"
                              value={item.stockNo}
                              placeholder="F2 to browse / Article"
                              onFocus={() => { setActiveRowIndex(idx); setShowF2Hint(false); }}
                              onChange={(e) => handleStockNoOrArticleChange(idx, e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 rounded px-2 h-7 font-mono font-bold text-xs outline-none text-slate-800 dark:text-slate-100"
                            />
                          </td>

                          {/* 4. Product Name */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <input
                              type="text"
                              value={item.product}
                              placeholder="Product description"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { product: e.target.value })}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 rounded px-2 h-7 font-medium text-xs outline-none text-slate-800 dark:text-slate-100"
                            />
                          </td>

                          {/* 5. Brand */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <input
                              type="text"
                              value={item.brand}
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { brand: e.target.value })}
                              className="w-full bg-transparent border-none px-2 h-6 text-xs outline-none text-slate-600"
                            />
                          </td>

                          {/* 6. Style */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <input
                              type="text"
                              id={`pogen-gen-style-${idx + 1}`}
                              list="pogen-articles-datalist"
                              value={item.style}
                              placeholder="Article / Style"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => handleStyleChange(idx, e.target.value)}
                              className="w-full bg-transparent border-none px-2 h-6 text-xs outline-none text-slate-600 font-bold"
                            />
                          </td>

                          {/* 7. Shade / Color */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <input
                              type="text"
                              id={`pogen-gen-color-${idx + 1}`}
                              list={`pogen-colors-list-${idx + 1}`}
                              value={item.shade}
                              placeholder="Color"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => handleColorChange(idx, e.target.value)}
                              className="w-full bg-transparent border-none px-2 h-6 text-xs outline-none text-slate-600 dark:text-slate-300 uppercase"
                            />
                            <datalist id={`pogen-colors-list-${idx + 1}`}>
                              {getAvailableColorsForArticle(articleCatalogIndex, item.style || item.stockNo).map(c => (
                                <option key={c} value={c} />
                              ))}
                            </datalist>
                          </td>

                          {/* 8. Size */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-center">
                            <input
                              type="text"
                              id={`pogen-gen-size-${idx + 1}`}
                              list={`pogen-sizes-list-${idx + 1}`}
                              value={item.size}
                              placeholder="Size"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => handleSizeChange(idx, e.target.value)}
                              className="w-full bg-transparent border-none text-center h-6 font-semibold text-xs outline-none text-slate-700 dark:text-slate-200 uppercase"
                            />
                            <datalist id={`pogen-sizes-list-${idx + 1}`}>
                              {getAvailableSizesForArticleAndColor(articleCatalogIndex, item.style || item.stockNo, item.shade).map(sz => (
                                <option key={sz} value={sz} />
                              ))}
                            </datalist>
                          </td>

                          {/* 9. MRP (₹) - PROMINENT RETAIL FIELD */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-950/20 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.mrp || ""}
                              placeholder="0.00"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { mrp: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 rounded px-2 h-7 font-mono font-bold text-xs text-right outline-none text-blue-900 dark:text-blue-300"
                            />
                          </td>

                          {/* 10. Qty */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                            <input
                              type="number"
                              id={`po-qty-input-${idx}`}
                              min="0"
                              value={item.orderQty || ""}
                              placeholder="0"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { orderQty: parseInt(e.target.value, 10) || 0 })}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white rounded px-2 h-7 font-mono font-bold text-xs text-right outline-none text-blue-600"
                            />
                          </td>

                          {/* 11. Free */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.freeQty || ""}
                              placeholder="0"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { freeQty: parseInt(e.target.value, 10) || 0 })}
                              className="w-full bg-transparent border-none text-right px-2 h-6 font-mono text-xs outline-none text-slate-600 dark:text-slate-300"
                            />
                          </td>

                          {/* 12. Unit */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                            <select
                              value={item.unit || "Pair"}
                              onChange={(e) => updateLineItem(idx, { unit: e.target.value })}
                              className="w-full bg-transparent border-none text-center h-6 text-xs outline-none font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              {UNITS_LIST.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>

                          {/* 13. Rate (₹) */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.rate || ""}
                              placeholder="0.00"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { rate: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-900 rounded px-2 h-7 font-mono font-bold text-xs text-right outline-none text-slate-800 dark:text-slate-100"
                            />
                          </td>

                          {/* 14. Disc. (%) */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent || ""}
                              placeholder="0"
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { discountPercent: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent border-none text-right px-2 h-6 font-mono text-xs outline-none text-slate-600 dark:text-slate-300"
                            />
                          </td>

                          {/* 15. Tax (%) */}
                          <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.taxPercent ?? 5}
                              onFocus={() => setActiveRowIndex(idx)}
                              onChange={(e) => updateLineItem(idx, { taxPercent: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent border-none text-right px-2 h-6 font-mono text-xs outline-none text-slate-600 dark:text-slate-300"
                            />
                          </td>

                          {/* 16. Amount (₹) */}
                          <td className="p-2 px-3 border-r border-slate-100 dark:border-slate-800 text-right font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-800/30">
                            ₹{item.totalValue ? item.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                          </td>

                          {/* 17. Actions */}
                          <td className="p-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                title="Browse/Edit (F2)"
                                onClick={() => { setActiveRowIndex(idx); setShowBrowseModal(true); }}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button
                                type="button"
                                title="Delete row"
                                onClick={() => handleDeleteRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                /* Tab 2: Size Pivot Matrix Grid */
                <table className="w-full text-left border-collapse min-w-[1200px] text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th rowSpan={2} className="p-1 w-8 text-center border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold">#</th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 min-w-[120px]">Article No</th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 min-w-[160px]">Product</th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 min-w-[100px]">Brand</th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 min-w-[90px]">Style</th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 min-w-[90px]">Color</th>
                      <th colSpan={DEFAULT_SIZES.length} className="p-1 text-center border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                        Size Quantities
                      </th>
                      <th rowSpan={2} className="p-2 text-right border-r border-slate-200 dark:border-slate-700 min-w-[65px] font-bold bg-slate-100 dark:bg-slate-800">QTY</th>
                      <th rowSpan={2} className="p-2 text-right border-r border-slate-200 min-w-[60px] font-bold">GST %</th>
                      <th rowSpan={2} className="p-2 text-right border-r border-slate-200 min-w-[80px] font-bold">Rate</th>
                      <th rowSpan={2} className="p-2 text-right min-w-[100px] font-bold bg-slate-100 dark:bg-slate-800">Total Value</th>
                    </tr>
                    <tr>
                      {DEFAULT_SIZES.map(sz => (
                        <th key={sz} className="p-1 text-center w-10 font-mono font-bold border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          {sz}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                    {sizePivotRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-2 text-center text-slate-400 font-mono border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">{row.sNo}</td>
                        <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.articleNo}
                            placeholder="Article / F2"
                            onChange={(e) => updatePivotRow(idx, { articleNo: e.target.value })}
                            className="w-full bg-transparent border-none px-2 h-6 font-mono font-bold text-xs outline-none"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.product}
                            onChange={(e) => updatePivotRow(idx, { product: e.target.value })}
                            className="w-full bg-transparent border-none px-2 h-6 text-xs outline-none"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.brand}
                            onChange={(e) => updatePivotRow(idx, { brand: e.target.value })}
                            className="w-full bg-transparent border-none px-2 h-6 text-xs outline-none text-slate-600"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.style}
                            onChange={(e) => updatePivotRow(idx, { style: e.target.value })}
                            className="w-full bg-transparent border-none px-2 h-6 text-xs outline-none text-slate-600"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-100 dark:border-slate-800">
                          <input
                            type="text"
                            value={row.color}
                            onChange={(e) => updatePivotRow(idx, { color: e.target.value })}
                            className="w-full bg-transparent border-none px-2 h-6 text-xs outline-none text-slate-600"
                          />
                        </td>
                        {DEFAULT_SIZES.map(sz => (
                          <td key={sz} className="p-0 border-r border-slate-100 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.sizeQuantities[sz] || ""}
                              onChange={(e) => updatePivotSizeQty(idx, sz, parseInt(e.target.value, 10) || 0)}
                              className="w-full bg-transparent border-none text-center h-6 font-mono text-xs outline-none"
                            />
                          </td>
                        ))}
                        <td className="p-2 text-right font-mono font-bold text-blue-600 dark:text-blue-400 bg-slate-50/50 dark:bg-slate-800/30 border-r border-slate-100 dark:border-slate-800">{row.totalQty}</td>
                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                          <input
                            type="number"
                            value={row.gstPercent || 5}
                            onChange={(e) => updatePivotRow(idx, { gstPercent: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-transparent border-none text-right px-2 h-6 font-mono text-xs outline-none"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-right">
                          <input
                            type="number"
                            value={row.rate || ""}
                            onChange={(e) => updatePivotRow(idx, { rate: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-transparent border-none text-right px-2 h-6 font-mono font-bold text-xs outline-none"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-800/30">
                          ₹{row.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ── 5. Bottom Section: Notes + Summary + Order Amount Summary ──────── */}
      {activeTab === "general" ? (
        <section className="px-6 py-3 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 text-xs">
            {/* Left Card: Notes (~30%) */}
            <div className="md:col-span-4 bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col">
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">edit_note</span>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Notes</h3>
              </div>
              <textarea
                rows={4}
                value={header.specialInstructions}
                onChange={(e) => setHeader({ ...header, specialInstructions: e.target.value })}
                placeholder="Add notes, special instructions or terms for supplier..."
                className="w-full flex-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 bg-slate-50/50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600 text-xs resize-none"
              />
            </div>

            {/* Center Card: Summary (~25%) */}
            <div className="md:col-span-3 bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">analytics</span>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Summary</h3>
              </div>
              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Total Items</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200 text-sm">{totals.totalItems || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Total Qty</span>
                  <span className="font-bold font-mono text-blue-600 text-sm">{totals.totalQty || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Free Qty</span>
                  <span className="font-bold font-mono text-emerald-600 text-sm">{totals.freeQty || 0}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono pt-1.5 border-t border-slate-100">
                Mode: {itemView === "size_pivot" ? "Size Matrix" : "Standard Line Items"}
              </div>
            </div>

            {/* Right Card: Order Amount Summary (~45%) */}
            <div className="md:col-span-5 bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">calculate</span>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Order Amount Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Gross Amount</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ₹{(totals.grossValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Taxable Amount</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ₹{(totals.taxableAmount || totals.grossValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Item Discount</span>
                  <span className="font-mono font-bold text-emerald-600">
                    - ₹{(totals.itemDiscount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">CGST (2.5%)</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    ₹{(totals.cgst || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Freight Charges</span>
                  <div className="flex items-center">
                    <span className="font-mono mr-1">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={header.freightAmount || ""}
                      placeholder="0.00"
                      onChange={(e) => setHeader({ ...header, freightAmount: parseFloat(e.target.value) || 0 })}
                      className="w-16 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded px-1.5 py-0.5 text-right font-mono font-bold text-xs outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">SGST (2.5%)</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    ₹{(totals.sgst || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Other Charges</span>
                  <div className="flex items-center">
                    <span className="font-mono mr-1">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={header.otherCharges || ""}
                      placeholder="0.00"
                      onChange={(e) => setHeader({ ...header, otherCharges: parseFloat(e.target.value) || 0 })}
                      className="w-16 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded px-1.5 py-0.5 text-right font-mono font-bold text-xs outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Round Off</span>
                  <span className="font-mono text-slate-600">
                    ₹{(totals.roundOff || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Net Order Value (Prominent Display) */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-blue-50/60 dark:bg-blue-950/40 p-2.5 rounded-lg">
                <span className="font-bold text-blue-900 dark:text-blue-200 text-sm uppercase tracking-wider">
                  Net Order Value
                </span>
                <span className="font-extrabold text-blue-700 dark:text-blue-300 text-lg font-mono">
                  ₹{(totals.netOrderValue || totals.totalValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : activeTab === "items" ? (
        <section className="px-6 py-2 shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Items:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totals.totalItems || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Total Qty:</span>
                <span className="font-mono font-bold text-blue-600">{totals.totalQty || 0}</span>
              </div>
              {(totals.freeQty ?? 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Free:</span>
                  <span className="font-mono font-bold text-emerald-600">{totals.freeQty}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Gross:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">₹{(totals.grossValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">GST:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">₹{((totals.cgst || 0) + (totals.sgst || 0) + (totals.igst || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">Net Order Value:</span>
                <span className="font-mono font-extrabold text-blue-700 text-sm">
                  ₹{(totals.netOrderValue || totals.totalValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className="text-blue-600 hover:text-blue-800 font-medium text-xs flex items-center gap-1 underline underline-offset-2"
              >
                <span className="material-symbols-outlined text-[14px]">tune</span>
                <span>Edit Freight & Taxes</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* 409 Duplicate Order Recovery Banner */}
      {duplicateOrderNo && (
        <aside aria-label="Order Number Exists Banner" className="mx-6 mb-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-4 py-2 rounded-xl flex items-center gap-3 text-xs shrink-0">
          <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
          <span className="text-amber-900 dark:text-amber-200 font-medium">
            Purchase Order <strong>{duplicateOrderNo}</strong> already exists for this organization.
          </span>
          {suggestedOrderNo && (
            <button
              type="button"
              onClick={() => {
                const parts = suggestedOrderNo.split("-");
                const num = parts.pop() || "";
                const pfx = parts.join("-");
                setHeader(h => ({ ...h, prefix: pfx || h.prefix, orderNumber: num }));
                setDuplicateOrderNo(null);
                setSuggestedOrderNo(null);
              }}
              className="ml-2 bg-blue-600 text-white font-bold px-3 py-1 rounded text-xs hover:bg-blue-700 transition shadow-xs"
            >
              Use {suggestedOrderNo} instead
            </button>
          )}
          <button
            type="button"
            onClick={() => { setDuplicateOrderNo(null); setSuggestedOrderNo(null); }}
            className="ml-auto text-amber-700 hover:text-amber-900 font-bold text-base"
          >
            &times;
          </button>
        </aside>
      )}

      {/* ── 6. Persistent Bottom Action Bar ───────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-lg sticky bottom-0 z-20 text-xs">
        <div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-1.5 font-bold transition shadow-2xs"
          >
            Cancel
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={handleSavePO}
            className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-1.5 font-bold transition shadow-2xs disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            disabled={saving || submitValidating}
            onClick={handleSubmitGate}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-1.5 font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>{PO_PRIMARY_SUBMIT_LABEL}</span>
          </button>
        </div>
      </footer>

      {/* ── 7. Modals & Dialogs ────────────────────────────────────────────── */}

      {/* Post-Save Workflow Modal */}
      {savedOrderNo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-[500px] max-w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">check_circle</span>
              </div>
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Purchase Order Saved</h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{savedOrderNo} committed successfully.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">What would you like to do next?</p>
            <div className="grid grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  const saved = savedOrderNo;
                  setSavedOrderNo(null);
                  await openPersistedPurchaseOrder(saved);
                }}
                className="flex flex-col items-center justify-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl py-3 px-2 font-bold text-xs text-indigo-700 dark:text-indigo-300 transition"
              >
                <span className="material-symbols-outlined text-[22px]">open_in_new</span>
                <span>Open PO</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavedOrderNo(null);
                  handleClear();
                }}
                className="flex flex-col items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-xl py-3 px-2 font-bold text-xs text-blue-700 dark:text-blue-300 transition"
              >
                <span className="material-symbols-outlined text-[22px]">add_circle</span>
                <span>Create Another</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const saved = savedOrderNo;
                  setSavedOrderNo(null);
                  if (onNavigateTab) {
                    onNavigateTab("grn-studio");
                  } else {
                    onNotification?.("GRN Notice", `Inward order ${saved || ""}.`, "info");
                  }
                }}
                className="flex flex-col items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-xl py-3 px-2 font-bold text-xs text-emerald-700 dark:text-emerald-300 transition"
              >
                <span className="material-symbols-outlined text-[22px]">local_shipping</span>
                <span>Receive GRN</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavedOrderNo(null);
                  setShowPrintPreview(true);
                }}
                className="flex flex-col items-center justify-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-xl py-3 px-2 font-bold text-xs text-amber-700 dark:text-amber-300 transition"
              >
                <span className="material-symbols-outlined text-[22px]">print</span>
                <span>Print PO</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSavedOrderNo(null)}
              className="text-xs text-slate-400 hover:text-slate-600 underline self-center mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* F2 Product Browse Modal */}
      <PurchBrowseDlg
        products={products}
        isOpen={showBrowseModal}
        onClose={() => setShowBrowseModal(false)}
        onSelectProduct={handleSelectProduct}
        vendorId={header.supplierId || undefined}
        transactionDate={header.orderDate || undefined}
      />

      {/* Approval Reason Dialog */}
      <POApprovalReasonDialog
        isOpen={showApprovalDialog}
        onClose={() => {
          setShowApprovalDialog(false);
          setPendingProduct(null);
          setPendingDecision(null);
          setPOWorkflowState("VENDOR_SELECTED");
        }}
        onConfirm={handleApprovalConfirmed}
        decision={pendingDecision}
        productName={pendingProduct?.name ?? ""}
        vendorName={header.supplierName}
      />

      {/* Vendor Change Dialog */}
      {showVendorChangeDialog && pendingNewVendor && (
        <POVendorChangeDialog
          isOpen={showVendorChangeDialog}
          onClose={() => {
            setShowVendorChangeDialog(false);
            setPendingNewVendor(null);
          }}
          onConfirm={handleVendorChangeConfirmed}
          currentVendorId={header.supplierId}
          currentVendorName={header.supplierName}
          newVendorId={pendingNewVendor.id}
          newVendorName={pendingNewVendor.name}
          lines={lineItems.map(l => ({ stockNo: l.stockNo, product: l.product }))}
          transactionDate={header.orderDate}
        />
      )}

      {/* Submit Validation Summary */}
      <POValidationSummary
        isOpen={showValidationSummary}
        onClose={() => setShowValidationSummary(false)}
        onSubmit={() => {
          setShowValidationSummary(false);
          handleSavePO();
        }}
        result={submitValidationResult}
        loading={submitValidating}
      />

      {/* Policy Explain Modal */}
      <POProductExplainModal
        isOpen={showExplainModal}
        onClose={() => {
          setShowExplainModal(false);
          setExplainDecision(null);
        }}
        decision={explainDecision}
        productName={explainProductName}
        vendorName={header.supplierName}
      />

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <POPrintPreviewModal
          isOpen={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          header={header}
          lineItems={lineItems}
          sizePivotRows={sizePivotRows}
          activeTab={itemView === "size_pivot" ? "pivot" : "generation"}
          vendor={selectedSupplier}
        />
      )}

      {/* Supplier Scorecard Modal */}
      {isScorecardOpen && (
        <SupplierScorecardModal
          isOpen={isScorecardOpen}
          onClose={() => setIsScorecardOpen(false)}
          initialSupplierId={header.supplierId}
          onNotification={onNotification}
        />
      )}

      {/* ── SMRITI Global Grid Input & Import Standard Modal ───────────────── */}
      <GlobalGridImportModal
        isOpen={isGlobalImportOpen}
        onClose={() => {
          setIsGlobalImportOpen(false);
          setInitialImportText(undefined);
        }}
        profile={GRID_PROFILES.PURCHASE}
        title="Purchase Order Fast Import & Clipboard Paste"
        existingRowCount={lineItems.filter((l) => Boolean(l.stockNo?.trim()) || l.orderQty > 0).length}
        initialRawText={initialImportText}
        onCommit={handleGlobalGridImportCommit}
      />

      {/* ── Indexed Articles Datalist for Fast Autocomplete ────────────────── */}
      <datalist id="pogen-articles-datalist">
        {articleCatalogIndex.articles.map(art => (
          <option key={art} value={art} />
        ))}
      </datalist>

      {/* ── Commercial & Delivery Slide-Over Drawer (Decision B) ─────────── */}
      <CommercialDeliveryDrawer
        isOpen={showCommercialDrawer}
        onClose={() => setShowCommercialDrawer(false)}
        data={{
          paymentTerms: header.paymentTerms || "120 Days",
          freightCharges: header.freightCharges || "Paid by Supplier",
          freightAmount: header.freightAmount ?? 0,
          currency: header.currency || "INR",
          buyer: header.buyer || "",
          department: header.department || "Footwear",
          specialInstructions: header.specialInstructions || "",
          supplierReference: header.supplierReference || "",
          deliveryDate: header.deliveryDate || "",
          deliveryLocation: header.deliveryLocation || "Main Store (MAIN)",
          leadTimeDays: header.leadTimeDays || 7,
          otherCharges: header.otherCharges ?? 0,
          businessTerms: header.businessTerms ?? DEFAULT_BUSINESS_TERMS,
        }}
        onChange={(updated) => setHeader(h => ({ ...h, ...updated }))}
        supplierName={selectedSupplier?.name || header.supplierName}
        supplierCode={selectedSupplier?.code || suppliersList.find(s => s.id === header.supplierId)?.code}
        supplierCommercialDefaults={supplierCommercialDefaults}
        onResetToDefaults={() => {
          if (supplierCommercialDefaults) {
            setHeader(h => ({
              ...h,
              paymentTerms: supplierCommercialDefaults.paymentTerms || h.paymentTerms,
              freightCharges: supplierCommercialDefaults.freightCharges || h.freightCharges,
              currency: supplierCommercialDefaults.currency || h.currency,
              buyer: supplierCommercialDefaults.buyer || h.buyer,
              department: supplierCommercialDefaults.department || h.department,
              specialInstructions: supplierCommercialDefaults.specialInstructions !== undefined ? supplierCommercialDefaults.specialInstructions : h.specialInstructions,
            }));
          }
        }}
      />
    </div>
  );
};

export default PoGenerateTab;
