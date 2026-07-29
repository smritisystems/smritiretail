/**
 * Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
 * Module       : Item Master Studio (SLGP-001 v2.0 Standard & SEDSObjectPage Pattern)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 5.6.0
 */

import React, { useState } from "react";
import { SEEFObjectPage, ObjectPageTab, ObjectPageMetric } from "../common/FioriObjectPage.tsx";
import { Package, Tag, DollarSign, Percent, Barcode, ShieldAlert, Layers, Grid, History, Building2, Sliders, Printer } from "lucide-react";
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

  // 8-Tier Product Hierarchy State
  const [dept, setDept] = useState<string>("Apparel & Fashion");
  const [section, setSection] = useState<string>("Ethnic Wear");
  const [cat, setCat] = useState<string>(formData.category || "Kurtas");
  const [subCat, setSubCat] = useState<string>("Silk Kurtas");
  const [brand, setBrand] = useState<string>(formData.brand || "Smriti Royal");
  const [collection, setCollection] = useState<string>("Festive 2026");
  const [season, setSeason] = useState<string>("Autumn/Winter");

  // Variant Matrix Grid State (Color x Size)
  const colors = ["Black", "Navy Blue", "Maroon", "Gold"];
  const sizes = ["S", "M", "L", "XL", "XXL"];
  const [variantGrid, setVariantGrid] = useState<Record<string, boolean>>({
    "Black-M": true,
    "Black-L": true,
    "Navy Blue-L": true,
    "Maroon-XL": true
  });

  const toggleVariant = (color: string, size: string) => {
    if (isReadOnly) return;
    const key = `${color}-${size}`;
    setVariantGrid((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFieldChange = (field: keyof Product, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveProduct({
        ...formData,
        category: cat,
        brand: brand
      });
    } finally {
      setIsSaving(false);
    }
  };

  const metrics: ObjectPageMetric[] = [
    { label: "SKU Code", value: formData.sku || formData.barcode || "N/A" },
    { label: "Physical Stock", value: `${formData.stock_qty ?? formData.qty ?? 0} ${formData.uom || "Pcs"}`, highlight: true },
    { label: "MRP Price", value: `₹${(formData.mrp || formData.price || 0).toLocaleString("en-IN")}` },
    { label: "Labels Printed", value: "1,248 Pcs", highlight: false }
  ];

  const tabs: ObjectPageTab[] = [
    {
      id: "general",
      label: "General & Identity",
      content: (
        <div className="space-y-6">
          {/* Main Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-theme-surface-1 p-5 border border-theme-divider rounded-xl">
            <div>
              <label className="block text-xs font-bold text-theme-muted mb-1">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                disabled={isReadOnly}
                className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-heading"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-theme-muted mb-1">SKU / Item Code *</label>
              <input
                type="text"
                value={formData.sku || ""}
                onChange={(e) => handleFieldChange("sku", e.target.value)}
                disabled={isReadOnly}
                className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-theme-muted mb-1">Primary Barcode</label>
              <input
                type="text"
                value={formData.barcode || ""}
                onChange={(e) => handleFieldChange("barcode", e.target.value)}
                disabled={isReadOnly}
                className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-theme-muted mb-1">Style Code / Model</label>
              <input
                type="text"
                value={formData.styleCode || ""}
                onChange={(e) => handleFieldChange("styleCode", e.target.value)}
                disabled={isReadOnly}
                className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
              />
            </div>
          </div>
        </div>
      )
    },
    {
      id: "variant-breakdown",
      label: "Variant Inventory Breakdown",
      content: (
        <ItemMasterVariantTable
          product={formData}
          onOpenBarcodeDialog={onOpenBarcodeDialog}
          isReadOnly={isReadOnly}
        />
      )
    },
    {
      id: "hierarchy",
      label: "8-Tier Classification",
      content: (
        <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-theme-heading flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0a6ed1]" /> 8-Tier Enterprise Product Classification Hierarchy
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-bold text-theme-muted mb-1">1. Department</label>
              <input type="text" value={dept} onChange={(e) => setDept(e.target.value)} disabled={isReadOnly} className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg" />
            </div>
            <div>
              <label className="block font-bold text-theme-muted mb-1">2. Section</label>
              <input type="text" value={section} onChange={(e) => setSection(e.target.value)} disabled={isReadOnly} className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg" />
            </div>
            <div>
              <label className="block font-bold text-theme-muted mb-1">3. Category</label>
              <input type="text" value={cat} onChange={(e) => setCat(e.target.value)} disabled={isReadOnly} className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold" />
            </div>
            <div>
              <label className="block font-bold text-theme-muted mb-1">4. Sub Category</label>
              <input type="text" value={subCat} onChange={(e) => setSubCat(e.target.value)} disabled={isReadOnly} className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg" />
            </div>
            <div>
              <label className="block font-bold text-theme-muted mb-1">5. Brand</label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} disabled={isReadOnly} className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-[#0a6ed1]" />
            </div>
            <div>
              <label className="block font-bold text-theme-muted mb-1">6. Collection</label>
              <input type="text" value={collection} onChange={(e) => setCollection(e.target.value)} disabled={isReadOnly} className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg" />
            </div>
            <div>
              <label className="block font-bold text-theme-muted mb-1">7. Season</label>
              <input type="text" value={season} onChange={(e) => setSeason(e.target.value)} disabled={isReadOnly} className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg" />
            </div>
            <div>
              <label className="block font-bold text-theme-muted mb-1">8. Item Node</label>
              <input type="text" value={formData.name} disabled className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono opacity-80" />
            </div>
          </div>
        </div>
      )
    },
    {
      id: "pricing",
      label: "Multi-Price Tiers",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-theme-surface-1 p-5 border border-theme-divider rounded-xl">
          <div>
            <label className="block text-xs font-bold text-theme-muted mb-1">Cost Price ₹ (Purchase)</label>
            <input
              type="number"
              value={formData.purchase_price || 0}
              onChange={(e) => handleFieldChange("purchase_price", parseFloat(e.target.value) || 0)}
              disabled={isReadOnly}
              className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading text-right"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-muted mb-1">MRP Price ₹ (Maximum Retail)</label>
            <input
              type="number"
              value={formData.mrp || formData.price || 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                handleFieldChange("mrp", val);
                handleFieldChange("price", val);
              }}
              disabled={isReadOnly}
              className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono font-bold text-emerald-500 text-right"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-muted mb-1">Wholesale / Trade Price ₹</label>
            <input
              type="number"
              value={(formData.mrp || 0) * 0.85}
              disabled
              className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-muted text-right opacity-80"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-muted mb-1">PTR (Price to Retailer - Pharma)</label>
            <input
              type="number"
              value={(formData.mrp || 0) * 0.70}
              disabled
              className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-muted text-right opacity-80"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-muted mb-1">HSN Code</label>
            <input
              type="text"
              value={formData.hsn_code || "6204"}
              onChange={(e) => handleFieldChange("hsn_code", e.target.value)}
              disabled={isReadOnly}
              className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-muted mb-1">GST Tax Rate %</label>
            <input
              type="number"
              value={formData.gst_rate ?? formData.tax_rate ?? 18}
              onChange={(e) => handleFieldChange("gst_rate", parseFloat(e.target.value) || 0)}
              disabled={isReadOnly}
              className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono font-bold text-center"
            />
          </div>
        </div>
      )
    },
    {
      id: "print-ledger",
      label: "Label Print Ledger",
      content: <ItemMasterPrintHistoryTab product={formData} />
    },
    {
      id: "matrix",
      label: "Variant Matrix Grid",
      content: (
        <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-theme-heading flex items-center gap-2">
            <Grid className="w-4 h-4 text-[#0a6ed1]" /> Color x Size Apparel Matrix Grid
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-theme-surface-2 border-b border-theme-divider">
                  <th className="p-2.5 text-left font-bold text-theme-muted">Color / Size</th>
                  {sizes.map((s) => (
                    <th key={s} className="p-2.5 text-center font-bold text-theme-muted">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colors.map((c) => (
                  <tr key={c} className="border-b border-theme-divider hover:bg-theme-surface-hover">
                    <td className="p-2.5 font-bold text-theme-heading">{c}</td>
                    {sizes.map((s) => {
                      const active = !!variantGrid[`${c}-${s}`];
                      return (
                        <td key={s} className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleVariant(c, s)}
                            className={`w-7 h-7 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                              active
                                ? "bg-[#0a6ed1] text-white shadow-xs"
                                : "bg-theme-surface-2 border border-theme-divider text-theme-muted hover:border-[#0a6ed1]"
                            }`}
                          >
                            {active ? "✓" : "-"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    },
    {
      id: "uom",
      label: "Multi-UOM Matrix",
      content: (
        <ItemMasterUomMatrix
          baseUom={formData.uom || "Pcs"}
          conversions={uomConversions}
          onChange={setUomConversions}
          isReadOnly={isReadOnly}
        />
      )
    },
    {
      id: "tracking",
      label: "Batch & Serial Flags",
      content: (
        <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-theme-heading flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#0a6ed1]" /> Inventory Control & Serialization Flags
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <label className="p-4 rounded-lg bg-theme-surface-2 border border-theme-divider flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_batch_tracking || false}
                onChange={(e) => handleFieldChange("has_batch_tracking", e.target.checked)}
                disabled={isReadOnly}
                className="rounded text-[#0a6ed1]"
              />
              <div>
                <strong className="block text-theme-heading">Batch Tracking</strong>
                <span className="text-[10px] text-theme-muted">Mandatory for Pharmacy & FMCG</span>
              </div>
            </label>

            <label className="p-4 rounded-lg bg-theme-surface-2 border border-theme-divider flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_expiry_date || false}
                onChange={(e) => handleFieldChange("has_expiry_date", e.target.checked)}
                disabled={isReadOnly}
                className="rounded text-[#0a6ed1]"
              />
              <div>
                <strong className="block text-theme-heading">Expiry Date Alerts</strong>
                <span className="text-[10px] text-theme-muted">Enables near-expiry notifications</span>
              </div>
            </label>

            <label className="p-4 rounded-lg bg-theme-surface-2 border border-theme-divider flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_serial_number || false}
                onChange={(e) => handleFieldChange("has_serial_number", e.target.checked)}
                disabled={isReadOnly}
                className="rounded text-[#0a6ed1]"
              />
              <div>
                <strong className="block text-theme-heading">Serial Serialization</strong>
                <span className="text-[10px] text-theme-muted">Mandatory for Mobile & Hardware</span>
              </div>
            </label>
          </div>
        </div>
      )
    }
  ];

  return (
    <SEEFObjectPage
      title={formData.name}
      subtitle={`SKU: ${formData.sku || formData.barcode || "N/A"} | HSN: ${formData.hsn_code || "6204"} | Brand: ${brand}`}
      badgeStatus={{ label: "Active SKU", type: "success" }}
      metrics={metrics}
      tabs={tabs}
      onSave={handleSave}
      onDelete={!isReadOnly ? () => onDeleteProduct(formData.id) : undefined}
      isSaving={isSaving}
      headerActions={
        <button
          onClick={() => onOpenBarcodeDialog()}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#0a6ed1] text-white hover:bg-[#085caf] flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Printer className="w-4 h-4" /> Print Barcode Labels
        </button>
      }
    />
  );
};
