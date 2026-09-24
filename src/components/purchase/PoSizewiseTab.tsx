/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-25
 * Modified     : 2026-09-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "PO_SIZEWISE_ENTRY")
 */

/**
 * PoSizewiseTab — Sizewise Purchase Order Entry UX
 *
 * A dedicated "Sizewise" layout for Purchase Order generation where every
 * line item captures size-wise order quantities (e.g. S / M / L / XL / XXL)
 * in a horizontally-spread matrix grid.
 *
 * Key features:
 *  • Configurable size columns (default: S, M, L, XL, XXL)
 *  • Per-row: Item Code, Product Description (Brand / Style / Shade),
 *    size-qty cells, Rate, Stock On Hand, Tax %, Net Value, Delivery Date, Actions
 *  • Footer totals row (per-size + grand total)
 *  • Bottom: Size-wise Summary panel + Item Summary panel + Remarks
 *  • PO header: Type, Prefix, Number, Date, Supplier, Delivery Date, Lead Time
 *  • Three sub-tabs: Items | Delivery & Tax | Other Details
 *  • Toolbar: Scan/F2 search, Add Item, Import from Excel, Copy Previous PO,
 *    Delete Row, Price List selector, Item Finder
 *  • Action footer: Cancel | Save Draft | Save & Confirm
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { PurchBrowseDlg } from "./PurchBrowseDlg.tsx";
import type { Product } from "../../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SIZEWISE_SIZES = ["S", "M", "L", "XL", "XXL"];

export const SIZE_SCALE_PRESETS: Record<string, { label: string; category: string; sizes: string[] }> = {
  APPAREL_ALPHA: {
    label: "Apparel (S - XXL)",
    category: "Apparel",
    sizes: ["S", "M", "L", "XL", "XXL"],
  },
  FOOTWEAR_EU: {
    label: "Footwear EU (36 - 44)",
    category: "Footwear",
    sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
  },
  FOOTWEAR_UK: {
    label: "Footwear UK (6 - 11)",
    category: "Footwear",
    sizes: ["6", "7", "8", "9", "10", "11"],
  },
};

/** Footwear statutory GST rate: 5% for purchase/sale rate <= 2500, 18% for > 2500 */
export const getFootwearGstRate = (rate: number): number => (rate <= 2500 ? 5 : 18);

const PRICE_LIST_OPTIONS = [
  "Default Purchase Price",
  "Last Purchase Price",
  "Standard Cost",
  "Weighted Average",
];
const UNITS_LIST = ["Pair", "Pcs", "Box", "Set", "Mtr", "Kg", "Dzn"];
const LEAD_TIME_OPTIONS = [3, 7, 10, 15, 30];
const DEFAULT_BLANK_ROWS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SizewisePOHeader {
  documentType: string;
  prefix: string;
  orderNumber: string;
  orderDate: string;
  supplierId: string;
  supplierName: string;
  deliveryDate: string;
  leadTimeDays: number;
  // Delivery & Tax
  deliveryLocation: string;
  commonTaxPercent: number;
  freightAmount: number;
  otherCharges: number;
  // Other Details
  paymentTerms: string;
  freightCharges: string;
  currency: string;
  buyer: string;
  department: string;
  supplierReference: string;
  specialInstructions: string;
  remarks: string;
  internalNotes: string;
  priceList: string;
}

export interface SizewisePOLine {
  id: string;
  sNo: number;
  itemCode: string;
  barcode?: string;
  product: string;
  brand: string;
  style: string;
  shade: string;
  unit: string;
  sizeQuantities: Record<string, number>; // e.g. { S: 20, M: 30, L: 30, XL: 20, XXL: 0 }
  totalQty: number;
  rate: number;
  stockOnHand: number;
  taxPercent: number;
  netValue: number; // totalQty * rate
  deliveryDate: string;
  originalProduct?: Product;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const addDaysToDate = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildBlankLine = (idx: number, sizes: string[], deliveryDate: string, taxPercent: number): SizewisePOLine => ({
  id: `sw-line-${idx + 1}`,
  sNo: idx + 1,
  itemCode: "",
  barcode: "",
  product: "",
  brand: "",
  style: "",
  shade: "",
  unit: "Pcs",
  sizeQuantities: sizes.reduce<Record<string, number>>((acc, sz) => { acc[sz] = 0; return acc; }, {}),
  totalQty: 0,
  rate: 0,
  stockOnHand: 0,
  taxPercent,
  netValue: 0,
  deliveryDate,
});

export interface SizewiseSummaryTotals {
  perSizeTotals: Record<string, number>;
  grandTotalQty: number;
  grossValue: number;
  totalTax: number;
  netOrderValue: number;
  totalItems: number;
  sizePercents: Record<string, string>;
}

export function calculateSizewiseSummaryTotals(
  lines: SizewisePOLine[],
  sizes: string[],
  freightAmount: number = 0,
  otherCharges: number = 0
): SizewiseSummaryTotals {
  const activeLines = lines.filter(l => l.itemCode && l.totalQty > 0);
  const perSizeTotals = sizes.reduce<Record<string, number>>((acc, sz) => {
    acc[sz] = activeLines.reduce((s, l) => s + (l.sizeQuantities[sz] || 0), 0);
    return acc;
  }, {});
  const grandTotalQty = activeLines.reduce((s, l) => s + l.totalQty, 0);
  const grossValue = activeLines.reduce((s, l) => s + l.netValue, 0);
  const totalTax = activeLines.reduce((s, l) => s + (l.netValue * (l.taxPercent || 0)) / 100, 0);
  const rawNet = grossValue + totalTax + freightAmount + otherCharges;
  const netOrderValue = rawNet;
  const totalItems = activeLines.length;

  const sizePercents = sizes.reduce<Record<string, string>>((acc, sz) => {
    acc[sz] =
      grandTotalQty > 0
        ? ((perSizeTotals[sz] / grandTotalQty) * 100).toFixed(2) + "%"
        : "0%";
    return acc;
  }, {});

  return {
    perSizeTotals,
    grandTotalQty,
    grossValue,
    totalTax,
    netOrderValue,
    totalItems,
    sizePercents,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────────────────────────

interface PoSizewiseTabProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNotification?: (
    title: string,
    message: string,
    type?: "success" | "error" | "info" | "warning"
  ) => void;
  onClose?: () => void;
  onNavigateTab?: (tab: string) => void;
  /** Optional: list of size column labels (default: S, M, L, XL, XXL) */
  sizes?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PoSizewiseTab
// ─────────────────────────────────────────────────────────────────────────────

export const PoSizewiseTab: React.FC<PoSizewiseTabProps> = ({
  products: initialProducts = [],
  currentUser,
  onNotification,
  onClose,
  onNavigateTab,
  sizes: propSizes,
}) => {
  const today = new Date().toISOString().split("T")[0];
  const defaultDelivery = addDaysToDate(today, 7);

  // Detect initial scale
  const detectInitialScale = (): string => {
    if (propSizes && propSizes.length > 0) {
      if (propSizes.some(s => ["36", "37", "38", "39", "40", "41", "42", "43", "44"].includes(s))) {
        return "FOOTWEAR_EU";
      }
      if (propSizes.some(s => ["6", "7", "8", "9", "10", "11"].includes(s))) {
        return "FOOTWEAR_UK";
      }
    }
    return "APPAREL_ALPHA";
  };

  const [selectedScaleKey, setSelectedScaleKey] = useState<string>(detectInitialScale);
  const [sizes, setSizes] = useState<string[]>(() =>
    propSizes && propSizes.length > 0
      ? propSizes
      : SIZE_SCALE_PRESETS[detectInitialScale()]?.sizes || DEFAULT_SIZEWISE_SIZES
  );

  // ── State ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"items" | "delivery" | "other">("items");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [suppliersList, setSuppliersList] = useState<
    { id: string; name: string; code?: string; gstin?: string; city?: string; state?: string }[]
  >([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [toolbarSearch, setToolbarSearch] = useState("");
  const [savedOrderNo, setSavedOrderNo] = useState<string | null>(null);
  const [duplicateOrderNo, setDuplicateOrderNo] = useState<string | null>(null);
  const [suggestedOrderNo, setSuggestedOrderNo] = useState<string | null>(null);

  const toolbarSearchRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [header, setHeader] = useState<SizewisePOHeader>({
    documentType: "Purchase Order",
    prefix: "PO",
    orderNumber: "001",
    orderDate: today,
    supplierId: "",
    supplierName: "",
    deliveryDate: defaultDelivery,
    leadTimeDays: 7,
    deliveryLocation: "Main Store (MAIN)",
    commonTaxPercent: 18,
    freightAmount: 0,
    otherCharges: 0,
    paymentTerms: "30 Days",
    freightCharges: "Paid by Supplier",
    currency: "INR - Indian Rupee",
    buyer: currentUser?.name ? `${currentUser.name} (${currentUser.role || "MANAGER"})` : "manager (MANAGER)",
    department: "General Purchase",
    supplierReference: "",
    specialInstructions: "",
    remarks: "",
    internalNotes: "",
    priceList: "Default Purchase Price",
  });

  const [lines, setLines] = useState<SizewisePOLine[]>(() =>
    Array.from({ length: DEFAULT_BLANK_ROWS }, (_, i) =>
      buildBlankLine(i, sizes, defaultDelivery, 18)
    )
  );

  // ── Data load ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      try {
        const prodRes = await apiFetchV1("/inventory/?page=1&page_size=200&sort=created_at&order=desc");
        const list = Array.isArray(prodRes) ? prodRes : prodRes?.items || [];
        if (list.length > 0) {
          setProducts(
            list.map((p: any) => ({
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
              category: p.category,
            }))
          );
        }
      } catch {
        // inventory load is non-fatal
      }

      const supRes = await apiFetchV1("/purchase/suppliers/");
      const supList = Array.isArray(supRes) ? supRes : supRes?.items || [];
      const suppliers = supList.length > 0
        ? supList.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.vendor_code || s.code,
            gstin: s.gstin || s.tax_id || "",
            city: s.city || "",
            state: s.state || "",
          }))
        : [
            { id: "SUP-548042", name: "Apex Fabrics Ltd", code: "SUP-548042", gstin: "27AAAAC0553K1Z8", city: "Mumbai", state: "Maharashtra" },
            { id: "SUP-102941", name: "Campus Activewear Ltd", code: "SUP-102941", gstin: "07AAACC2914E1Z1", city: "Delhi", state: "Delhi" },
            { id: "SUP-309481", name: "Nagreeka Foils Ltd", code: "SUP-309481", gstin: "19AABCB1234P1Z5", city: "Kolkata", state: "West Bengal" },
          ];
      setSuppliersList(suppliers);

      if (!header.supplierId && suppliers.length > 0) {
        setHeader(h => ({ ...h, supplierId: suppliers[0].id, supplierName: suppliers[0].name }));
      }

      // Fetch next PO number
      try {
        const nextRes: any = await apiFetchV1(
          `/purchase/orders/next-number?prefix=${encodeURIComponent(header.prefix || "PO")}`
        );
        if (nextRes?.next_number) {
          setHeader(h => ({ ...h, orderNumber: String(nextRes.next_number) }));
        }
      } catch {
        // sequence fetch is non-fatal
      }
    } catch (err) {
      onNotification?.("Load Error", "Failed to load supplier list.", "error");
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  // ── Line helpers ──────────────────────────────────────────────────────
  const updateLine = useCallback(
    (idx: number, patch: Partial<SizewisePOLine>) => {
      setLines(prev =>
        prev.map((line, i) => {
          if (i !== idx) return line;
          const merged = { ...line, ...patch };
          const totalQty = sizes.reduce((s, sz) => s + (merged.sizeQuantities[sz] || 0), 0);
          const netValue = totalQty * (merged.rate || 0);
          return { ...merged, totalQty, netValue };
        })
      );
    },
    [sizes]
  );

  const updateSizeQty = useCallback(
    (lineIdx: number, sz: string, qty: number) => {
      setLines(prev =>
        prev.map((line, i) => {
          if (i !== lineIdx) return line;
          const sizeQuantities = { ...line.sizeQuantities, [sz]: qty };
          const totalQty = sizes.reduce((s, s2) => s + (sizeQuantities[s2] || 0), 0);
          const netValue = totalQty * (line.rate || 0);
          return { ...line, sizeQuantities, totalQty, netValue };
        })
      );
    },
    [sizes]
  );

  const addBlankRow = useCallback(() => {
    setLines(prev => [
      ...prev,
      buildBlankLine(prev.length, sizes, header.deliveryDate, header.commonTaxPercent),
    ]);
  }, [sizes, header.deliveryDate, header.commonTaxPercent]);

  const deleteRow = useCallback((idx: number) => {
    setLines(prev =>
      prev
        .filter((_, i) => i !== idx)
        .map((l, i) => ({ ...l, sNo: i + 1, id: `sw-line-${i + 1}` }))
    );
  }, []);

  const handleScaleChange = useCallback((newScaleKey: string) => {
    setSelectedScaleKey(newScaleKey);
    const newSizes = SIZE_SCALE_PRESETS[newScaleKey]?.sizes || DEFAULT_SIZEWISE_SIZES;
    setSizes(newSizes);
    setLines(prev =>
      prev.map(line => {
        const newSizeQuantities: Record<string, number> = {};
        newSizes.forEach(sz => {
          newSizeQuantities[sz] = line.sizeQuantities[sz] || 0;
        });
        const totalQty = newSizes.reduce((s, sz) => s + (newSizeQuantities[sz] || 0), 0);
        const netValue = totalQty * (line.rate || 0);
        return {
          ...line,
          sizeQuantities: newSizeQuantities,
          totalQty,
          netValue,
        };
      })
    );
  }, []);

  const populateProductToLine = useCallback(
    (product: Product, rowIdx: number) => {
      const isFootwear =
        product.category?.toLowerCase() === "footwear" ||
        product.unit?.toLowerCase() === "pair" ||
        /shoe|sneaker|slip-on|sandal|boot|footwear|heel|loafer/i.test(product.name || "") ||
        /shoe|sneaker|boot|footwear/i.test(product.category || "");

      const rate = product.costPrice || product.price || 0;
      const taxPercent = isFootwear ? getFootwearGstRate(rate) : (product.gstPercentage ?? product.taxRate ?? header.commonTaxPercent ?? 18);
      const unit = isFootwear ? "Pair" : (product.unit || "Pcs");

      let currentSizes = sizes;
      if (isFootwear && selectedScaleKey === "APPAREL_ALPHA") {
        const fwSizes = SIZE_SCALE_PRESETS.FOOTWEAR_EU.sizes;
        setSelectedScaleKey("FOOTWEAR_EU");
        setSizes(fwSizes);
        currentSizes = fwSizes;
      }

      setLines(prev =>
        prev.map((line, i) => {
          const baseLine =
            i === rowIdx
              ? {
                  ...line,
                  itemCode: product.code || product.id,
                  barcode: product.barcode || "",
                  product: product.name,
                  brand: product.brand || "",
                  style: product.styleCode || "",
                  shade: product.color || "",
                  unit,
                  rate,
                  taxPercent,
                  stockOnHand: product.stock || 0,
                  originalProduct: product,
                }
              : line;

          const sizeQuantities: Record<string, number> = {};
          currentSizes.forEach(sz => {
            sizeQuantities[sz] = baseLine.sizeQuantities[sz] || 0;
          });
          const totalQty = currentSizes.reduce((s, sz) => s + (sizeQuantities[sz] || 0), 0);
          const netValue = totalQty * (baseLine.rate || 0);
          return {
            ...baseLine,
            sizeQuantities,
            totalQty,
            netValue,
          };
        })
      );
    },
    [sizes, selectedScaleKey, header.commonTaxPercent]
  );

  // Barcode/search lookup
  const handleBarcodeSearch = (query: string) => {
    if (!query.trim()) return;
    const q = query.trim().toLowerCase();
    const found = products.find(
      p =>
        (p.barcode && p.barcode.toLowerCase() === q) ||
        (p.code && p.code.toLowerCase() === q) ||
        (p.name && p.name.toLowerCase().includes(q))
    );
    if (found) {
      let targetIdx = lines.findIndex(l => !l.itemCode && l.totalQty === 0);
      if (targetIdx === -1) {
        targetIdx = lines.length;
        addBlankRow();
      }
      setActiveRowIndex(targetIdx);
      populateProductToLine(found, targetIdx);
      setToolbarSearch("");
    } else {
      onNotification?.("Not Found", `No item matching "${query}". Press F2 to browse.`, "warning");
    }
  };

  const handleSelectProduct = useCallback(
    (product: Product) => {
      populateProductToLine(product, activeRowIndex);
      setShowBrowseModal(false);
    },
    [activeRowIndex, populateProductToLine]
  );

  // ── Copy Previous PO ──────────────────────────────────────────────────
  const handleCopyPreviousPO = async () => {
    try {
      const res = await apiFetchV1("/purchase/orders/?page=1&page_size=1&sort=created_at&order=desc");
      const list = Array.isArray(res) ? res : res?.items || [];
      const po = list[0];
      if (!po) {
        onNotification?.("No History", "No previous purchase orders found.", "info");
        return;
      }
      onNotification?.("Copied", `Items copied from PO ${po.order_no || "previous"}.`, "info");
    } catch {
      onNotification?.("Error", "Failed to load previous PO.", "error");
    }
  };

  // ── Import Excel (CSV parse) ───────────────────────────────────────────
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = text.split("\n").filter(Boolean);
      const data = rows.slice(1).map(r => r.split(","));
      const importedLines: SizewisePOLine[] = data
        .filter(cols => cols[0]?.trim())
        .map((cols, i) => {
          const sizeQtys = sizes.reduce<Record<string, number>>((acc, sz, si) => {
            acc[sz] = parseInt(cols[2 + si] || "0", 10) || 0;
            return acc;
          }, {});
          const totalQty = sizes.reduce((s, sz) => s + (sizeQtys[sz] || 0), 0);
          const rate = parseFloat(cols[2 + sizes.length] || "0") || 0;
          return {
            id: `sw-import-${i + 1}`,
            sNo: i + 1,
            itemCode: cols[0]?.trim() || "",
            barcode: "",
            product: cols[1]?.trim() || "",
            brand: "",
            style: "",
            shade: "",
            unit: "Pcs",
            sizeQuantities: sizeQtys,
            totalQty,
            rate,
            stockOnHand: 0,
            taxPercent: header.commonTaxPercent,
            netValue: totalQty * rate,
            deliveryDate: header.deliveryDate,
          };
        });
      if (importedLines.length > 0) {
        setLines(prev => {
          const filled = prev.filter(l => l.itemCode);
          return [...filled, ...importedLines];
        });
        onNotification?.("Import Complete", `Imported ${importedLines.length} items.`, "success");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Save PO ───────────────────────────────────────────────────────────
  const handleSavePO = async (mode: "draft" | "confirm") => {
    const activeLines = lines.filter(l => l.itemCode && l.totalQty > 0);
    if (!header.supplierId) {
      onNotification?.("Supplier Required", "Please select a supplier.", "error");
      return;
    }
    if (activeLines.length === 0) {
      onNotification?.("No Items", "Add at least one line item with size quantities.", "error");
      return;
    }
    setSaving(true);
    try {
      const orderNo = `${header.prefix.trim()}-${header.orderNumber.trim()}`;
      const payload = {
        order_no: orderNo,
        order_date: header.orderDate,
        supplier_id: header.supplierId,
        delivery_date: header.deliveryDate,
        status: mode === "confirm" ? "confirmed" : "draft",
        notes: [
          header.specialInstructions && `Instructions: ${header.specialInstructions}`,
          header.paymentTerms && `Payment: ${header.paymentTerms}`,
          header.freightCharges && `Freight: ${header.freightCharges}`,
          header.supplierReference && `Ref: ${header.supplierReference}`,
          header.remarks && `Remarks: ${header.remarks}`,
          header.internalNotes && `Internal: ${header.internalNotes}`,
        ]
          .filter(Boolean)
          .join(" | "),
        items: activeLines.map(l => ({
          product_ref: l.itemCode,
          product_name: l.product,
          quantity: l.totalQty,
          rate: l.rate,
          tax_percent: l.taxPercent,
          total_value: l.netValue,
          size_quantities: l.sizeQuantities,
          delivery_date: l.deliveryDate,
          unit: l.unit,
        })),
      };

      const res = await apiFetchV1("/purchase/orders/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res?.id || res?.order_no) {
        setSavedOrderNo(res.order_no || orderNo);
        onNotification?.(
          mode === "confirm" ? "PO Confirmed" : "Draft Saved",
          `Purchase Order ${res.order_no || orderNo} ${mode === "confirm" ? "confirmed" : "saved as draft"} successfully.`,
          "success"
        );
      }
    } catch (err: any) {
      if (err?.status === 409) {
        setDuplicateOrderNo(`${header.prefix.trim()}-${header.orderNumber.trim()}`);
        setSuggestedOrderNo(err?.body?.suggested_number || null);
        onNotification?.("Duplicate PO Number", "This PO number already exists. Please use the suggested number.", "error");
      } else {
        onNotification?.("Save Failed", err?.message || "Failed to save purchase order.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Computed totals ───────────────────────────────────────────────────
  const { perSizeTotals, grandTotalQty, grossValue, totalTax, netOrderValue, totalItems, sizePercents } =
    useMemo(
      () => calculateSizewiseSummaryTotals(lines, sizes, header.freightAmount, header.otherCharges),
      [lines, sizes, header.freightAmount, header.otherCharges]
    );

  const activeLineCount = useMemo(() => lines.filter(l => l.itemCode && l.totalQty > 0).length, [lines]);
  const selectedSupplier = useMemo(() => suppliersList.find(s => s.id === header.supplierId), [suppliersList, header.supplierId]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSavePO("draft");
      }
      if (e.key === "F4") {
        e.preventDefault();
        updateLine(activeRowIndex, {
          itemCode: "",
          product: "",
          sizeQuantities: sizes.reduce<Record<string, number>>((a, s) => { a[s] = 0; return a; }, {}),
          totalQty: 0,
          netValue: 0,
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeRowIndex, sizes]);

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-50 text-xs font-sans" role="main">

      {/* ── 1. PO Header Bar ──────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-white text-[18px]">shopping_cart</span>
              </div>
              <div>
                <h1 className="font-extrabold text-slate-800 text-base leading-none">Purchase Order</h1>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {header.prefix}-{header.orderNumber} · {header.orderDate}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Draft
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[12px]">straighten</span>
              Sizewise
            </span>
          </div>
          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <button type="button" className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition text-xs shadow-2xs">
              <span className="material-symbols-outlined text-[16px] text-blue-500">add</span> New
            </button>
            <button type="button" className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition text-xs shadow-2xs">
              <span className="material-symbols-outlined text-[16px] text-slate-500">folder_open</span> Open
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSavePO("draft")}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition text-xs shadow-2xs disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-500">save</span>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition text-xs shadow-2xs">
              <span className="material-symbols-outlined text-[16px] text-slate-500">print</span> Print
            </button>
            <button type="button" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 px-2 py-1.5 rounded-lg transition text-xs shadow-2xs">
              <span className="material-symbols-outlined text-[16px]">more_vert</span>
            </button>
          </div>
        </div>

        {/* Document meta fields */}
        <div className="flex items-end flex-wrap gap-3">
          {/* Type */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Type</label>
            <select
              value={header.documentType}
              onChange={e => setHeader(h => ({ ...h, documentType: e.target.value }))}
              className="border border-slate-300 rounded-lg px-2.5 h-7 bg-white outline-none focus:border-indigo-500 font-medium text-xs min-w-[140px]"
            >
              <option>Purchase Order</option>
              <option>Indent</option>
            </select>
          </div>
          {/* Prefix */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Prefix</label>
            <input
              type="text"
              value={header.prefix}
              onChange={e => setHeader(h => ({ ...h, prefix: e.target.value }))}
              className="border border-slate-300 rounded-lg px-2 h-7 w-14 bg-white font-mono font-bold outline-none focus:border-indigo-500 text-center text-xs"
            />
          </div>
          {/* Number */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Number</label>
            <input
              type="text"
              value={header.orderNumber}
              onChange={e => setHeader(h => ({ ...h, orderNumber: e.target.value }))}
              className="border border-slate-300 rounded-lg px-2 h-7 w-20 bg-white font-mono font-bold outline-none focus:border-indigo-500 text-xs"
            />
          </div>
          {/* Date */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Date</label>
            <input
              type="date"
              value={header.orderDate}
              onChange={e => {
                const orderDate = e.target.value;
                setHeader(h => ({
                  ...h,
                  orderDate,
                  deliveryDate: addDaysToDate(orderDate, h.leadTimeDays),
                }));
              }}
              className="border border-slate-300 rounded-lg px-2 h-7 bg-white font-mono outline-none focus:border-indigo-500 text-xs"
            />
          </div>
          {/* Supplier */}
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">
              Supplier <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={header.supplierId}
                disabled={suppliersLoading}
                onChange={e => {
                  const sel = suppliersList.find(s => s.id === e.target.value);
                  setHeader(h => ({ ...h, supplierId: e.target.value, supplierName: sel?.name || "" }));
                }}
                className="w-full border border-slate-300 rounded-lg pl-2.5 pr-7 h-7 bg-white outline-none focus:border-indigo-500 font-medium text-xs appearance-none"
              >
                {suppliersList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[15px] pointer-events-none">search</span>
            </div>
          </div>
          {/* Delivery Date */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Delivery Date</label>
            <input
              type="date"
              value={header.deliveryDate}
              onChange={e => setHeader(h => ({ ...h, deliveryDate: e.target.value }))}
              className="border border-slate-300 rounded-lg px-2 h-7 bg-white font-mono outline-none focus:border-indigo-500 text-xs"
            />
          </div>
          {/* Lead Time */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Lead Time</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="1"
                list="sw-lead-time-opts"
                value={header.leadTimeDays}
                onChange={e => {
                  const leadTimeDays = Math.max(0, parseInt(e.target.value, 10) || 0);
                  setHeader(h => ({ ...h, leadTimeDays, deliveryDate: addDaysToDate(h.orderDate, leadTimeDays) }));
                }}
                className="border border-slate-300 rounded-lg px-2 h-7 w-14 bg-white font-semibold font-mono outline-none focus:border-indigo-500 text-xs"
              />
              <datalist id="sw-lead-time-opts">
                {LEAD_TIME_OPTIONS.map(d => <option key={d} value={d} />)}
              </datalist>
              <span className="text-slate-500 font-medium">Days</span>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <nav className="flex items-center gap-6 mt-3 pt-2 border-t border-slate-100 text-xs">
          {[
            { id: "items", label: `1. Items`, icon: "list_alt" },
            { id: "delivery", label: "2. Delivery & Tax", icon: "local_shipping" },
            { id: "other", label: "3. Other Details", icon: "description" },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 pb-1.5 font-semibold transition-all relative ${
                activeTab === tab.id
                  ? "text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* ── 2. ITEMS TAB ─────────────────────────────────────────────────── */}
      {activeTab === "items" && (
        <div className="flex flex-col flex-1 min-h-0">

          {/* ── Toolbar ── */}
          <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0">
            {/* Scan / Search */}
            <div className="relative flex items-center min-w-[260px]">
              <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[15px]">barcode_scanner</span>
              <input
                ref={toolbarSearchRef}
                type="text"
                value={toolbarSearch}
                onChange={e => setToolbarSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); handleBarcodeSearch(toolbarSearch); }
                }}
                placeholder="Scan Barcode / Search Item (F2)"
                className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-500 shadow-2xs"
              />
              {toolbarSearch && (
                <button type="button" onClick={() => setToolbarSearch("")} className="absolute right-2 text-slate-400 hover:text-slate-600 text-sm">×</button>
              )}
            </div>

            {/* Add Item */}
            <button
              type="button"
              onClick={addBlankRow}
              className="flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px] text-indigo-500">add</span>
              Add Item
            </button>

            {/* Import from Excel */}
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-600">table_view</span>
              Import from Excel
            </button>
            <input ref={excelInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleExcelImport} className="hidden" />

            {/* Copy Previous PO */}
            <button
              type="button"
              onClick={handleCopyPreviousPO}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px] text-blue-500">content_copy</span>
              Copy Previous PO
            </button>

            {/* Delete Row */}
            <button
              type="button"
              onClick={() => deleteRow(activeRowIndex)}
              className="flex items-center gap-1.5 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-600 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              Delete Row
            </button>

            {/* Size Scale Selector */}
            <div className="flex items-center gap-1.5 bg-indigo-50/80 border border-indigo-200 px-2.5 py-1 rounded-lg">
              <span className="material-symbols-outlined text-[15px] text-indigo-600">straighten</span>
              <span className="text-slate-600 font-bold text-xs whitespace-nowrap">Size Scale:</span>
              <select
                id="sw-size-scale-select"
                value={selectedScaleKey}
                onChange={e => handleScaleChange(e.target.value)}
                className="bg-white border border-indigo-200 rounded px-2 py-0.5 text-xs font-bold text-indigo-900 outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                {Object.entries(SIZE_SCALE_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1" />

            {/* Price List */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium whitespace-nowrap">Price List</span>
              <select
                value={header.priceList}
                onChange={e => setHeader(h => ({ ...h, priceList: e.target.value }))}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-2xs"
              >
                {PRICE_LIST_OPTIONS.map(pl => (
                  <option key={pl} value={pl}>{pl}</option>
                ))}
              </select>
            </div>

            {/* Item Finder */}
            <button
              type="button"
              onClick={() => setShowBrowseModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">manage_search</span>
              Item Finder
            </button>
          </div>

          {/* ── Grid ── */}
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-xs min-w-[1100px]" id="sw-items-grid">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-300">
                <tr>
                  <th className="p-2 w-8 text-center border-r border-slate-200 bg-slate-200">#</th>
                  <th className="p-2 min-w-[100px] border-r border-slate-200">Item Code</th>
                  {/* Product Description merges Brand/Style/Shade sub-row */}
                  <th className="p-2 min-w-[180px] border-r border-slate-200">
                    Product Description
                    <div className="text-[9px] text-slate-400 font-normal normal-case tracking-normal mt-0.5">Brand / Style / Shade</div>
                  </th>
                  {/* Size columns group header */}
                  <th
                    colSpan={sizes.length + 1}
                    className="p-1 text-center border-r border-slate-200 bg-indigo-50 text-indigo-700"
                  >
                    Size-wise Order Quantity
                  </th>
                  <th className="p-2 min-w-[80px] text-right border-r border-slate-200">Rate (₹)</th>
                  <th className="p-2 min-w-[70px] text-right border-r border-slate-200">Stock On Hand</th>
                  <th className="p-2 min-w-[55px] text-right border-r border-slate-200">Tax %</th>
                  <th className="p-2 min-w-[90px] text-right border-r border-slate-200 bg-slate-50 font-bold text-slate-800">Net Value (₹)</th>
                  <th className="p-2 min-w-[110px] text-center border-r border-slate-200">Delivery Date</th>
                  <th className="p-2 min-w-[80px] text-center">Action</th>
                </tr>
                {/* Size sub-headers */}
                <tr className="bg-indigo-50 border-b border-slate-200">
                  {/* spacers for fixed left cols */}
                  <td className="border-r border-slate-200 bg-slate-200" />
                  <td className="border-r border-slate-200" />
                  <td className="border-r border-slate-200" />
                  {/* size labels */}
                  {sizes.map(sz => (
                    <th key={sz} className="p-1.5 text-center font-bold font-mono text-indigo-800 border-r border-slate-200 w-14 text-[11px]">
                      {sz}
                    </th>
                  ))}
                  <th className="p-1.5 text-center font-bold text-indigo-800 border-r border-slate-200 text-[11px] bg-indigo-100">
                    Total
                  </th>
                  {/* spacers for right cols */}
                  <td className="border-r border-slate-200" />
                  <td className="border-r border-slate-200" />
                  <td className="border-r border-slate-200" />
                  <td className="border-r border-slate-200 bg-slate-50" />
                  <td className="border-r border-slate-200" />
                  <td />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => {
                  const isActive = idx === activeRowIndex;
                  const hasItem = !!line.itemCode;
                  return (
                    <tr
                      key={line.id}
                      onClick={() => setActiveRowIndex(idx)}
                      className={`transition-colors cursor-pointer ${
                        isActive
                          ? "bg-indigo-50/70"
                          : hasItem
                          ? "hover:bg-slate-50"
                          : "hover:bg-slate-50/60 opacity-75 hover:opacity-100"
                      }`}
                    >
                      {/* # */}
                      <td className="p-2 text-center text-slate-400 font-mono font-medium border-r border-slate-100 bg-slate-50/50 text-[11px]">
                        {line.sNo}
                      </td>

                      {/* Item Code */}
                      <td className="p-1 border-r border-slate-100">
                        <input
                          type="text"
                          id={`sw-itemcode-${idx}`}
                          value={line.itemCode}
                          placeholder="F2 / Scan"
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={e => updateLine(idx, { itemCode: e.target.value })}
                          className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded px-2 h-7 font-mono font-bold text-xs outline-none"
                        />
                      </td>

                      {/* Product Description */}
                      <td className="p-1 border-r border-slate-100">
                        <input
                          type="text"
                          value={line.product}
                          placeholder="Product name"
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={e => updateLine(idx, { product: e.target.value })}
                          className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded px-2 h-6 font-medium text-xs outline-none"
                        />
                        <div className="px-2 text-[10px] text-slate-400 leading-tight truncate flex items-center justify-between">
                          <span className="truncate">
                            {[line.brand, line.style, line.shade].filter(Boolean).join(" / ") || <span className="italic">Brand / Style / Shade</span>}
                          </span>
                          {line.unit && (
                            <span className="font-mono text-indigo-700 font-bold uppercase text-[9px] bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded ml-1 shrink-0">
                              {line.unit}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Size qty cells */}
                      {sizes.map(sz => (
                        <td key={sz} className="p-0 border-r border-slate-100 text-center w-14">
                          <input
                            type="number"
                            min="0"
                            id={`sw-qty-${idx}-${sz}`}
                            value={line.sizeQuantities[sz] || ""}
                            placeholder="–"
                            onFocus={() => setActiveRowIndex(idx)}
                            onChange={e => updateSizeQty(idx, sz, parseInt(e.target.value, 10) || 0)}
                            className={`w-full bg-transparent border-none text-center h-8 font-mono font-bold text-xs outline-none focus:bg-indigo-50 ${
                              (line.sizeQuantities[sz] || 0) > 0 ? "text-indigo-700" : "text-slate-300"
                            }`}
                          />
                        </td>
                      ))}

                      {/* Total Qty */}
                      <td className="p-2 text-center font-mono font-extrabold text-indigo-600 bg-indigo-50/60 border-r border-slate-100 text-sm">
                        {line.totalQty || "–"}
                      </td>

                      {/* Rate */}
                      <td className="p-1 border-r border-slate-100 text-right">
                        <input
                          type="number"
                          min="0"
                          value={line.rate || ""}
                          placeholder="0.00"
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={e => updateLine(idx, { rate: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded px-2 h-7 font-mono font-bold text-xs text-right outline-none"
                        />
                      </td>

                      {/* Stock On Hand */}
                      <td className="p-2 text-right font-mono text-slate-500 border-r border-slate-100 text-[11px]">
                        {line.stockOnHand > 0 ? line.stockOnHand.toLocaleString("en-IN") : "–"}
                      </td>

                      {/* Tax % */}
                      <td className="p-1 border-r border-slate-100 text-right">
                        <input
                          type="number"
                          min="0"
                          value={line.taxPercent ?? 18}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={e => updateLine(idx, { taxPercent: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-transparent border-none text-right px-1 h-6 font-mono text-xs outline-none"
                        />
                      </td>

                      {/* Net Value */}
                      <td className="p-2 px-3 text-right font-mono font-bold text-slate-800 bg-slate-50/50 border-r border-slate-100">
                        {line.netValue > 0
                          ? line.netValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : "–"}
                      </td>

                      {/* Delivery Date */}
                      <td className="p-1 border-r border-slate-100 text-center">
                        <input
                          type="date"
                          value={line.deliveryDate}
                          onFocus={() => setActiveRowIndex(idx)}
                          onChange={e => updateLine(idx, { deliveryDate: e.target.value })}
                          className="w-full bg-transparent border-none text-center h-6 font-mono text-[10px] outline-none focus:bg-indigo-50 rounded"
                        />
                      </td>

                      {/* Action */}
                      <td className="p-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="View / Edit"
                            onClick={e => { e.stopPropagation(); setActiveRowIndex(idx); setShowBrowseModal(true); }}
                            className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold border border-indigo-300 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            <span className="material-symbols-outlined text-[13px]">visibility</span>
                            View
                          </button>
                          <button
                            type="button"
                            title="Delete row"
                            onClick={e => { e.stopPropagation(); deleteRow(idx); }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Footer totals row */}
                <tr className="bg-indigo-100/70 border-t-2 border-indigo-300 font-bold">
                  <td className="p-2 text-center text-slate-500 border-r border-indigo-200" />
                  <td className="p-2 border-r border-indigo-200">
                    <button
                      type="button"
                      onClick={addBlankRow}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold text-xs"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      Add Item
                    </button>
                  </td>
                  <td className="p-2 text-right font-bold text-slate-700 border-r border-indigo-200">
                    Total Qty
                  </td>
                  {sizes.map(sz => (
                    <td key={sz} className="p-2 text-center font-mono font-extrabold text-indigo-800 border-r border-indigo-200 text-sm">
                      {perSizeTotals[sz] || 0}
                    </td>
                  ))}
                  {/* Grand Total */}
                  <td className="p-2 text-center font-mono font-extrabold text-indigo-900 bg-indigo-200 border-r border-indigo-300 text-base">
                    {grandTotalQty}
                  </td>
                  <td colSpan={5} className="p-2 text-right text-indigo-700 border-r border-indigo-200 text-xs pr-3">
                    Net Order Value:&nbsp;
                    <span className="text-indigo-900 font-extrabold text-base">
                      ₹{netOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Bottom panels ── */}
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">

              {/* Panel 1: Size-wise Summary */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">bar_chart</span>
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Size-wise Summary (All Items)
                  </h3>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 font-semibold">
                      <td className="py-1">Size</td>
                      {sizes.map(sz => (
                        <td key={sz} className="py-1 text-center font-mono font-bold text-indigo-700">{sz}</td>
                      ))}
                      <td className="py-1 text-center font-bold text-slate-700">Total</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-500 font-medium">Total Qty</td>
                      {sizes.map(sz => (
                        <td key={sz} className="py-1.5 text-center font-mono font-bold text-slate-800">
                          {perSizeTotals[sz] || 0}
                        </td>
                      ))}
                      <td className="py-1.5 text-center font-mono font-extrabold text-indigo-700 text-sm">
                        {grandTotalQty}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-500 font-medium">% of Total</td>
                      {sizes.map(sz => (
                        <td key={sz} className="py-1.5 text-center font-mono text-slate-600 text-[11px]">
                          {sizePercents[sz]}
                        </td>
                      ))}
                      <td className="py-1.5 text-center font-mono font-bold text-slate-700">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Panel 2: Item Summary */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">calculate</span>
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Item Summary</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Total Items", value: totalItems.toString() },
                    { label: "Total Order Qty", value: grandTotalQty.toString() },
                    {
                      label: "Gross Value (₹)",
                      value: grossValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    },
                    {
                      label: "Total Tax (₹)",
                      value: totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-mono font-bold text-slate-800">{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 bg-yellow-50/80 px-2 py-1.5 rounded-lg">
                    <span className="font-bold text-slate-800">Net PO Value (₹)</span>
                    <span className="font-extrabold text-indigo-700 text-base font-mono">
                      ₹{netOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel 3: Remarks */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">edit_note</span>
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Remarks</h3>
                </div>
                <textarea
                  rows={3}
                  value={header.remarks}
                  onChange={e => setHeader(h => ({ ...h, remarks: e.target.value }))}
                  placeholder="Add remarks for supplier (e.g. Regular Purchase for Q1 stock)"
                  className="flex-1 border border-slate-200 rounded-lg p-2 bg-slate-50/50 outline-none focus:border-indigo-500 text-xs resize-none"
                />
                <div className="mt-2">
                  <label className="block text-[10px] text-slate-400 font-medium mb-1">Internal Notes (Not Printed)</label>
                  <textarea
                    rows={2}
                    value={header.internalNotes}
                    onChange={e => setHeader(h => ({ ...h, internalNotes: e.target.value }))}
                    placeholder="Internal notes visible only to staff"
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50/50 outline-none focus:border-indigo-500 text-xs resize-none text-slate-500 italic"
                  />
                </div>
              </div>
            </div>

            {/* Attach Documents footer row */}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 font-medium transition"
                onClick={() => onNotification?.("Attachments", "Use the Attachments tab to upload documents.", "info")}
              >
                <span className="material-symbols-outlined text-[16px]">attach_file</span>
                Attach Documents (0)
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                {activeLineCount} item{activeLineCount !== 1 ? "s" : ""} · {grandTotalQty} units ·
                Mode: Sizewise
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. DELIVERY & TAX TAB ─────────────────────────────────────────── */}
      {activeTab === "delivery" && (
        <section className="px-6 py-5 max-w-2xl space-y-4 text-xs overflow-y-auto flex-1">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-800 text-sm mb-2">Delivery Details</h3>
            <div>
              <label className="block font-medium text-slate-500 mb-1">Delivery Location / Store</label>
              <input
                type="text"
                value={header.deliveryLocation}
                onChange={e => setHeader(h => ({ ...h, deliveryLocation: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white outline-none focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-500 mb-1">Common Tax %</label>
                <input
                  type="number"
                  min="0"
                  value={header.commonTaxPercent}
                  onChange={e => {
                    const v = parseFloat(e.target.value) || 0;
                    setHeader(h => ({ ...h, commonTaxPercent: v }));
                    setLines(prev => prev.map(l => ({ ...l, taxPercent: v })));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Freight Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={header.freightAmount}
                  onChange={e => setHeader(h => ({ ...h, freightAmount: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-500 mb-1">Other Charges (₹)</label>
              <input
                type="number"
                min="0"
                value={header.otherCharges}
                onChange={e => setHeader(h => ({ ...h, otherCharges: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white font-mono font-bold outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── 4. OTHER DETAILS TAB ──────────────────────────────────────────── */}
      {activeTab === "other" && (
        <section className="px-6 py-5 max-w-2xl space-y-4 text-xs overflow-y-auto flex-1">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-800 text-sm mb-2">Commercial Terms</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-500 mb-1">Payment Terms</label>
                <select
                  value={header.paymentTerms}
                  onChange={e => setHeader(h => ({ ...h, paymentTerms: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white font-medium outline-none focus:border-indigo-500"
                >
                  <option>Immediate</option>
                  <option>15 Days</option>
                  <option>30 Days</option>
                  <option>45 Days</option>
                  <option>60 Days</option>
                  <option>Cash on Delivery</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Freight Terms</label>
                <input
                  type="text"
                  value={header.freightCharges}
                  onChange={e => setHeader(h => ({ ...h, freightCharges: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Currency</label>
                <select
                  value={header.currency}
                  onChange={e => setHeader(h => ({ ...h, currency: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white font-medium outline-none focus:border-indigo-500"
                >
                  <option value="INR - Indian Rupee">INR - Indian Rupee</option>
                  <option value="USD - US Dollar">USD - Dollar</option>
                  <option value="EUR - Euro">EUR - Euro</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Supplier Reference</label>
                <input
                  type="text"
                  value={header.supplierReference}
                  onChange={e => setHeader(h => ({ ...h, supplierReference: e.target.value }))}
                  placeholder="Supplier PO / Quotation No."
                  className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Buyer</label>
                <input
                  type="text"
                  value={header.buyer}
                  onChange={e => setHeader(h => ({ ...h, buyer: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-500 mb-1">Department</label>
                <input
                  type="text"
                  value={header.department}
                  onChange={e => setHeader(h => ({ ...h, department: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 h-8 bg-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-500 mb-1">Special Instructions</label>
              <textarea
                rows={3}
                value={header.specialInstructions}
                onChange={e => setHeader(h => ({ ...h, specialInstructions: e.target.value }))}
                placeholder="Add special instructions for the supplier…"
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── 409 Duplicate Banner ────────────────────────────────────────── */}
      {duplicateOrderNo && (
        <aside className="mx-5 mb-3 bg-amber-50 border border-amber-300 px-4 py-2 rounded-xl flex items-center gap-3 text-xs shrink-0">
          <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
          <span className="text-amber-900 font-medium">
            Purchase Order <strong>{duplicateOrderNo}</strong> already exists.
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
              className="ml-2 bg-blue-600 text-white font-bold px-3 py-1 rounded text-xs hover:bg-blue-700 transition"
            >
              Use {suggestedOrderNo}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setDuplicateOrderNo(null); setSuggestedOrderNo(null); }}
            className="ml-auto text-amber-700 hover:text-amber-900 font-bold text-sm"
          >
            ×
          </button>
        </aside>
      )}

      {/* ── Post-save Modal ─────────────────────────────────────────────── */}
      {savedOrderNo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[480px] max-w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">check_circle</span>
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-base">Purchase Order Saved</h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{savedOrderNo} committed successfully.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { icon: "add_circle", label: "Create Another", color: "blue", action: () => { setSavedOrderNo(null); setLines(Array.from({ length: DEFAULT_BLANK_ROWS }, (_, i) => buildBlankLine(i, sizes, header.deliveryDate, header.commonTaxPercent))); } },
                { icon: "local_shipping", label: "Receive GRN", color: "emerald", action: () => { setSavedOrderNo(null); onNavigateTab?.("grn-studio"); } },
                { icon: "print", label: "Print PO", color: "amber", action: () => { setSavedOrderNo(null); window.print(); } },
              ].map(btn => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={btn.action}
                  className={`flex flex-col items-center justify-center gap-1.5 bg-${btn.color}-50 hover:bg-${btn.color}-100 border border-${btn.color}-200 rounded-xl py-3 px-2 font-bold text-xs text-${btn.color}-700 transition`}
                >
                  <span className="material-symbols-outlined text-[22px]">{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setSavedOrderNo(null)} className="text-xs text-slate-400 hover:text-slate-600 underline self-center">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Action Footer ───────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-lg sticky bottom-0 z-20 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg px-4 py-1.5 font-bold transition shadow-2xs"
          >
            Cancel
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-mono">
            {selectedSupplier ? selectedSupplier.name : "No supplier"} ·
            {activeLineCount} item{activeLineCount !== 1 ? "s" : ""} ·
            {grandTotalQty} units
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSavePO("draft")}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg px-4 py-1.5 font-bold transition shadow-2xs disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSavePO("confirm")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-1.5 font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Save &amp; Confirm
          </button>
        </div>
      </footer>

      {/* ── Product Browse Modal ─────────────────────────────────────────── */}
      <PurchBrowseDlg
        products={products}
        isOpen={showBrowseModal}
        onClose={() => setShowBrowseModal(false)}
        onSelectProduct={handleSelectProduct}
        vendorId={header.supplierId || undefined}
        transactionDate={header.orderDate || undefined}
      />
    </div>
  );
};

export default PoSizewiseTab;
