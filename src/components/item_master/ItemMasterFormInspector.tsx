/**
 * Project      : SMRITI Retail OS v6.5 â€” Workspace Experience Platform
 * Module       : Item Master Studio (12-Tab Item 360 Workspace & SEDSObjectPage Pattern)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 6.5.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { SEEFObjectPage, ObjectPageTab, ObjectPageMetric } from "../common/FioriObjectPage.tsx";
import {
  Package, Tag, DollarSign, Percent, Barcode, ShieldAlert, Layers, Grid, History,
  Building2, Sliders, Printer, Sparkles, ChevronRight, MapPin, Truck, FileText,
  TrendingUp, Activity, PieChart, BarChart2, Plus, Trash2, CheckCircle2, Image as ImageIcon
} from "lucide-react";
import { Product, SupplierCatalogueEntry, PriceRule, TaggedMediaEntry, MediaTag } from "../../types.js";
import { ItemMasterUomMatrix, UomConversion } from "./ItemMasterUomMatrix.tsx";
import { ItemMasterVariantTable } from "./ItemMasterVariantTable.tsx";
import { ItemMasterPrintHistoryTab } from "./ItemMasterPrintHistoryTab.tsx";
import { ItemCompletenessWidget } from "./ItemCompletenessWidget.tsx";
import { WorkspaceCommand } from "../../kernel/upr/workspace/WorkspaceCommandRegistry.js";
import { WorkspaceStatus } from "../../kernel/services/WorkspaceStatusService.js";

interface ItemMasterFormInspectorProps {
  product: Product | null;
  onSaveProduct: (updated: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onOpenBarcodeDialog: (variant?: any) => void;
  isReadOnly?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
}

export const ItemMasterFormInspector: React.FC<ItemMasterFormInspectorProps> = ({
  product,
  onSaveProduct,
  onDeleteProduct,
  onOpenBarcodeDialog,
  isReadOnly = false,
  isSaving = false,
  isDeleting = false
}) => {
  const [formData, setFormData] = useState<Product | null>(product ? { ...product } : null);
  const [internalSaving, setInternalSaving] = useState<boolean>(false);
  const [uomConversions, setUomConversions] = useState<UomConversion[]>([]);
  const [supplierCatalogue, setSupplierCatalogue] = useState<SupplierCatalogueEntry[]>(product?.supplierCatalogue || []);
  const [priceRules, setPriceRules] = useState<PriceRule[]>(product?.priceRules || []);
  const [taggedMedia, setTaggedMedia] = useState<TaggedMediaEntry[]>(product?.taggedMedia || []);

  useEffect(() => {
    setFormData(product ? { ...product } : null);
    setUomConversions([]);
    setSupplierCatalogue(product?.supplierCatalogue || []);
    setPriceRules(product?.priceRules || []);
    setTaggedMedia(product?.taggedMedia || []);
  }, [product]);

  const activeProduct = formData ?? product;

  if (!activeProduct) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center text-theme-muted font-mono border-2 border-dashed border-theme-divider rounded-xl select-none">
        <Package className="w-12 h-12 mb-3 text-theme-muted" />
        <h3 className="text-sm font-bold text-theme-heading">No Product Selected</h3>
        <p className="text-xs">Select a SKU from the left master list or click "New SKU" to create a record.</p>
      </div>
    );
  }

  // Pricing Matrix Calculations
  const mrp = activeProduct.mrp || activeProduct.price || 0;
  const salePrice = activeProduct.price || 0;
  const purchaseCost = activeProduct.purchase_price || activeProduct.costPrice || 0;
  const marginPercent = mrp > 0 ? (((mrp - purchaseCost) / mrp) * 100).toFixed(1) : "0.0";
  const markupPercent = purchaseCost > 0 ? (((salePrice - purchaseCost) / purchaseCost) * 100).toFixed(1) : "0.0";

  // AI Suggestions & Nudges
  const aiSuggestions = [
    salePrice < purchaseCost ? "CRITICAL: Sale price is lower than purchase cost!" : "Margin is healthy at " + marginPercent + "%",
    (activeProduct.stock_qty ?? activeProduct.qty ?? 0) < (activeProduct.min_stock_level || 5) ? "Low Stock Alert: Reorder point reached" : "Optimal Stock Level maintained",
    "Suggested Price Optimization: Retail market rate supports +3.5% margin adjustment",
  ];

  const handleFieldChange = (field: keyof Product, value: any) => {
    setFormData((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  };

  const handleSave = async () => {
    if (!activeProduct) return;

    setInternalSaving(true);
    try {
      await onSaveProduct({ ...activeProduct });
    } finally {
      setInternalSaving(false);
    }
  };

  const metrics: ObjectPageMetric[] = [
    { label: "SKU / Barcode", value: activeProduct.barcode || activeProduct.sku || "N/A" },
    { label: "Physical Stock", value: `${activeProduct.stock_qty ?? activeProduct.qty ?? 0} ${activeProduct.uom || "Pcs"}`, highlight: true },
    { label: "MRP / Retailing Price", value: `₹${mrp.toLocaleString("en-IN")}` },
    { label: "Margin %", value: `${marginPercent}%`, highlight: parseFloat(marginPercent) > 20 },
  ];

  const tabs: ObjectPageTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-6 max-w-5xl font-sans text-xs">
          <ItemCompletenessWidget product={activeProduct} />

          {/* AI Action Cards (SCS-WIN-001) */}
          <div className="p-4 bg-gradient-to-r from-purple-950/40 to-blue-950/40 border border-purple-500/30 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-purple-400 font-bold uppercase font-mono text-[11px]">
              <Sparkles className="w-4 h-4" /> AI Recommendations &amp; Action Cards
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 font-mono text-xs">
              <div className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 ${salePrice < purchaseCost ? "bg-rose-500/10 border-rose-500/30 text-rose-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"}`}>
                <div className="flex items-center space-x-1.5 font-bold">
                  <span>{salePrice < purchaseCost ? "🔴" : "🟢"}</span>
                  <span>{salePrice < purchaseCost ? "Sale Price below Cost" : "Margin Healthy"}</span>
                </div>
                <div className="text-[11px] opacity-80">
                  {salePrice < purchaseCost ? `Loss: ₹${(purchaseCost - salePrice).toFixed(2)} / unit` : `Margin: ${marginPercent}%`}
                </div>
                <button
                  type="button"
                  onClick={() => WorkspaceCommand.execute("inventory.openPricingTab")}
                  className="px-2.5 py-1 text-[10px] font-bold rounded bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider self-start flex items-center space-x-1 cursor-pointer"
                >
                  <span>Fix Now</span>
                  <ChevronRight size={11} />
                </button>
              </div>

              <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-300 flex flex-col justify-between space-y-2">
                <div className="flex items-center space-x-1.5 font-bold">
                  <span>🟡</span>
                  <span>Images Required</span>
                </div>
                <div className="text-[11px] opacity-80">
                  {(activeProduct as any).primary_image_url || (activeProduct as any).primaryImageUrl ? "Primary image set" : "0 of 3 images uploaded"}
                </div>
                <button
                  type="button"
                  onClick={() => WorkspaceCommand.execute("inventory.openMediaTab")}
                  className="px-2.5 py-1 text-[10px] font-bold rounded bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider self-start flex items-center space-x-1 cursor-pointer"
                >
                  <span>Upload Images</span>
                  <ChevronRight size={11} />
                </button>
              </div>

              <div className="p-3 rounded-xl border bg-blue-500/10 border-blue-500/30 text-blue-300 flex flex-col justify-between space-y-2">
                <div className="flex items-center space-x-1.5 font-bold">
                  <span>🟢</span>
                  <span>Supplier Assignment</span>
                </div>
                <div className="text-[11px] opacity-80">
                  {(activeProduct as any).preferred_supplier || (activeProduct as any).preferredSupplier || "No primary vendor assigned"}
                </div>
                <button
                  type="button"
                  onClick={() => WorkspaceCommand.execute("inventory.openSupplierTab")}
                  className="px-2.5 py-1 text-[10px] font-bold rounded bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider self-start flex items-center space-x-1 cursor-pointer"
                >
                  <span>Assign Supplier</span>
                  <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Identity Card (Point 9: Business Identity First) */}
            <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3 font-mono">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-bold text-theme-heading font-display text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-[var(--c-seef-accent)]" /> Basic Identity
                </h5>
                <select
                  disabled={isReadOnly}
                  value={activeProduct.status || "Active"}
                  onChange={(e) => handleFieldChange("status", e.target.value)}
                  className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                    (activeProduct.status || "Active") === "Active"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : (activeProduct.status || "Active") === "Draft"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : (activeProduct.status || "Active") === "Inactive"
                      ? "bg-theme-surface-2 text-theme-muted border-theme-divider"
                      : (activeProduct.status || "Active") === "Blocked"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                  }`}
                >
                  <option value="Active">● Active</option>
                  <option value="Draft">◐ Draft</option>
                  <option value="Inactive">○ Inactive</option>
                  <option value="Blocked">🚫 Blocked</option>
                  <option value="Discontinued">✖ Discontinued</option>
                </select>
              </div>
              {[
                ["Item Name", activeProduct.name],
                ["Item Code", activeProduct.code || activeProduct.sku || "N/A"],
                ["Barcode", activeProduct.barcode || "N/A"],
                ["Category", activeProduct.category || "General"],
                ["Brand", activeProduct.brand || "Smriti Standard"],
                ["Sub-Category", activeProduct.subCategory || activeProduct.sub_category || "Standard"],
                ["HSN / SAC Code", activeProduct.hsn_code || activeProduct.hsnCode || "8471"],
                ["GST Rate", `${activeProduct.gst_rate || activeProduct.gstPercentage || 18}%`],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between text-xs border-b border-theme-divider/40 pb-1.5">
                  <span className="text-theme-muted">{k}</span>
                  <span className="font-bold text-theme-heading">{v || "—"}</span>
                </div>
              ))}

              <details className="pt-2 text-[10px] text-theme-muted cursor-pointer">
                <summary className="font-semibold text-indigo-400 hover:underline">Advanced Technical IDs</summary>
                <div className="pt-2 space-y-1 font-mono">
                  <div className="flex justify-between"><span>Database UUID:</span><span className="text-white font-bold">{activeProduct.id}</span></div>
                  <div className="flex justify-between"><span>Lifecycle State:</span><span className="text-emerald-400 font-bold">{activeProduct.status || "Active"}</span></div>
                </div>
              </details>
            </div>

            {/* Commercial Card (Point 8: Visual Hierarchy & Margins) */}
            <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4 font-mono">
              <h5 className="font-bold text-theme-heading font-display text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Commercial &amp; Margins
              </h5>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-theme-surface-1 rounded-xl border border-theme-divider">
                  <div className="text-[10px] text-theme-muted uppercase font-bold">MRP</div>
                  <div className="text-sm font-black text-white mt-0.5">₹{mrp.toLocaleString("en-IN")}</div>
                </div>
                <div className="p-2.5 bg-theme-surface-1 rounded-xl border border-theme-divider">
                  <div className="text-[10px] text-theme-muted uppercase font-bold">Selling</div>
                  <div className="text-sm font-black text-emerald-400 mt-0.5">₹{salePrice.toLocaleString("en-IN")}</div>
                </div>
                <div className="p-2.5 bg-theme-surface-1 rounded-xl border border-theme-divider">
                  <div className="text-[10px] text-theme-muted uppercase font-bold">Purchase</div>
                  <div className="text-sm font-black text-purple-400 mt-0.5">₹{purchaseCost.toLocaleString("en-IN")}</div>
                </div>
              </div>

              {/* Visual HSL Margin Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-theme-muted">Gross Margin: ₹{(salePrice - purchaseCost).toLocaleString("en-IN")}</span>
                  <span className={parseFloat(marginPercent) >= 20 ? "text-emerald-400" : "text-amber-400"}>{marginPercent}%</span>
                </div>
                <div className="w-full h-2 bg-theme-surface-1 rounded-full overflow-hidden border border-theme-divider">
                  <div
                    className={`h-full ${parseFloat(marginPercent) >= 30 ? "bg-emerald-500" : parseFloat(marginPercent) >= 15 ? "bg-blue-500" : "bg-amber-500"} transition-all`}
                    style={{ width: `${Math.min(100, Math.max(0, parseFloat(marginPercent)))}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-theme-divider/40 space-y-1.5 text-xs">
                <div className="flex justify-between text-theme-muted"><span>Markup %</span><span className="font-bold text-theme-heading">{markupPercent}%</span></div>
                <div className="flex justify-between text-theme-muted"><span>Current Stock</span><span className="font-bold text-emerald-400">{activeProduct.stock_qty ?? activeProduct.qty ?? 0} {activeProduct.uom || "Pcs"}</span></div>
                <div className="flex justify-between text-theme-muted"><span>Reorder Point</span><span className="font-bold text-amber-400">{activeProduct.min_stock_level || 5} Pcs</span></div>
              </div>
            </div>
          </div>

          {/* SMRITI AI Copilot Dock */}
          <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-indigo-400 font-bold uppercase font-mono text-[10px] tracking-wider">
              <span className="flex items-center gap-1.5"><Sparkles size={13} /> SMRITI AI Copilot Dock</span>
              <span className="text-theme-muted">Ask Assistant</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
              {[
                "What's wrong?",
                "Optimize margin",
                "Generate barcode",
                "Assign supplier",
                "Find duplicates"
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => WorkspaceStatus.notify(`SMRITI AI: Executing "${prompt}" advisory task...`, "info")}
                  className="px-3 py-1 bg-theme-surface-2 hover:bg-indigo-600/30 border border-indigo-500/25 text-indigo-200 rounded-lg transition-colors cursor-pointer"
                >
                  ⚡ {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: "pricing",
      label: "Multi-Tier Pricing",
      content: (
        <div className="space-y-5 max-w-5xl font-mono text-xs">
          <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" /> Multi-Tier Pricing &amp; Margin Matrix
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Maximum Retail Price (MRP)</span>
              <input type="number" step="0.01" value={activeProduct.mrp || 0} onChange={(e) => handleFieldChange("mrp", parseFloat(e.target.value))} className="w-full p-2 bg-theme-surface-1 border border-theme-divider rounded text-theme-heading font-bold text-base" />
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Retail Selling Price</span>
              <input type="number" step="0.01" value={activeProduct.price || 0} onChange={(e) => handleFieldChange("price", parseFloat(e.target.value))} className="w-full p-2 bg-theme-surface-1 border border-theme-divider rounded text-emerald-400 font-bold text-base" />
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Purchase Cost / Rate</span>
              <input type="number" step="0.01" value={activeProduct.purchase_price || activeProduct.costPrice || 0} onChange={(e) => handleFieldChange("purchase_price", parseFloat(e.target.value))} className="w-full p-2 bg-theme-surface-1 border border-theme-divider rounded text-purple-400 font-bold text-base" />
            </div>
          </div>

          <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><span className="text-theme-muted text-[10px] uppercase block font-bold">Wholesale Price</span><strong className="text-sm font-bold text-theme-heading">₹{((activeProduct.price || 0) * 0.9).toFixed(2)}</strong></div>
            <div><span className="text-theme-muted text-[10px] uppercase block font-bold">Dealer Price</span><strong className="text-sm font-bold text-theme-heading">₹{((activeProduct.price || 0) * 0.85).toFixed(2)}</strong></div>
            <div><span className="text-theme-muted text-[10px] uppercase block font-bold">Distributor Price</span><strong className="text-sm font-bold text-theme-heading">₹{((activeProduct.price || 0) * 0.8).toFixed(2)}</strong></div>
            <div><span className="text-theme-muted text-[10px] uppercase block font-bold">Landed Cost</span><strong className="text-sm font-bold text-theme-heading">₹{((purchaseCost) * 1.05).toFixed(2)}</strong></div>
          </div>
        </div>
      )
    },
    {
      id: "inventory",
      label: "Inventory & Storage",
      content: (
        <div className="space-y-5 max-w-5xl font-mono text-xs">
          <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2">
            <Truck className="w-5 h-5 text-[var(--c-seef-accent)]" /> Multi-Location Stock &amp; Warehouse Bin Locations
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Current Stock Qty</span>
              <strong className="text-xl font-bold text-emerald-400">{activeProduct.stock_qty ?? activeProduct.qty ?? 0} {activeProduct.uom || "Pcs"}</strong>
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Min Reorder Level</span>
              <strong className="text-xl font-bold text-amber-400">{activeProduct.min_stock_level || 5} Pcs</strong>
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Max Stock Limit</span>
              <strong className="text-xl font-bold text-theme-heading">500 Pcs</strong>
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Preferred Warehouse</span>
              <strong className="text-sm font-bold text-[var(--c-seef-accent)]">Central WH-01</strong>
            </div>
          </div>

          <ItemMasterUomMatrix baseUom={activeProduct.uom || "Pcs"} conversions={uomConversions} onChange={setUomConversions} isReadOnly={isReadOnly} />
        </div>
      )
    },
    {
      id: "scdm_channel",
      label: "Channel Stock (SCDM)",
      content: (
        <div className="space-y-4 max-w-5xl font-mono text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-400" /> SCDM Channel Stock &amp; Customer Store Visibility
            </h4>
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              SCDM v1.0 SSOT Projection
            </span>
          </div>

          <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-theme-divider text-theme-muted font-bold uppercase text-[10px]">
                  <th className="p-2">Customer Account</th>
                  <th className="p-2">Channel Location</th>
                  <th className="p-2 text-right">Dispatched Qty</th>
                  <th className="p-2 text-right">Sell-Out Qty</th>
                  <th className="p-2 text-right text-indigo-400 font-bold">Current Stock</th>
                  <th className="p-2 text-right">MRP Value</th>
                  <th className="p-2 text-right">Ageing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-divider/50">
                <tr className="hover:bg-theme-surface-1">
                  <td className="p-2 font-bold text-theme-heading">Reliance Retail Ltd</td>
                  <td className="p-2 text-theme-muted">DC Mumbai / Store A</td>
                  <td className="p-2 text-right text-theme-muted">150 Pcs</td>
                  <td className="p-2 text-right text-emerald-400 font-bold">90 Pcs</td>
                  <td className="p-2 text-right text-indigo-400 font-bold">60 Pcs</td>
                  <td className="p-2 text-right font-bold text-theme-heading">₹{(parseFloat(String(activeProduct.mrp || "100")) * 60).toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right text-amber-400 font-bold">14 Days</td>
                </tr>
                <tr className="hover:bg-theme-surface-1">
                  <td className="p-2 font-bold text-theme-heading">Avenue Supermarts (D-Mart)</td>
                  <td className="p-2 text-theme-muted">DC Thane / Grocery Dept</td>
                  <td className="p-2 text-right text-theme-muted">200 Pcs</td>
                  <td className="p-2 text-right text-emerald-400 font-bold">140 Pcs</td>
                  <td className="p-2 text-right text-indigo-400 font-bold">60 Pcs</td>
                  <td className="p-2 text-right font-bold text-theme-heading">₹{(parseFloat(String(activeProduct.mrp || "100")) * 60).toLocaleString('en-IN')}</td>

                  <td className="p-2 text-right text-emerald-400 font-bold">8 Days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )
    },

    {
      id: "variants",
      label: "Variant Matrix",
      content: <ItemMasterVariantTable product={activeProduct} onOpenBarcodeDialog={onOpenBarcodeDialog} isReadOnly={isReadOnly} />
    },
    {
      id: "suppliers",
      label: "Suppliers & Procurement",
      content: (
        <div className="space-y-4 max-w-5xl font-mono text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--c-seef-accent)]" /> Supplier Catalogue
            </h4>
            {!isReadOnly && (
              <button
                onClick={() => {
                  const newEntry: SupplierCatalogueEntry = {
                    id: `sup-${Date.now()}`, supplierId: "", supplierName: "New Supplier",
                    purchaseUom: "Pcs", moq: 10, currentRate: purchaseCost || 100,
                    lastPurchaseRate: purchaseCost || 100, leadTimeDays: 3, priority: 3 as 1|2|3
                  };
                  setSupplierCatalogue((prev) => [...prev, newEntry]);
                }}
                className="px-2.5 py-1 bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)] rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Supplier
              </button>
            )}
          </div>

          {supplierCatalogue.length === 0 ? (
            <div className="p-8 text-center text-theme-muted border-2 border-dashed border-theme-divider rounded-xl">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-theme-muted" />
              <p className="font-bold text-xs">No supplier catalogue entries yet.</p>
              <p className="text-[10px] mt-1">Click "Add Supplier" to link this SKU to a preferred vendor.</p>
            </div>
          ) : (
            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-theme-divider text-theme-muted font-bold uppercase text-[10px] bg-theme-surface-1">
                    <th className="p-2.5">Priority</th>
                    <th className="p-2.5">Supplier Name</th>
                    <th className="p-2.5">Supplier Code</th>
                    <th className="p-2.5">Purchase UOM</th>
                    <th className="p-2.5 text-right">MOQ</th>
                    <th className="p-2.5 text-right">Last Rate</th>
                    <th className="p-2.5 text-right">Current Rate</th>
                    <th className="p-2.5 text-right">Lead Time</th>
                    {!isReadOnly && <th className="p-2.5 text-right">Remove</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider/40">
                  {supplierCatalogue.map((s) => (
                    <tr key={s.id} className="hover:bg-theme-surface-1 transition-colors">
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          s.priority === 1 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                          s.priority === 2 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                          "bg-theme-surface-2 text-theme-muted border-theme-divider"
                        }`}>
                          P{s.priority} {s.priority === 1 ? "★ Preferred" : ""}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-theme-heading">{s.supplierName}</td>
                      <td className="p-2.5 text-theme-muted">{s.supplierItemCode || "—"}</td>
                      <td className="p-2.5 text-theme-muted">{s.purchaseUom || "Pcs"}</td>
                      <td className="p-2.5 text-right">{s.moq || 1}</td>
                      <td className="p-2.5 text-right text-theme-muted">₹{(s.lastPurchaseRate || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">₹{(s.currentRate || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-right">{s.leadTimeDays || 3}d</td>
                      {!isReadOnly && (
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => setSupplierCatalogue((prev) => prev.filter((x) => x.id !== s.id))}
                            className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    },
    {
      id: "price_rules",
      label: "Price Rules",
      content: (
        <div className="space-y-4 max-w-5xl font-mono text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" /> Promotional &amp; Tier Price Rules
            </h4>
            {!isReadOnly && (
              <button
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  const newRule: PriceRule = {
                    id: `pr-${Date.now()}`, name: "New Promotion", type: "Promotional",
                    startDate: today, endDate: today, promotionalPrice: activeProduct.price || 100, isActive: true
                  };
                  setPriceRules((prev) => [...prev, newRule]);
                }}
                className="px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </button>
            )}
          </div>

          {priceRules.length === 0 ? (
            <div className="p-8 text-center text-theme-muted border-2 border-dashed border-theme-divider rounded-xl">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-theme-muted" />
              <p className="font-bold text-xs">No promotional price rules configured.</p>
              <p className="text-[10px] mt-1">Add festival, branch, or customer-group price rules here.</p>
            </div>
          ) : (
            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-theme-divider text-theme-muted font-bold uppercase text-[10px] bg-theme-surface-1">
                    <th className="p-2.5">Rule Name</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Valid From</th>
                    <th className="p-2.5">Valid To</th>
                    <th className="p-2.5 text-right">Promo Price</th>
                    <th className="p-2.5 text-right">Discount %</th>
                    <th className="p-2.5 text-center">Active</th>
                    {!isReadOnly && <th className="p-2.5 text-right">Remove</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider/40">
                  {priceRules.map((r) => (
                    <tr key={r.id} className="hover:bg-theme-surface-1 transition-colors">
                      <td className="p-2.5 font-bold text-theme-heading">{r.name}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{r.type}</span>
                      </td>
                      <td className="p-2.5 text-theme-muted">{r.startDate}</td>
                      <td className="p-2.5 text-theme-muted">{r.endDate}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">{r.promotionalPrice ? `₹${r.promotionalPrice.toFixed(2)}` : "—"}</td>
                      <td className="p-2.5 text-right font-bold text-amber-400">{r.discountPercentage ? `${r.discountPercentage}%` : "—"}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-theme-surface-2 text-theme-muted"}`}>
                          {r.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {!isReadOnly && (
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => setPriceRules((prev) => prev.filter((x) => x.id !== r.id))}
                            className="text-rose-400 hover:text-rose-300 cursor-pointer"
                            aria-label="Remove price rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    },
    {
      id: "media",
      label: "Media Gallery",
      content: (
        <div className="space-y-4 max-w-5xl font-mono text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-400" /> Multi-Angle Tagged Image Gallery
            </h4>
            {!isReadOnly && (
              <button
                onClick={() => {
                  const newEntry: TaggedMediaEntry = {
                    id: `m-${Date.now()}`, url: "", tag: "Front" as MediaTag
                  };
                  setTaggedMedia((prev) => [...prev, newEntry]);
                }}
                className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Image
              </button>
            )}
          </div>

          {taggedMedia.length === 0 ? (
            <div className="p-8 text-center text-theme-muted border-2 border-dashed border-theme-divider rounded-xl">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 text-theme-muted" />
              <p className="font-bold text-xs">No tagged product images yet.</p>
              <p className="text-[10px] mt-1">Add Front, Back, Packaging, Lifestyle images to improve catalog quality score.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {taggedMedia.map((m) => (
                <div key={m.id} className="relative group rounded-xl overflow-hidden border border-theme-divider bg-theme-surface-2">
                  {m.url ? (
                    <img src={m.url} alt={m.tag} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-theme-surface-1">
                      <ImageIcon className="w-8 h-8 text-theme-muted" />
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-theme-surface-1/90 text-theme-heading border border-theme-divider">{m.tag}</span>
                  </div>
                  {m.isPrimary && (
                    <div className="absolute top-1.5 right-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/90 text-white">Primary</span>
                    </div>
                  )}
                  {!isReadOnly && (
                    <button
                      onClick={() => setTaggedMedia((prev) => prev.filter((x) => x.id !== m.id))}
                      className="absolute bottom-1.5 right-1.5 p-1.5 bg-rose-500/80 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      aria-label="Remove media image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
    {
      id: "barcode",
      label: "Barcode & Labels",
      content: <ItemMasterPrintHistoryTab product={activeProduct} />
    },
    {
      id: "analytics",
      label: "Analytics & Velocity",
      content: (
        <div className="space-y-5 max-w-5xl font-mono text-xs">
          <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><BarChart2 className="w-5 h-5 text-[var(--c-seef-accent)]" /> Sales Velocity &amp; Inventory Turnover</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1"><span className="text-theme-muted text-[10px] uppercase font-bold block">Velocity Status</span><strong className="text-lg font-bold text-emerald-400">Fast Moving (ABC-Class A)</strong></div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1"><span className="text-theme-muted text-[10px] uppercase font-bold block">30-Day Sales Volume</span><strong className="text-lg font-bold text-theme-heading">142 Pcs</strong></div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1"><span className="text-theme-muted text-[10px] uppercase font-bold block">Inventory Turn Rate</span><strong className="text-lg font-bold text-purple-400">8.4x / Year</strong></div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col h-full bg-theme-base p-6">
      <SEEFObjectPage
        title={activeProduct.name}
        subtitle={`SKU: ${activeProduct.sku || activeProduct.code || "N/A"} | Category: ${activeProduct.category || "General"} | Brand: ${activeProduct.brand || "Smriti"}`}
        badgeStatus={{
          label: (activeProduct.stock_qty ?? activeProduct.qty ?? 0) > 0 ? "In Stock" : "Out of Stock",
          type: (activeProduct.stock_qty ?? activeProduct.qty ?? 0) > 0 ? "success" : "error"
        }}
        metrics={metrics}
        tabs={tabs}
        onSave={!isReadOnly ? handleSave : undefined}
        onDelete={!isReadOnly ? () => onDeleteProduct(activeProduct.id) : undefined}
        isSaving={isSaving || internalSaving}
        isDeleting={isDeleting}
      />
    </div>
  );
};
