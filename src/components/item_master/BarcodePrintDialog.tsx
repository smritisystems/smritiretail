/**
 * Project      : SMRITI Retail OS
 * Module       : Standardized Thermal Barcode Label Print Dialog (SLGP-R4 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState } from "react";
import { SmritiDialog } from "../../layout_engine/components/SmritiDialog.tsx";
import { Printer, Barcode, Tag, Check, Copy } from "lucide-react";
import { Product } from "../../types.js";

interface BarcodePrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onNotification?: (title: string, msg: string, type?: "success" | "error") => void;
}

export const BarcodePrintDialog: React.FC<BarcodePrintDialogProps> = ({
  isOpen,
  onClose,
  product,
  onNotification
}) => {
  const [printCount, setPrintCount] = useState<number>(10);
  const [labelSize, setLabelSize] = useState<string>("50x25mm");
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showStoreName, setShowStoreName] = useState<boolean>(true);

  if (!product) return null;

  const handlePrint = () => {
    if (onNotification) {
      onNotification(
        "Barcode Label Queue Sent",
        `Sent ${printCount} thermal barcode labels (${labelSize}) for ${product.name} to thermal printer queue.`,
        "success"
      );
    }
    onClose();
  };

  return (
    <SmritiDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Print Barcode Labels: ${product.name}`}
      subtitle={`SKU: ${product.sku || product.barcode || "N/A"} | MRP: ₹${product.mrp || product.price || 0}`}
      icon={Printer}
      maxWidthClass="max-w-xl"
      footerActions={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-theme-muted hover:text-theme-heading transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-bold bg-[#0a6ed1] text-white rounded-lg hover:bg-[#085caf] flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print {printCount} Labels
          </button>
        </>
      }
    >
      <div className="space-y-5 select-none">
        {/* Label Thermal Preview Card */}
        <div className="p-4 bg-white border-2 border-dashed border-[#0a6ed1] rounded-xl flex flex-col items-center justify-center space-y-1 shadow-md text-slate-900 font-sans">
          {showStoreName && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
              SMRITI RETAIL OS STORE
            </span>
          )}
          <h4 className="text-xs font-bold text-center line-clamp-1">{product.name}</h4>
          
          {/* Simulated Barcode Stripes */}
          <div className="w-48 h-10 bg-slate-900 flex items-center justify-center my-1 rounded-xs">
            <Barcode className="w-36 h-8 text-white stroke-[1.5]" />
          </div>

          <div className="flex items-center justify-between w-48 text-[10px] font-mono text-slate-800">
            <span>{product.barcode || product.sku || "8901234567890"}</span>
            {showPrice && (
              <span className="font-extrabold text-slate-950">₹{(product.mrp || product.price || 0).toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* Print Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-theme-muted font-bold mb-1">Number of Labels</label>
            <input
              type="number"
              min="1"
              max="500"
              value={printCount}
              onChange={(e) => setPrintCount(parseInt(e.target.value) || 1)}
              className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
            />
          </div>

          <div>
            <label className="block text-theme-muted font-bold mb-1">Label Sticker Size</label>
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value)}
              className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
            >
              <option value="50x25mm">50 x 25 mm (Standard Thermal Roll)</option>
              <option value="38x25mm">38 x 25 mm (Dual Column)</option>
              <option value="100x50mm">100 x 50 mm (Warehouse Outer Carton)</option>
            </select>
          </div>
        </div>

        {/* Toggle Options */}
        <div className="flex items-center gap-6 text-xs text-theme-heading">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="rounded text-[#0a6ed1]"
            />
            <span>Include MRP Price tag</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showStoreName}
              onChange={(e) => setShowStoreName(e.target.checked)}
              className="rounded text-[#0a6ed1]"
            />
            <span>Include Store Header</span>
          </label>
        </div>
      </div>
    </SmritiDialog>
  );
};
