/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.47.2
 * Created      : 2026-09-29
 * Modified     : 2026-09-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal Modal
 */

import React, { useState } from "react";
import { X, Lock, Plus, Tag } from "lucide-react";
import { Product } from "../../../types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

export interface VariantEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onUpdated: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const VariantEditModal: React.FC<VariantEditModalProps> = ({
  isOpen,
  onClose,
  product,
  onUpdated,
  onNotification,
}) => {
  if (!isOpen || !product) return null;

  const [mrp, setMrp] = useState<string>(String(product.mrp ?? "0"));
  const [sellingPrice, setSellingPrice] = useState<string>(String(product.price ?? "0"));
  const [costPrice, setCostPrice] = useState<string>(String((product as any).cost_price ?? product.costPrice ?? "0"));
  
  // Secondary barcodes
  const initialSecondary = Array.isArray((product as any).secondary_barcodes)
    ? (product as any).secondary_barcodes
    : [];
  const [secondaryBarcodes, setSecondaryBarcodes] = useState<string[]>(initialSecondary);
  const [newBarcode, setNewBarcode] = useState<string>("");
  const [isAddingBarcode, setIsAddingBarcode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleAddBarcode = () => {
    const trimmed = newBarcode.trim().toUpperCase();
    if (!trimmed) return;
    if (trimmed === (product.barcode || "").toUpperCase() || secondaryBarcodes.includes(trimmed)) {
      onNotification?.("Validation Error", "Barcode already exists for this variant.", "error");
      return;
    }
    setSecondaryBarcodes((prev) => [...prev, trimmed]);
    setNewBarcode("");
    setIsAddingBarcode(false);
  };

  const handleRemoveBarcode = (index: number) => {
    setSecondaryBarcodes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Put update with mutable fields only (immutable SKU, Barcode, Size, Color excluded to protect canonical identity)
      await apiFetchV1(`/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          mrp: parseFloat(mrp) || 0,
          price: parseFloat(sellingPrice) || 0,
          cost_price: parseFloat(costPrice) || 0,
          secondary_barcodes: secondaryBarcodes,
        }),
      });

      onNotification?.("Variant Updated", `Variant ${product.code || product.sku} updated successfully.`, "success");
      onUpdated();
      onClose();
    } catch (err: any) {
      onNotification?.("Update Failed", err?.message || "Failed to update variant.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white dark:bg-[#1a2234] border border-[#c3c6d6] dark:border-[#434654] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0] dark:border-[#2d3748]">
          <h2 className="text-base font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
            Edit Variant
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] dark:hover:bg-[#2d3748] dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Section 1: Immutable Variant Information */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] mb-3">
              Variant Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                  SKU
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={product.code || (product as any).sku || ""}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed pr-8"
                  />
                  <Lock size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                  Primary Barcode <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={product.barcode || ""}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed pr-8"
                  />
                  <Lock size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Additional Barcodes */}
          <div>
            <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1.5">
              Additional Barcodes
            </label>
            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-[#f8fafc] dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#374151] rounded-xl min-h-[46px]">
              {secondaryBarcodes.map((bc, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-mono border border-blue-200 dark:border-blue-800"
                >
                  <Tag size={11} />
                  <span>{bc}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBarcode(idx)}
                    className="hover:text-red-600 transition"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              {isAddingBarcode ? (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Scan or enter barcode"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddBarcode();
                      } else if (e.key === "Escape") {
                        setIsAddingBarcode(false);
                      }
                    }}
                    className="px-2 py-1 text-xs border border-blue-400 rounded-lg outline-none bg-white dark:bg-slate-900 font-mono w-44"
                  />
                  <button
                    type="button"
                    onClick={handleAddBarcode}
                    className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingBarcode(false)}
                    className="px-1.5 py-1 text-slate-500 hover:text-slate-700 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingBarcode(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-[#94a3b8] text-xs font-semibold text-[#64748b] hover:border-[#2563eb] hover:text-[#2563eb] transition"
                >
                  <Plus size={12} />
                  <span>Add barcode</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Immutable Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                Size
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={product.size || (product.attributes as any)?.size || "—"}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed pr-8"
                />
                <Lock size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                Color
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={product.color || (product.attributes as any)?.color || "—"}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed pr-8"
                />
                <Lock size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Section 4: Mutable Commercial Fields */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#e2e8f0] dark:border-[#2d3748]">
            <div>
              <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                MRP (₹)
              </label>
              <input
                type="number"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                Selling Price (₹)
              </label>
              <input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                Cost Price (₹)
              </label>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8f0] dark:border-[#2d3748] bg-slate-50 dark:bg-[#131b2e]/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition"
          >
            {isSaving ? "Updating..." : "Update Variant"}
          </button>
        </div>

      </div>
    </div>
  );
};
