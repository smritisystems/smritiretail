/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.1
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Contextual Field Inspector HUD (Real-Time Reactive Assistant)
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useActiveField } from "../../context/ActiveFieldContext.tsx";
import { useDrillDown } from "./drilldown_store.tsx";

export const ContextualInspectorHUD: React.FC = () => {
  const { category, fieldLabel, fieldValue, isInputFocused } = useActiveField();
  const { setSearchOpen } = useDrillDown();
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-expand HUD when focus moves to a contextual field
  useEffect(() => {
    if (category !== "general") {
      setIsMinimized(false);
    }
  }, [category]);

  // If no input is focused and category is general, hide HUD
  if (!isInputFocused && category === "general") {
    return null;
  }

  return (
    <div className="fixed bottom-12 right-6 z-40 select-none font-sans">
      <AnimatePresence>
        {!isMinimized ? (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="bg-white/95 backdrop-blur-md border border-[#c5c5d4] shadow-xl rounded-2xl p-3.5 w-80 text-[#0b1c30] border-l-4 border-l-[#24389c]"
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-[#e1e2ec]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#24389c] text-[18px]">
                  {category === "product" ? "barcode_scanner" :
                   category === "customer" ? "person_search" :
                   category === "supplier" ? "local_shipping" :
                   category === "invoice" ? "receipt_long" : "info"}
                </span>
                <span className="text-xs font-bold text-[#0b1c30] truncate">
                  {fieldLabel}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  title="Minimize Inspector HUD"
                  className="p-1 text-[#757684] hover:text-[#0b1c30] rounded-md transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">remove</span>
                </button>
              </div>
            </div>

            {/* Context Content */}
            <div className="py-2.5">
              {category === "product" && (
                <div className="text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[#565975]">
                    <span>Target Entity:</span>
                    <span className="font-semibold text-[#0b1c30] bg-slate-100 px-1.5 py-0.5 rounded">
                      Product / Barcode
                    </span>
                  </div>
                  {fieldValue ? (
                    <div className="p-2 bg-indigo-50/70 rounded-lg border border-indigo-100 text-[11px]">
                      <span className="text-indigo-900 font-medium block">Active Query:</span>
                      <span className="font-mono text-indigo-700 font-bold truncate block">{fieldValue}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#757684] italic">
                      Scan or type barcode/SKU to inspect stock, MRP, tax rate, and variants.
                    </p>
                  )}
                </div>
              )}

              {category === "customer" && (
                <div className="text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[#565975]">
                    <span>Target Entity:</span>
                    <span className="font-semibold text-[#0b1c30] bg-slate-100 px-1.5 py-0.5 rounded">
                      Customer / Client
                    </span>
                  </div>
                  {fieldValue ? (
                    <div className="p-2 bg-indigo-50/70 rounded-lg border border-indigo-100 text-[11px]">
                      <span className="text-indigo-900 font-medium block">Active Query:</span>
                      <span className="font-mono text-indigo-700 font-bold truncate block">{fieldValue}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#757684] italic">
                      Enter mobile number or name to inspect loyalty points and credit limits.
                    </p>
                  )}
                </div>
              )}

              {category === "supplier" && (
                <div className="text-xs space-y-1.5">
                  <p className="text-[11px] text-[#757684]">
                    Supplier mode active. Search vendor details, GSTIN, and pending PO balances.
                  </p>
                </div>
              )}

              {category === "invoice" && (
                <div className="text-xs space-y-1.5">
                  <p className="text-[11px] text-[#757684]">
                    Invoice mode active. Search historical tax invoices, dates, and amounts.
                  </p>
                </div>
              )}

              {category === "general" && (
                <div className="text-xs space-y-1.5">
                  <p className="text-[11px] text-[#757684]">
                    Global search assistant ready. Press Ctrl+K to search all entities.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Action Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-full py-1.5 bg-[#24389c] hover:bg-[#1b2b7b] text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[15px]">search</span>
              <span>Search in {category === "product" ? "Product Catalog" : category === "customer" ? "Customer Directory" : "Global System"}</span>
              <span className="text-[10px] font-mono bg-white/20 px-1 py-0.5 rounded">Ctrl+K</span>
            </button>
          </motion.div>
        ) : (
          <motion.button
            type="button"
            onClick={() => setIsMinimized(false)}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 bg-[#24389c] text-white px-3 py-2 rounded-full shadow-lg hover:bg-[#1b2b7b] transition-all text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[16px]">
              {category === "product" ? "barcode_scanner" :
               category === "customer" ? "person_search" : "info"}
            </span>
            <span>{fieldLabel}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
