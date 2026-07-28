/**
 * Project      : SMRITI Retail OS
 * Module       : Product Master Form Inspector (SEEF Object Page Pattern C Right Inspector)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState } from "react";
import { SEEFObjectPage, ObjectPageTab, ObjectPageMetric } from "../common/FioriObjectPage.tsx";
import { Package, Tag, DollarSign, Percent, Barcode, ShieldAlert, Layers } from "lucide-react";
import { Product } from "../../types.js";
import { ItemMasterUomMatrix, UomConversion } from "./ItemMasterUomMatrix.tsx";

interface ItemMasterFormInspectorProps {
  product: Product | null;
  onSaveProduct: (updated: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onOpenBarcodeDialog: () => void;
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
      <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center text-theme-muted font-mono border-2 border-dashed border-theme-divider rounded-xl">
        <Package className="w-12 h-12 mb-3 text-theme-muted" />
        <h3 className="text-sm font-bold text-theme-heading">No Product Selected</h3>
        <p className="text-xs">Select a SKU from the left master list or click "New SKU" to create a record.</p>
      </div>
    );
  }

  const [formData, setFormData] = useState<Product>({ ...product });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [uomConversions, setUomConversions] = useState<UomConversion[]>([]);

  const handleFieldChange = (field: keyof Product, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveProduct(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const metrics: ObjectPageMetric[] = [
    { label: "SKU Code", value: formData.sku || formData.barcode || "N/A" },
    { label: "Current Stock", value: `${formData.stock_qty ?? formData.qty ?? 0} ${formData.uom || "Pcs"}`, highlight: true },
    { label: "MRP Price", value: `₹${(formData.mrp || formData.price || 0).toLocaleString("en-IN")}` },
    { label: "GST Tax Rate", value: `${formData.gst_rate ?? formData.tax_rate ?? 18}%` }
  ];

  const tabs: ObjectPageTab[] = [
    {
      id: "general",
      label: "General & Pricing",
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
              <label className="block text-xs font-bold text-theme-muted mb-1">Category</label>
              <input
                type="text"
                value={formData.category || ""}
                onChange={(e) => handleFieldChange("category", e.target.value)}
                disabled={isReadOnly}
                className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
              />
            </div>
          </div>

          {/* Financials & Tax Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-theme-surface-1 p-5 border border-theme-divider rounded-xl">
            <div>
              <label className="block text-xs font-bold text-theme-muted mb-1">Cost Price ₹</label>
              <input
                type="number"
                value={formData.purchase_price || 0}
                onChange={(e) => handleFieldChange("purchase_price", parseFloat(e.target.value) || 0)}
                disabled={isReadOnly}
                className="w-full p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-theme-muted mb-1">Selling Price (MRP) ₹ *</label>
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
              <label className="block text-xs font-bold text-theme-muted mb-1">HSN Code / GST %</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="HSN"
                  value={formData.hsn_code || ""}
                  onChange={(e) => handleFieldChange("hsn_code", e.target.value)}
                  disabled={isReadOnly}
                  className="w-1/2 p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                />
                <input
                  type="number"
                  placeholder="GST %"
                  value={formData.gst_rate ?? formData.tax_rate ?? 18}
                  onChange={(e) => handleFieldChange("gst_rate", parseFloat(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className="w-1/2 p-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading text-center"
                />
              </div>
            </div>
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
      subtitle={`SKU: ${formData.sku || formData.barcode || "N/A"} | HSN: ${formData.hsn_code || "N/A"}`}
      badgeStatus={{ label: "Active SKU", type: "success" }}
      metrics={metrics}
      tabs={tabs}
      onSave={handleSave}
      onDelete={!isReadOnly ? () => onDeleteProduct(formData.id) : undefined}
      isSaving={isSaving}
      headerActions={
        <button
          onClick={onOpenBarcodeDialog}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-theme-surface-2 border border-theme-divider text-theme-heading hover:bg-theme-surface-hover flex items-center gap-1.5 cursor-pointer"
        >
          <Barcode className="w-4 h-4 text-[#0a6ed1]" /> Print Barcodes
        </button>
      }
    />
  );
};
