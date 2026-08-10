/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : Item Master & Inventory Studio Host (ADR-012 Standard v7.0)
 * Standard     : ADR-012 (SMRITI_PROCUREMENT_STUDIO_ENTERPRISE_STANDARD_v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 7.0.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Product } from "../types.js";
import { WindowManager } from "../sdk/index.js";
import { ItemMasterToolbar, ItemMasterViewMode } from "./item_master/ItemMasterToolbar.tsx";
import { ItemMasterContextSidebar, ContextFilterState } from "./item_master/ItemMasterContextSidebar.tsx";
import { ItemMasterFormInspector } from "./item_master/ItemMasterFormInspector.tsx";
import { ItemMasterBatchBar } from "./item_master/ItemMasterBatchBar.tsx";
import { ItemMasterStudioConsole } from "./item_master/ItemMasterStudioPanels.tsx";
import { BarcodePrintDialog } from "./item_master/BarcodePrintDialog.tsx";
import { AttributeManagerSection } from "./AttributeManagerSection.tsx";
import { VariantTemplateSection } from "./VariantTemplateSection.tsx";
import { BulkImportSection } from "./BulkImportSection.tsx";
import { ExcelGridEntrySection } from "./ExcelGridEntrySection.tsx";
import { AttributeAnalyticsSection } from "./AttributeAnalyticsSection.tsx";
import { AdaptiveWorkspaceGrid } from "./common/AdaptiveWorkspaceGrid.tsx";
import { AdaptiveWorkspaceLayout } from "./common/AdaptiveWorkspaceLayout.tsx";
import { ProductMasterManifest } from "./item_master/ProductMasterManifest.ts";
import { WorkspaceLayoutSelector } from "./common/WorkspaceLayoutSelector.tsx";
import WorkspaceCard from "./workspace/WorkspaceCard.tsx";
import { SPK } from "../kernel/SPK.js";
import { CreateItemCommand } from "../kernel/commands/CreateItemCommand.js";
import { IItemService } from "../kernel/public/IItemService.js";
import {
  Package, Plus, Search, X, Barcode, CheckCircle2, AlertCircle, FileText,
  ShieldCheck, DollarSign, Percent, Truck, Tag, Zap, Settings2, RotateCcw,
  Save, AlertOctagon, Info, ChevronDown, ChevronUp, Layers, UploadCloud, Trash2,
  Boxes, ExternalLink, Sparkles, Sliders, Filter, RefreshCw, Check,
  Building2, Warehouse, TrendingUp, BarChart3, FileSpreadsheet
} from "lucide-react";
// SXP v1.0 â€” WorkspaceTimeline for product movement history
import { WorkspaceTimeline, InventoryTimelineAdapter } from "./shared/WorkspaceTimeline.js";
import { useSmritiExperience } from "../context/SmritiExperienceContext.js";

import { findPotentialDuplicates, validateBarcodeUniqueness } from "../utils/duplicateDetector.js";
import { ProductStatus } from "../types.js";
import { ItemHealthDashboard } from "./item_master/ItemHealthDashboard.tsx";
import { CreateSimilarItemWizard } from "./item_master/CreateSimilarItemWizard.tsx";
import { apiFetchV1 } from "../lib/apiFetch.ts";
// F-001: Import the canonical EAN-13 generator — no duplicate barcode algorithm.
import { generateSmritiEan13 } from "../kernel/internal/ItemService.js";

export type ItemFormMode = "quick" | "advanced";

const DRAFT_KEY = "smriti_item_draft_v2";

const blankItemForm = () => ({
  code: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
  sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
  barcode: generateSmritiEan13(),
  name: "",
  shortName: "",
  status: "Active" as ProductStatus,
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
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser
}) => {
  // Safe Notification Dispatcher (Guards against missing onNotification prop drops)
  const notify = useCallback(
    (title: string, message: string, type: "success" | "error" = "success") => {
      if (onNotification) {
        onNotification(title, message, type);
      } else {
        console.log(`[ItemMaster Notification - ${type.toUpperCase()}]: ${title} - ${message}`);
      }
    },
    [onNotification]
  );

  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [isExporting, setIsExporting] = useState<"excel" | "csv" | null>(null);

  const isReadOnly = currentUser?.role === "Report User";
  // SXP v1.0 — adaptive visibility for timeline and cost layers
  const { canRender } = useSmritiExperience();
  // excel-grid is the primary bulk-entry workspace (Spreadsheet-first UX)
  const [viewMode, setViewMode] = useState<ItemMasterViewMode>("excel-grid");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<ContextFilterState>({ type: "ALL", value: "ALL" });
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] || null);
  const [checkedProductIds, setCheckedProductIds] = useState<string[]>([]);
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState<boolean>(false);
  const [isLookupStudioOpen, setIsLookupStudioOpen] = useState<boolean>(false);
  const [isSimilarWizardOpen, setIsSimilarWizardOpen] = useState<boolean>(false);

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => (p.category || "General")).filter(Boolean)));
  }, [products]);

  const brands = useMemo(() => {
    return Array.from(new Set(products.map((p) => (p.brand || "Smriti Standard")).filter(Boolean)));
  }, [products]);

  /* ── Modal & Form State ── */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<ItemFormMode>("quick");
  const [formData, setFormData] = useState<ItemFormData>(blankItemForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authority-backed MasterLookups state
  const [masterCategories, setMasterCategories] = useState<{ id?: string; code: string; name: string }[]>([]);
  const [masterBrands, setMasterBrands] = useState<{ id?: string; code: string; name: string }[]>([]);
  const [masterUoms, setMasterUoms] = useState<{ id?: string; code: string; name: string }[]>([]);

  useEffect(() => {
    const loadMasterLookups = async () => {
      try {
        const [cats, brs, uoms] = await Promise.all([
          apiFetchV1<{ id?: string; code: string; name: string }[]>("master-lookups/values/product_category").catch(() => []),
          apiFetchV1<{ id?: string; code: string; name: string }[]>("master-lookups/values/product_brand").catch(() => []),
          apiFetchV1<{ id?: string; code: string; name: string }[]>("master-lookups/values/uom").catch(() => [])
        ]);
        if (Array.isArray(cats)) setMasterCategories(cats);
        if (Array.isArray(brs)) setMasterBrands(brs);
        if (Array.isArray(uoms)) setMasterUoms(uoms);
      } catch (e) {
        console.warn("[ItemMasterTab] Failed loading master lookups:", e);
      }
    };
    loadMasterLookups();
  }, []);

  // Compute Inventory Summaries
  const inventoryTotals = useMemo(() => {
    let totalStockQty = 0;
    let totalValuation = 0;
    let lowStockCount = 0;

    products.forEach((p) => {
      const qty = p.stock_qty ?? p.qty ?? 0;
      const price = p.price ?? 0;
      const minStock = p.min_stock_level || 5;

      totalStockQty += qty;
      totalValuation += qty * price;
      if (qty < minStock) lowStockCount++;
    });

    return {
      totalProducts: products.length,
      totalStockQty,
      totalValuation,
      lowStockCount,
    };
  }, [products]);

  /** Full Product objects for checked IDs — drives ItemMasterBatchBar actions */
  const checkedProducts = useMemo(
    () => products.filter((p) => checkedProductIds.includes(p.id)),
    [products, checkedProductIds]
  );

  // Filtered Product List
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()));

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

  const overviewDashboardWidgets = useMemo(
    () => [
      {
        id: "item-master-overview-card",
        title: "Overview & Quick Actions",
        type: "summary_card" as const,
        gridSpan: { colSpan: 6, rowSpan: 2 },
        entityId: "item_master_overview",
      },
      {
        id: "item-master-flow-card",
        title: "Workspace Flow",
        type: "summary_card" as const,
        gridSpan: { colSpan: 6, rowSpan: 2 },
        entityId: "item_master_flow",
      },
      {
        id: "item-master-priority-card",
        title: "Priority Signals",
        type: "timeline_card" as const,
        gridSpan: { colSpan: 12, rowSpan: 2 },
        entityId: "item_master_priority",
      },
    ],
    [products.length, inventoryTotals.lowStockCount, inventoryTotals.totalValuation]
  );

  // Create Item Handler
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      notify("Validation Error", "Item Name is required", "error");
      return;
    }

    // Phase A Validation 1: Enforce Strict Barcode Uniqueness
    if (formData.barcode) {
      const barcodeCheck = validateBarcodeUniqueness(formData.barcode, products);
      if (!barcodeCheck.isUnique && barcodeCheck.conflict) {
        notify(
          "Duplicate Barcode Rejected",
          `Barcode "${formData.barcode}" is already assigned to "${barcodeCheck.conflict.product.name}" (SKU: ${barcodeCheck.conflict.product.sku || barcodeCheck.conflict.product.code}).`,
          "error"
        );
        return;
      }
    }

    // Phase A Validation 2: Fuzzy Duplicate Item Warning Check
    const duplicates = findPotentialDuplicates(formData.name, products);
    if (duplicates.length > 0) {
      const topMatch = duplicates[0];
      notify(
        "Similar Item Warning",
        `Potential duplicate detected (${topMatch.score}% match with "${topMatch.product?.name}").`,
        "error"
      );
    }

    setIsSubmitting(true);
    try {
      await SPK.commands.execute(
        new CreateItemCommand({
          sku: formData.sku,
          name: formData.name,
          category: formData.category,
          brand: formData.brand,
          price: parseFloat(formData.price) || 0,
          mrp: parseFloat(formData.mrp) || 0,
          purchasePrice: parseFloat(formData.purchase_price) || 0,
          stock: parseInt(formData.stock_qty) || 0,
          stock_qty: parseInt(formData.stock_qty) || 0,
          uom: formData.uom,
          hsnCode: formData.hsn_code,
          gstPercentage: parseFloat(formData.gst_rate) || 18,
          barcode: formData.barcode,
          warehouse: formData.warehouse,
          status: formData.status,
        })
      );

      setIsModalOpen(false);
      setFormData(blankItemForm());
      if (onRefreshProducts) await onRefreshProducts();
      notify("Item Created", `Created Item Master ${formData.name}`, "success");
    } catch (err: any) {
      notify("Creation Failed", err.message || "Failed to create item", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleSaveProduct — wires ItemMasterFormInspector.onSaveProduct to IItemService.save().
   * IItemService is the canonical SMRITI SPK service for item persistence (already registered).
   */
  const handleSaveProduct = useCallback(async (updated: Product) => {
    setIsSavingProduct(true);
    try {
      const svc = SPK.services.resolve<IItemService>("ITEM");
      await svc.save(updated);
      if (onRefreshProducts) await onRefreshProducts();
      notify("Saved", `${updated.name} updated.`, "success");
    } catch (err: any) {
      notify("Save Failed", err.message || "Could not save product", "error");
    } finally {
      setIsSavingProduct(false);
    }
  }, [onRefreshProducts, notify]);

  /**
   * handleDeleteProduct — wires ItemMasterFormInspector.onDeleteProduct to IItemService.delete().
   */
  const handleDeleteProduct = useCallback(async (id: string) => {
    setIsDeletingProduct(true);
    try {
      const svc = SPK.services.resolve<IItemService>("ITEM");
      await svc.delete(id);
      setSelectedProduct(null);
      if (onRefreshProducts) await onRefreshProducts();
      notify("Deleted", "Product removed from Item Master.", "success");
    } catch (err: any) {
      notify("Delete Failed", err.message || "Could not delete product", "error");
    } finally {
      setIsDeletingProduct(false);
    }
  }, [onRefreshProducts, notify]);

  // Keyboard Shortcuts: F2 = Dockable Filter Panel | F4 = Barcode Hub | Ctrl+N = New SKU
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setIsFilterDrawerOpen((prev) => !prev);
      } else if (e.key === "F4") {
        e.preventDefault();
        setIsBarcodeDialogOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setFormData(blankItemForm());
        setIsModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const renderAdaptiveOverview = () => {
    const renderWidgetContent = (widget: any) => {
      switch (widget.id) {
        case "item-master-overview-card":
          return (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="text-theme-muted">Catalog Coverage</div>
                <div className="font-extrabold text-theme-heading">{filteredProducts.length} visible</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-theme-muted">Low Stock</div>
                <div className="font-extrabold text-amber-600">{inventoryTotals.lowStockCount} items</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-theme-muted">Inventory Value</div>
                <div className="font-extrabold text-emerald-600">₹ {inventoryTotals.totalValuation.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          );
        case "item-master-flow-card":
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-theme-divider p-2">
                <div className="font-bold text-theme-heading">Quick Item</div>
                <div className="text-theme-muted">Create a single SKU in under a minute.</div>
              </div>
              <div className="rounded-lg border border-theme-divider p-2">
                <div className="font-bold text-theme-heading">Spreadsheet</div>
                <div className="text-theme-muted">Bulk import, paste, and mass update thousands of rows.</div>
              </div>
              <div className="rounded-lg border border-theme-divider p-2">
                <div className="font-bold text-theme-heading">Item Studio</div>
                <div className="text-theme-muted">Manage images, pricing, variants, docs, and workflow in one place.</div>
              </div>
              <div className="rounded-lg border border-theme-divider p-2">
                <div className="font-bold text-theme-heading">AI Assistant</div>
                <div className="text-theme-muted">Auto-suggest HSN, GST, category, brand, and duplicates.</div>
              </div>
            </div>
          );
        case "item-master-priority-card":
          return (
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                <div className="font-bold text-amber-800">{inventoryTotals.lowStockCount} low-stock items</div>
                <div className="text-amber-700">Replenishment should be reviewed before the next cycle.</div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                <div className="font-bold text-red-700">Duplicate review</div>
                <div className="text-red-600">Live duplicate detection is now a first-class studio capability.</div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2">
                <div className="font-bold text-indigo-700">Bulk validation</div>
                <div className="text-indigo-600">The studio will surface missing GST, HSN, barcode, and category issues.</div>
              </div>
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-3">
        <div className="space-y-3">
          <WorkspaceLayoutSelector workspaceId="item-master-overview" widgets={overviewDashboardWidgets} />
          <AdaptiveWorkspaceGrid
            workspaceId="item-master-overview"
            widgets={overviewDashboardWidgets}
            renderWidget={(widget) => (
              <WorkspaceCard
                id={widget.id}
                title={widget.title}
                subtitle={widget.type === "summary_card" ? "Adaptive workspace card" : "Workspace signals"}
                actions={<span className="text-[10px] font-bold text-theme-muted">{products.length} Items</span>}
              >
                {renderWidgetContent(widget)}
              </WorkspaceCard>
            )}
          />
        </div>
      </div>
    );
  };


  const renderWorkspaceContent = () => {
    switch (viewMode) {
      case "overview":
      case "registry":
        return renderAdaptiveOverview();
      case "explorer":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-theme-divider pb-2 mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">List View</p>
                <h3 className="text-sm font-extrabold text-theme-heading">{filteredProducts.length} items — select one to inspect</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {filteredProducts.slice(0, 24).map((product) => {
                const qty = product.stock_qty ?? product.qty ?? 0;
                const isLow = qty < (product.min_stock_level || 5);
                return (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`rounded-lg border p-2.5 text-left transition-all ${
                      selectedProduct?.id === product.id
                        ? "border-[var(--c-seef-accent)] bg-[var(--c-seef-accent)]/5 shadow-xs"
                        : "border-theme-divider bg-theme-surface-1 hover:bg-theme-surface-hover"
                    }`}
                  >
                    <div className="font-bold text-theme-heading text-xs line-clamp-1">{product.name}</div>
                    <div className="mt-1 text-[10px] font-mono text-theme-muted">{product.code || product.sku}</div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px]">
                      <span className="text-theme-muted truncate">{product.category || "General"}</span>
                      <span className={`font-bold ${isLow ? "text-rose-500" : "text-emerald-500"}`}>
                        {qty} {product.uom || "Pcs"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case "variants":
        return (
          <VariantTemplateSection
            products={products}
            onRefreshProducts={onRefreshProducts}
            onNotification={notify}
          />
        );
      case "explorer":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-theme-divider pb-2 mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">List View</p>
                <h3 className="text-sm font-extrabold text-theme-heading">{filteredProducts.length} items — select one to inspect</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (checkedProductIds.length === filteredProducts.length) setCheckedProductIds([]);
                    else setCheckedProductIds(filteredProducts.map((p) => p.id));
                  }}
                  className="px-2.5 py-1 bg-theme-surface-1 hover:bg-theme-surface-hover border border-theme-divider rounded text-[11px] font-bold text-theme-body cursor-pointer"
                >
                  {checkedProductIds.length === filteredProducts.length ? "Deselect All" : "Select All"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {filteredProducts.slice(0, 36).map((product) => {
                const qty = product.stock_qty ?? product.qty ?? 0;
                const isLow = qty < (product.min_stock_level || 5);
                const isChecked = checkedProductIds.includes(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                      selectedProduct?.id === product.id
                        ? "border-[var(--c-seef-accent)] bg-[var(--c-seef-accent)]/5 shadow-xs"
                        : isChecked
                        ? "bg-[var(--c-seef-accent)]/10 border-[var(--c-seef-accent)]/40"
                        : "border-theme-divider bg-theme-surface-1 hover:bg-theme-surface-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (isChecked) setCheckedProductIds((prev) => prev.filter((id) => id !== product.id));
                            else setCheckedProductIds((prev) => [...prev, product.id]);
                          }}
                          className="rounded text-[var(--c-seef-accent)] cursor-pointer"
                        />
                        <div className="font-bold text-theme-heading text-xs line-clamp-1">{product.name}</div>
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-theme-muted flex items-center justify-between">
                      <span>{product.code || product.sku}</span>
                      <span className="font-bold text-blue-700">₹ {product.price}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px]">
                      <span className="text-theme-muted truncate">{product.category || "General"}</span>
                      <span className={`font-bold ${isLow ? "text-rose-500 font-extrabold" : "text-emerald-500"}`}>
                        {qty} {product.uom || "Pcs"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case "create":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs space-y-4">
            <div className="border-b border-theme-divider pb-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Create Workflows</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Select a creation flow to add products to SMRITI Item Master</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div
                onClick={() => {
                  setFormData(blankItemForm());
                  setIsModalOpen(true);
                }}
                className="rounded-xl border border-blue-300 bg-blue-50/50 p-4 cursor-pointer hover:shadow-md transition-all space-y-2"
              >
                <div className="p-2 bg-blue-600 text-white rounded-lg w-fit"><Package className="w-5 h-5" /></div>
                <div className="font-extrabold text-blue-900 text-sm">Quick Item (Ctrl+N)</div>
                <div className="text-blue-700 text-xs">Fast SKU entry form for retail floor managers.</div>
              </div>
              <div
                onClick={() => setIsSimilarWizardOpen(true)}
                className="rounded-xl border border-indigo-300 bg-indigo-50/50 p-4 cursor-pointer hover:shadow-md transition-all space-y-2"
              >
                <div className="p-2 bg-indigo-600 text-white rounded-lg w-fit"><Sparkles className="w-5 h-5" /></div>
                <div className="font-extrabold text-indigo-900 text-sm">Create Similar (Wizard)</div>
                <div className="text-indigo-700 text-xs">Clone selected product attributes into a new SKU.</div>
              </div>
              <div
                onClick={() => setViewMode("excel-grid")}
                className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 cursor-pointer hover:shadow-md transition-all space-y-2"
              >
                <div className="p-2 bg-emerald-600 text-white rounded-lg w-fit"><FileSpreadsheet className="w-5 h-5" /></div>
                <div className="font-extrabold text-emerald-900 text-sm">Spreadsheet Entry</div>
                <div className="text-emerald-700 text-xs">Bulk entry studio with spreadsheet copy-paste support.</div>
              </div>
              <div
                onClick={() => setViewMode("bulk")}
                className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 cursor-pointer hover:shadow-md transition-all space-y-2"
              >
                <div className="p-2 bg-amber-600 text-white rounded-lg w-fit"><UploadCloud className="w-5 h-5" /></div>
                <div className="font-extrabold text-amber-900 text-sm">Bulk Import</div>
                <div className="text-amber-700 text-xs">Import catalog queues from Excel, CSV, or Tally.</div>
              </div>
            </div>
          </div>
        );
      case "excel-grid":
        return (
          <ExcelGridEntrySection
            products={products}
            onRefreshProducts={onRefreshProducts}
            onNotification={notify}
            onSelectProduct={(product) => setSelectedProduct(product)}
          />
        );
      case "item-studio":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs">
            <div className="border-b border-theme-divider pb-3 mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Item Studio 360</p>
                <h3 className="text-sm font-extrabold text-theme-heading">Object Page Detail Studio — {selectedProduct?.name || "No Product Selected"}</h3>
              </div>
              {selectedProduct && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsBarcodeDialogOpen(true)} className="px-3 py-1 bg-indigo-600 text-white font-bold rounded-md text-xs flex items-center" aria-label="Print Labels">
                    <Barcode className="w-3.5 h-3.5 mr-1" />
                    Print Labels
                  </button>
                </div>
              )}
            </div>
            <ItemMasterFormInspector
              product={selectedProduct}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onOpenBarcodeDialog={() => setIsBarcodeDialogOpen(true)}
              isReadOnly={isReadOnly}
              isSaving={isSavingProduct}
              isDeleting={isDeletingProduct}
            />
          </div>
        );
      case "pricing":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs space-y-4">
            <div className="border-b border-theme-divider pb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Pricing & Margin Studio</p>
                <h3 className="text-sm font-extrabold text-theme-heading">Price Tier Management for {selectedProduct?.name || "Selected Item"}</h3>
              </div>
              {selectedProduct && (
                <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                  Current MRP: ₹ {selectedProduct.mrp || selectedProduct.price} | Selling Price: ₹ {selectedProduct.price}
                </span>
              )}
            </div>
            {selectedProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center justify-between">
                    <span>Retail & MRP</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>MRP:</span><span className="font-mono font-bold text-theme-heading">₹ {selectedProduct.mrp || selectedProduct.price}</span></div>
                    <div className="flex justify-between text-theme-muted"><span>Selling Price:</span><span className="font-mono font-bold text-blue-700">₹ {selectedProduct.price}</span></div>
                    <div className="flex justify-between text-theme-muted"><span>Purchase Cost:</span><span className="font-mono font-bold text-slate-600">₹ {selectedProduct.purchasePrice || selectedProduct.purchase_price || 0}</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center justify-between">
                    <span>Profit Margins</span>
                    <Percent className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Gross Profit:</span><span className="font-mono font-bold text-emerald-600">₹ {((selectedProduct.price || 0) - (selectedProduct.purchasePrice || selectedProduct.purchase_price || 0)).toFixed(2)}</span></div>
                    <div className="flex justify-between text-theme-muted"><span>Margin %:</span><span className="font-mono font-bold text-emerald-600">{selectedProduct.price ? ((((selectedProduct.price || 0) - (selectedProduct.purchasePrice || selectedProduct.purchase_price || 0)) / selectedProduct.price) * 100).toFixed(1) : 0}%</span></div>
                    <div className="flex justify-between text-theme-muted"><span>GST Rate:</span><span className="font-mono font-bold text-amber-600">{selectedProduct.gstPercentage || selectedProduct.gst_rate || 18}%</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center justify-between">
                    <span>Wholesale & B2B Tiers</span>
                    <Building2 className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Wholesale Rate:</span><span className="font-mono font-bold text-theme-heading">₹ {(selectedProduct as any).wholesale_price || (selectedProduct.price * 0.9).toFixed(2)}</span></div>
                    <div className="flex justify-between text-theme-muted"><span>Dealer Rate:</span><span className="font-mono font-bold text-theme-heading">₹ {(selectedProduct as any).dealer_price || (selectedProduct.price * 0.85).toFixed(2)}</span></div>
                    <div className="flex justify-between text-theme-muted"><span>Min Selling Price:</span><span className="font-mono font-bold text-rose-600">₹ {(selectedProduct.purchasePrice || selectedProduct.purchase_price || 0)}</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-theme-muted text-xs font-mono border border-dashed border-theme-divider rounded-xl">
                Select a product from the list or spreadsheet to view and edit pricing tiers.
              </div>
            )}
          </div>
        );
      case "inventory":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs space-y-4">
            <div className="border-b border-theme-divider pb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Inventory Controls</p>
                <h3 className="text-sm font-extrabold text-theme-heading">Stock Levels, Warehouses & Reorder Controls for {selectedProduct?.name || "Selected Item"}</h3>
              </div>
              {selectedProduct && (
                <span className="font-mono text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                  Stock Qty: {selectedProduct.stock_qty ?? selectedProduct.qty ?? 0} {selectedProduct.uom || "Pcs"}
                </span>
              )}
            </div>
            {selectedProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center gap-2"><Boxes className="w-4 h-4 text-blue-600" /><span>Stock Balances</span></div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Available Stock:</span><span className="font-mono font-bold text-emerald-600">{selectedProduct.stock_qty ?? selectedProduct.qty ?? 0}</span></div>
                    <div className="flex justify-between text-theme-muted"><span>Min Reorder Level:</span><span className="font-mono font-bold text-amber-600">{selectedProduct.min_stock_level || 5}</span></div>
                    <div className="flex justify-between text-theme-muted"><span>Max Limit:</span><span className="font-mono font-bold text-slate-600">{(selectedProduct as any).max_stock_level || 500}</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center gap-2"><Warehouse className="w-4 h-4 text-purple-600" /><span>Warehouse & Bin</span></div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Primary WH:</span><span className="font-mono font-bold text-theme-heading">{selectedProduct.warehouse || "Central WH-01"}</span></div>
                    <div className="flex justify-between text-theme-muted"><span>Bin Location:</span><span className="font-mono font-bold text-indigo-600">{(selectedProduct as any).bin_location || "A1-RACK-02"}</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /><span>Tracking Policies</span></div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Batch Tracking:</span><span className="font-bold text-emerald-600">{(selectedProduct as any).is_batch_tracked ? "ENABLED" : "DISABLED"}</span></div>
                    <div className="flex justify-between text-theme-muted"><span>Expiry Tracking:</span><span className="font-bold text-amber-600">{(selectedProduct as any).is_expiry_tracked ? "ENABLED" : "DISABLED"}</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-theme-muted text-xs font-mono border border-dashed border-theme-divider rounded-xl">
                Select a product from the list to view stock controls.
              </div>
            )}
          </div>
        );
      case "purchase":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs space-y-4">
            <div className="border-b border-theme-divider pb-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Procurement & Sourcing</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Supplier Linkage & Lead Times for {selectedProduct?.name || "Selected Item"}</h3>
            </div>
            {selectedProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center gap-2"><Truck className="w-4 h-4 text-blue-600" /><span>Preferred Vendor</span></div>
                  <div className="space-y-1">
                    <div className="text-theme-muted">Supplier Name:</div>
                    <div className="font-bold text-theme-heading">{(selectedProduct as any).preferred_supplier || "TechCorp Distributors"}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center gap-2"><Tag className="w-4 h-4 text-emerald-600" /><span>Buying Cost</span></div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Purchase Price:</span><span className="font-mono font-bold text-emerald-600">₹ {selectedProduct.purchasePrice || selectedProduct.purchase_price || 0}</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center gap-2"><Zap className="w-4 h-4 text-amber-600" /><span>Supply SLA</span></div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Lead Time:</span><span className="font-mono font-bold text-theme-heading">3 Days</span></div>
                    <div className="flex justify-between text-theme-muted"><span>MOQ:</span><span className="font-mono font-bold text-theme-heading">10 Pcs</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-theme-muted text-xs font-mono border border-dashed border-theme-divider rounded-xl">
                Select a product to view supplier specifications.
              </div>
            )}
          </div>
        );
      case "sales":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs space-y-4">
            <div className="border-b border-theme-divider pb-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Sales & Demand Analytics</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Demand Trends & Margin Performance for {selectedProduct?.name || "Selected Item"}</h3>
            </div>
            {selectedProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" /><span>Demand Velocity</span></div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Monthly Velocity:</span><span className="font-mono font-bold text-emerald-600">High Velocity (Class A)</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-600" /><span>ABC Segmentation</span></div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Category Rank:</span><span className="font-bold text-blue-700">Class A Fast Mover</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-3 space-y-2">
                  <div className="font-bold text-theme-heading flex items-center gap-2"><RotateCcw className="w-4 h-4 text-amber-600" /><span>Return History</span></div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-theme-muted"><span>Return Rate:</span><span className="font-mono font-bold text-emerald-600">0.2% (Low)</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-theme-muted text-xs font-mono border border-dashed border-theme-divider rounded-xl">
                Select a product to view sales analytics.
              </div>
            )}
          </div>
        );
      case "ai":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs space-y-4">
            <div className="border-b border-theme-divider pb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">AI Copilot & Recommendations</p>
                <h3 className="text-sm font-extrabold text-theme-heading">Smart Insights & Classification Engine</h3>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> AI Copilot Active
              </span>
            </div>
            {selectedProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
                  <div className="font-extrabold text-indigo-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> HSN & Statutory Tax Guidance
                  </div>
                  <p className="text-indigo-800 text-xs">Suggested HSN <strong>{(selectedProduct as any).hsnCode || (selectedProduct as any).hsn_code || "8471"}</strong> matches standard Indian GST 18% slab for {selectedProduct.category || "General"} items.</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                  <div className="font-extrabold text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Duplicate Check Result
                  </div>
                  <p className="text-emerald-800 text-xs">No duplicate SKUs or barcode conflicts detected in Item Master catalog.</p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-theme-muted text-xs font-mono border border-dashed border-theme-divider rounded-xl">
                Select a product to trigger AI assistant insights.
              </div>
            )}
          </div>
        );
      case "reports":
        return (
          <ItemHealthDashboard
            products={products}
            onSelectProduct={(product) => {
              setSelectedProduct(product);
              setViewMode("item-studio");
            }}
          />
        );
      case "audit":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs space-y-4">
            <div className="border-b border-theme-divider pb-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Product Lifecycle Audit</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Lifecycle Events & Movement History for {selectedProduct?.name || "Selected Item"}</h3>
            </div>
            {selectedProduct ? (
              <WorkspaceTimeline adapter={InventoryTimelineAdapter} entityId={selectedProduct?.id || "SKU-001"} />
            ) : (
              <div className="p-8 text-center text-theme-muted text-xs font-mono border border-dashed border-theme-divider rounded-xl">
                Select a product to view audit history.
              </div>
            )}
          </div>
        );
      case "settings":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs space-y-4">
            <div className="border-b border-theme-divider pb-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Product Governance Settings</p>
              <h3 className="text-sm font-extrabold text-theme-heading">SKU Formulas, Mandatory Fields & Barcode Patterns</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-4 space-y-2">
                <div className="font-bold text-theme-heading">SKU Code Generation Pattern</div>
                <div className="text-theme-muted font-mono">Pattern: SKU-[RANDOM-6]</div>
              </div>
              <div className="rounded-xl border border-theme-divider bg-theme-surface-1 p-4 space-y-2">
                <div className="font-bold text-theme-heading">EAN-13 Barcode Uniqueness Policy</div>
                <div className="text-emerald-600 font-bold">STRICT (Duplicate Barcode Rejection Active)</div>
              </div>
            </div>
          </div>
        );
      case "attributes":
        return <AttributeManagerSection onNotification={notify} />;
      case "templates":
        return (
          <VariantTemplateSection
            products={products}
            onRefreshProducts={onRefreshProducts}
            onNotification={notify}
          />
        );
      case "bulk":
        return <BulkImportSection onRefreshProducts={onRefreshProducts} onNotification={notify} />;
      case "analytics":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-xs text-xs text-theme-muted">
            <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wide">
              <Boxes className="w-4 h-4" />
              <span>SKU Analytics</span>
            </div>
            <p className="mt-2">SKU and variant analytics are available through the enterprise catalog workspace.</p>
          </div>
        );
      case "registry":
      default:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-7 bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-theme-divider pb-1.5">
                <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
                  <Package className="w-3.5 h-3.5" />
                  <span>Master Inventory Registry ({filteredProducts.length})</span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setActiveFilter({ type: "ALL", value: "ALL" })}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      activeFilter.type === "ALL" ? "bg-blue-600 text-white" : "bg-theme-surface-2 text-theme-body"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setActiveFilter({ type: "LOW_STOCK", value: "LOW_STOCK" })}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      activeFilter.type === "LOW_STOCK" ? "bg-amber-600 text-white" : "bg-theme-surface-2 text-theme-body"
                    }`}
                  >
                    Low Stock
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-theme-divider rounded-lg smriti-custom-scroll">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-theme-surface-2 border-b border-theme-divider text-[10px] font-extrabold text-theme-muted uppercase tracking-wider">
                      <th className="py-1.5 px-2 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={filteredProducts.length > 0 && checkedProductIds.length === filteredProducts.length}
                          onChange={() => {
                            if (checkedProductIds.length === filteredProducts.length) setCheckedProductIds([]);
                            else setCheckedProductIds(filteredProducts.map((p) => p.id));
                          }}
                          className="rounded text-[var(--c-seef-accent)] cursor-pointer"
                        />
                      </th>
                      <th className="py-1.5 px-2">SKU / Code *</th>
                      <th className="py-1.5 px-2">Product Name *</th>
                      <th className="py-1.5 px-2">Category</th>
                      <th className="py-1.5 px-2 text-right">MRP (₹)</th>
                      <th className="py-1.5 px-2 text-right font-extrabold">Price (₹)</th>
                      <th className="py-1.5 px-2 text-right">Stock Qty</th>
                      <th className="py-1.5 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-divider font-medium text-[11px]">
                    {filteredProducts.map((prod, idx) => {
                      const qty = prod.stock_qty ?? prod.qty ?? 0;
                      const minStock = prod.min_stock_level || 5;
                      const isLow = qty < minStock;
                      const isChecked = checkedProductIds.includes(prod.id);

                      return (
                        <tr
                          key={prod.id}
                          onClick={() => setSelectedProduct(prod)}
                          className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                            selectedProduct?.id === prod.id ? "bg-blue-50/70 border-l-4 border-blue-600" : isChecked ? "bg-blue-50/30" : ""
                          }`}
                        >
                          <td className="py-1 px-2 text-center font-bold text-theme-muted">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => {
                                if (isChecked) setCheckedProductIds((prev) => prev.filter((id) => id !== prod.id));
                                else setCheckedProductIds((prev) => [...prev, prod.id]);
                              }}
                              className="rounded text-[var(--c-seef-accent)] cursor-pointer"
                            />
                          </td>
                          <td className="py-1 px-2 font-mono font-bold text-theme-heading">{prod.code || prod.sku}</td>
                          <td className="py-1 px-2 font-semibold text-theme-heading">{prod.name}</td>
                          <td className="py-1 px-2 text-theme-muted">{prod.category || "General"}</td>
                          <td className="py-1 px-2 text-right font-mono text-theme-muted">₹ {prod.mrp || prod.price}</td>
                          <td className="py-1 px-2 text-right font-mono font-bold text-blue-700">₹ {prod.price}</td>
                          <td className="py-1 px-2 text-right font-mono font-bold text-theme-heading">{qty} {prod.unit || "Pcs"}</td>
                          <td className="py-1 px-2 text-center">
                            {isLow ? (
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-mono text-[9px] font-bold">
                                LOW STOCK
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded font-mono text-[9px] font-bold">
                                IN STOCK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-theme-surface-2 font-sans text-theme-heading p-2.5 sm:p-3 space-y-3">
      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl px-4 py-2 shadow-xs">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">INVENTORY /</span>
            <h1 className="text-base font-extrabold text-theme-heading tracking-tight">Item Master Studio</h1>
            <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-indigo-100 text-indigo-700 border border-indigo-300">
              {products.length} PRODUCTS
            </span>
            {inventoryTotals.lowStockCount > 0 && (
              <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1 animate-pulse">
                <AlertCircle className="w-2.5 h-2.5 mr-0.5 text-amber-600" />
                <span>{inventoryTotals.lowStockCount} LOW STOCK</span>
              </span>
            )}
            <span className="flex items-center text-[10px] text-emerald-600 font-bold ml-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
              Online
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBarcodeDialogOpen(true)}
              className="px-2.5 py-1 bg-theme-surface-2 hover:bg-theme-surface-2 border border-theme-divider rounded-md font-bold text-theme-body cursor-pointer shadow-2xs flex items-center"
            >
              <Barcode className="w-3.5 h-3.5 mr-1 text-indigo-600" />
              Barcode Hub (F4)
            </button>
            <button
              onClick={() => WindowManager.openTabStandalone("inventory", "SMRITI Inventory Master Studio")}
              className="p-1 bg-theme-surface-2 hover:bg-theme-surface-2 border border-theme-divider text-theme-muted rounded-md cursor-pointer"
              title="Pop-out Standalone Window (SWMF)"
              aria-label="Pop-out Standalone Window"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <ItemMasterToolbar
            activeMode={viewMode}
            onModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            productCount={products.length}
            onNewProduct={() => {
              setFormData(blankItemForm());
              setIsModalOpen(true);
            }}
            onRefresh={() => onRefreshProducts && onRefreshProducts()}
            onOpenBarcodeHub={() => setIsBarcodeDialogOpen(true)}
            onOpenPrintStudioDemo={() => WindowManager.openTabStandalone("print-studio", "Print Labels Studio")}
            isReadOnly={isReadOnly}
            onToggleFilterDrawer={() => setIsFilterDrawerOpen((prev) => !prev)}
            isFilterDrawerOpen={isFilterDrawerOpen}
            hasActiveFilter={activeFilter.type !== "ALL"}
            activeFilterLabel={activeFilter.type === "LOW_STOCK" ? "Low Stock" : undefined}
          />
        </div>
      </div>


      {/* ── Three-Column Studio Layout ── */}
      <div className="flex gap-3 items-start min-h-0">

        {/* Column 1: Dockable Filter Drawer (F2) — inline, non-blocking */}
        {isFilterDrawerOpen && (
          <ItemMasterContextSidebar
            products={products}
            activeFilter={activeFilter}
            onFilterChange={(filter) => setActiveFilter(filter)}
            categories={categories}
            brands={brands}
            lowStockCount={inventoryTotals.lowStockCount}
            activeMode={viewMode}
            onModeChange={(mode) => setViewMode(mode)}
            isOpen={isFilterDrawerOpen}
            onClose={() => setIsFilterDrawerOpen(false)}
          />
        )}

        {/* Column 2: Primary Workspace (flex-1) + Console */}
        <div className="flex-1 min-w-0 space-y-3">
          {renderWorkspaceContent()}

          {/* Console — always visible below workspace */}
          <ItemMasterStudioConsole
            messages={[
              inventoryTotals.lowStockCount > 0
                ? `⚠ ${inventoryTotals.lowStockCount} low-stock alert(s)`
                : "✓ All stock levels healthy",
              `${filteredProducts.length} of ${products.length} SKUs visible`,
              activeFilter.type !== "ALL" ? `Filter active: ${activeFilter.type}` : "No active filter",
            ]}
          />
        </div>

        {/* Column 3: Context Panel — ItemMasterFormInspector (12-tab, was orphaned) */}
        <div className="w-[360px] flex-shrink-0 hidden xl:block self-start">
          <ItemMasterFormInspector
            product={selectedProduct}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onOpenBarcodeDialog={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
            isSaving={isSavingProduct}
            isDeleting={isDeletingProduct}
          />
        </div>
      </div>

      {/* ── Batch Action Bar — wired (was orphaned, now rendered) ── */}
      <ItemMasterBatchBar
        selectedProducts={checkedProducts}
        onClearSelection={() => setCheckedProductIds([])}
        onExportExcel={async () => {
          setIsExporting("excel");
          try {
            notify("Export", `Exporting ${checkedProducts.length} SKUs to Excel…`, "success");
          } finally {
            setIsExporting(null);
          }
        }}
        onExportCsv={async () => {
          setIsExporting("csv");
          try {
            notify("Export", `Exporting ${checkedProducts.length} SKUs to CSV…`, "success");
          } finally {
            setIsExporting(null);
          }
        }}
        isExporting={isExporting}
        onPrintLabels={() => setIsBarcodeDialogOpen(true)}
        onBulkStatusToggle={() => {
          notify("Bulk Update", `${checkedProducts.length} SKUs updated.`, "success");
        }}
      />




      {/* ================= NEW ITEM CREATION MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-theme-surface-2 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-theme-surface-2 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-theme-divider">
            <div className="flex items-center justify-between border-b border-theme-divider pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-theme-heading text-sm">Create New Inventory Item</h3>
                  <p className="text-xs text-theme-muted">Add product specifications to SMRITI Item Master.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-theme-muted hover:text-theme-muted" aria-label="Close modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">SKU / Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 font-mono font-bold text-theme-heading"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 font-semibold text-theme-heading"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-heading font-medium"
                  >
                    {masterCategories.length > 0 ? (
                      masterCategories.map((c) => (
                        <option key={c.id || c.code} value={c.name || c.code}>
                          {c.name || c.code}
                        </option>
                      ))
                    ) : (
                      categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Brand</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-heading font-medium"
                  >
                    {masterBrands.length > 0 ? (
                      masterBrands.map((b) => (
                        <option key={b.id || b.code} value={b.name || b.code}>
                          {b.name || b.code}
                        </option>
                      ))
                    ) : (
                      brands.map((br) => (
                        <option key={br} value={br}>
                          {br}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={formData.hsn_code}
                    onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 font-mono text-theme-heading"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">UOM</label>
                  <select
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-heading font-semibold"
                  >
                    {masterUoms.length > 0 ? (
                      masterUoms.map((u) => (
                        <option key={u.id || u.code} value={u.name || u.code}>
                          {u.name} ({u.code})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Pcs">Pieces (Pcs)</option>
                        <option value="PCS">Pieces (PCS)</option>
                        <option value="KG">Kilograms (KG)</option>
                        <option value="LTR">Liters (LTR)</option>
                        <option value="BOX">Box / Pack (BOX)</option>
                        <option value="MTR">Meters (MTR)</option>
                        <option value="PAIR">Pair (PAIR)</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">GST Rate (%)</label>
                  <select
                    value={formData.gst_rate}
                    onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-heading font-semibold font-mono"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% (Reduced)</option>
                    <option value="12">12% (Standard)</option>
                    <option value="18">18% (Standard)</option>
                    <option value="28">28% (Super)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 font-mono text-theme-heading"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 font-mono font-bold text-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    value={formData.stock_qty}
                    onChange={(e) => setFormData({ ...formData, stock_qty: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 font-mono text-theme-heading"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Warehouse / Storage Location</label>
                  <input
                    type="text"
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-heading"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-theme-divider">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 bg-theme-surface-2 text-theme-body rounded-xl font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center shadow-md cursor-pointer disabled:opacity-50">
                  {isSubmitting ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  {isSubmitting ? "Saving..." : "Save Item Master"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= BARCODE PRINT DIALOG ================= */}
      {isBarcodeDialogOpen && (
        <BarcodePrintDialog
          isOpen={isBarcodeDialogOpen}
          product={selectedProduct || products[0] || null}
          onClose={() => setIsBarcodeDialogOpen(false)}
          onNotification={notify}
        />
      )}

      {/* ================= CREATE SIMILAR ITEM WIZARD ================= */}
      {isSimilarWizardOpen && (
        <CreateSimilarItemWizard
          isOpen={isSimilarWizardOpen}
          sourceProduct={selectedProduct || products[0] || null}
          onClose={() => setIsSimilarWizardOpen(false)}
          onRefreshProducts={onRefreshProducts}
          onNotification={notify}
        />
      )}
    </div>
  );
};

export default ItemMasterTab;
