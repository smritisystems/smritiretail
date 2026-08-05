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
import { WorkspaceLayoutSelector } from "./common/WorkspaceLayoutSelector.tsx";
import WorkspaceCard from "./workspace/WorkspaceCard.tsx";
import { SPK } from "../kernel/SPK.js";
import { CreateItemCommand } from "../kernel/commands/CreateItemCommand.js";
import { IItemService } from "../kernel/public/IItemService.js";
import {
  Package, Plus, Search, X, Barcode, CheckCircle2, AlertCircle, FileText,
  ShieldCheck, DollarSign, Percent, Truck, Tag, Zap, Settings2, RotateCcw,
  Save, AlertOctagon, Info, ChevronDown, ChevronUp, Layers, UploadCloud, Trash2,
  Boxes, ExternalLink, Sparkles, Sliders, Filter, RefreshCw, Check
} from "lucide-react";
// SXP v1.0 â€” WorkspaceTimeline for product movement history
import { WorkspaceTimeline, InventoryTimelineAdapter } from "./shared/WorkspaceTimeline.js";
import { useSmritiExperience } from "../context/SmritiExperienceContext.js";

export type ItemFormMode = "quick" | "advanced";

const DRAFT_KEY = "smriti_item_draft_v2";

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
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser
}) => {
  const isReadOnly = currentUser?.role === "Report User";
  // SXP v1.0 â€” adaptive visibility for timeline and cost layers
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

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => (p.category || "General")).filter(Boolean)));
  }, [products]);

  const brands = useMemo(() => {
    return Array.from(new Set(products.map((p) => (p.brand || "Smriti Standard")).filter(Boolean)));
  }, [products]);

  /* â”€â”€ Modal & Form State â”€â”€ */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<ItemFormMode>("quick");
  const [formData, setFormData] = useState<ItemFormData>(blankItemForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      if (onNotification) onNotification("Validation Error", "Item Name is required", "error");
      return;
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
        })
      );

      setIsModalOpen(false);
      setFormData(blankItemForm());
      if (onRefreshProducts) await onRefreshProducts();
      if (onNotification) onNotification("Item Created", `Created Item Master ${formData.name}`, "success");
    } catch (err: any) {
      if (onNotification) onNotification("Creation Failed", err.message || "Failed to create item", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleSaveProduct — wires ItemMasterFormInspector.onSaveProduct to IItemService.save().
   * IItemService is the canonical SMRITI SPK service for item persistence (already registered).
   */
  const handleSaveProduct = useCallback(async (updated: Product) => {
    try {
      const svc = SPK.services.resolve<IItemService>("ITEM");
      await svc.save(updated);
      if (onRefreshProducts) await onRefreshProducts();
      if (onNotification) onNotification("Saved", `${updated.name} updated.`, "success");
    } catch (err: any) {
      if (onNotification) onNotification("Save Failed", err.message || "Could not save product", "error");
    }
  }, [onRefreshProducts, onNotification]);

  /**
   * handleDeleteProduct — wires ItemMasterFormInspector.onDeleteProduct to IItemService.delete().
   */
  const handleDeleteProduct = useCallback(async (id: string) => {
    try {
      const svc = SPK.services.resolve<IItemService>("ITEM");
      await svc.delete(id);
      setSelectedProduct(null);
      if (onRefreshProducts) await onRefreshProducts();
      if (onNotification) onNotification("Deleted", "Product removed from Item Master.", "success");
    } catch (err: any) {
      if (onNotification) onNotification("Delete Failed", err.message || "Could not delete product", "error");
    }
  }, [onRefreshProducts, onNotification]);

  // Keyboard Shortcuts: F2 = Universal Lookup Studio (ULS) | F4 = Barcode Hub | Ctrl+N = New SKU
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setIsLookupStudioOpen(true);
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
      case "create":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Create</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Create via quick, advanced, clone, or import flows</h3>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              {[
                { title: "Quick Item", body: "Fast entry for retail teams and floor operations." },
                { title: "Advanced Item", body: "Full product information and governance fields." },
                { title: "Clone Item", body: "Replicate an existing SKU with controlled edits." },
                { title: "Import Item", body: "Bulk onboarding from Excel, CSV, or ERP queues." },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-theme-divider p-2">
                  <div className="font-bold text-theme-heading">{item.title}</div>
                  <div className="mt-1 text-theme-muted">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "excel-grid":
        return (
          <ExcelGridEntrySection
            products={products}
            onRefreshProducts={onRefreshProducts}
            onNotification={onNotification}
          />
        );
      case "item-studio":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Item Studio</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Object-page style product detail experience</h3>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {[
                "Overview",
                "General",
                "Pricing",
                "Purchase",
                "Sales",
                "Inventory",
                "Images",
                "Documents",
                "Tax",
                "Workflow",
                "History"
              ].map((section) => (
                <div key={section} className="rounded-lg border border-theme-divider p-2">{section}</div>
              ))}
            </div>
          </div>
        );
      case "pricing":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Pricing</p>
              <h3 className="text-sm font-extrabold text-theme-heading">MRP, retail, wholesale, distributor, marketplace, and margin controls</h3>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {[
                { title: "MRP", body: "Base list price" },
                { title: "Retail", body: "Store price" },
                { title: "Wholesale", body: "Bulk distributor pricing" },
                { title: "Online", body: "Marketplace pricing" },
                { title: "Offers", body: "Promotions and discounts" },
                { title: "Margins", body: "Profit guardrails" },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-theme-divider p-2">
                  <div className="font-bold text-theme-heading">{item.title}</div>
                  <div className="mt-1 text-theme-muted">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "inventory":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Inventory</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Opening stock, reorder rules, location, batch, and ledger readiness</h3>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {[
                { title: "Opening", body: "Initial balances" },
                { title: "Reorder", body: "Min max controls" },
                { title: "Locations", body: "Warehouses and bins" },
                { title: "Batches", body: "Expiry and serial handling" },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-theme-divider p-2">
                  <div className="font-bold text-theme-heading">{item.title}</div>
                  <div className="mt-1 text-theme-muted">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "purchase":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Purchase</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Supplier, buying rate, MOQ, lead time, and vendor history</h3>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {[
                { title: "Preferred Supplier", body: "Primary vendor linkage" },
                { title: "Buying Rate", body: "Cost price" },
                { title: "MOQ", body: "Purchase quantity" },
                { title: "Lead Time", body: "Supply planning" },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-theme-divider p-2">
                  <div className="font-bold text-theme-heading">{item.title}</div>
                  <div className="mt-1 text-theme-muted">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "sales":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Sales</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Top customer, sales trends, ABC analysis, margins, and returns</h3>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {[
                { title: "Top Customer", body: "High-value buyers" },
                { title: "Sales Trend", body: "Demand pattern" },
                { title: "ABC Analysis", body: "Segmentation" },
                { title: "Returns", body: "Return behavior" },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-theme-divider p-2">
                  <div className="font-bold text-theme-heading">{item.title}</div>
                  <div className="mt-1 text-theme-muted">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "ai":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">AI Assistant</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Category, HSN, GST, description, duplicate detection, and barcode suggestions</h3>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {[
                { title: "Suggest Category", body: "Contextual classification" },
                { title: "Suggest HSN", body: "Tax code assistance" },
                { title: "Suggest GST", body: "Rate guidance" },
                { title: "Duplicate Detection", body: "Live match and merge guidance" },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-theme-divider p-2">
                  <div className="font-bold text-theme-heading">{item.title}</div>
                  <div className="mt-1 text-theme-muted">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "reports":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Reports</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Operational analytics for missing images, HSN gaps, margin issues, and dead stock</h3>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {[
                { title: "Missing Images", body: "Catalog hygiene" },
                { title: "Negative Margin", body: "Profitability alerts" },
                { title: "Duplicate Barcode", body: "Data quality" },
                { title: "Dead Stock", body: "Slow movers" },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-theme-divider p-2">
                  <div className="font-bold text-theme-heading">{item.title}</div>
                  <div className="mt-1 text-theme-muted">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "audit":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Audit</p>
              <h3 className="text-sm font-extrabold text-theme-heading">Create, update, delete, merge, price change, stock change, and approval history</h3>
            </div>
            <div className="mt-3 text-xs text-theme-muted">The audit layer will surface lifecycle events and governance actions for each product.</div>
          </div>
        );
      case "settings":
        return (
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-xs">
            <div className="border-b border-theme-divider pb-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Settings</p>
              <h3 className="text-sm font-extrabold text-theme-heading">SKU formula, barcode formula, mandatory fields, approval rules, and business class</h3>
            </div>
            <div className="mt-3 text-xs text-theme-muted">Product governance configurations are controlled centrally from this domain.</div>
          </div>
        );
      case "attributes":
        return <AttributeManagerSection onNotification={onNotification} />;
      case "templates":
        return (
          <VariantTemplateSection
            products={products}
            onRefreshProducts={onRefreshProducts}
            onNotification={onNotification}
          />
        );
      case "bulk":
        return <BulkImportSection onRefreshProducts={onRefreshProducts} onNotification={onNotification} />;
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
                      <th className="py-1.5 px-2 w-8 text-center">#</th>
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

                      return (
                        <tr
                          key={prod.id}
                          onClick={() => setSelectedProduct(prod)}
                          className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                            selectedProduct?.id === prod.id ? "bg-blue-50/70 border-l-4 border-blue-600" : ""
                          }`}
                        >
                          <td className="py-1 px-2 text-center font-bold text-theme-muted">{idx + 1}</td>
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
          />
        </div>
      </div>

      {/* ── Batch Action Bar — wired (was orphaned, now rendered) ── */}
      <ItemMasterBatchBar
        selectedProducts={checkedProducts}
        onClearSelection={() => setCheckedProductIds([])}
        onExportExcel={() => {
          if (onNotification) onNotification("Export", `Exporting ${checkedProducts.length} SKUs to Excel…`, "success");
        }}
        onExportCsv={() => {
          if (onNotification) onNotification("Export", `Exporting ${checkedProducts.length} SKUs to CSV…`, "success");
        }}
        onPrintLabels={() => setIsBarcodeDialogOpen(true)}
        onBulkStatusToggle={() => {
          if (onNotification) onNotification("Bulk Update", `${checkedProducts.length} SKUs updated.`, "success");
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
              <button onClick={() => setIsModalOpen(false)} className="text-theme-muted hover:text-theme-muted">
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
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-heading"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-heading"
                  />
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

              <div className="grid grid-cols-3 gap-3">
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
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    value={formData.stock_qty}
                    onChange={(e) => setFormData({ ...formData, stock_qty: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 font-mono text-theme-heading"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-theme-divider">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 bg-theme-surface-2 text-theme-body rounded-xl font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center shadow-md">
                  <Check className="w-4 h-4 mr-1" />
                  Save Item Master
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
          onNotification={onNotification}
        />
      )}
    </div>
  );
};

export default ItemMasterTab;
