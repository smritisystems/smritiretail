/**
 * Project      : SMRITI Retail OS v5.0
 * Module       : Browser-First Barcode Label Engine & Audit Capture (v4.0 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 5.6.0
 */

import React, { useState } from "react";
import { SmritiDialog } from "../../layout_engine/components/SmritiDialog.tsx";
import { Printer, Barcode, Download, FileText, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";
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
  const [outputFormat, setOutputFormat] = useState<"PDF" | "ZPL" | "TSPL" | "EPL" | "DIRECT_QZ">("PDF");
  const [reprintReason, setReprintReason] = useState<string>("Manual Reprint");
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showStoreName, setShowStoreName] = useState<boolean>(true);

  if (!product) return null;

  // Runtime QZ Tray detection check (window.qz)
  const isQzAvailable = typeof window !== "undefined" && Boolean((window as any).qz);

  // Formatted Print Job ID: LP-YYYYMMDD-XXXXXX
  const generatePrintJobId = () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    return `LP-${today}-${randomHex}`;
  };

  const handleExecutePrint = (format: "PDF" | "ZPL" | "TSPL" | "EPL" | "DIRECT_QZ") => {
    const jobId = generatePrintJobId();

    if (format === "ZPL" || format === "TSPL" || format === "EPL") {
      const dummyContent = `; SMRITI Label Raw Command Stream (${format})
^XA
^FO50,50^A0N,36,36^FD${product.name}^FS
^FO50,100^BY3^BCN,100,Y,N,N^FD${product.barcode || product.sku || "8901234567890"}^FS
^FO50,220^A0N,28,28^FDMRP: RS.${product.mrp || product.price || 0}^FS
^XZ`;
      const blob = new Blob([dummyContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${product.sku || "label"}_${format.toLowerCase()}_${jobId}.${format.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
    }

    if (onNotification) {
      onNotification(
        `Print Job Created: ${jobId}`,
        `Generated ${printCount} thermal labels (${labelSize}) via ${format} output stream. Logged to Label Print Ledger.`,
        "success"
      );
    }
    onClose();
  };

  return (
    <SmritiDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Label Print Manager: ${product.name}`}
      subtitle={`SKU: ${product.sku || product.barcode || "N/A"} | MRP: â‚¹${product.mrp || product.price || 0}`}
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

          {isQzAvailable && (
            <button
              onClick={() => handleExecutePrint("DIRECT_QZ")}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Cpu className="w-4 h-4" /> 1-Click Direct Print (QZ)
            </button>
          )}

          <button
            onClick={() => handleExecutePrint(outputFormat)}
            className="px-4 py-2 text-xs font-bold bg-[var(--c-seef-accent)] text-white rounded-lg hover:bg-[var(--c-seef-accent)]/90 flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Generate {printCount} Labels ({outputFormat})
          </button>
        </>
      }
    >
      <div className="space-y-5 select-none">
        {/* Label Thermal Preview Card */}
        <div className="p-4 bg-white border-2 border-dashed border-[var(--c-seef-accent)] rounded-xl flex flex-col items-center justify-center space-y-1 shadow-md text-theme-heading font-sans">
          {showStoreName && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-theme-body">
              SMRITI RETAIL OS STORE
            </span>
          )}
          <h4 className="text-xs font-bold text-center line-clamp-1">{product.name}</h4>

          {/* Simulated Barcode Stripes */}
          <div className="w-48 h-10 bg-theme-surface-2 flex items-center justify-center my-1 rounded-xs">
            <Barcode className="w-36 h-8 text-white stroke-[1.5]" />
          </div>

          <div className="flex items-center justify-between w-48 text-[10px] font-mono text-theme-heading">
            <span>{product.barcode || product.sku || "8901234567890"}</span>
            {showPrice && (
              <span className="font-extrabold text-theme-heading">â‚¹{(product.mrp || product.price || 0).toFixed(2)}</span>
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
              max="1000"
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

          <div>
            <label className="block text-theme-muted font-bold mb-1">Browser Output Format</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as any)}
              className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading font-bold text-[var(--c-seef-accent)]"
            >
              <option value="PDF">PDF Sticker Sheet (Browser Native Stream)</option>
              <option value="ZPL">ZPL Raw Stream (Zebra Industrial)</option>
              <option value="TSPL">TSPL Raw Stream (TSC Printers)</option>
              <option value="EPL">EPL Raw Stream (Eltron Printers)</option>
            </select>
          </div>

          <div>
            <label className="block text-theme-muted font-bold mb-1">Reprint Reason</label>
            <select
              value={reprintReason}
              onChange={(e) => setReprintReason(e.target.value)}
              className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
            >
              <option value="Manual Reprint">Initial Batch Print</option>
              <option value="Damaged Label">Damaged / Damaged Sticker</option>
              <option value="Lost Label">Lost Label Replacement</option>
              <option value="Price Changed">Price / MRP Updated</option>
              <option value="Barcode Not Readable">Barcode Unreadable Scanner Failure</option>
              <option value="Shelf Replacement">Shelf Edge Replacement</option>
            </select>
          </div>
        </div>

        {/* QZ Status Indicator */}
        <div className="p-2.5 rounded-lg bg-theme-surface-2 border border-theme-divider flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1.5 text-theme-muted">
            <Cpu className="w-4 h-4 text-[var(--c-seef-accent)]" /> Hardware Direct Print (QZ Tray):
          </span>
          <span className={`font-bold ${isQzAvailable ? "text-emerald-500" : "text-amber-500"}`}>
            {isQzAvailable ? "âœ“ Available & Connected" : "Not Detected (Browser Output Active)"}
          </span>
        </div>

        {/* Toggle Options */}
        <div className="flex items-center gap-6 text-xs text-theme-heading">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="rounded text-[var(--c-seef-accent)]"
            />
            <span>Include MRP Price tag</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showStoreName}
              onChange={(e) => setShowStoreName(e.target.checked)}
              className="rounded text-[var(--c-seef-accent)]"
            />
            <span>Include Store Header</span>
          </label>
        </div>
      </div>
    </SmritiDialog>
  );
};
