/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : Â© SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useMemo } from "react";
import { 
  X, Printer, Download, Copy, Check, FileCode, Tag, 
  Layers, Settings, Sliders, RefreshCw, Barcode, CheckCircle2
} from "lucide-react";
import { Product } from "../types.js";
import { generatePRNScript, PRNOptions } from "../services/prnGenerator";

interface BarcodePrintStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProductIds?: Set<string>;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const BarcodePrintStudioModal: React.FC<BarcodePrintStudioModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedProductIds,
  onNotification,
}) => {
  const [language, setLanguage] = useState<"TSPL" | "ZPL">("TSPL");
  const [widthMm, setWidthMm] = useState<number>(50);
  const [heightMm, setHeightMm] = useState<number>(25);
  const [copiesMode, setCopiesMode] = useState<"fixed" | "stock">("fixed");
  const [fixedCopies, setFixedCopies] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"preview" | "script">("preview");

  // Determine items to print based on selection or fallback to first 10
  const selectedItems = useMemo(() => {
    if (selectedProductIds && selectedProductIds.size > 0) {
      return products.filter((p) => selectedProductIds.has(p.id));
    }
    return products.slice(0, 10);
  }, [products, selectedProductIds]);

  // Construct item copies array
  const itemCopiesList = useMemo(() => {
    return selectedItems.map((product) => ({
      product,
      copies: copiesMode === "stock" ? Math.max(1, product.stock || 1) : fixedCopies,
    }));
  }, [selectedItems, copiesMode, fixedCopies]);

  // Generate PRN Script
  const rawPRNScript = useMemo(() => {
    const options: PRNOptions = {
      language,
      widthMm,
      heightMm,
      gapMm: 2,
    };
    return generatePRNScript(itemCopiesList, options);
  }, [itemCopiesList, language, widthMm, heightMm]);

  if (!isOpen) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(rawPRNScript);
    setCopied(true);
    onNotification("PRN Script Copied", "Raw printer script copied to clipboard.", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPRN = () => {
    const blob = new Blob([rawPRNScript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smriti_barcode_labels_${language.toLowerCase()}.prn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotification("PRN Downloaded", "Barcode PRN file downloaded successfully.", "success");
  };

  const handlePrint = () => {
    window.print();
  };

  const sampleItem = selectedItems[0] || {
    code: "SKU-DEMO-001",
    name: "Sample Product Label",
    price: 499.00,
    mrp: 599.00,
    barcode: "8901234567890",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-theme-surface-1 border border-cyan-500/30 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-theme-surface-1 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Tag size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Barcode Print Studio & PRN Script Generator
              </h2>
              <p className="text-xs text-theme-muted font-mono">
                Item Master Mapping ({selectedItems.length} Products Selected)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-theme-muted hover:text-theme-heading rounded-lg hover:bg-theme-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 scrollbar-none">
          {/* Left Panel: Configuration Options (5 cols) */}
          <div className="md:col-span-5 space-y-5">
            {/* Command Language Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-theme-muted uppercase tracking-wider font-mono flex items-center gap-1.5">
                <FileCode size={13} className="text-cyan-400" /> Printer Command Language
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-theme-surface-2 rounded-xl border border-theme-divider">
                <button
                  onClick={() => setLanguage("TSPL")}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    language === "TSPL"
                      ? "bg-cyan-500 text-black shadow-md"
                      : "text-theme-muted hover:text-theme-heading"
                  }`}
                >
                  TSPL (TSC / GPrinter)
                </button>
                <button
                  onClick={() => setLanguage("ZPL")}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    language === "ZPL"
                      ? "bg-cyan-500 text-black shadow-md"
                      : "text-theme-muted hover:text-theme-heading"
                  }`}
                >
                  ZPL (Zebra)
                </button>
              </div>
            </div>

            {/* Label Dimensions */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-theme-muted uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sliders size={13} className="text-cyan-400" /> Label Size (Width x Height)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { w: 50, h: 25, label: "50 x 25 mm" },
                  { w: 40, h: 25, label: "40 x 25 mm" },
                  { w: 58, h: 40, label: "58 x 40 mm" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setWidthMm(preset.w);
                      setHeightMm(preset.h);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      widthMm === preset.w && heightMm === preset.h
                        ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 font-bold"
                        : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-theme-heading"
                    }`}
                  >
                    <span className="text-xs block font-mono">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Print Quantity Mode */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-theme-muted uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Layers size={13} className="text-cyan-400" /> Copies Source
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-theme-surface-2 border border-theme-divider cursor-pointer">
                  <input
                    type="radio"
                    name="copiesMode"
                    checked={copiesMode === "fixed"}
                    onChange={() => setCopiesMode("fixed")}
                    className="accent-cyan-500"
                  />
                  <span className="text-xs text-white font-medium">Fixed Copies per Item:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={fixedCopies}
                    onChange={(e) => setFixedCopies(parseInt(e.target.value) || 1)}
                    disabled={copiesMode !== "fixed"}
                    className="w-16 bg-theme-surface-1 border border-theme-divider rounded px-2 py-0.5 text-xs text-white font-mono outline-none"
                  />
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-theme-surface-2 border border-theme-divider cursor-pointer">
                  <input
                    type="radio"
                    name="copiesMode"
                    checked={copiesMode === "stock"}
                    onChange={() => setCopiesMode("stock")}
                    className="accent-cyan-500"
                  />
                  <span className="text-xs text-white font-medium">
                    Use Item Master Stock Qty (On-Hand)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Panel: Preview & Raw PRN Script (7 cols) */}
          <div className="md:col-span-7 flex flex-col space-y-4">
            {/* View Switcher */}
            <div className="flex justify-between items-center border-b border-theme-divider pb-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "preview"
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                      : "text-theme-muted hover:text-theme-heading"
                  }`}
                >
                  Label Visual Preview
                </button>
                <button
                  onClick={() => setActiveTab("script")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "script"
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                      : "text-theme-muted hover:text-theme-heading"
                  }`}
                >
                  Raw PRN Script ({language})
                </button>
              </div>

              <span className="text-xs font-mono text-cyan-400">
                Total Labels: {itemCopiesList.reduce((acc, c) => acc + c.copies, 0)}
              </span>
            </div>

            {/* Visual Preview */}
            {activeTab === "preview" ? (
              <div className="flex-1 min-h-[220px] bg-theme-surface-1 border border-theme-divider rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
                <span className="text-[10px] uppercase font-mono text-theme-muted mb-3">
                  Live Thermal Label Mockup ({widthMm} x {heightMm} mm)
                </span>

                {/* Printable Label Card */}
                <div
                  className="bg-white text-black p-3 rounded-lg shadow-xl flex flex-col justify-between select-none"
                  style={{
                    width: `${widthMm * 4}px`,
                    height: `${heightMm * 4}px`,
                  }}
                >
                  <div className="flex justify-between items-start leading-none">
                    <span className="text-[10px] font-bold truncate max-w-[120px]">
                      {sampleItem.name}
                    </span>
                    <span className="text-[10px] font-bold">
                      ₹{Number(sampleItem.price || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="text-[9px] font-mono text-gray-600">
                    SKU: {sampleItem.code} {sampleItem.mrp ? `| MRP: ₹${sampleItem.mrp}` : ""}
                  </div>

                  <div className="flex flex-col items-center mt-1">
                    {/* Simulated Barcode */}
                    <div className="w-full h-7 bg-black flex items-center justify-around px-1">
                      {Array.from({ length: 32 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="bg-white h-full"
                          style={{ width: idx % 3 === 0 ? "2px" : "1px" }}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] font-mono mt-0.5 tracking-wider">
                      {sampleItem.barcode || sampleItem.code}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* PRN Script View */
              <div className="flex-1 min-h-[220px] bg-theme-surface-1 border border-theme-divider rounded-2xl p-4 font-mono text-xs text-cyan-300 overflow-auto relative scrollbar-none">
                <pre className="whitespace-pre-wrap">{rawPRNScript}</pre>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleCopyScript}
                className="px-4 py-2 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy PRN Script"}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPRN}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg"
                >
                  <Download size={14} /> Download .PRN File
                </button>

                <button
                  onClick={handlePrint}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Printer size={14} /> Dispatch Print
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
