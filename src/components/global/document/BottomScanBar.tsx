/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useRef, useEffect } from "react";
import { Barcode, Search, Plus, AlertCircle, CheckCircle2, Loader2, CornerDownLeft } from "lucide-react";
import { BottomScanBarProps } from "./types.ts";

export const BottomScanBar: React.FC<BottomScanBarProps> = ({
  onScanProduct,
  disabled = false,
  placeholder = "Scan barcode or type SKU / Item name and press Enter...",
  defaultQty = 1,
}) => {
  const [scanQuery, setScanQuery] = useState("");
  const [quantity, setQuantity] = useState(defaultQty);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = scanQuery.trim();
    if (!query || disabled || isProcessing) return;

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const success = await onScanProduct(query, quantity);
      if (success) {
        setScanQuery("");
        setQuantity(defaultQty);
        setStatusMessage({ text: `Added / updated line for '${query}'`, type: "success" });
      } else {
        setStatusMessage({ text: `Item not found for barcode/code: '${query}'`, type: "error" });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to process barcode scan", type: "error" });
    } finally {
      setIsProcessing(false);
      // Auto refocus input for rapid continuous scanning
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  };

  return (
    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3 shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Barcode Scanner Icon Indicator */}
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 shrink-0 font-mono text-xs font-semibold">
          <Barcode size={18} className="animate-pulse" />
          <span className="hidden sm:inline">QUICK SCAN</span>
        </div>

        {/* Barcode / SKU Query Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={scanQuery}
            onChange={(e) => {
              setScanQuery(e.target.value);
              if (statusMessage) setStatusMessage(null);
            }}
            disabled={disabled || isProcessing}
            placeholder={placeholder}
            className="w-full bg-theme-surface-1 border border-theme-divider focus:border-blue-500 rounded-lg pl-9 pr-24 py-2 text-sm text-theme-primary placeholder:text-theme-muted/60 focus:outline-hidden font-mono tracking-tight"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-theme-muted font-mono bg-theme-surface-3 px-1.5 py-0.5 rounded border border-theme-divider">
            <CornerDownLeft size={10} />
            <span>ENTER</span>
          </div>
        </div>

        {/* Qty Modifier */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-theme-muted font-mono">Qty:</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={disabled || isProcessing}
            className="w-16 bg-theme-surface-1 border border-theme-divider focus:border-blue-500 rounded-lg px-2.5 py-2 text-sm text-center text-theme-primary focus:outline-hidden font-mono"
          />
        </div>

        {/* Submit Action Button */}
        <button
          type="submit"
          disabled={disabled || isProcessing || !scanQuery.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Scanning...</span>
            </>
          ) : (
            <>
              <Plus size={14} />
              <span>Add Line</span>
            </>
          )}
        </button>
      </form>

      {/* Status Feedback Notice */}
      {statusMessage && (
        <div
          className={`mt-2 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md font-mono transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 size={14} className="shrink-0" />
          ) : (
            <AlertCircle size={14} className="shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};
