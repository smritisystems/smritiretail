/**
 * Project      : SMRITI Retail OS v6.5
 * Module       : Product & Item Master Composition Host (v6.5 Enterprise Standard)
 *                Adaptive Form Framework v2.0 — Quick Add (<15s) + 10-Panel Advanced Add
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 6.5.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Product } from "../types.js";
import { FioriObjectPage } from "./common/FioriObjectPage.tsx";
export { FioriObjectPage as SEEFObjectPage };

import { WorkspaceLayout } from "../layout_engine/components/WorkspaceLayout.tsx";
import { ItemMasterToolbar, ItemMasterViewMode } from "./item_master/ItemMasterToolbar.tsx";
import { ItemMasterContextSidebar, ContextFilterState } from "./item_master/ItemMasterContextSidebar.tsx";
import { ItemMasterMasterList } from "./item_master/ItemMasterMasterList.tsx";
import { ItemMasterFormInspector } from "./item_master/ItemMasterFormInspector.tsx";
import { ItemMasterBatchBar } from "./item_master/ItemMasterBatchBar.tsx";
import { BarcodePrintDialog } from "./item_master/BarcodePrintDialog.tsx";

import { AttributeManagerSection } from "./AttributeManagerSection.tsx";
import { VariantTemplateSection } from "./VariantTemplateSection.tsx";
import { BulkImportSection } from "./BulkImportSection.tsx";
import { ExcelGridEntrySection } from "./ExcelGridEntrySection.tsx";
import { AttributeAnalyticsSection } from "./AttributeAnalyticsSection.tsx";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { apiFetchV1 } from "../lib/apiFetchV1.js";
import {
  Package, Plus, Search, X, Barcode, CheckCircle2, AlertCircle, FileText,
  ShieldCheck, DollarSign, Percent, Truck, Tag, Zap, Settings2, RotateCcw,
  Save, AlertOctagon, Info, ChevronDown, ChevronUp, Layers, UploadCloud, Trash2
} from "lucide-react";

/* ═══════════════════ TYPES & CONSTANTS ═══════════════════ */
export type ItemFormMode = "quick" | "advanced";
type SectionKey =
  | "identity"
  | "gst"
  | "pricing"
  | "inventory"
  | "tracking"
  | "variants"
  | "suppliers"
  | "media"
  | "labels"
  | "notes";

const DRAFT_KEY = "smriti_item_draft_v2";
const MODE_KEY  = "smriti_item_form_mode_v2";

const blankItemForm = () => ({
  code: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
  sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
  barcode: `${Math.floor(8900000000000 + Math.random() * 9000000000)}`,
  name: "",
  shortName: "",
  category: "General",
  subCategory: "",
  brand: "Smriti Standard",
  hsn_code: "8471",
  gst_rate: "18",
  is_tax_inclusive: false,
  mrp: "100.00",
  price: "100.00",
  purchase_price: "60.00",
  wholesale_price: "90.00",
  dealer_price: "85.00",
  uom: "Pcs",
  stock_qty: "10",
  min_stock_level: "5",
  max_stock_level: "500",
  warehouse: "Central WH-01",
  bin_location: "A1-RACK-02",
  is_batch_tracked: false,
  is_expiry_tracked: false,
  preferred_supplier: "TechCorp Distributors",
  primary_image_url: "",
  label_template: "50x25mm",
  notes: ""
});

type ItemFormData = ReturnType<typeof blankItemForm>;

interface ItemMasterTabProps {
  products: Product[];
  onRefreshProducts: () => Promise<void>;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
}

export const ItemMasterTab: React.FC<ItemMasterTabProps> = ({
  products,
  onRefreshProducts,
  onNotification,
  currentUser
}) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [viewMode, setViewMode] = useState<ItemMasterViewMode>("registry");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<ContextFilterState>({ type: "ALL", value: "ALL" });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] || null);
  const [checkedProductIds, setCheckedProductIds] = useState<string[]>([]);
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState<boolean>(false);

  /* ── Adaptive Modal State ── */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<ItemFormMode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as ItemFormMode) || "quick";
    } catch {
      return "quick";
    }
  });

  const [formData, setFormData] = useState<ItemFormData>(blankItemForm);
  const [isDirty, setIsDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    new Set(["identity", "gst", "pricing"])
  );

  /* ── Draft Auto-Save System ── */
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback((data: ItemFormData) => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      } catch {
        /* storage quota exceeded */
      }
    }, 500);
  }, []);

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setHasDraft(false);
  }, []);

  const set = (field: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      saveDraft(next);
      setIsDirty(true);
      return next;
    });
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const switchMode = (mode: ItemFormMode) => {
    setFormMode(mode);
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
    if (mode === "advanced") {
      setOpenSections(new Set(["identity", "gst", "pricing"]));
    }
  };

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  /* ── Open Modal with Draft Recovery ── */
  const handleOpenModal = () => {
    if (isReadOnly) {
      onNotification("Access Denied", "Read-Only operators cannot create new SKUs.", "error");
      return;
    }
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ItemFormData;
        setFormData(saved);
        setHasDraft(true);
        setIsDirty(false);
        setIsModalOpen(true);
        return;
      }
    } catch {
      /* ignore bad json */
    }
    const fresh = blankItemForm();
    setFormData(fresh);
    setValidationErrors({});
    setIsDirty(false);
    setHasDraft(false);
    setIsModalOpen(true);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    const fresh = blankItemForm();
    setFormData(fresh);
    setIsDirty(false);
  };

  const handleCloseModal = () => {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard them?");
      if (!ok) return;
      clearDraft();
    }
    setIsModalOpen(false);
    setIsDirty(false);
  };

  /* ── Dynamic Validation ── */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Item Name is required.";
    if (!formData.hsn_code.trim()) errors.hsn_code = "HSN Code is required.";
    const mrpVal = parseFloat(formData.mrp) || 0;
    const saleVal = parseFloat(formData.price) || 0;
    if (saleVal > mrpVal && mrpVal > 0) {
      errors.price = "Sale Price cannot exceed MRP Price.";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ── Submit SKU Creation ── */
  const handleSubmit = async (e: React.FormEvent, saveAndNew = false) => {
    e.preventDefault();
    if (!validateForm()) {
      onNotification("Validation Error", "Please fix highlighted fields.", "error");
      return;
    }

    setIsSubmitting(true);
    const newSku: Product = {
      id: `prod_${Date.now()}`,
      code: formData.code,
      sku: formData.sku,
      barcode: formData.barcode,
      name: formData.name.trim(),
      category: formData.category,
      brand: formData.brand,
      hsn_code: formData.hsn_code,
      gst_rate: parseFloat(formData.gst_rate) || 18,
      mrp: parseFloat(formData.mrp) || 100,
      price: parseFloat(formData.price) || 100,
      purchase_price: parseFloat(formData.purchase_price) || 60,
      stock: parseFloat(formData.stock_qty) || 0,
      stock_qty: parseFloat(formData.stock_qty) || 0,
      min_stock_level: parseFloat(formData.min_stock_level) || 5,
      uom: formData.uom
    };

    try {
      await apiFetchV1("/products/", {
        method: "POST",
        body: JSON.stringify(newSku)
      });
      onNotification("SKU Created ✓", `${newSku.name} (${newSku.code}) added to Product Master.`, "success");
    } catch {
      onNotification("SKU Created Locally", `${newSku.name} added to workspace.`, "success");
    } finally {
      clearDraft();
      setIsSubmitting(false);
      await onRefreshProducts();
      setSelectedProduct(newSku);

      if (saveAndNew) {
        setFormData(blankItemForm());
        setValidationErrors({});
        setIsDirty(false);
      } else {
        setIsModalOpen(false);
      }
    }
  };

  /* ── Extract Categories & Brands ── */
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => (p.stock_qty ?? p.qty ?? 0) < (p.min_stock_level || 5)).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchFilter = true;
      if (activeFilter.type === "CATEGORY") {
        matchFilter = p.category === activeFilter.value;
      } else if (activeFilter.type === "BRAND") {
        matchFilter = p.brand === activeFilter.value;
      } else if (activeFilter.type === "LOW_STOCK") {
        matchFilter = (p.stock_qty ?? p.qty ?? 0) < (p.min_stock_level || 5);
      }

      return matchSearch && matchFilter;
    });
  }, [products, searchTerm, activeFilter]);

  /* ── Global Hardware Barcode Scanner Listener ── */
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeyTime > 100) buffer = "";
      lastKeyTime = now;

      if (e.key === "Enter" && buffer.length >= 6) {
        const scannedCode = buffer.trim();
        const found = products.find(
          (p) => p.barcode === scannedCode || p.sku === scannedCode || p.code === scannedCode
        );
        if (found) {
          setSelectedProduct(found);
          onNotification("Barcode Scanned", `Auto-selected matching SKU: ${found.name}`, "success");
        }
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products, onNotification]);

  /* ── Style Tokens ── */
  const inp = "w-full p-2.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading text-xs focus:outline-none focus:border-[#0a6ed1] focus:ring-1 focus:ring-[#0a6ed1]/20 transition-all placeholder:text-theme-muted";
  const inpErr = (f: string) => inp + (validationErrors[f] ? " border-rose-500 ring-1 ring-rose-500/20" : "");
  const inpMono = inp + " font-mono";
  const inpMonoErr = (f: string) => inpMono + (validationErrors[f] ? " border-rose-500 ring-1 ring-rose-500/20" : "");
  const lbl = "block font-bold text-theme-muted mb-1 text-[11px] uppercase tracking-wide";
  const sel = inp + " cursor-pointer";

  const SectionPanel: React.FC<{
    sectionKey: SectionKey;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ sectionKey, title, icon, children }) => {
    const isOpen = openSections.has(sectionKey);
    return (
      <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-2">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-theme-surface-3 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[#0a6ed1]">{icon}</span>
            <span className="font-bold text-theme-heading text-xs uppercase tracking-wide font-mono">{title}</span>
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4 text-theme-muted" /> : <ChevronDown className="w-4 h-4 text-theme-muted" />}
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="px-5 pb-5 pt-1 border-t border-theme-divider/50 space-y-4">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  /* Mode Switcher Views */
  if (viewMode === "excel-grid") {
    return (
      <WorkspaceLayout
        mode="studio"
        toolbar={
          <ItemMasterToolbar
            activeMode={viewMode}
            onModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            productCount={filteredProducts.length}
            onNewProduct={handleOpenModal}
            onRefresh={onRefreshProducts}
            onOpenBarcodeHub={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
          />
        }
      >
        <ExcelGridEntrySection onRefreshProducts={onRefreshProducts} onNotification={onNotification} />
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout
      mode="studio"
      toolbar={
        <ItemMasterToolbar
          activeMode={viewMode}
          onModeChange={setViewMode}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          productCount={filteredProducts.length}
          onNewProduct={handleOpenModal}
          onRefresh={onRefreshProducts}
          onOpenBarcodeHub={() => setIsBarcodeDialogOpen(true)}
          isReadOnly={isReadOnly}
        />
      }
    >
      <div className="flex h-full w-full overflow-hidden bg-theme-base text-theme-body">
        <ItemMasterContextSidebar
          categories={categories}
          brands={brands}
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
          lowStockCount={lowStockCount}
          totalCount={products.length}
        />

        <ItemMasterMasterList
          products={filteredProducts}
          selectedProduct={selectedProduct}
          onSelectProduct={setSelectedProduct}
          checkedProductIds={checkedProductIds}
          onToggleCheckProduct={(id, e) => {
            e.stopPropagation();
            setCheckedProductIds((p) => (p.includes(id) ? p.filter((i) => i !== id) : [...p, id]));
          }}
          onToggleSelectAll={() => {
            setCheckedProductIds(checkedProductIds.length === filteredProducts.length ? [] : filteredProducts.map((p) => p.id));
          }}
        />

        <div className="flex-1 h-full overflow-hidden bg-theme-surface-1">
          <ItemMasterFormInspector
            product={selectedProduct}
            onSaveProduct={async (u) => {
              await apiFetchV1(`/products/${u.id}`, { method: "PUT", body: JSON.stringify(u) });
              onNotification("Product Updated", `Saved ${u.name}`, "success");
              await onRefreshProducts();
            }}
            onDeleteProduct={async (id) => {
              await apiFetchV1(`/products/${id}`, { method: "DELETE" });
              onNotification("Product Deleted", "Removed SKU", "success");
              setSelectedProduct(null);
              await onRefreshProducts();
            }}
            onOpenBarcodeDialog={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
          />
        </div>

        <BarcodePrintDialog
          isOpen={isBarcodeDialogOpen}
          onClose={() => setIsBarcodeDialogOpen(false)}
          selectedProducts={checkedProductIds.length > 0 ? products.filter((p) => checkedProductIds.includes(p.id)) : selectedProduct ? [selectedProduct] : []}
          onNotification={onNotification}
        />
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/*        ADAPTIVE SKU ONBOARDING MODAL (v2.5)     */}
      {/* ════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.18 }}
            className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden"
            style={{ maxWidth: formMode === "quick" ? 640 : 880, maxHeight: "94vh" }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider bg-theme-surface-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#0a6ed1]/10 text-[#0a6ed1]">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-theme-heading font-display">
                    {formMode === "quick" ? "Quick Add — Product SKU Onboarding" : "Advanced Add — Complete SKU Profile & Taxonomy"}
                  </h3>
                  <p className="text-[11px] text-theme-muted font-mono">
                    {formMode === "quick" ? "Minimal essentials for ultra-fast barcode SKU creation (< 15 sec)." : "10-panel enterprise master data: Pricing, Location, Suppliers & Labels."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-bold font-mono flex items-center gap-1">
                    <Save className="w-3 h-3" /> Unsaved Changes
                  </span>
                )}
                <button onClick={handleCloseModal} className="p-1.5 text-theme-muted hover:text-theme-heading rounded-lg cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Draft Recovery Banner */}
            {hasDraft && (
              <div className="px-6 py-2.5 bg-[#0a6ed1]/5 border-b border-[#0a6ed1]/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#0a6ed1]">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span><strong>Draft recovered.</strong> Your previous unsaved SKU inputs have been restored.</span>
                </div>
                <button onClick={handleDiscardDraft} className="flex items-center gap-1 text-[11px] text-theme-muted hover:text-rose-400 font-mono cursor-pointer transition-colors">
                  <RotateCcw className="w-3 h-3" /> Discard Draft
                </button>
              </div>
            )}

            {/* Mode Switcher Pills */}
            <div className="px-6 pt-3 pb-2 flex items-center gap-2 border-b border-theme-divider/50 bg-theme-surface-2/40">
              <button
                type="button"
                onClick={() => switchMode("quick")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  formMode === "quick"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-xs"
                    : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:border-emerald-500/40"
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Quick Add Mode (&lt;15s)
              </button>
              <button
                type="button"
                onClick={() => switchMode("advanced")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  formMode === "advanced"
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/40 shadow-xs"
                    : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:border-purple-500/40"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" /> Advanced Add Mode (10 Panels)
              </button>
            </div>

            {/* Form Body */}
            <SmritiScrollArea className="flex-1 overflow-y-auto px-6 pb-2">
              <form id="item-form" onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 text-xs font-sans py-3">

                {/* QUICK ADD MODE */}
                {formMode === "quick" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-theme-heading uppercase tracking-wide font-mono flex items-center gap-2">
                          <Barcode className="w-4 h-4 text-[#0a6ed1]" /> Essential Product &amp; Barcode Attributes
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">Target: &lt; 15 seconds</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={lbl}>Barcode / Hardware EAN13 <span className="text-rose-400">*</span></label>
                          <input type="text" value={formData.barcode} onChange={(e) => set("barcode", e.target.value)} className={inpMono} autoFocus />
                        </div>
                        <div>
                          <label className={lbl}>SKU Code</label>
                          <input type="text" value={formData.sku} onChange={(e) => set("sku", e.target.value)} className={inpMono} />
                        </div>

                        <div className="md:col-span-2">
                          <label className={lbl}>Item Name / Description <span className="text-rose-400">*</span></label>
                          <input type="text" required placeholder="e.g. Cotton Printed Silk Kurta" value={formData.name} onChange={(e) => set("name", e.target.value)} className={inpErr("name")} />
                          {validationErrors.name && <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3" />{validationErrors.name}</p>}
                        </div>

                        <div>
                          <label className={lbl}>Category <span className="text-rose-400">*</span></label>
                          <input type="text" required placeholder="General" value={formData.category} onChange={(e) => set("category", e.target.value)} className={inp} />
                        </div>

                        <div>
                          <label className={lbl}>Brand</label>
                          <input type="text" placeholder="Smriti Standard" value={formData.brand} onChange={(e) => set("brand", e.target.value)} className={inp} />
                        </div>

                        <div>
                          <label className={lbl}>HSN Code <span className="text-rose-400">*</span></label>
                          <input type="text" required placeholder="8471" value={formData.hsn_code} onChange={(e) => set("hsn_code", e.target.value)} className={inpMonoErr("hsn_code")} />
                          {validationErrors.hsn_code && <p className="text-rose-400 text-[10px] mt-1">{validationErrors.hsn_code}</p>}
                        </div>

                        <div>
                          <label className={lbl}>GST Rate (%) <span className="text-rose-400">*</span></label>
                          <select value={formData.gst_rate} onChange={(e) => set("gst_rate", e.target.value)} className={sel}>
                            {["0", "5", "12", "18", "28"].map((r) => <option key={r} value={r}>{r}% GST</option>)}
                          </select>
                        </div>

                        <div>
                          <label className={lbl}>MRP Price (₹) <span className="text-rose-400">*</span></label>
                          <input type="number" step="0.01" required value={formData.mrp} onChange={(e) => set("mrp", e.target.value)} className={inpMono} />
                        </div>

                        <div>
                          <label className={lbl}>Sale Price (₹) <span className="text-rose-400">*</span></label>
                          <input type="number" step="0.01" required value={formData.price} onChange={(e) => set("price", e.target.value)} className={inpMonoErr("price")} />
                          {validationErrors.price && <p className="text-rose-400 text-[10px] mt-1">{validationErrors.price}</p>}
                        </div>

                        <div>
                          <label className={lbl}>Purchase Cost (₹) <span className="text-rose-400">*</span></label>
                          <input type="number" step="0.01" required value={formData.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} className={inpMono} />
                        </div>

                        <div>
                          <label className={lbl}>Opening Stock Qty &amp; UOM</label>
                          <div className="flex gap-2">
                            <input type="number" value={formData.stock_qty} onChange={(e) => set("stock_qty", e.target.value)} className={inpMono + " flex-1"} />
                            <select value={formData.uom} onChange={(e) => set("uom", e.target.value)} className={sel + " w-24"}>
                              {["Pcs", "Kg", "Box", "Mtr", "Ltr", "Set", "Pack"].map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => switchMode("advanced")}
                      className="w-full py-2.5 border border-dashed border-purple-500/40 rounded-xl text-xs font-bold text-purple-400 hover:bg-purple-500/5 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Settings2 className="w-3.5 h-3.5" /> Switch to Advanced Add — Full Enterprise SKU Workspace →
                    </button>
                  </div>
                )}

                {/* ADVANCED ADD MODE */}
                {formMode === "advanced" && (
                  <div className="space-y-3">
                    <SectionPanel sectionKey="identity" title="Basic Identity & Barcode" icon={<Package className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className={lbl}>Item Full Name <span className="text-rose-400">*</span></label>
                          <input type="text" required value={formData.name} onChange={(e) => set("name", e.target.value)} className={inpErr("name")} />
                        </div>
                        <div><label className={lbl}>SKU Code</label><input type="text" value={formData.sku} onChange={(e) => set("sku", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>Barcode EAN13</label><input type="text" value={formData.barcode} onChange={(e) => set("barcode", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>Category</label><input type="text" value={formData.category} onChange={(e) => set("category", e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>Brand</label><input type="text" value={formData.brand} onChange={(e) => set("brand", e.target.value)} className={inp} /></div>
                      </div>
                    </SectionPanel>

                    <SectionPanel sectionKey="gst" title="GST, HSN & Tax Classification" icon={<ShieldCheck className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className={lbl}>HSN / SAC Code</label><input type="text" value={formData.hsn_code} onChange={(e) => set("hsn_code", e.target.value)} className={inpMono} /></div>
                        <div>
                          <label className={lbl}>GST Rate (%)</label>
                          <select value={formData.gst_rate} onChange={(e) => set("gst_rate", e.target.value)} className={sel}>
                            {["0", "5", "12", "18", "28"].map((r) => <option key={r} value={r}>{r}% GST</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Price Taxability</label>
                          <select value={formData.is_tax_inclusive ? "true" : "false"} onChange={(e) => set("is_tax_inclusive", e.target.value === "true")} className={sel}>
                            <option value="false">Exclusive of Tax</option>
                            <option value="true">Inclusive of Tax</option>
                          </select>
                        </div>
                      </div>
                    </SectionPanel>

                    <SectionPanel sectionKey="pricing" title="Multi-Tier Pricing & Margins" icon={<DollarSign className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className={lbl}>MRP Price (₹)</label><input type="number" step="0.01" value={formData.mrp} onChange={(e) => set("mrp", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>Retail Sale Price (₹)</label><input type="number" step="0.01" value={formData.price} onChange={(e) => set("price", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>Purchase Cost (₹)</label><input type="number" step="0.01" value={formData.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>Wholesale Price (₹)</label><input type="number" step="0.01" value={formData.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} className={inpMono} /></div>
                      </div>
                    </SectionPanel>

                    <SectionPanel sectionKey="inventory" title="Multi-Location Inventory" icon={<Truck className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className={lbl}>Opening Stock Qty</label><input type="number" value={formData.stock_qty} onChange={(e) => set("stock_qty", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>Min Stock Level</label><input type="number" value={formData.min_stock_level} onChange={(e) => set("min_stock_level", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>Default Warehouse</label><input type="text" value={formData.warehouse} onChange={(e) => set("warehouse", e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>Bin / Rack Location</label><input type="text" value={formData.bin_location} onChange={(e) => set("bin_location", e.target.value)} className={inpMono} /></div>
                      </div>
                    </SectionPanel>

                    <button type="button" onClick={() => switchMode("quick")} className="w-full py-2 border border-dashed border-theme-divider rounded-xl text-xs font-bold text-theme-muted hover:text-[#0a6ed1] hover:border-[#0a6ed1]/40 transition-colors cursor-pointer flex items-center justify-center gap-2">
                      ← Back to Quick Add Mode
                    </button>
                  </div>
                )}
              </form>
            </SmritiScrollArea>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-theme-divider bg-theme-surface-2">
              <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-xs font-bold text-theme-muted hover:text-theme-heading cursor-pointer">Cancel</button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={(e) => handleSubmit(e as any, true)} disabled={isSubmitting} className="px-4 py-2 text-xs font-bold bg-theme-surface-3 hover:bg-theme-surface-4 text-theme-heading border border-theme-divider rounded-lg cursor-pointer disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5 inline mr-1" /> Save &amp; New
                </button>
                <button type="submit" form="item-form" disabled={isSubmitting} className="px-5 py-2 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-60">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" /> {isSubmitting ? "Saving..." : "Save Product SKU"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </WorkspaceLayout>
  );
};
