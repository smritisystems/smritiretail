/**
 * Project      : SMRITI Retail OS v6.5 — Workspace Experience Platform
 * Module       : Item Master Studio (12-Tab Item 360 Workspace & SEDSObjectPage Pattern)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 6.5.0
 */

import React, { useState, useEffect } from "react";
import { SEEFObjectPage, ObjectPageTab, ObjectPageMetric } from "../common/FioriObjectPage.tsx";
import {
  Package, Tag, DollarSign, Percent, Barcode, ShieldAlert, Layers, Grid, History,
  Building2, Sliders, Printer, Sparkles, ChevronRight, MapPin, Truck, FileText,
  TrendingUp, Activity, PieChart, BarChart2, Plus, Trash2, CheckCircle2, Image as ImageIcon
} from "lucide-react";
import { Product } from "../../types.js";
import { ItemMasterUomMatrix, UomConversion } from "./ItemMasterUomMatrix.tsx";
import { ItemMasterVariantTable } from "./ItemMasterVariantTable.tsx";
import { ItemMasterPrintHistoryTab } from "./ItemMasterPrintHistoryTab.tsx";

interface ItemMasterFormInspectorProps {
  product: Product | null;
  onSaveProduct: (updated: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onOpenBarcodeDialog: (variant?: any) => void;
  isReadOnly?: boolean;
}

export const ItemMasterFormInspector: React.FC<ItemMasterFormInspectorProps> = ({
  product,
  onSaveProduct,
  onDeleteProduct,
  onOpenBarcodeDialog,
  isReadOnly = false
}) => {
  if (!product) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center text-theme-muted font-mono border-2 border-dashed border-theme-divider rounded-xl select-none">
        <Package className="w-12 h-12 mb-3 text-theme-muted" />
        <h3 className="text-sm font-bold text-theme-heading">No Product Selected</h3>
        <p className="text-xs">Select a SKU from the left master list or click "New SKU" to create a record.</p>
      </div>
    );
  }

  const [formData, setFormData] = useState<Product>({ ...product });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [uomConversions, setUomConversions] = useState<UomConversion[]>([]);

  useEffect(() => {
    setFormData({ ...product });
  }, [product]);

  // Pricing Matrix Calculations
  const mrp = formData.mrp || formData.price || 0;
  const salePrice = formData.price || 0;
  const purchaseCost = formData.purchase_price || formData.costPrice || 0;
  const marginPercent = mrp > 0 ? (((mrp - purchaseCost) / mrp) * 100).toFixed(1) : "0.0";
  const markupPercent = purchaseCost > 0 ? (((salePrice - purchaseCost) / purchaseCost) * 100).toFixed(1) : "0.0";

  // AI Suggestions & Nudges
  const aiSuggestions = [
    salePrice < purchaseCost ? "CRITICAL: Sale price is lower than purchase cost!" : "Margin is healthy at " + marginPercent + "%",
    (formData.stock_qty ?? formData.qty ?? 0) < (formData.min_stock_level || 5) ? "Low Stock Alert: Reorder point reached" : "Optimal Stock Level maintained",
    "Suggested Price Optimization: Retail market rate supports +3.5% margin adjustment",
  ];

  const handleFieldChange = (field: keyof Product, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveProduct({ ...formData });
    } finally {
      setIsSaving(false);
    }
  };

  const metrics: ObjectPageMetric[] = [
    { label: "SKU / Barcode", value: formData.barcode || formData.sku || "N/A" },
    { label: "Physical Stock", value: `${formData.stock_qty ?? formData.qty ?? 0} ${formData.uom || "Pcs"}`, highlight: true },
    { label: "MRP / Retailing Price", value: `₹${mrp.toLocaleString("en-IN")}` },
    { label: "Margin %", value: `${marginPercent}%`, highlight: parseFloat(marginPercent) > 20 },
  ];

  const tabs: ObjectPageTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-6 max-w-5xl font-sans text-xs">
          <div className="p-4 bg-gradient-to-r from-purple-950/40 to-blue-950/40 border border-purple-500/30 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold uppercase font-mono text-[11px]">
              <Sparkles className="w-4 h-4" /> AI Smart Recommendations &amp; Margin Nudges
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {aiSuggestions.map((sug, i) => (
                <div key={i} className="p-3 bg-theme-surface-2/80 border border-theme-divider rounded-lg font-mono text-[11px] text-theme-heading flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-[#0a6ed1] flex-shrink-0 mt-0.5" />
                  <span>{sug}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3 font-mono">
              <h5 className="font-bold text-theme-heading font-display text-sm flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-[#0a6ed1]" /> Identity &amp; Tax Profile
              </h5>
              {[
                ["Item Code", formData.code || formData.sku || "N/A"],
                ["Item Name", formData.name],
                ["Barcode", formData.barcode || "N/A"],
                ["Category", formData.category || "General"],
                ["Sub-Category", formData.subCategory || formData.sub_category || "Standard"],
                ["Brand", formData.brand || "Smriti Standard"],
                ["HSN / SAC Code", formData.hsn_code || formData.hsnCode || "8471"],
                ["GST Rate", `${formData.gst_rate || formData.gstPercentage || 18}%`],
                ["Unit of Measure (UOM)", formData.uom || "Pcs"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between text-xs border-b border-theme-divider/40 pb-1.5">
                  <span className="text-theme-muted">{k}</span>
                  <span className="font-bold text-theme-heading">{v || "—"}</span>
                </div>
              ))}
            </div>

            <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3 font-mono">
              <h5 className="font-bold text-theme-heading font-display text-sm flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Commercial &amp; Margins
              </h5>
              {[
                ["MRP Price", `₹${mrp.toLocaleString("en-IN")}`],
                ["Retail Sale Price", `₹${salePrice.toLocaleString("en-IN")}`],
                ["Purchase Cost", `₹${purchaseCost.toLocaleString("en-IN")}`],
                ["Gross Margin", `₹${(salePrice - purchaseCost).toLocaleString("en-IN")}`],
                ["Margin %", `${marginPercent}%`],
                ["Markup %", `${markupPercent}%`],
                ["Current Stock Qty", `${formData.stock_qty ?? formData.qty ?? 0} ${formData.uom || "Pcs"}`],
                ["Min Reorder Level", `${formData.min_stock_level || 5} Pcs`],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between text-xs border-b border-theme-divider/40 pb-1.5">
                  <span className="text-theme-muted">{k}</span>
                  <span className="font-bold text-theme-heading">{v || "—"}</span>
                </div>
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
              <input type="number" step="0.01" value={formData.mrp || 0} onChange={(e) => handleFieldChange("mrp", parseFloat(e.target.value))} className="w-full p-2 bg-theme-surface-1 border border-theme-divider rounded text-theme-heading font-bold text-base" />
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Retail Selling Price</span>
              <input type="number" step="0.01" value={formData.price || 0} onChange={(e) => handleFieldChange("price", parseFloat(e.target.value))} className="w-full p-2 bg-theme-surface-1 border border-theme-divider rounded text-emerald-400 font-bold text-base" />
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Purchase Cost / Rate</span>
              <input type="number" step="0.01" value={formData.purchase_price || formData.costPrice || 0} onChange={(e) => handleFieldChange("purchase_price", parseFloat(e.target.value))} className="w-full p-2 bg-theme-surface-1 border border-theme-divider rounded text-purple-400 font-bold text-base" />
            </div>
          </div>

          <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><span className="text-theme-muted text-[10px] uppercase block font-bold">Wholesale Price</span><strong className="text-sm font-bold text-theme-heading">₹{((formData.price || 0) * 0.9).toFixed(2)}</strong></div>
            <div><span className="text-theme-muted text-[10px] uppercase block font-bold">Dealer Price</span><strong className="text-sm font-bold text-theme-heading">₹{((formData.price || 0) * 0.85).toFixed(2)}</strong></div>
            <div><span className="text-theme-muted text-[10px] uppercase block font-bold">Distributor Price</span><strong className="text-sm font-bold text-theme-heading">₹{((formData.price || 0) * 0.8).toFixed(2)}</strong></div>
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
            <Truck className="w-5 h-5 text-[#0a6ed1]" /> Multi-Location Stock &amp; Warehouse Bin Locations
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Current Stock Qty</span>
              <strong className="text-xl font-bold text-emerald-400">{formData.stock_qty ?? formData.qty ?? 0} {formData.uom || "Pcs"}</strong>
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Min Reorder Level</span>
              <strong className="text-xl font-bold text-amber-400">{formData.min_stock_level || 5} Pcs</strong>
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Max Stock Limit</span>
              <strong className="text-xl font-bold text-theme-heading">500 Pcs</strong>
            </div>
            <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1">
              <span className="text-theme-muted text-[10px] uppercase font-bold block">Preferred Warehouse</span>
              <strong className="text-sm font-bold text-[#0a6ed1]">Central WH-01</strong>
            </div>
          </div>

          <ItemMasterUomMatrix baseUom={formData.uom || "Pcs"} conversions={uomConversions} onChange={setUomConversions} isReadOnly={isReadOnly} />
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
                  <td className="p-2 text-right font-bold text-theme-heading">₹{(parseFloat(String(formData.mrp || "100")) * 60).toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right text-amber-400 font-bold">14 Days</td>
                </tr>
                <tr className="hover:bg-theme-surface-1">
                  <td className="p-2 font-bold text-theme-heading">Avenue Supermarts (D-Mart)</td>
                  <td className="p-2 text-theme-muted">DC Thane / Grocery Dept</td>
                  <td className="p-2 text-right text-theme-muted">200 Pcs</td>
                  <td className="p-2 text-right text-emerald-400 font-bold">140 Pcs</td>
                  <td className="p-2 text-right text-indigo-400 font-bold">60 Pcs</td>
                  <td className="p-2 text-right font-bold text-theme-heading">₹{(parseFloat(String(formData.mrp || "100")) * 60).toLocaleString('en-IN')}</td>

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
      content: <ItemMasterVariantTable product={formData} onOpenBarcodeDialog={onOpenBarcodeDialog} isReadOnly={isReadOnly} />
    },
    {
      id: "suppliers",
      label: "Suppliers & Procurement",
      content: (
        <div className="space-y-4 max-w-5xl font-mono text-xs">
          <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><Building2 className="w-5 h-5 text-[#0a6ed1]" /> Preferred Vendors &amp; Purchase History</h4>
          <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
            <div className="flex items-center justify-between"><strong className="font-sans text-theme-heading text-xs">TechCorp Distributors (VND-1002)</strong><span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">Primary Vendor</span></div>
            <p className="text-theme-muted text-xs">Lead Time: 3 Days | MOQ: 10 Pcs | Last Purchase Rate: ₹{(purchaseCost || 60).toFixed(2)} | Date: 2026-07-20</p>
          </div>
        </div>
      )
    },
    {
      id: "barcode",
      label: "Barcode & Labels",
      content: <ItemMasterPrintHistoryTab product={formData} />
    },
    {
      id: "analytics",
      label: "Analytics & Velocity",
      content: (
        <div className="space-y-5 max-w-5xl font-mono text-xs">
          <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><BarChart2 className="w-5 h-5 text-[#0a6ed1]" /> Sales Velocity &amp; Inventory Turnover</h4>
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
        title={formData.name}
        subtitle={`SKU: ${formData.sku || formData.code || "N/A"} | Category: ${formData.category || "General"} | Brand: ${formData.brand || "Smriti"}`}
        badgeStatus={{
          label: (formData.stock_qty ?? formData.qty ?? 0) > 0 ? "In Stock" : "Out of Stock",
          type: (formData.stock_qty ?? formData.qty ?? 0) > 0 ? "success" : "error"
        }}
        metrics={metrics}
        tabs={tabs}
        onSave={!isReadOnly ? handleSave : undefined}
        onDelete={!isReadOnly ? () => onDeleteProduct(formData.id) : undefined}
        isSaving={isSaving}
      />
    </div>
  );
};
