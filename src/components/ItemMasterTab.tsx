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
  Boxes, ExternalLink, Sparkles, Sliders, Filter, RefreshCw
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
          stockQty: parseInt(formData.stock_qty) || 0,
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

  return (
    <div className="w-full bg-slate-100 font-sans text-slate-800 p-2.5 sm:p-3 space-y-3">
      {/* ================= SINGLE HORIZONTAL TOOLBAR (55px HERO COMPRESSION) ================= */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        {/* Left Title & Low Stock Alert Badge */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">INVENTORY /</span>
          <h1 className="text-base font-extrabold text-slate-900 tracking-tight">Item Master Studio</h1>
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

        {/* Right Actions & SWMF Pop-Out Button */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search SKU / Barcode (F2)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 w-44"
            />
          </div>

          {!isReadOnly && (
            <button
              onClick={() => {
                setFormData(blankItemForm());
                setIsModalOpen(true);
              }}
              className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow-xs cursor-pointer flex items-center"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              + Add Product
            </button>
          )}

          <button
            onClick={() => setIsBarcodeDialogOpen(true)}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-700 cursor-pointer shadow-2xs flex items-center"
          >
            <Barcode className="w-3.5 h-3.5 mr-1 text-indigo-600" />
            Barcode Hub (F4)
          </button>

          <button
            onClick={() => onRefreshProducts && onRefreshProducts()}
            className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-md cursor-pointer"
            title="Refresh Inventory Products"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
          </button>

          <button
            onClick={() => WindowManager.openTabStandalone("inventory", "SMRITI Inventory Master Studio")}
            className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-md cursor-pointer"
            title="Pop-out Standalone Window (SWMF)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
          </button>
        </div>
      </div>

      {/* ================= 2-COLUMN MASTER FORM (SUMMARY CARDS + PRODUCT FORM) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ----- LEFT SIDE: PRODUCTS DATA GRID (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Package className="w-3.5 h-3.5" />
              <span>Master Inventory Registry ({filteredProducts.length})</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setActiveFilter({ type: "ALL", value: "ALL" })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeFilter.type === "ALL" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter({ type: "LOW_STOCK", value: "LOW_STOCK" })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeFilter.type === "LOW_STOCK" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Low Stock
              </button>
            </div>
          </div>

          {/* SUPG Inventory Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg smriti-custom-scroll">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
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
              <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
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
                      <td className="py-1 px-2 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-1 px-2 font-mono font-bold text-slate-800">{prod.code || prod.sku}</td>
                      <td className="py-1 px-2 font-semibold text-slate-900">{prod.name}</td>
                      <td className="py-1 px-2 text-slate-600">{prod.category || "General"}</td>
                      <td className="py-1 px-2 text-right font-mono text-slate-500">₹ {prod.mrp || prod.price}</td>
                      <td className="py-1 px-2 text-right font-mono font-bold text-blue-700">₹ {prod.price}</td>
                      <td className="py-1 px-2 text-right font-mono font-bold text-slate-800">{qty} {prod.unit || "Pcs"}</td>
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

        {/* ----- RIGHT SIDE: INVENTORY VALUATION & SELECTED PRODUCT DETAILS (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Boxes className="w-3.5 h-3.5" />
              <span>Valuation & Product Inspector</span>
            </div>
          </div>

          {/* Live Valuation Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Total Catalog Products</span>
              <span className="font-mono font-bold text-slate-800">{inventoryTotals.totalProducts}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Total Available Stock Qty</span>
              <span className="font-mono font-bold text-slate-800">{inventoryTotals.totalStockQty} Pcs</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-800">Total Inventory Valuation</span>
              <span className="font-mono font-black text-emerald-600 text-sm">
                ₹ {inventoryTotals.totalValuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Selected Product Details Panel */}
          {selectedProduct ? (
            <div className="border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="font-extrabold text-slate-900">{selectedProduct.name}</span>
                <span className="font-mono font-bold text-blue-600">{selectedProduct.code || selectedProduct.sku}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Category</span>
                  <span className="font-semibold text-slate-800">{selectedProduct.category || "General"}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Brand</span>
                  <span className="font-semibold text-slate-800">{selectedProduct.brand || "Smriti Standard"}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Buying Rate</span>
                  <span className="font-mono font-bold text-slate-700">₹ {selectedProduct.purchasePrice || 60}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Retail Selling Price</span>
                  <span className="font-mono font-bold text-blue-700">₹ {selectedProduct.price}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400 text-xs italic">Select a product row to inspect details.</div>
          )}
        </div>
      </div>

      {/* ================= NEW ITEM CREATION MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Create New Inventory Item</h3>
                  <p className="text-xs text-slate-500">Add product specifications to SMRITI Item Master.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">SKU / Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={formData.hsn_code}
                    onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-blue-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    value={formData.stock_qty}
                    onChange={(e) => setFormData({ ...formData, stock_qty: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-bold">
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
          products={products}
          onClose={() => setIsBarcodeDialogOpen(false)}
          onNotification={onNotification}
        />
      )}
    </div>
  );
};

export default ItemMasterTab;
