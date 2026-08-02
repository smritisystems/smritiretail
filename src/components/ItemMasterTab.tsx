/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : Item Master & Inventory Studio Host (ADR-012 Standard v7.0)
 * Standard     : ADR-012 (SMRITI_PROCUREMENT_STUDIO_ENTERPRISE_STANDARD_v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 7.0.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Product } from "../types.js";
import { WindowManager } from "../sdk/index.js";
import { ItemMasterToolbar, ItemMasterViewMode } from "./item_master/ItemMasterToolbar.tsx";
import { ItemMasterContextSidebar, ContextFilterState } from "./item_master/ItemMasterContextSidebar.tsx";
import { BarcodePrintDialog } from "./item_master/BarcodePrintDialog.tsx";
import { AttributeManagerSection } from "./AttributeManagerSection.tsx";
import { VariantTemplateSection } from "./VariantTemplateSection.tsx";
import { BulkImportSection } from "./BulkImportSection.tsx";
import { ExcelGridEntrySection } from "./ExcelGridEntrySection.tsx";
import { AttributeAnalyticsSection } from "./AttributeAnalyticsSection.tsx";
import { SPK } from "../kernel/SPK.js";
import { CreateItemCommand } from "../kernel/commands/CreateItemCommand.js";
import { IItemService } from "../kernel/public/IItemService.js";
import {
  Package, Plus, Search, X, Barcode, CheckCircle2, AlertCircle, FileText,
  ShieldCheck, DollarSign, Percent, Truck, Tag, Zap, Settings2, RotateCcw,
  Save, AlertOctagon, Info, ChevronDown, ChevronUp, Layers, UploadCloud, Trash2,
  Boxes, ExternalLink, Sparkles, Sliders, Filter, RefreshCw, Check
} from "lucide-react";

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
  const [viewMode, setViewMode] = useState<ItemMasterViewMode>("registry");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<ContextFilterState>({ type: "ALL", value: "ALL" });
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] || null);
  const [checkedProductIds, setCheckedProductIds] = useState<string[]>([]);
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState<boolean>(false);

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

  // Keyboard Shortcuts (F2 Search, F4 Barcode Hub)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setIsModalOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        setIsBarcodeDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const renderWorkspaceContent = () => {
    switch (viewMode) {
      case "excel-grid":
        return (
          <ExcelGridEntrySection
            products={products}
            onRefreshProducts={onRefreshProducts}
            onNotification={onNotification}
          />
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
          <div className="bg-white border border-theme-divider rounded-xl p-5 shadow-xs text-xs text-theme-muted">
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
            <div className="lg:col-span-7 bg-white border border-theme-divider rounded-xl p-3 shadow-xs space-y-2">
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

            <div className="lg:col-span-5 bg-white border border-theme-divider rounded-xl p-3 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-theme-divider pb-1.5">
                <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Valuation & Product Inspector</span>
                </div>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-theme-muted">
                  <span>Total Catalog Products</span>
                  <span className="font-mono font-bold text-theme-heading">{inventoryTotals.totalProducts}</span>
                </div>
                <div className="flex items-center justify-between text-theme-muted">
                  <span>Total Available Stock Qty</span>
                  <span className="font-mono font-bold text-theme-heading">{inventoryTotals.totalStockQty} Pcs</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-theme-divider">
                  <span className="font-bold text-theme-heading">Total Inventory Valuation</span>
                  <span className="font-mono font-black text-emerald-600 text-sm">
                    ₹ {inventoryTotals.totalValuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {selectedProduct ? (
                <div className="border border-theme-divider rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-theme-divider pb-1">
                    <span className="font-extrabold text-theme-heading">{selectedProduct.name}</span>
                    <span className="font-mono font-bold text-blue-600">{selectedProduct.code || selectedProduct.sku}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-theme-muted uppercase text-[9px] block">Category</span>
                      <span className="font-semibold text-theme-heading">{selectedProduct.category || "General"}</span>
                    </div>
                    <div>
                      <span className="text-theme-muted uppercase text-[9px] block">Brand</span>
                      <span className="font-semibold text-theme-heading">{selectedProduct.brand || "Smriti Standard"}</span>
                    </div>
                    <div>
                      <span className="text-theme-muted uppercase text-[9px] block">Buying Rate</span>
                      <span className="font-mono font-bold text-theme-body">₹ {selectedProduct.purchasePrice || 60}</span>
                    </div>
                    <div>
                      <span className="text-theme-muted uppercase text-[9px] block">Retail Selling Price</span>
                      <span className="font-mono font-bold text-blue-700">₹ {selectedProduct.price}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-theme-muted text-xs italic">Select a product row to inspect details.</div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-theme-surface-2 font-sans text-theme-heading p-2.5 sm:p-3 space-y-3">
      <div className="bg-white border border-theme-divider rounded-xl px-4 py-2 shadow-xs">
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
              className="px-2.5 py-1 bg-white hover:bg-theme-surface-2 border border-theme-divider rounded-md font-bold text-theme-body cursor-pointer shadow-2xs flex items-center"
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

      {isFilterDrawerOpen && (
        <ItemMasterContextSidebar
          products={products}
          activeFilter={activeFilter}
          onFilterChange={(filter) => {
            setActiveFilter(filter);
            setIsFilterDrawerOpen(false);
          }}
          categories={categories}
          brands={brands}
          lowStockCount={inventoryTotals.lowStockCount}
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
        />
      )}

      {renderWorkspaceContent()}

      {/* ================= NEW ITEM CREATION MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-theme-surface-2 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-theme-divider">
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
