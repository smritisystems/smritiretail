/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-07-10
 * Modified     : 2026-09-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Purchase Order / Indent Generation (SMRITI 9 Professional Terminal)
 */

import React, { useState } from "react";
import { PoGenerateTab } from "./purchase/PoGenerateTab.tsx";
import { PoSizewiseTab } from "./purchase/PoSizewiseTab.tsx";
import { Product } from "../types.ts";

interface PurchaseStudioTabProps {
  products?: Product[];
  onRefreshProducts?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  currentUser?: { role: string; name: string } | null;
  onClose?: () => void;
  onNavigateTab?: (tab: string) => void;
  initialMode?: "standard" | "sizewise";
}

export const PurchaseStudioTab: React.FC<PurchaseStudioTabProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser,
  onClose,
  onNavigateTab,
  initialMode,
}) => {
  const [poMode, setPoMode] = useState<"standard" | "sizewise">(() => {
    if (initialMode) return initialMode;
    try {
      const saved = localStorage.getItem("smriti_po_ux_mode");
      if (saved === "standard" || saved === "sizewise") return saved;
    } catch {
      // localStorage unavailable
    }
    return "sizewise";
  });

  const handleModeChange = (mode: "standard" | "sizewise") => {
    setPoMode(mode);
    try {
      localStorage.setItem("smriti_po_ux_mode", mode);
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* PO Mode Switcher Header Pill */}
      <div className="bg-slate-900 text-white px-4 py-1.5 flex items-center justify-between text-xs border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-indigo-400 text-base">tune</span>
          <span className="font-semibold text-slate-300">PO Generation Mode:</span>
          <div className="inline-flex rounded-md shadow-xs bg-slate-800 p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => handleModeChange("sizewise")}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                poMode === "sizewise"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">view_column</span>
              Sizewise Matrix UX
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("standard")}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                poMode === "standard"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">table_rows</span>
              Standard Grid UX
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">F2</kbd> to search items</span>
          <span>·</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">Ctrl+S</kbd> to save draft</span>
        </div>
      </div>

      {/* PO Content Area */}
      <div className="flex-1 min-h-0">
        {poMode === "sizewise" ? (
          <PoSizewiseTab
            products={products}
            currentUser={currentUser}
            onNotification={onNotification}
            onClose={onClose}
            onNavigateTab={onNavigateTab}
          />
        ) : (
          <PoGenerateTab
            products={products}
            currentUser={currentUser}
            onNotification={onNotification}
            onClose={onClose}
            onNavigateTab={onNavigateTab}
          />
        )}
      </div>
    </div>
  );
};

export default PurchaseStudioTab;
