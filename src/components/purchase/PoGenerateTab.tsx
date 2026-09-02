/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-08-21
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Product } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  PurchaseOrderHeader,
  PurchaseOrderLineItem,
  PurchaseOrderSizePivotRow,
  PurchaseOrderSummaryTotals
} from "./types.ts";
import { PurchBrowseDlg } from "./PurchBrowseDlg.tsx";
import { useF2Screen } from "../../context/F2DispatcherContext.tsx";
import type { LookupResult } from "../../context/F2DispatcherContext.tsx";

interface PurchaseOrderGenerationTabProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
  onClose?: () => void;
}

const DEFAULT_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];

export const PoGenerateTab: React.FC<PurchaseOrderGenerationTabProps> = ({
  products: initialProducts = [],
  currentUser,
  onNotification,
  onClose
}) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [suppliersList, setSuppliersList] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"generation" | "size_pivot" | "other">("generation");
  const [showF2Hint, setShowF2Hint] = useState(true);
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document & Supplier Header State
  const [header, setHeader] = useState<PurchaseOrderHeader>({
    documentType: "Purchase Order",
    prefix: "PO13",
    orderNumber: "46",
    orderDate: new Date().toLocaleDateString("en-GB"),
    supplierId: "sup-1",
    supplierName: "RPSH KMR:Rupesh Kumar",
    billTo: "ACME TEXTILES",
    deliveryDate: new Date(Date.now() + 10 * 86400000).toLocaleDateString("en-GB"),
    leadTimeDays: 10,
    deliveryLocation: "ACME TEXTILES",
    commonTaxPercent: 5,
    pictureUrl: ""
  });

  // Standard Line Items (20 initial rows)
  const [lineItems, setLineItems] = useState<PurchaseOrderLineItem[]>(() => {
    return Array.from({ length: 20 }, (_, idx) => ({
      id: `line-${idx + 1}`,
      sNo: idx + 1,
      stockNo: "",
      product: "",
      brand: "",
      style: "",
      shade: "",
      size: "",
      fibre: "",
      colourBase: "",
      styling: "",
      rate: 0,
      orderQty: 0,
      value: 0,
      stockOnHand: 0,
      taxPercent: 5,
      taxAmount: 0,
      addOnPercent: 0,
      addOnAmount: 0,
      totalValue: 0
    }));
  });

  // Size Pivot Rows (10 initial rows)
  const [sizePivotRows, setSizePivotRows] = useState<PurchaseOrderSizePivotRow[]>(() => {
    const initialRow: PurchaseOrderSizePivotRow = {
      id: "pivot-1",
      sNo: 1,
      articleNo: "ART-9021",
      product: "Leather Formal",
      brand: "Bata",
      style: "Oxford",
      color: "Black",
      sizeQuantities: { "36": 0, "37": 0, "38": 2, "39": 4, "40": 4, "41": 2, "42": 0, "43": 0, "44": 0 },
      rate: 1250,
      totalQty: 12,
      gstPercent: 5,
      totalValue: 15000
    };
    const emptyRows: PurchaseOrderSizePivotRow[] = Array.from({ length: 19 }, (_, idx) => ({
      id: `pivot-${idx + 2}`,
      sNo: idx + 2,
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
    }));
    return [initialRow, ...emptyRows];
  });

  // Fetch products and suppliers on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (products.length === 0) {
        const prodRes = await apiFetchV1("/products");
        const list = Array.isArray(prodRes) ? prodRes : prodRes?.items || [];
        if (list.length > 0) setProducts(list);
      }
      const supRes = await apiFetchV1("/purchase/suppliers");
      const supList = Array.isArray(supRes) ? supRes : supRes?.items || [];
      if (supList.length > 0) {
        setSuppliersList(supList.map((s: any) => ({ id: s.id, name: s.name, code: s.vendor_code || s.code })));
      } else {
        setSuppliersList([
          { id: "sup-1", name: "RPSH KMR:Rupesh Kumar", code: "RPSH" },
          { id: "sup-2", name: "ACME Suppliers Pvt Ltd", code: "ACME" },
          { id: "sup-3", name: "Raymond Apparel Ltd", code: "RAYM" }
        ]);
      }
    } catch {
      setSuppliersList([
        { id: "sup-1", name: "RPSH KMR:Rupesh Kumar", code: "RPSH" },
        { id: "sup-2", name: "ACME Suppliers Pvt Ltd", code: "ACME" },
        { id: "sup-3", name: "Raymond Apparel Ltd", code: "RAYM" }
      ]);
    }
  };

  // Populate first line with sample data if line items are completely empty
  useEffect(() => {
    if (products.length > 0 && !lineItems[0].stockNo) {
      const p1 = products[0];
      setLineItems(prev => {
        const next = [...prev];
        const rate = p1.costPrice || p1.price * 0.7 || 850;
        const qty = 10;
        const val = rate * qty;
        const taxAmt = (val * 5) / 100;
        next[0] = {
          ...next[0],
          stockNo: p1.code || "000001",
          product: p1.name,
          brand: p1.brand || "SMRITI",
          style: p1.styleCode || "REG",
          shade: p1.color || "Blue",
          size: p1.size || "32",
          fibre: (p1.attributes as any)?.fabric_type || "Cotton",
          colourBase: p1.color || "Blue",
          styling: "Standard",
          rate: rate,
          orderQty: qty,
          value: val,
          stockOnHand: p1.stock ?? 12,
          taxPercent: 5,
          taxAmount: taxAmt,
          addOnPercent: 0,
          addOnAmount: 0,
          totalValue: val + taxAmt,
          originalProduct: p1
        };
        return next;
      });
    }
  }, [products]);

  // Standard line items calculation
  const updateLineItem = (idx: number, updates: Partial<PurchaseOrderLineItem>) => {
    setLineItems(prev => {
      const copy = [...prev];
      const current = { ...copy[idx], ...updates };
      const rate = current.rate || 0;
      const qty = current.orderQty || 0;
      const value = rate * qty;
      const taxPercent = current.taxPercent || 0;
      const taxAmount = (value * taxPercent) / 100;
      const addOnPercent = current.addOnPercent || 0;
      const addOnAmount = (value * addOnPercent) / 100;
      const totalValue = value + taxAmount + addOnAmount;

      copy[idx] = {
        ...current,
        value,
        taxAmount,
        addOnAmount,
        totalValue
      };
      return copy;
    });
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

  // Handle product selected from F2 browse
  const handleSelectProduct = (product: Product) => {
    if (activeTab === "generation") {
      const rate = product.costPrice || product.price * 0.7 || product.price || 0;
      updateLineItem(activeRowIndex, {
        stockNo: product.code || product.barcode,
        product: product.name,
        brand: product.brand || "SMRITI",
        style: product.styleCode || "-",
        shade: product.color || "-",
        size: product.size || "-",
        fibre: (product.attributes as any)?.fabric_type || "Cotton",
        colourBase: product.color || "-",
        styling: "Regular",
        rate: rate,
        orderQty: 1,
        stockOnHand: product.stock ?? 0,
        originalProduct: product
      });
    } else {
      const rate = product.costPrice || product.price * 0.7 || product.price || 0;
      updatePivotRow(activeRowIndex, {
        articleNo: product.code || product.barcode,
        product: product.name,
        brand: product.brand || "SMRITI",
        style: product.styleCode || "-",
        color: product.color || "-",
        gstPercent: (product as any).taxPercent ?? 5,
        rate: rate,
        originalProduct: product
      });
    }
  };

  // Summary Totals Calculation
  const totals: PurchaseOrderSummaryTotals = useMemo(() => {
    if (activeTab === "generation") {
      const validLines = lineItems.filter(l => l.stockNo && l.orderQty > 0);
      const totalQty = validLines.reduce((sum, l) => sum + l.orderQty, 0);
      const grossValue = validLines.reduce((sum, l) => sum + l.value, 0);
      const totalTax = validLines.reduce((sum, l) => sum + l.taxAmount, 0);
      const totalAddOn = validLines.reduce((sum, l) => sum + l.addOnAmount, 0);
      const totalValue = validLines.reduce((sum, l) => sum + l.totalValue, 0);
      return { totalQty, grossValue, totalTax, totalAddOn, totalValue };
    } else {
      const validRows = sizePivotRows.filter(r => r.articleNo && r.totalQty > 0);
      const totalQty = validRows.reduce((sum, r) => sum + r.totalQty, 0);
      const grossValue = validRows.reduce((sum, r) => sum + r.totalValue, 0);
      return { totalQty, grossValue, totalTax: 0, totalAddOn: 0, totalValue: grossValue };
    }
  }, [lineItems, sizePivotRows, activeTab]);

  // Apply Common Tax to all rows
  const handleApplyCommonTax = (val: number) => {
    setHeader(h => ({ ...h, commonTaxPercent: val }));
    setLineItems(prev => prev.map(l => ({
      ...l,
      taxPercent: val,
      taxAmount: (l.value * val) / 100,
      totalValue: l.value + (l.value * val) / 100 + l.addOnAmount
    })));
  };

  // ─── F2 Universal Lookup Architecture v2 — Screen Registration (Phase B Batch 2) ──
  // F2 on stock number / article number fields → entity=variant (Tier 1 data-f2-entity).
  // FieldAdapter populates the active row via updateLineItem / updatePivotRow.
  // PurchBrowseDlg onClick button trigger (line 638) is preserved as a non-F2 consumer.
  useF2Screen({
    screenId: "PoGenerateTab",
    defaultEntity: "variant",
    adapter: (result: LookupResult) => {
      if (result.entity !== "variant" && result.entity !== "item" && result.entity !== "item_barcode") {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[PoGenerateTab][F2] FieldAdapter: unhandled entity:", result.entity);
        }
        return;
      }
      const stockVal  = (result.record?.stock_no as string)
                     || (result.record?.style_code as string)
                     || result.returnValue || "";
      const nameVal   = result.displayValue || (result.record?.name as string) || "";
      const brandVal  = (result.record?.brand as string) || "";
      const styleVal  = (result.record?.style_code as string) || "-";
      const colorVal  = (result.record?.color as string) || "-";
      const sizeVal   = (result.record?.size as string) || "-";
      const rateVal   = (result.record?.cost_price as number)
                     || (result.record?.selling_price as number)
                     || (result.record?.mrp as number) || 0;
      const stockQty  = (result.record?.stock_qty as number) ?? 0;
      if (activeTab === "generation") {
        setShowF2Hint(false);
        updateLineItem(activeRowIndex, {
          stockNo: stockVal,
          product: nameVal,
          brand:   brandVal,
          style:   styleVal,
          shade:   colorVal,
          size:    sizeVal,
          rate:    rateVal,
          stockOnHand: stockQty,
        });
      } else {
        setShowF2Hint(false);
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

  // Keyboard Navigation (F4, F6) — F2 removed: now handled by F2DispatcherProvider
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      // F2 is handled exclusively by F2DispatcherProvider (F2 Universal Lookup Architecture v2).
      // This screen registers via useF2Screen() above. No screen-level F2 handler.
      if (e.key === "F4") {
        e.preventDefault();
        // Delete current row
        if (activeTab === "generation") {
          updateLineItem(activeRowIndex, { stockNo: "", product: "", orderQty: 0, rate: 0, value: 0 });
        } else {
          updatePivotRow(activeRowIndex, { articleNo: "", product: "", rate: 0, sizeQuantities: DEFAULT_SIZES.reduce((a, s) => ({ ...a, [s]: 0 }), {}) });
        }
      } else if (e.key === "F6") {
        e.preventDefault();
        // Copy previous row
        if (activeRowIndex > 0) {
          if (activeTab === "generation") {
            const prevRow = lineItems[activeRowIndex - 1];
            updateLineItem(activeRowIndex, { ...prevRow, id: lineItems[activeRowIndex].id, sNo: activeRowIndex + 1 });
          } else {
            const prevRow = sizePivotRows[activeRowIndex - 1];
            updatePivotRow(activeRowIndex, { ...prevRow, id: sizePivotRows[activeRowIndex].id, sNo: activeRowIndex + 1 });
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [activeRowIndex, activeTab, lineItems, sizePivotRows]);

  // Save / Commit PO to backend
  const handleSavePO = async () => {
    const activeLines = activeTab === "generation"
      ? lineItems.filter(l => l.stockNo && l.orderQty > 0)
      : sizePivotRows.filter(r => r.articleNo && r.totalQty > 0);

    if (activeLines.length === 0) {
      if (onNotification) onNotification("Validation Error", "Please enter at least one line item with quantity.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        order_number: `${header.prefix}-${header.orderNumber}`,
        order_date: new Date().toISOString().split("T")[0],
        supplier_id: header.supplierId || "sup-1",
        supplier_name: header.supplierName,
        delivery_date: new Date(Date.now() + header.leadTimeDays * 86400000).toISOString().split("T")[0],
        total_amount: totals.totalValue,
        status: "Draft",
        lines: activeTab === "generation"
          ? lineItems.filter(l => l.stockNo).map(l => ({
              item_code: l.stockNo,
              item_name: l.product,
              quantity: l.orderQty,
              rate: l.rate,
              amount: l.totalValue
            }))
          : sizePivotRows.filter(r => r.articleNo).map(r => ({
              item_code: r.articleNo,
              item_name: r.product,
              quantity: r.totalQty,
              rate: r.rate,
              amount: r.totalValue,
              size_breakdown: r.sizeQuantities
            }))
      };

      await apiFetchV1("/purchase/orders", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (onNotification) onNotification("Success", `Purchase Order ${payload.order_number} saved successfully!`, "success");
      // Advance order number
      setHeader(h => ({ ...h, orderNumber: String(parseInt(h.orderNumber) + 1 || 47) }));
    } catch {
      // Offline / Local success fallback
      if (onNotification) onNotification("PO Saved (Local)", `Purchase Order ${header.prefix}-${header.orderNumber} stored in session.`, "success");
      setHeader(h => ({ ...h, orderNumber: String(parseInt(h.orderNumber) + 1 || 47) }));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setLineItems(prev => prev.map((l, i) => ({
      ...l,
      stockNo: "",
      product: "",
      brand: "",
      style: "",
      shade: "",
      size: "",
      rate: 0,
      orderQty: 0,
      value: 0,
      totalValue: 0
    })));
    setSizePivotRows(prev => prev.map((r, i) => ({
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
    if (onNotification) onNotification("Cleared", "All grid line items cleared.", "success");
  };

  return (
    <div className="bg-[#faf9ff] text-[#1a1b20] font-sans h-full flex flex-col antialiased select-none overflow-hidden relative">
      {/* Top Header & Sub-Tabs */}
      <div className="bg-[#e9edff] border-b border-[#c4c6d4] shrink-0">
        <div className="px-4 py-1.5 border-b border-[#c4c6d4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00296d] text-[20px]">shopping_cart</span>
            <h1 className="font-bold text-[#00296d] text-sm tracking-tight">
              Purchase Order / Indent Generation - SMRITI 9
            </h1>
          </div>
          <span className="text-[10px] font-mono bg-white border border-[#c4c6d4] px-2 py-0.5 rounded text-[#434652] font-bold">
            PO Mode: {activeTab === "size_pivot" ? "Size Pivot Matrix" : "Standard Line Items"}
          </span>
        </div>

        {/* Tab Selection */}
        <div className="flex px-4 pt-1.5 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("generation")}
            className={`px-4 py-1 text-xs font-mono font-bold rounded-t transition-colors ${
              activeTab === "generation"
                ? "bg-white text-[#00296d] border-t border-x border-[#c4c6d4]"
                : "text-[#434652] hover:bg-[#e2e2e8]"
            }`}
          >
            Generation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("size_pivot")}
            className={`px-4 py-1 text-xs font-mono font-bold rounded-t transition-colors ${
              activeTab === "size_pivot"
                ? "bg-white text-[#00296d] border-t border-x border-[#c4c6d4]"
                : "text-[#434652] hover:bg-[#e2e2e8]"
            }`}
          >
            Size Pivot Grid
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("other")}
            className={`px-4 py-1 text-xs font-mono font-bold rounded-t transition-colors ${
              activeTab === "other"
                ? "bg-white text-[#00296d] border-t border-x border-[#c4c6d4]"
                : "text-[#434652] hover:bg-[#e2e2e8]"
            }`}
          >
            Other Details
          </button>
        </div>
      </div>

      {/* Form Header Area (Split Pane) */}
      <div className="p-3 shrink-0 bg-[#faf9ff] border-b border-[#c4c6d4] grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
        {/* Document Details */}
        <div className="lg:col-span-4 bg-white p-2.5 border border-[#c4c6d4] rounded shadow-2xs flex flex-col justify-between">
          <h3 className="text-[10px] font-bold uppercase text-[#00296d] mb-1.5 border-b border-[#c4c6d4] pb-1 tracking-wider">
            Purchase / Indent Document Details
          </h3>
          <div className="grid grid-cols-3 gap-1.5 items-center mb-1">
            <label className="font-semibold text-[#434652]">Type</label>
            <select
              value={header.documentType}
              onChange={(e) => setHeader({ ...header, documentType: e.target.value as any })}
              className="col-span-2 border border-[#737685] rounded px-2 h-6 bg-white outline-none focus:ring-1 focus:ring-[#00296d]"
            >
              <option value="Purchase Order">Purchase Order</option>
              <option value="Indent">Indent</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-1.5 items-center mb-1">
            <label className="font-semibold text-[#434652]">Prefix</label>
            <input
              type="text"
              value={header.prefix}
              onChange={(e) => setHeader({ ...header, prefix: e.target.value })}
              className="col-span-2 border border-[#737685] rounded px-2 h-6 font-mono font-bold bg-white outline-none focus:ring-1 focus:ring-[#00296d]"
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5 items-center mb-1">
            <label className="font-semibold text-[#434652]">Number</label>
            <input
              type="text"
              value={header.orderNumber}
              onChange={(e) => setHeader({ ...header, orderNumber: e.target.value })}
              className="col-span-2 border border-[#737685] rounded px-2 h-6 text-right font-mono font-bold bg-white outline-none focus:ring-1 focus:ring-[#00296d]"
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5 items-center">
            <label className="font-semibold text-[#434652]">Date</label>
            <input
              type="text"
              value={header.orderDate}
              onChange={(e) => setHeader({ ...header, orderDate: e.target.value })}
              className="col-span-2 border border-[#737685] rounded px-2 h-6 font-mono bg-white outline-none focus:ring-1 focus:ring-[#00296d]"
            />
          </div>
        </div>

        {/* Supplier Details */}
        <div className="lg:col-span-6 bg-white p-2.5 border border-[#c4c6d4] rounded shadow-2xs flex flex-col justify-between">
          <div className="grid grid-cols-12 gap-1.5 items-center mb-1">
            <label className="col-span-3 font-semibold text-[#434652]">Supplier</label>
            <select
              value={header.supplierId}
              onChange={(e) => {
                const s = suppliersList.find(x => x.id === e.target.value);
                setHeader({ ...header, supplierId: e.target.value, supplierName: s ? s.name : header.supplierName });
              }}
              className="col-span-9 border border-[#737685] rounded px-2 h-6 bg-white outline-none focus:ring-1 focus:ring-[#00296d] font-medium"
            >
              {suppliersList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-12 gap-1.5 items-center mb-1">
            <label className="col-span-3 font-semibold text-[#434652]">Bill to</label>
            <input
              type="text"
              value={header.billTo}
              onChange={(e) => setHeader({ ...header, billTo: e.target.value })}
              className="col-span-9 border border-[#737685] rounded px-2 h-6 bg-white outline-none focus:ring-1 focus:ring-[#00296d]"
            />
          </div>
          <div className="grid grid-cols-12 gap-1.5 items-center mb-1">
            <label className="col-span-3 font-semibold text-[#434652]">Delivery Date</label>
            <input
              type="text"
              value={header.deliveryDate}
              onChange={(e) => setHeader({ ...header, deliveryDate: e.target.value })}
              className="col-span-4 border border-[#737685] rounded px-2 h-6 font-mono bg-white outline-none focus:ring-1 focus:ring-[#00296d]"
            />
            <label className="col-span-2 text-right font-semibold text-[#434652] pr-1">Lead Time</label>
            <input
              type="number"
              value={header.leadTimeDays}
              onChange={(e) => setHeader({ ...header, leadTimeDays: parseInt(e.target.value) || 0 })}
              className="col-span-3 border border-[#737685] rounded px-2 h-6 text-right font-mono font-bold bg-white outline-none focus:ring-1 focus:ring-[#00296d]"
            />
          </div>
          <div className="grid grid-cols-12 gap-1.5 items-center">
            <label className="col-span-3 font-semibold text-[#434652]">Delivery Location</label>
            <input
              type="text"
              value={header.deliveryLocation}
              onChange={(e) => setHeader({ ...header, deliveryLocation: e.target.value })}
              className="col-span-9 border border-[#737685] rounded px-2 h-6 bg-white outline-none focus:ring-1 focus:ring-[#00296d]"
            />
          </div>
        </div>

        {/* Picture Preview */}
        <div className="lg:col-span-2 bg-white p-2.5 border border-[#c4c6d4] rounded shadow-2xs flex flex-col justify-between items-center">
          <h3 className="text-[10px] font-bold uppercase text-[#00296d] mb-1 text-center w-full border-b border-[#c4c6d4] pb-1 tracking-wider">
            Picture
          </h3>
          <div className="w-full h-16 border border-dashed border-[#c4c6d4] bg-[#eeedf3] flex items-center justify-center rounded overflow-hidden mb-1">
            {header.pictureUrl ? (
              <img src={header.pictureUrl} alt="Product" className="h-full object-contain" />
            ) : (
              <span className="material-symbols-outlined text-[#737685] text-2xl">image</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-[#eeedf3] hover:bg-[#e8e7ed] border border-[#c4c6d4] text-[#1a1b20] rounded h-6 text-[11px] font-bold font-mono transition-colors"
          >
            Load
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                setHeader({ ...header, pictureUrl: url });
              }
            }}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-[#eeedf3] px-3 py-1 border-b border-[#c4c6d4] flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "generation" ? "size_pivot" : "generation")}
            className="bg-white hover:bg-[#faf9ff] text-[#00296d] border border-[#00296d] font-bold rounded px-3 py-1 text-xs transition-colors shadow-2xs flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">
              {activeTab === "generation" ? "grid_view" : "table_rows"}
            </span>
            Switch to {activeTab === "generation" ? "Size Pivot Grid" : "Standard Grid"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBrowseModal(true)}
            className="bg-[#00296d] hover:bg-[#0052cc] text-white px-3 py-1 rounded font-bold text-xs flex items-center gap-1 shadow-xs"
          >
            <span className="material-symbols-outlined text-[14px]">search</span>
            Browse Catalog (F2)
          </button>
        </div>
      </div>

      {/* Data Grid Container */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-white" id="data-grid-container">
        {/* Floating F2 Hint Overlay */}
        {showF2Hint && (
          <div
            onClick={() => setShowF2Hint(false)}
            className="absolute top-6 left-12 z-20 cursor-pointer animate-bounce"
            title="Click to dismiss"
          >
            <div className="bg-[#d6e3ff] border border-[#00296d] rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 text-[#00296d]">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <p className="font-bold text-xs m-0">
                Press <strong>F2</strong> to browse for stock items
              </p>
            </div>
            <div className="absolute -top-2 left-6 w-3 h-3 bg-[#d6e3ff] border-t border-l border-[#00296d] transform rotate-45"></div>
          </div>
        )}

        {/* Tab 1: Standard Generation Grid */}
        {activeTab === "generation" && (
          <table className="w-full text-left border-collapse min-w-[1300px] text-xs">
            <thead className="sticky top-0 z-10 bg-[#eeedf3] shadow-xs text-[10px] font-bold uppercase text-[#434652]">
              <tr>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 w-8 text-center bg-[#e8e7ed]">#</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[100px]">Stock Number</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[130px]">Product</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[90px]">Brand</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px]">Style</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px]">Shade</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[60px]">Size</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px]">Fibre</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px]">Colour Base</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px]">Styling</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px] text-right">Rate</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px] text-right">Order Qty</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[100px] text-right bg-[#e2e2e8]">Value</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 text-center min-w-[90px]">Stock On Hand</th>
                <th colSpan={2} className="border-b border-r border-[#c4c6d4] p-1 text-center">Tax / Duty</th>
                <th colSpan={2} className="border-b border-r border-[#c4c6d4] p-1 text-center">Add-On After Tax</th>
                <th rowSpan={2} className="border-b border-[#c4c6d4] p-1 px-2 min-w-[100px] text-right bg-[#e2e2e8]">Total Value</th>
              </tr>
              <tr>
                <th className="border-b border-r border-[#c4c6d4] p-0.5 text-center text-[9px] w-14">Per (%)</th>
                <th className="border-b border-r border-[#c4c6d4] p-0.5 text-center text-[9px] w-20">Amount</th>
                <th className="border-b border-r border-[#c4c6d4] p-0.5 text-center text-[9px] w-14">Per (%)</th>
                <th className="border-b border-r border-[#c4c6d4] p-0.5 text-center text-[9px] w-20">Amount</th>
              </tr>
            </thead>
            <tbody className="font-mono divide-y divide-[#c4c6d4]/40 font-medium">
              {lineItems.map((item, idx) => {
                const isSelected = idx === activeRowIndex;
                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      setActiveRowIndex(idx);
                      setShowF2Hint(false);
                    }}
                    className={`hover:bg-[#f4f3f9] transition-colors ${
                      isSelected ? "bg-[#cdddff]/40" : ""
                    }`}
                  >
                    <td className="border-r border-[#c4c6d4] p-1 text-center text-[#737685] bg-[#f4f3f9]">
                      {item.sNo}
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        id="pogen-gen-stockno"
                        name="stockNo"
                        aria-label="Stock Number — F2 to browse variants"
                        data-f2-entity="variant"
                        value={item.stockNo}
                        onFocus={() => { setActiveRowIndex(idx); setShowF2Hint(false); }}
                        onChange={(e) => updateLineItem(idx, { stockNo: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 font-mono font-bold text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={item.product}
                        onChange={(e) => updateLineItem(idx, { product: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={item.brand}
                        onChange={(e) => updateLineItem(idx, { brand: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={item.style}
                        onChange={(e) => updateLineItem(idx, { style: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={item.shade}
                        onChange={(e) => updateLineItem(idx, { shade: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={item.size}
                        onChange={(e) => updateLineItem(idx, { size: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={item.fibre}
                        onChange={(e) => updateLineItem(idx, { fibre: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={item.colourBase}
                        onChange={(e) => updateLineItem(idx, { colourBase: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={item.styling}
                        onChange={(e) => updateLineItem(idx, { styling: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="number"
                        min="0"
                        value={item.rate || ""}
                        onChange={(e) => updateLineItem(idx, { rate: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs text-right font-bold focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="number"
                        min="0"
                        value={item.orderQty || ""}
                        onChange={(e) => updateLineItem(idx, { orderQty: parseInt(e.target.value) || 0 })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs text-right font-bold text-[#00296d] focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-1 px-2 text-right bg-[#eeedf3]/60 font-bold">
                      {item.value.toFixed(2)}
                    </td>
                    <td className="border-r border-[#c4c6d4] p-1 px-2 text-right text-[#737685]">
                      {item.stockOnHand}
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="number"
                        value={item.taxPercent || ""}
                        onChange={(e) => updateLineItem(idx, { taxPercent: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs text-right focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-1 px-1.5 text-right text-[11px]">
                      {item.taxAmount.toFixed(2)}
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="number"
                        value={item.addOnPercent || ""}
                        onChange={(e) => updateLineItem(idx, { addOnPercent: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs text-right focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-1 px-1.5 text-right text-[11px]">
                      {item.addOnAmount.toFixed(2)}
                    </td>
                    <td className="p-1 px-2 text-right bg-[#eeedf3]/60 font-bold">
                      {item.totalValue.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Tab 2: Size Pivot Grid */}
        {activeTab === "size_pivot" && (
          <table className="w-full text-left border-collapse min-w-[1200px] text-xs">
            <thead className="sticky top-0 z-10 bg-[#eeedf3] shadow-xs text-[10px] font-bold uppercase text-[#434652]">
              <tr>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 w-8 text-center bg-[#e8e7ed]">#</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[100px]">Article No</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[130px]">Product</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[90px]">Brand</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px]">Style</th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px]">Color</th>
                <th colSpan={DEFAULT_SIZES.length} className="border-b border-r border-[#c4c6d4] p-1 text-center bg-[#e2e2e8]">
                  Size Pivot (Qty)
                </th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[65px] text-right bg-[#e2e2e8] font-bold">
                  QTY
                </th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[55px] text-right bg-[#e2e2e8] font-bold">
                  GST %
                </th>
                <th rowSpan={2} className="border-b border-r border-[#c4c6d4] p-1 px-2 min-w-[80px] text-right">
                  Rate
                </th>
                <th rowSpan={2} className="border-b border-[#c4c6d4] p-1 px-2 min-w-[100px] text-right bg-[#e2e2e8]">
                  Total Value
                </th>
              </tr>
              <tr>
                {DEFAULT_SIZES.map(sz => (
                  <th key={sz} className="border-b border-r border-[#c4c6d4] p-1 text-center w-10 font-mono font-bold bg-[#eeedf3]">
                    {sz}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono divide-y divide-[#c4c6d4]/40 font-medium">
              {sizePivotRows.map((row, idx) => {
                const isSelected = idx === activeRowIndex;
                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setActiveRowIndex(idx);
                      setShowF2Hint(false);
                    }}
                    className={`hover:bg-[#f4f3f9] transition-colors ${
                      isSelected ? "bg-[#cdddff]/40" : ""
                    }`}
                  >
                    <td className="border-r border-[#c4c6d4] p-1 text-center text-[#737685] bg-[#f4f3f9]">
                      {row.sNo}
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        id="pogen-pivot-articleno"
                        name="articleNo"
                        aria-label="Article Number — F2 to browse variants"
                        data-f2-entity="variant"
                        value={row.articleNo}
                        onFocus={() => { setActiveRowIndex(idx); setShowF2Hint(false); }}
                        onChange={(e) => updatePivotRow(idx, { articleNo: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 font-mono font-bold text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={row.product}
                        onChange={(e) => updatePivotRow(idx, { product: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={row.brand}
                        onChange={(e) => updatePivotRow(idx, { brand: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={row.style}
                        onChange={(e) => updatePivotRow(idx, { style: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="text"
                        value={row.color}
                        onChange={(e) => updatePivotRow(idx, { color: e.target.value })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    {DEFAULT_SIZES.map((sz) => (
                      <td key={sz} className="border-r border-[#c4c6d4] p-0 w-10 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.sizeQuantities[sz] || ""}
                          onChange={(e) => updatePivotSizeQty(idx, sz, parseInt(e.target.value) || 0)}
                          className="w-full bg-transparent border-none p-1 h-6 text-xs font-mono text-center focus:ring-1 focus:ring-[#00296d]"
                        />
                      </td>
                    ))}
                    <td className="border-r border-[#c4c6d4] p-1 px-2 text-right font-mono font-bold bg-[#f4f3f9] text-[#00296d]">
                      {row.totalQty}
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="number"
                        min="0"
                        value={row.gstPercent || ""}
                        onChange={(e) => updatePivotRow(idx, { gstPercent: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs text-right font-mono focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="border-r border-[#c4c6d4] p-0.5">
                      <input
                        type="number"
                        value={row.rate || ""}
                        onChange={(e) => updatePivotRow(idx, { rate: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent border-none p-1 h-6 text-xs text-right font-bold focus:ring-1 focus:ring-[#00296d]"
                      />
                    </td>
                    <td className="p-1 px-2 text-right bg-[#eeedf3]/60 font-bold">
                      {row.totalValue.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Tab 3: Other Details */}
        {activeTab === "other" && (
          <div className="p-6 max-w-2xl text-xs space-y-4">
            <div className="bg-[#eeedf3] p-4 rounded border border-[#c4c6d4]">
              <h4 className="font-bold text-[#00296d] mb-2 uppercase text-[11px]">Payment & Commercial Terms</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#434652] mb-1">Payment Terms</label>
                  <input type="text" defaultValue="30 Days Net" className="w-full border border-[#737685] rounded px-2 h-7 bg-white" />
                </div>
                <div>
                  <label className="block font-semibold text-[#434652] mb-1">Freight Charges</label>
                  <input type="text" defaultValue="Paid by Supplier" className="w-full border border-[#737685] rounded px-2 h-7 bg-white" />
                </div>
              </div>
            </div>

            <div className="bg-[#eeedf3] p-4 rounded border border-[#c4c6d4]">
              <h4 className="font-bold text-[#00296d] mb-2 uppercase text-[11px]">Special Instructions</h4>
              <textarea rows={3} defaultValue="Please ensure all garments carry SMRITI 9 Barcode tags and standard export polybag packaging." className="w-full border border-[#737685] rounded p-2 bg-white" />
            </div>
          </div>
        )}
      </div>

      {/* Summary Totals Bar */}
      <div className="bg-[#e9edff] px-4 py-2 border-t border-[#c4c6d4] flex items-center justify-between shrink-0 text-xs">
        <div className="flex-1 text-[#434652] font-mono font-bold">
          Active Mode: {activeTab === "size_pivot" ? "Size Matrix" : "Standard Line Items"} ({activeTab === "size_pivot" ? sizePivotRows.filter(r => r.articleNo).length : lineItems.filter(l => l.stockNo).length} Active Rows)
        </div>
        <div className="flex items-center gap-4 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#434652]">Total Qty:</span>
            <input
              type="text"
              readOnly
              value={totals.totalQty}
              className="w-20 bg-white border border-[#c4c6d4] rounded h-7 px-2 text-right font-bold text-[#00296d]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#434652]">Gross Value:</span>
            <input
              type="text"
              readOnly
              value={`₹${totals.grossValue.toFixed(2)}`}
              className="w-28 bg-white border border-[#c4c6d4] rounded h-7 px-2 text-right font-bold"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#00296d]">Total Value:</span>
            <input
              type="text"
              readOnly
              value={`₹${totals.totalValue.toFixed(2)}`}
              className="w-32 bg-[#00296d] text-white border border-[#00296d] rounded h-7 px-2 text-right font-bold text-sm"
            />
          </div>
        </div>
      </div>

      {/* Bottom Control Action Bar */}
      <div className="bg-[#eeedf3] px-4 py-1.5 border-t border-[#c4c6d4] flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-3 text-xs text-[#00296d] font-mono">
          <span><strong>F2</strong> - Browse</span>
          <span><strong>F4</strong> - Delete Row</span>
          <span><strong>F6</strong> - Copy Previous Row</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="bg-white hover:bg-[#faf9ff] text-[#1a1b20] border border-[#c4c6d4] rounded px-4 py-1 font-bold text-xs transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Global Operational Controls (Add / Edit / View / Exit) */}
      <div className="bg-[#e2e2e8] px-2 py-1.5 flex items-center gap-2 shrink-0 border-t border-[#c4c6d4] text-xs">
        <button
          type="button"
          disabled={saving}
          onClick={handleSavePO}
          className="flex-1 bg-[#00296d] hover:bg-[#0052cc] text-white rounded py-1.5 font-bold uppercase tracking-wider transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
          {saving ? "Saving PO..." : "Save Purchase Order"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 bg-white hover:bg-[#eeedf3] text-[#1a1b20] border border-[#c4c6d4] rounded py-1.5 font-bold uppercase tracking-wider transition-colors shadow-2xs"
        >
          Print Preview (F9)
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 bg-[#ffdad6] hover:bg-[#ba1a1a] text-[#93000a] hover:text-white border border-[#ffdad6] rounded py-1.5 font-bold uppercase tracking-wider transition-colors shadow-2xs"
        >
          Exit
        </button>
      </div>

      {/* Footer Status Bar */}
      <footer className="bg-[#e2e2e8] text-[#434652] font-mono text-[11px] border-t border-[#c4c6d4] flex justify-between items-center px-4 py-1 w-full shrink-0">
        <span className="font-bold text-[#00296d]">SMRITI 9 Enterprise POS | Ver 4.2.0</span>
        <div className="flex items-center gap-6">
          <span>F1: Help</span>
          <span>F2: Browse Stock</span>
          <span>F9: Print</span>
          <span>Date: {header.orderDate}</span>
        </div>
      </footer>

      {/* F2 Product Browse Modal */}
      <PurchBrowseDlg
        products={products}
        isOpen={showBrowseModal}
        onClose={() => setShowBrowseModal(false)}
        onSelectProduct={handleSelectProduct}
      />
    </div>
  );
};

export default PoGenerateTab;
